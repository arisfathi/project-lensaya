import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { createQueue, isQueueAvailable } from "./queueFactory.js";
import { processImageResizeJob } from "./processors/imageProcessingProcessor.js";

export const IMAGE_PROCESSING_QUEUE_NAME = "imageProcessingQueue";
export const imageProcessingQueue = createQueue(IMAGE_PROCESSING_QUEUE_NAME);

const runInlineImageProcessing = async (payload, reason) => {
  logger.warn(
    {
      queue: IMAGE_PROCESSING_QUEUE_NAME,
      requestId: payload?.requestId || null,
      reason,
      mode: "inline-fallback",
    },
    "Running image processing inline because queue is unavailable"
  );

  try {
    const result = await processImageResizeJob(payload, {
      mode: "inline-fallback",
      queue: IMAGE_PROCESSING_QUEUE_NAME,
    });
    return { fallback: true, result };
  } catch (error) {
    logger.error(
      { err: error, requestId: payload?.requestId || null, queue: IMAGE_PROCESSING_QUEUE_NAME },
      "Inline image processing fallback failed"
    );
    captureException(error, {
      queue: IMAGE_PROCESSING_QUEUE_NAME,
      mode: "inline-fallback",
      requestId: payload?.requestId || null,
    });
    return null;
  }
};

export const enqueueImageProcessing = async (payload) => {
  const options = {
    inlineFallback: payload?.inlineFallback !== false,
    jobId: payload?.jobId || (payload?.assetId ? `asset:${payload.assetId}` : undefined),
  };

  if (!isQueueAvailable) {
    if (!options.inlineFallback) {
      logger.warn(
        {
          queue: IMAGE_PROCESSING_QUEUE_NAME,
          requestId: payload?.requestId || null,
          reason: "redis-disabled",
          mode: "no-inline-fallback",
        },
        "Skipping image processing because queue is unavailable and inline fallback is disabled"
      );
      return null;
    }
    return runInlineImageProcessing(payload, "redis-disabled");
  }

  try {
    return await imageProcessingQueue.add(
      "image-resize",
      payload,
      {
        ...(options.jobId ? { jobId: options.jobId } : {}),
      }
    );
  } catch (error) {
    const duplicateJob = /job.+already exists/i.test(String(error?.message || ""));
    if (duplicateJob) {
      return null;
    }

    logger.error({ err: error, requestId: payload?.requestId || null }, "Failed to enqueue image processing job");
    captureException(error, {
      queue: IMAGE_PROCESSING_QUEUE_NAME,
      jobName: "image-resize",
      requestId: payload?.requestId || null,
    });
    if (!options.inlineFallback) {
      return null;
    }
    return runInlineImageProcessing(payload, "enqueue-failed");
  }
};
