import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { env } from "../config/env.js";
import { createQueue, isQueueAvailable } from "./queueFactory.js";
import { processNotificationCreateJob, processNotificationCreateManyJob } from "./processors/notificationProcessor.js";

export const NOTIFICATION_QUEUE_NAME = "notificationQueue";
export const notificationQueue = createQueue(NOTIFICATION_QUEUE_NAME);
const canRunInlineFallback = !env.isProduction;

export const NOTIFICATION_CREATE_JOB = "notification-create";
export const NOTIFICATION_CREATE_MANY_JOB = "notification-create-many";
export const NOTIFICATION_REMINDER_SCAN_JOB = "notification-reminder-scan";
export const NOTIFICATION_REMINDER_REPEAT_JOB_ID = "notification-reminder-scan-repeat";
export const NOTIFICATION_REMINDER_EVERY_MS = env.notificationReminders.intervalMs;

const runInlineNotificationJob = async (jobName, payload, reason) => {
  logger.warn(
    {
      queue: NOTIFICATION_QUEUE_NAME,
      jobName,
      requestId: payload?.requestId || null,
      reason,
      mode: "inline-fallback",
    },
    "Running notification processing inline because queue is unavailable"
  );

  try {
    if (jobName === NOTIFICATION_CREATE_MANY_JOB) {
      const result = await processNotificationCreateManyJob(payload, {
        mode: "inline-fallback",
        queue: NOTIFICATION_QUEUE_NAME,
      });
      return { fallback: true, result };
    }

    const result = await processNotificationCreateJob(payload, {
      mode: "inline-fallback",
      queue: NOTIFICATION_QUEUE_NAME,
    });
    return { fallback: true, result };
  } catch (error) {
    logger.error(
      {
        err: error,
        queue: NOTIFICATION_QUEUE_NAME,
        jobName,
        requestId: payload?.requestId || null,
      },
      "Inline notification processing fallback failed"
    );
    captureException(error, {
      queue: NOTIFICATION_QUEUE_NAME,
      jobName,
      mode: "inline-fallback",
      requestId: payload?.requestId || null,
    });
    return null;
  }
};

const enqueueNotificationJob = async (jobName, payload) => {
  if (!isQueueAvailable) {
    if (!canRunInlineFallback) {
      logger.warn(
        {
          queue: NOTIFICATION_QUEUE_NAME,
          jobName,
          requestId: payload?.requestId || null,
          reason: "redis-disabled",
          mode: "dropped",
        },
        "Skipping inline notification fallback in production"
      );
      return null;
    }
    return runInlineNotificationJob(jobName, payload, "redis-disabled");
  }

  try {
    return await notificationQueue.add(jobName, payload);
  } catch (error) {
    logger.error(
      { err: error, queue: NOTIFICATION_QUEUE_NAME, jobName, requestId: payload?.requestId || null },
      "Failed to enqueue notification job"
    );
    captureException(error, {
      queue: NOTIFICATION_QUEUE_NAME,
      jobName,
      requestId: payload?.requestId || null,
    });
    if (!canRunInlineFallback) {
      logger.warn(
        {
          queue: NOTIFICATION_QUEUE_NAME,
          jobName,
          requestId: payload?.requestId || null,
          reason: "enqueue-failed",
          mode: "dropped",
        },
        "Skipping inline notification fallback in production"
      );
      return null;
    }
    return runInlineNotificationJob(jobName, payload, "enqueue-failed");
  }
};

export const enqueueNotificationCreate = async (payload) =>
  enqueueNotificationJob(NOTIFICATION_CREATE_JOB, payload);

export const enqueueNotificationCreateMany = async (payload) =>
  enqueueNotificationJob(NOTIFICATION_CREATE_MANY_JOB, payload);

export const scheduleNotificationReminderJob = async (payload = {}) => {
  try {
    return await notificationQueue.add(
      NOTIFICATION_REMINDER_SCAN_JOB,
      payload,
      {
        jobId: NOTIFICATION_REMINDER_REPEAT_JOB_ID,
        repeat: {
          every: NOTIFICATION_REMINDER_EVERY_MS,
        },
      }
    );
  } catch (error) {
    logger.error({ err: error, queue: NOTIFICATION_QUEUE_NAME }, "Failed to schedule notification reminder job");
    captureException(error, {
      queue: NOTIFICATION_QUEUE_NAME,
      jobName: NOTIFICATION_REMINDER_SCAN_JOB,
      action: "schedule-repeat",
    });
    return null;
  }
};
