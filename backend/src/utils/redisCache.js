import { redis, isRedisConfigured } from "../config/redis.js";
import { logger } from "../config/logger.js";

const toKey = (key) => String(key || "").trim();

export const redisCache = {
  async getJson(key) {
    const normalizedKey = toKey(key);
    if (!normalizedKey || !isRedisConfigured || !redis) return null;

    try {
      const raw = await redis.get(normalizedKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      logger.warn({ err: error, key: normalizedKey }, "Redis cache get failed");
      return null;
    }
  },

  async setJson(key, value, ttlSeconds) {
    const normalizedKey = toKey(key);
    const ttl = Number(ttlSeconds);
    if (!normalizedKey || !isRedisConfigured || !redis || !Number.isFinite(ttl) || ttl <= 0) return;

    try {
      await redis.set(normalizedKey, JSON.stringify(value), "EX", Math.floor(ttl));
    } catch (error) {
      logger.warn({ err: error, key: normalizedKey }, "Redis cache set failed");
    }
  },

  async del(key) {
    const normalizedKey = toKey(key);
    if (!normalizedKey || !isRedisConfigured || !redis) return;

    try {
      await redis.del(normalizedKey);
    } catch (error) {
      logger.warn({ err: error, key: normalizedKey }, "Redis cache delete failed");
    }
  },
};
