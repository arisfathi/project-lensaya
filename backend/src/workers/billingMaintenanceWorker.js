import { Worker } from "bullmq";
import { redis, isRedisConfigured } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { captureException, flushSentry } from "../config/sentry.js";
import {
  BILLING_MAINTENANCE_EVERY_MS,
  BILLING_MAINTENANCE_JOB_NAME,
  BILLING_MAINTENANCE_QUEUE_NAME,
  billingMaintenanceQueue,
  scheduleBillingMaintenanceJob,
} from "../jobs/billingMaintenanceQueue.js";
import { processBillingMaintenanceJob } from "../jobs/processors/billingMaintenanceProcessor.js";
import { startWorkerHeartbeat } from "../jobs/workerHeartbeat.js";

let worker = null;
let maintenanceTimer = null;
let maintenanceInProgress = false;
let heartbeat = null;

const runMaintenance = async (meta = {}) => {
  if (maintenanceInProgress) {
    logger.warn(
      { mode: meta.mode || "unknown" },
      "Billing maintenance run skipped because previous run is still in progress"
    );
    return { skipped: true };
  }

  maintenanceInProgress = true;
  try {
    const result = await processBillingMaintenanceJob(
      { batchSize: env.billingMaintenance.batchSize },
      {
        mode: meta.mode || "queue",
        queue: BILLING_MAINTENANCE_QUEUE_NAME,
        jobId: meta.jobId || null,
      }
    );

    logger.info(
      {
        ...meta,
        scanned: result.scanned || 0,
        transitioned: result.transitioned || 0,
        pastDue: result.pastDue || 0,
        canceled: result.canceled || 0,
        expired: result.expired || 0,
        errors: result.errors || 0,
      },
      "Billing maintenance job completed"
    );

    return result;
  } catch (error) {
    logger.error({ err: error, ...meta }, "Billing maintenance job failed");
    captureException(error, {
      queue: BILLING_MAINTENANCE_QUEUE_NAME,
      ...meta,
    });
    throw error;
  } finally {
    maintenanceInProgress = false;
  }
};

const setupRedisWorker = () => {
  worker = new Worker(
    BILLING_MAINTENANCE_QUEUE_NAME,
    async (job) => {
      if (job.name !== BILLING_MAINTENANCE_JOB_NAME) {
        logger.warn(
          { queue: BILLING_MAINTENANCE_QUEUE_NAME, jobId: job.id, jobName: job.name },
          "Unknown billing maintenance job ignored"
        );
        return { ignored: true };
      }

      return runMaintenance({
        mode: "queue",
        queue: BILLING_MAINTENANCE_QUEUE_NAME,
        jobId: job.id,
      });
    },
    {
      connection: redis,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, error) => {
    logger.error(
      { err: error, queue: BILLING_MAINTENANCE_QUEUE_NAME, jobId: job?.id || null },
      "Billing maintenance job failed"
    );
    captureException(error, {
      queue: BILLING_MAINTENANCE_QUEUE_NAME,
      jobId: job?.id || null,
    });
  });
};

const startTimerFallback = (reason = "fallback") => {
  if (maintenanceTimer) return;
  void heartbeat?.setMode("timer-fallback");

  runMaintenance({ mode: "timer", trigger: "startup", reason }).catch(() => {
    // Error already logged in runMaintenance. Keep process alive for next interval retry.
  });

  maintenanceTimer = setInterval(() => {
    runMaintenance({ mode: "timer", trigger: "interval", reason }).catch(() => {
      // Error already logged in runMaintenance.
    });
  }, BILLING_MAINTENANCE_EVERY_MS);

  logger.info(
    {
      mode: "timer",
      intervalMs: BILLING_MAINTENANCE_EVERY_MS,
      batchSize: env.billingMaintenance.batchSize,
      reason,
    },
    "Billing maintenance timer started"
  );
};

const bootstrap = async () => {
  if (!env.billingMaintenance.enabled) {
    logger.info(
      {
        queue: BILLING_MAINTENANCE_QUEUE_NAME,
        enabled: false,
      },
      "Billing maintenance worker is disabled by BILLING_MAINTENANCE_ENABLED"
    );
    await billingMaintenanceQueue.close();
    await prisma.$disconnect();
    if (redis) {
      await redis.quit();
    }
    await flushSentry();
    process.exit(0);
  }

  if (isRedisConfigured && redis) {
    heartbeat = await startWorkerHeartbeat({
      queue: BILLING_MAINTENANCE_QUEUE_NAME,
      workerType: "billing-maintenance",
      mode: "queue",
    });
    setupRedisWorker();
    const scheduledJob = await scheduleBillingMaintenanceJob();

    if (!scheduledJob) {
      void heartbeat.setMode("queue+timer-fallback");
      logger.warn(
        {
          mode: "queue",
          queue: BILLING_MAINTENANCE_QUEUE_NAME,
          intervalMs: BILLING_MAINTENANCE_EVERY_MS,
          reason: "repeat-schedule-failed",
        },
        "Failed to schedule repeat billing maintenance job, enabling timer fallback"
      );
      startTimerFallback("repeat-schedule-failed");
    }

    logger.info(
      {
        mode: "queue",
        queue: BILLING_MAINTENANCE_QUEUE_NAME,
        intervalMs: BILLING_MAINTENANCE_EVERY_MS,
        batchSize: env.billingMaintenance.batchSize,
        repeatScheduled: Boolean(scheduledJob),
        workerId: heartbeat.workerId,
      },
      "Billing maintenance worker started"
    );
    return;
  }

  logger.warn(
    { mode: "timer", intervalMs: BILLING_MAINTENANCE_EVERY_MS },
    "REDIS_URL missing, running billing maintenance on local timer fallback"
  );
  heartbeat = await startWorkerHeartbeat({
    queue: BILLING_MAINTENANCE_QUEUE_NAME,
    workerType: "billing-maintenance",
    mode: "timer-fallback",
  });

  startTimerFallback("redis-disabled");
};

const shutdown = async (signal) => {
  logger.info({ signal, queue: BILLING_MAINTENANCE_QUEUE_NAME }, "Stopping billing maintenance worker");
  if (heartbeat) {
    await heartbeat.stop();
    heartbeat = null;
  }
  if (maintenanceTimer) {
    clearInterval(maintenanceTimer);
    maintenanceTimer = null;
  }
  if (worker) {
    await worker.close();
    worker = null;
  }
  await billingMaintenanceQueue.close();
  await prisma.$disconnect();
  if (redis) {
    await redis.quit();
  }
  await flushSentry();
  process.exit(0);
};

bootstrap().catch(async (error) => {
  logger.error({ err: error, queue: BILLING_MAINTENANCE_QUEUE_NAME }, "Failed to bootstrap billing maintenance worker");
  captureException(error, { queue: BILLING_MAINTENANCE_QUEUE_NAME, action: "bootstrap" });
  await flushSentry();
  process.exit(1);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
