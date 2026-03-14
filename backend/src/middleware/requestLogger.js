import pinoHttp from "pino-http";
import { logger } from "../config/logger.js";

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => req.id || res.getHeader("X-Request-Id"),
  customAttributeKeys: {
    req: "request",
    res: "response",
    err: "error",
    reqId: "requestId",
    responseTime: "responseTimeMs",
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res, responseTime) =>
    `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${responseTime}ms`,
  customErrorMessage: (req, res, err, responseTime) =>
    `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${responseTime}ms ${err.message}`,
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
    }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
