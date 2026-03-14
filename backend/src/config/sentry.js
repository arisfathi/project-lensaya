import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { env } from "./env.js";
import { logger } from "./logger.js";

Sentry.init({
  dsn: env.sentryDsn || undefined,
  enabled: Boolean(env.sentryDsn),
  integrations: [Sentry.expressIntegration(), nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  environment: env.nodeEnv,
});

if (!env.sentryDsn) {
  logger.warn("Sentry is disabled because SENTRY_DSN is not configured");
}

const shouldCaptureError = (error) => {
  const statusCode = Number(error?.statusCode || error?.status || 500);
  return Number.isFinite(statusCode) ? statusCode >= 500 : true;
};

export const sentryRequestHandler = (req, _res, next) => {
  if (req.id) {
    Sentry.setTag("request_id", req.id);
  }
  Sentry.setContext("http_request", {
    method: req.method,
    path: req.originalUrl,
    requestId: req.id || null,
  });
  next();
};

export const sentryErrorHandler = (error, req, _res, next) => {
  if (shouldCaptureError(error)) {
    Sentry.withScope((scope) => {
      if (req.id) {
        scope.setTag("request_id", req.id);
      }
      scope.setContext("http_request", {
        method: req.method,
        path: req.originalUrl,
        requestId: req.id || null,
      });
      Sentry.captureException(error);
    });
  }
  next(error);
};

export const captureException = (error, extras = {}) => {
  if (!error) return;
  Sentry.withScope((scope) => {
    Object.entries(extras).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    Sentry.captureException(error);
  });
};

export const flushSentry = async () => {
  await Sentry.flush(2000);
};
