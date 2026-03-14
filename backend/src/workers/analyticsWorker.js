import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { captureException, flushSentry } from "../config/sentry.js";
import { redis, isRedisConfigured } from "../config/redis.js";
import { prisma } from "../config/prisma.js";
import { ANALYTICS_QUEUE_NAME } from "../jobs/analyticsQueue.js";
import { processAnalyticsEventJob } from "../jobs/processors/analyticsProcessor.js";
import { startWorkerHeartbeat } from "../jobs/workerHeartbeat.js";

if (!isRedisConfigured || !redis) {
  logger.warn("Analytics worker is disabled because REDIS_URL is missing");
  await prisma.$disconnect();
  process.exit(0);
}

const worker = new Worker(
  ANALYTICS_QUEUE_NAME,
  async (job) => {
    if (job.name !== "analytics-process") {
      logger.warn({ queue: ANALYTICS_QUEUE_NAME, jobId: job.id, jobName: job.name }, "Unknown analytics job ignored");
      return { ignored: true };
    }

    return processAnalyticsEventJob(job.data, {
      mode: "queue",
      queue: ANALYTICS_QUEUE_NAME,
      jobId: job.id,
    });
  },
  {
    connection: redis,
    concurrency: env.queueConcurrency,
  }
);
const heartbeat = await startWorkerHeartbeat({
  queue: ANALYTICS_QUEUE_NAME,
  workerType: "analytics",
  mode: "queue",
});

worker.on("completed", (job) => {
  logger.info({ queue: ANALYTICS_QUEUE_NAME, jobId: job.id, jobName: job.name }, "Analytics job completed");
});

worker.on("failed", (job, error) => {
  logger.error(
    { err: error, queue: ANALYTICS_QUEUE_NAME, jobId: job?.id || null, requestId: job?.data?.requestId || null },
    "Analytics job failed"
  );
  captureException(error, {
    queue: ANALYTICS_QUEUE_NAME,
    jobId: job?.id || null,
    requestId: job?.data?.requestId || null,
  });
});

logger.info(
  { queue: ANALYTICS_QUEUE_NAME, concurrency: env.queueConcurrency, workerId: heartbeat.workerId },
  "Analytics worker started"
);

const shutdown = async (signal) => {
  logger.info({ signal, queue: ANALYTICS_QUEUE_NAME }, "Stopping analytics worker");
  await heartbeat.stop();
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  await flushSentry();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
