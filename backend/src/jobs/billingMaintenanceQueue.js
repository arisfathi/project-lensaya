import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { createQueue, isQueueAvailable } from "./queueFactory.js";
import { processBillingMaintenanceJob } from "./processors/billingMaintenanceProcessor.js";
import { isTransientDatabaseError, retryWithExponentialBackoff } from "../utils/retry.js";

export const BILLING_MAINTENANCE_QUEUE_NAME = "billingMaintenanceQueue";
export const BILLING_MAINTENANCE_JOB_NAME = "billing-lifecycle-maintenance";
export const BILLING_MAINTENANCE_REPEAT_JOB_ID = "billing-lifecycle-maintenance-repeat";
export const BILLING_MAINTENANCE_EVERY_MS = env.billingMaintenance.intervalMs;
const BILLING_MAINTENANCE_JOB_OPTIONS = {
  attempts: env.nodeEnv === "test" ? 1 : 6,
  backoff: {
    type: "exponential",
    delay: 30000,
  },
};
const INLINE_RETRY_MAX_ATTEMPTS = env.nodeEnv === "test" ? 1 : 5;
const INLINE_RETRY_BASE_DELAY_MS = 15000;
const INLINE_RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

export const billingMaintenanceQueue = createQueue(BILLING_MAINTENANCE_QUEUE_NAME);

const runInlineBillingMaintenance = async (payload, reason) => {
  logger.warn(
    {
      queue: BILLING_MAINTENANCE_QUEUE_NAME,
      reason,
      mode: "inline-fallback",
    },
    "Running billing maintenance inline because queue is unavailable"
  );

  try {
    const result = await retryWithExponentialBackoff(
      async () =>
        processBillingMaintenanceJob(payload, {
          mode: "inline-fallback",
          queue: BILLING_MAINTENANCE_QUEUE_NAME,
        }),
      {
        operationName: "billing-maintenance-inline-fallback",
        maxAttempts: INLINE_RETRY_MAX_ATTEMPTS,
        baseDelayMs: INLINE_RETRY_BASE_DELAY_MS,
        maxDelayMs: INLINE_RETRY_MAX_DELAY_MS,
        unrefDelayTimer: true,
        shouldRetry: (error) => isTransientDatabaseError(error),
        onRetry: ({ error, attempt, maxAttempts, retryDelayMs, operationName }) => {
          logger.warn(
            {
              queue: BILLING_MAINTENANCE_QUEUE_NAME,
              reason,
              operationName,
              attempt,
              maxAttempts,
              retryDelayMs,
              errorCode: error?.code || null,
              errorName: error?.name || null,
            },
            "Retrying inline billing maintenance after transient database failure"
          );
        },
      }
    );
    return { fallback: true, result };
  } catch (error) {
    logger.error(
      {
        err: error,
        queue: BILLING_MAINTENANCE_QUEUE_NAME,
        reason,
        transientDatabaseError: isTransientDatabaseError(error),
        errorCode: error?.code || null,
        errorName: error?.name || null,
      },
      "Inline billing maintenance fallback failed"
    );
    captureException(error, {
      queue: BILLING_MAINTENANCE_QUEUE_NAME,
      mode: "inline-fallback",
    });
    return null;
  }
};

export const enqueueBillingMaintenance = async (payload = {}) => {
  if (!isQueueAvailable) {
    return runInlineBillingMaintenance(payload, "redis-disabled");
  }

  try {
    return await billingMaintenanceQueue.add(BILLING_MAINTENANCE_JOB_NAME, payload, BILLING_MAINTENANCE_JOB_OPTIONS);
  } catch (error) {
    logger.error({ err: error, queue: BILLING_MAINTENANCE_QUEUE_NAME }, "Failed to enqueue billing maintenance job");
    captureException(error, {
      queue: BILLING_MAINTENANCE_QUEUE_NAME,
      jobName: BILLING_MAINTENANCE_JOB_NAME,
    });
    return runInlineBillingMaintenance(payload, "enqueue-failed");
  }
};

export const scheduleBillingMaintenanceJob = async () => {
  try {
    return await billingMaintenanceQueue.add(
      BILLING_MAINTENANCE_JOB_NAME,
      {},
      {
        ...BILLING_MAINTENANCE_JOB_OPTIONS,
        jobId: BILLING_MAINTENANCE_REPEAT_JOB_ID,
        repeat: {
          every: BILLING_MAINTENANCE_EVERY_MS,
        },
      }
    );
  } catch (error) {
    logger.error({ err: error, queue: BILLING_MAINTENANCE_QUEUE_NAME }, "Failed to schedule billing maintenance job");
    captureException(error, {
      queue: BILLING_MAINTENANCE_QUEUE_NAME,
      jobName: BILLING_MAINTENANCE_JOB_NAME,
      action: "schedule-repeat",
    });
    return null;
  }
};
