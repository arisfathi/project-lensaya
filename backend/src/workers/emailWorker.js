import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { captureException, flushSentry } from "../config/sentry.js";
import { redis, isRedisConfigured } from "../config/redis.js";
import { EMAIL_QUEUE_NAME } from "../jobs/emailQueue.js";
import { startWorkerHeartbeat } from "../jobs/workerHeartbeat.js";
import { emailService } from "../services/emailService.js";

if (!isRedisConfigured || !redis) {
  logger.warn("Email worker is disabled because REDIS_URL is missing");
  process.exit(0);
}

const worker = new Worker(
  EMAIL_QUEUE_NAME,
  async (job) => {
    if (job.name === "booking-confirmation") {
      await emailService.sendBookingNotification(job.data.email, job.data.summary);
      return { delivered: true, bookingId: job.data.bookingId };
    }

    if (job.name === "welcome-email") {
      await emailService.sendWelcome(job.data.email, job.data.fullName || "there");
      return { delivered: true };
    }

    if (job.name === "verification-email") {
      await emailService.sendVerificationEmail(job.data.email, job.data.fullName || "there", job.data.token || "");
      return { delivered: true };
    }

    logger.warn({ queue: EMAIL_QUEUE_NAME, jobId: job.id, jobName: job.name }, "Unknown email job ignored");
    return { ignored: true };
  },
  {
    connection: redis,
    concurrency: env.workerConcurrency.email,
  }
);
const heartbeat = await startWorkerHeartbeat({
  queue: EMAIL_QUEUE_NAME,
  workerType: "email",
  mode: "queue",
});

worker.on("completed", (job) => {
  logger.info({ queue: EMAIL_QUEUE_NAME, jobId: job.id, jobName: job.name }, "Email job completed");
});

worker.on("failed", (job, error) => {
  logger.error(
    { err: error, queue: EMAIL_QUEUE_NAME, jobId: job?.id || null, requestId: job?.data?.requestId || null },
    "Email job failed"
  );
  captureException(error, {
    queue: EMAIL_QUEUE_NAME,
    jobId: job?.id || null,
    requestId: job?.data?.requestId || null,
  });
});

logger.info(
  { queue: EMAIL_QUEUE_NAME, concurrency: env.workerConcurrency.email, workerId: heartbeat.workerId },
  "Email worker started"
);

const shutdown = async (signal) => {
  logger.info({ signal, queue: EMAIL_QUEUE_NAME }, "Stopping email worker");
  await heartbeat.stop();
  await worker.close();
  await redis.quit();
  await flushSentry();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
