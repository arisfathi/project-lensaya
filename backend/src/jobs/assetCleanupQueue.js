import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { createQueue } from "./queueFactory.js";

export const ASSET_CLEANUP_QUEUE_NAME = "assetCleanupQueue";
export const ASSET_CLEANUP_JOB_NAME = "asset-purge";
export const ASSET_CLEANUP_REPEAT_JOB_ID = "asset-purge-hourly";
export const ASSET_CLEANUP_EVERY_MS = env.assetCleanup.intervalMs;

export const assetCleanupQueue = createQueue(ASSET_CLEANUP_QUEUE_NAME);

export const scheduleAssetCleanupJob = async () => {
  try {
    return await assetCleanupQueue.add(
      ASSET_CLEANUP_JOB_NAME,
      {},
      {
        jobId: ASSET_CLEANUP_REPEAT_JOB_ID,
        repeat: {
          every: ASSET_CLEANUP_EVERY_MS,
        },
      }
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to schedule asset cleanup job");
    captureException(error, {
      queue: ASSET_CLEANUP_QUEUE_NAME,
      jobName: ASSET_CLEANUP_JOB_NAME,
    });
    return null;
  }
};
