import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { captureException, flushSentry } from "../config/sentry.js";
import { redis, isRedisConfigured } from "../config/redis.js";
import { prisma } from "../config/prisma.js";
import { IMAGE_PROCESSING_QUEUE_NAME } from "../jobs/imageProcessingQueue.js";
import { processImageResizeJob } from "../jobs/processors/imageProcessingProcessor.js";
import { startWorkerHeartbeat } from "../jobs/workerHeartbeat.js";

if (!isRedisConfigured || !redis) {
  logger.warn("Image-processing worker is disabled because REDIS_URL is missing");
  await prisma.$disconnect();
  process.exit(0);
}

const worker = new Worker(
  IMAGE_PROCESSING_QUEUE_NAME,
  async (job) => {
    if (job.name !== "image-resize") {
      logger.warn(
        { queue: IMAGE_PROCESSING_QUEUE_NAME, jobId: job.id, jobName: job.name },
        "Unknown image-processing job ignored"
      );
      return { ignored: true };
    }

    return processImageResizeJob(job.data, {
      mode: "queue",
      queue: IMAGE_PROCESSING_QUEUE_NAME,
      jobId: job.id,
    });
  },
  {
    connection: redis,
    concurrency: env.queueConcurrency,
  }
);
const heartbeat = await startWorkerHeartbeat({
  queue: IMAGE_PROCESSING_QUEUE_NAME,
  workerType: "image-processing",
  mode: "queue",
});

worker.on("completed", (job) => {
  logger.info({ queue: IMAGE_PROCESSING_QUEUE_NAME, jobId: job.id, jobName: job.name }, "Image job completed");
});

worker.on("failed", (job, error) => {
  logger.error(
    {
      err: error,
      queue: IMAGE_PROCESSING_QUEUE_NAME,
      jobId: job?.id || null,
      requestId: job?.data?.requestId || null,
    },
    "Image processing job failed"
  );
  captureException(error, {
    queue: IMAGE_PROCESSING_QUEUE_NAME,
    jobId: job?.id || null,
    requestId: job?.data?.requestId || null,
  });
});

logger.info(
  { queue: IMAGE_PROCESSING_QUEUE_NAME, concurrency: env.queueConcurrency, workerId: heartbeat.workerId },
  "Image-processing worker started"
);

const shutdown = async (signal) => {
  logger.info({ signal, queue: IMAGE_PROCESSING_QUEUE_NAME }, "Stopping image-processing worker");
  await heartbeat.stop();
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  await flushSentry();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
