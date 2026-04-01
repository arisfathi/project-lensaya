import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const isRedisConfigured = env.nodeEnv !== "test" && Boolean(env.redisUrl);

export const redis = isRedisConfigured
  ? new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    })
  : null;

if (redis) {
  redis.on("connect", () => {
    logger.info("Redis connected");
  });

  redis.on("error", (error) => {
    logger.error({ err: error }, "Redis connection error");
  });
} else {
  logger.warn("Redis is disabled because REDIS_URL is not configured");
}
