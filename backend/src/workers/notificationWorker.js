import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { captureException, flushSentry } from "../config/sentry.js";
import { redis, isRedisConfigured } from "../config/redis.js";
import { prisma } from "../config/prisma.js";
import {
  NOTIFICATION_CREATE_JOB,
  NOTIFICATION_CREATE_MANY_JOB,
  NOTIFICATION_REMINDER_SCAN_JOB,
  NOTIFICATION_REMINDER_EVERY_MS,
  NOTIFICATION_QUEUE_NAME,
  scheduleNotificationReminderJob,
} from "../jobs/notificationQueue.js";
import { processNotificationCreateJob, processNotificationCreateManyJob } from "../jobs/processors/notificationProcessor.js";
import { processNotificationReminderScanJob } from "../jobs/processors/notificationReminderProcessor.js";
import { startWorkerHeartbeat } from "../jobs/workerHeartbeat.js";

let worker = null;
let heartbeat = null;
let reminderTimer = null;
let reminderInProgress = false;

const runReminderScan = async (meta = {}) => {
  if (!env.notificationReminders.enabled) {
    return { skipped: true, reason: "disabled" };
  }

  if (reminderInProgress) {
    logger.warn({ mode: meta.mode || "unknown" }, "Notification reminder scan skipped because previous run is still in progress");
    return { skipped: true, reason: "in-progress" };
  }

  reminderInProgress = true;
  try {
    return await processNotificationReminderScanJob(
      { batchSize: env.notificationReminders.scanBatchSize },
      {
        mode: meta.mode || "queue",
        queue: NOTIFICATION_QUEUE_NAME,
        jobId: meta.jobId || null,
      }
    );
  } finally {
    reminderInProgress = false;
  }
};

const startReminderTimerFallback = (reason = "fallback") => {
  if (reminderTimer || !env.notificationReminders.enabled) return;

  void heartbeat?.setMode(worker ? "queue+timer-fallback" : "timer-fallback");

  runReminderScan({ mode: "timer", trigger: "startup", reason }).catch((error) => {
    logger.error({ err: error, reason }, "Notification reminder startup timer run failed");
    captureException(error, {
      queue: NOTIFICATION_QUEUE_NAME,
      action: "reminder-startup-timer",
      reason,
    });
  });

  reminderTimer = setInterval(() => {
    runReminderScan({ mode: "timer", trigger: "interval", reason }).catch((error) => {
      logger.error({ err: error, reason }, "Notification reminder interval timer run failed");
      captureException(error, {
        queue: NOTIFICATION_QUEUE_NAME,
        action: "reminder-interval-timer",
        reason,
      });
    });
  }, NOTIFICATION_REMINDER_EVERY_MS);

  logger.info(
    {
      mode: worker ? "queue+timer-fallback" : "timer-fallback",
      intervalMs: NOTIFICATION_REMINDER_EVERY_MS,
      batchSize: env.notificationReminders.scanBatchSize,
      reason,
    },
    "Notification reminder timer started"
  );
};

const setupQueueWorker = () => {
  worker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      if (job.name === NOTIFICATION_CREATE_JOB) {
        return processNotificationCreateJob(job.data, {
          mode: "queue",
          queue: NOTIFICATION_QUEUE_NAME,
          jobId: job.id,
        });
      }

      if (job.name === NOTIFICATION_CREATE_MANY_JOB) {
        return processNotificationCreateManyJob(job.data, {
          mode: "queue",
          queue: NOTIFICATION_QUEUE_NAME,
          jobId: job.id,
        });
      }

      if (job.name === NOTIFICATION_REMINDER_SCAN_JOB) {
        return runReminderScan({
          mode: "queue",
          queue: NOTIFICATION_QUEUE_NAME,
          jobId: job.id,
        });
      }

      logger.warn(
        { queue: NOTIFICATION_QUEUE_NAME, jobId: job.id, jobName: job.name },
        "Unknown notification job ignored"
      );
      return { ignored: true };
    },
    {
      connection: redis,
      concurrency: env.workerConcurrency.notification,
    }
  );

  worker.on("completed", (job) => {
    logger.info({ queue: NOTIFICATION_QUEUE_NAME, jobId: job.id, jobName: job.name }, "Notification job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { err: error, queue: NOTIFICATION_QUEUE_NAME, jobId: job?.id || null, requestId: job?.data?.requestId || null },
      "Notification job failed"
    );
    captureException(error, {
      queue: NOTIFICATION_QUEUE_NAME,
      jobId: job?.id || null,
      requestId: job?.data?.requestId || null,
    });
  });
};

const bootstrap = async () => {
  if (isRedisConfigured && redis) {
    heartbeat = await startWorkerHeartbeat({
      queue: NOTIFICATION_QUEUE_NAME,
      workerType: "notification",
      mode: "queue",
    });

    setupQueueWorker();

    if (env.notificationReminders.enabled) {
      const scheduledReminderJob = await scheduleNotificationReminderJob({
        batchSize: env.notificationReminders.scanBatchSize,
      });

      if (!scheduledReminderJob) {
        logger.warn(
          {
            mode: "queue",
            queue: NOTIFICATION_QUEUE_NAME,
            intervalMs: NOTIFICATION_REMINDER_EVERY_MS,
            reason: "repeat-schedule-failed",
          },
          "Failed to schedule repeat notification reminder job, enabling timer fallback"
        );
        startReminderTimerFallback("repeat-schedule-failed");
      }

      logger.info(
        {
          queue: NOTIFICATION_QUEUE_NAME,
          remindersEnabled: true,
          reminderIntervalMs: NOTIFICATION_REMINDER_EVERY_MS,
          reminderBatchSize: env.notificationReminders.scanBatchSize,
          reminderRepeatScheduled: Boolean(scheduledReminderJob),
          concurrency: env.workerConcurrency.notification,
          workerId: heartbeat.workerId,
        },
        "Notification worker started"
      );
      return;
    }

    logger.info(
      {
        queue: NOTIFICATION_QUEUE_NAME,
        remindersEnabled: false,
        concurrency: env.workerConcurrency.notification,
        workerId: heartbeat.workerId,
      },
      "Notification worker started"
    );
    return;
  }

  logger.warn(
    { queue: NOTIFICATION_QUEUE_NAME, mode: "timer-fallback" },
    "REDIS_URL missing, notification queue disabled; reminder scans run on local timer fallback"
  );

  heartbeat = await startWorkerHeartbeat({
    queue: NOTIFICATION_QUEUE_NAME,
    workerType: "notification",
    mode: "timer-fallback",
  });

  if (env.notificationReminders.enabled) {
    startReminderTimerFallback("redis-disabled");
  }

  logger.info(
    {
      queue: NOTIFICATION_QUEUE_NAME,
      remindersEnabled: env.notificationReminders.enabled,
      reminderIntervalMs: env.notificationReminders.intervalMs,
      reminderBatchSize: env.notificationReminders.scanBatchSize,
      workerId: heartbeat.workerId,
      mode: "timer-fallback",
    },
    "Notification worker started"
  );
};

const shutdown = async (signal) => {
  logger.info({ signal, queue: NOTIFICATION_QUEUE_NAME }, "Stopping notification worker");
  if (heartbeat) {
    await heartbeat.stop();
    heartbeat = null;
  }
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
  if (worker) {
    await worker.close();
    worker = null;
  }
  await prisma.$disconnect();
  if (redis) {
    await redis.quit();
  }
  await flushSentry();
  process.exit(0);
};

bootstrap().catch(async (error) => {
  logger.error({ err: error, queue: NOTIFICATION_QUEUE_NAME }, "Failed to bootstrap notification worker");
  captureException(error, { queue: NOTIFICATION_QUEUE_NAME, action: "bootstrap" });
  await flushSentry();
  process.exit(1);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
