import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: "Too many requests, please try again later.",
  },
};

export const apiLimiter = rateLimit({
  ...commonOptions,
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMaxRequests,
});

export const authLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  max: 20,
});