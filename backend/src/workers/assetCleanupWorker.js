import { Worker } from "bullmq";
import { redis, isRedisConfigured } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { captureException, flushSentry } from "../config/sentry.js";
import {
  ASSET_CLEANUP_EVERY_MS,
  ASSET_CLEANUP_JOB_NAME,
  ASSET_CLEANUP_QUEUE_NAME,
  assetCleanupQueue,
  scheduleAssetCleanupJob,
} from "../jobs/assetCleanupQueue.js";
import { assetLifecycleService } from "../services/assetLifecycleService.js";
import { startWorkerHeartbeat } from "../jobs/workerHeartbeat.js";

let worker = null;
let cleanupTimer = null;
let cleanupInProgress = false;
let heartbeat = null;

const runCleanup = async (meta = {}) => {
  if (cleanupInProgress) {
    logger.warn({ mode: meta.mode || "unknown" }, "Asset cleanup run skipped because previous run is still in progress");
    return { skipped: true };
  }

  cleanupInProgress = true;
  try {
    const result = await assetLifecycleService.purgeDeletedAssets({
      olderThanHours: 24,
    });

    logger.info(
      {
        ...meta,
        scanned: result.scanned,
        purged: result.purged,
        failed: result.failed,
      },
      "Asset cleanup job completed"
    );

    return result;
  } catch (error) {
    logger.error({ err: error, ...meta }, "Asset cleanup job failed");
    captureException(error, {
      queue: ASSET_CLEANUP_QUEUE_NAME,
      ...meta,
    });
    throw error;
  } finally {
    cleanupInProgress = false;
  }
};

const setupRedisWorker = () => {
  worker = new Worker(
    ASSET_CLEANUP_QUEUE_NAME,
    async (job) => {
      if (job.name !== ASSET_CLEANUP_JOB_NAME) {
        logger.warn(
          { queue: ASSET_CLEANUP_QUEUE_NAME, jobId: job.id, jobName: job.name },
          "Unknown asset cleanup job ignored"
        );
        return { ignored: true };
      }

      return runCleanup({
        mode: "queue",
        queue: ASSET_CLEANUP_QUEUE_NAME,
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
      { err: error, queue: ASSET_CLEANUP_QUEUE_NAME, jobId: job?.id || null },
      "Asset cleanup job failed"
    );
    captureException(error, {
      queue: ASSET_CLEANUP_QUEUE_NAME,
      jobId: job?.id || null,
    });
  });
};

const startTimerFallback = (reason = "fallback") => {
  if (cleanupTimer) return;
  void heartbeat?.setMode("timer-fallback");

  runCleanup({ mode: "timer", trigger: "startup", reason }).catch(() => {
    // Error already logged in runCleanup. Keep process alive for next interval retry.
  });

  cleanupTimer = setInterval(() => {
    runCleanup({ mode: "timer", trigger: "interval", reason }).catch(() => {
      // Error already logged in runCleanup.
    });
  }, ASSET_CLEANUP_EVERY_MS);

  logger.info(
    {
      mode: "timer",
      intervalMs: ASSET_CLEANUP_EVERY_MS,
      reason,
    },
    "Asset cleanup timer started"
  );
};

const bootstrap = async () => {
  if (!env.assetCleanup.enabled) {
    logger.info(
      {
        queue: ASSET_CLEANUP_QUEUE_NAME,
        enabled: false,
      },
      "Asset cleanup worker is disabled by ASSET_CLEANUP_ENABLED"
    );
    await assetCleanupQueue.close();
    await prisma.$disconnect();
    if (redis) {
      await redis.quit();
    }
    await flushSentry();
    process.exit(0);
  }

  if (isRedisConfigured && redis) {
    heartbeat = await startWorkerHeartbeat({
      queue: ASSET_CLEANUP_QUEUE_NAME,
      workerType: "asset-cleanup",
      mode: "queue",
    });
    setupRedisWorker();
    const scheduledJob = await scheduleAssetCleanupJob();

    if (!scheduledJob) {
      void heartbeat.setMode("queue+timer-fallback");
      logger.warn(
        {
          mode: "queue",
          queue: ASSET_CLEANUP_QUEUE_NAME,
          intervalMs: ASSET_CLEANUP_EVERY_MS,
          reason: "repeat-schedule-failed",
        },
        "Failed to schedule repeat asset cleanup job, enabling timer fallback"
      );
      startTimerFallback("repeat-schedule-failed");
    }

    logger.info(
      {
        mode: "queue",
        queue: ASSET_CLEANUP_QUEUE_NAME,
        intervalMs: ASSET_CLEANUP_EVERY_MS,
        concurrency: 1,
        defaultQueueConcurrency: env.queueConcurrency,
        repeatScheduled: Boolean(scheduledJob),
        workerId: heartbeat.workerId,
      },
      "Asset cleanup worker started"
    );

    return;
  }

  logger.warn(
    { mode: "timer", intervalMs: ASSET_CLEANUP_EVERY_MS },
    "REDIS_URL missing, running asset cleanup on local timer fallback"
  );
  heartbeat = await startWorkerHeartbeat({
    queue: ASSET_CLEANUP_QUEUE_NAME,
    workerType: "asset-cleanup",
    mode: "timer-fallback",
  });
  startTimerFallback("redis-disabled");
};

const shutdown = async (signal) => {
  logger.info({ signal, queue: ASSET_CLEANUP_QUEUE_NAME }, "Stopping asset cleanup worker");
  if (heartbeat) {
    await heartbeat.stop();
    heartbeat = null;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  if (worker) {
    await worker.close();
    worker = null;
  }
  await assetCleanupQueue.close();
  await prisma.$disconnect();
  if (redis) {
    await redis.quit();
  }
  await flushSentry();
  process.exit(0);
};

bootstrap().catch(async (error) => {
  logger.error({ err: error, queue: ASSET_CLEANUP_QUEUE_NAME }, "Failed to bootstrap asset cleanup worker");
  captureException(error, { queue: ASSET_CLEANUP_QUEUE_NAME, action: "bootstrap" });
  await flushSentry();
  process.exit(1);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
