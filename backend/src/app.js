import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { sentryRequestHandler, sentryErrorHandler } from "./config/sentry.js";
import apiRoutes from "./routes/index.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { hostContext } from "./middleware/hostContext.js";
import { publicHostApiGuard } from "./middleware/publicHostApiGuard.js";
import { queueMonitoringService } from "./services/queueMonitoringService.js";

if (typeof BigInt.prototype.toJSON !== "function") {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

export const app = express();

const RAW_BODY_CAPTURE_PATHS = new Set(["/api/v1/billing/webhook", "/api/v1/webhooks/payments"]);
const shouldCaptureRawBody = (url = "") => {
  const path = String(url || "").split("?")[0];
  return RAW_BODY_CAPTURE_PATHS.has(path);
};

const parseCookies = (header = "") => {
  if (!header || typeof header !== "string") return {};

  return header.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.split("=");
    if (!rawKey) return acc;

    const key = rawKey.trim();
    const value = rest.join("=").trim();
    if (!key) return acc;

    try {
      acc[key] = decodeURIComponent(value || "");
    } catch (_error) {
      acc[key] = value || "";
    }
    return acc;
  }, {});
};

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(requestId);
app.use(requestLogger);
app.use(sentryRequestHandler);
app.use((req, _res, next) => {
  req.cookies = parseCookies(req.headers.cookie || "");
  next();
});
app.use(hostContext);

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      if (!shouldCaptureRawBody(req.originalUrl || req.url)) {
        return;
      }
      req.rawBody = buf?.toString("utf8") || "";
    },
  })
);
app.use(express.urlencoded({ extended: true }));
const corsOrigins = Array.from(new Set(env.corsOrigins));
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use("/api", apiLimiter);

app.get("/health", async (req, res) => {
  let workerSummary = {
    status: "degraded",
    checkedAt: new Date().toISOString(),
    queueBacklog: 0,
    degradedQueues: 0,
    liveWorkers: 0,
    staleWorkers: 0,
    redisEnabled: false,
  };

  try {
    workerSummary = await queueMonitoringService.getPublicHealthSummary();
  } catch (error) {
    logger.error({ err: error, requestId: req.id || null }, "Failed to collect worker health summary");
  }

  const apiStatus = workerSummary.status === "ok" ? "ok" : "degraded";

  res.json({
    success: true,
    data: {
      status: apiStatus,
      requestId: req.id || null,
      workers: workerSummary,
    },
    error: null,
  });
});

app.use("/api/v1", publicHostApiGuard, apiRoutes);

app.use(notFoundHandler);
app.use(sentryErrorHandler);
app.use(errorHandler);




