import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = statusCode >= 500 && env.isProduction ? "Internal server error" : err.message;
  const requestId = req.id || res.locals.requestId || null;

  logger.error(
    {
      err,
      requestId,
      statusCode,
      method: req.method,
      path: req.originalUrl,
    },
    "Request failed"
  );

  if (requestId) {
    res.setHeader("X-Request-Id", requestId);
  }

  return res.status(statusCode).json({
    success: false,
    data: null,
    error: message || "Request failed",
  });
};
