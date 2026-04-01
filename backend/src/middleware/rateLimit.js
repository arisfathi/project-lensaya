import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { redis, isRedisConfigured } from "../config/redis.js";

const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: false,
  message: {
    success: false,
    data: null,
    error: "Too many requests, please try again later.",
  },
};

const createRateLimitStore = (prefix) => {
  if (!isRedisConfigured || !redis) return null;

  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix,
  });
};

const createLimiter = ({ windowMs, max, storePrefix, name }) => {
  const store = createRateLimitStore(storePrefix);

  if (!store && isRedisConfigured) {
    logger.warn({ limiter: name }, "Redis configured but unavailable for distributed rate limiting; falling back to memory store");
  }

  return rateLimit({
    ...commonOptions,
    windowMs,
    max,
    ...(store ? { store } : {}),
  });
};

export const apiLimiter = createLimiter({
  name: "api",
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMaxRequests,
  storePrefix: "rl:api:",
});

export const authLimiter = createLimiter({
  name: "auth",
  windowMs: 15 * 60 * 1000,
  max: 20,
  storePrefix: "rl:auth:",
});

export const publicBookingLimiter = createLimiter({
  name: "public-bookings",
  windowMs: env.rateLimitPublicBookingsWindowMs,
  max: env.rateLimitPublicBookingsMaxRequests,
  storePrefix: "rl:public-bookings:",
});

export const publicReferralTrackLimiter = createLimiter({
  name: "public-referrals-track",
  windowMs: env.rateLimitPublicReferralTrackWindowMs,
  max: env.rateLimitPublicReferralTrackMaxRequests,
  storePrefix: "rl:public-referrals-track:",
});

export const analyticsEventLimiter = createLimiter({
  name: "analytics-events",
  windowMs: env.rateLimitAnalyticsEventsWindowMs,
  max: env.rateLimitAnalyticsEventsMaxRequests,
  storePrefix: "rl:analytics-events:",
});

export const publicClientErrorLimiter = createLimiter({
  name: "public-client-errors",
  windowMs: env.rateLimitPublicClientErrorsWindowMs,
  max: env.rateLimitPublicClientErrorsMaxRequests,
  storePrefix: "rl:public-client-errors:",
});
