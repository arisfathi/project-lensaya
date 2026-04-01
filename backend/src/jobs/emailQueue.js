import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { env } from "../config/env.js";
import { emailService } from "../services/emailService.js";
import { createQueue, isQueueAvailable } from "./queueFactory.js";

export const EMAIL_QUEUE_NAME = "emailQueue";
export const emailQueue = createQueue(EMAIL_QUEUE_NAME);
const canRunInlineFallback = !env.isProduction;

const runInlineEmailJob = async (jobName, payload, reason) => {
  logger.warn(
    {
      queue: EMAIL_QUEUE_NAME,
      jobName,
      requestId: payload?.requestId || null,
      reason,
      mode: "inline-fallback",
    },
    "Running email delivery inline because queue is unavailable"
  );

  try {
    if (jobName === "booking-confirmation") {
      const result = await emailService.sendBookingNotification(payload?.email, payload?.summary || "");
      return { fallback: true, result };
    }

    if (jobName === "welcome-email") {
      const result = await emailService.sendWelcome(payload?.email, payload?.fullName || "there");
      return { fallback: true, result };
    }

    if (jobName === "verification-email") {
      const result = await emailService.sendVerificationEmail(
        payload?.email,
        payload?.fullName || "there",
        payload?.token || ""
      );
      return { fallback: true, result };
    }

    logger.warn({ queue: EMAIL_QUEUE_NAME, jobName }, "Unknown email job ignored");
    return null;
  } catch (error) {
    logger.error(
      {
        err: error,
        queue: EMAIL_QUEUE_NAME,
        jobName,
        requestId: payload?.requestId || null,
      },
      "Inline email fallback failed"
    );
    captureException(error, {
      queue: EMAIL_QUEUE_NAME,
      jobName,
      mode: "inline-fallback",
      requestId: payload?.requestId || null,
    });
    return null;
  }
};

const enqueueEmailJob = async (jobName, payload) => {
  if (!isQueueAvailable) {
    if (!canRunInlineFallback) {
      logger.warn(
        {
          queue: EMAIL_QUEUE_NAME,
          jobName,
          requestId: payload?.requestId || null,
          reason: "redis-disabled",
          mode: "dropped",
        },
        "Skipping inline email fallback in production"
      );
      return null;
    }
    return runInlineEmailJob(jobName, payload, "redis-disabled");
  }

  try {
    return await emailQueue.add(jobName, payload);
  } catch (error) {
    logger.error(
      {
        err: error,
        queue: EMAIL_QUEUE_NAME,
        jobName,
        requestId: payload?.requestId || null,
      },
      "Failed to enqueue email job"
    );
    captureException(error, {
      queue: EMAIL_QUEUE_NAME,
      jobName,
      requestId: payload?.requestId || null,
    });
    if (!canRunInlineFallback) {
      logger.warn(
        {
          queue: EMAIL_QUEUE_NAME,
          jobName,
          requestId: payload?.requestId || null,
          reason: "enqueue-failed",
          mode: "dropped",
        },
        "Skipping inline email fallback in production"
      );
      return null;
    }
    return runInlineEmailJob(jobName, payload, "enqueue-failed");
  }
};

export const enqueueBookingConfirmationEmail = async (payload) =>
  enqueueEmailJob("booking-confirmation", payload);

export const enqueueWelcomeEmail = async (payload) => {
  return enqueueEmailJob("welcome-email", payload);
};
export const enqueueVerificationEmail = async (payload) => {
  return enqueueEmailJob("verification-email", payload);
};