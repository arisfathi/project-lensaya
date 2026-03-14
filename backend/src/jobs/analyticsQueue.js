import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { createQueue, isQueueAvailable } from "./queueFactory.js";
import { processAnalyticsEventJob } from "./processors/analyticsProcessor.js";

export const ANALYTICS_QUEUE_NAME = "analyticsQueue";
export const analyticsQueue = createQueue(ANALYTICS_QUEUE_NAME);

const runInlineAnalyticsProcessing = async (payload, reason) => {
  logger.warn(
    {
      queue: ANALYTICS_QUEUE_NAME,
      requestId: payload?.requestId || null,
      reason,
      mode: "inline-fallback",
    },
    "Running analytics processing inline because queue is unavailable"
  );

  try {
    const result = await processAnalyticsEventJob(payload, {
      mode: "inline-fallback",
      queue: ANALYTICS_QUEUE_NAME,
    });
    return { fallback: true, result };
  } catch (error) {
    logger.error(
      { err: error, requestId: payload?.requestId || null, queue: ANALYTICS_QUEUE_NAME },
      "Inline analytics processing fallback failed"
    );
    captureException(error, {
      queue: ANALYTICS_QUEUE_NAME,
      mode: "inline-fallback",
      requestId: payload?.requestId || null,
    });
    return null;
  }
};

export const enqueueAnalyticsEventProcessing = async (payload) => {
  if (!isQueueAvailable) {
    return runInlineAnalyticsProcessing(payload, "redis-disabled");
  }

  try {
    return await analyticsQueue.add("analytics-process", payload);
  } catch (error) {
    logger.error({ err: error, requestId: payload?.requestId || null }, "Failed to enqueue analytics job");
    captureException(error, {
      queue: ANALYTICS_QUEUE_NAME,
      jobName: "analytics-process",
      requestId: payload?.requestId || null,
    });
    return runInlineAnalyticsProcessing(payload, "enqueue-failed");
  }
};
