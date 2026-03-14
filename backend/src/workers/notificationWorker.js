import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { captureException, flushSentry } from "../config/sentry.js";
import { redis, isRedisConfigured } from "../config/redis.js";
import { prisma } from "../config/prisma.js";
import {
  NOTIFICATION_CREATE_JOB,
  NOTIFICATION_CREATE_MANY_JOB,
  NOTIFICATION_QUEUE_NAME,
} from "../jobs/notificationQueue.js";
import { processNotificationCreateJob, processNotificationCreateManyJob } from "../jobs/processors/notificationProcessor.js";
import { startWorkerHeartbeat } from "../jobs/workerHeartbeat.js";

if (!isRedisConfigured || !redis) {
  logger.warn("Notification worker is disabled because REDIS_URL is missing");
  await prisma.$disconnect();
  process.exit(0);
}

const worker = new Worker(
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

    logger.warn(
      { queue: NOTIFICATION_QUEUE_NAME, jobId: job.id, jobName: job.name },
      "Unknown notification job ignored"
    );
    return { ignored: true };
  },
  {
    connection: redis,
    concurrency: env.queueConcurrency,
  }
);
const heartbeat = await startWorkerHeartbeat({
  queue: NOTIFICATION_QUEUE_NAME,
  workerType: "notification",
  mode: "queue",
});

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

logger.info(
  { queue: NOTIFICATION_QUEUE_NAME, concurrency: env.queueConcurrency, workerId: heartbeat.workerId },
  "Notification worker started"
);

const shutdown = async (signal) => {
  logger.info({ signal, queue: NOTIFICATION_QUEUE_NAME }, "Stopping notification worker");
  await heartbeat.stop();
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  await flushSentry();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
