import { Queue } from "bullmq";
import { logger } from "../config/logger.js";
import { redis, isRedisConfigured } from "../config/redis.js";

export const isQueueAvailable = Boolean(isRedisConfigured && redis);

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

const createDisabledQueue = (name) => ({
  name,
  async add(jobName, _payload, _options) {
    logger.warn({ queue: name, jobName }, "Skipping job enqueue because Redis is disabled");
    return null;
  },
  async close() {
    return undefined;
  },
});

export const createQueue = (name) => {
  if (!isQueueAvailable) {
    return createDisabledQueue(name);
  }

  return new Queue(name, {
    connection: redis,
    defaultJobOptions,
  });
};
