import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const splitCsv = (value = "") =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseSameSite = (value, fallback = "lax") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["lax", "strict", "none"].includes(normalized)) return normalized;
  return fallback;
};

const parseIntWithMin = (value, fallback, min = 1) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed) || parsed < min) return fallback;
  return parsed;
};

const normalizeUrl = (value, fallback) => {
  try {
    return new URL(String(value || fallback)).toString().replace(/\/+$/, "");
  } catch {
    return String(fallback);
  }
};

const extractHostname = (value) => {
  try {
    return new URL(String(value)).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const stripManagedSubdomain = (hostname = "") =>
  String(hostname || "")
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^(app|admin)\./, "");

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const parseNonNegativeInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const cleanString = (value) => String(value || "").trim();
const parseCustomDomainVerificationMode = (value) => {
  const normalized = cleanString(value).toLowerCase();
  return normalized === "dns" ? "dns" : "mock";
};

const isLikelyConfiguredApiKey = (value = "") => {
  const normalized = cleanString(value);
  if (!normalized) return false;
  return !/replace[-_ ]with[-_ ]chip[-_ ]key/i.test(normalized);
};

const parsePercentage = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return fallback;
  return parsed;
};

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !process.env.APP_URL && !process.env.FRONTEND_URL) {
  throw new Error("APP_URL (or FRONTEND_URL) is required in production");
}
if (isProduction && !process.env.PUBLIC_APP_URL && !process.env.PUBLIC_URL && !process.env.APP_BASE_URL) {
  throw new Error("PUBLIC_APP_URL (or PUBLIC_URL/APP_BASE_URL) is required in production");
}
if (isProduction && cleanString(process.env.CHIP_API_KEY)) {
  const missingChipBrandEnv = ["CHIP_BRAND_ID_PRO", "CHIP_BRAND_ID_STUDIO"].filter(
    (key) => !cleanString(process.env[key])
  );
  if (missingChipBrandEnv.length > 0) {
    throw new Error(
      `Missing required CHIP brand config in production: ${missingChipBrandEnv.join(", ")}`
    );
  }
}

const defaultAppUrl = isProduction ? "https://app.example.com" : "http://localhost:5173";
const resolvedAppUrl = normalizeUrl(
  process.env.APP_URL || process.env.FRONTEND_URL || defaultAppUrl,
  defaultAppUrl
);
const resolvedPublicAppUrl = normalizeUrl(
  process.env.PUBLIC_APP_URL || process.env.PUBLIC_URL || process.env.APP_BASE_URL || resolvedAppUrl,
  resolvedAppUrl
);
const resolvedAdminAppUrl = normalizeUrl(
  process.env.ADMIN_APP_URL || process.env.ADMIN_URL || resolvedAppUrl,
  resolvedAppUrl
);
const configuredBaseDomain = String(process.env.APP_BASE_DOMAIN || "").trim().toLowerCase();
const resolvedBaseDomain =
  configuredBaseDomain ||
  stripManagedSubdomain(extractHostname(resolvedPublicAppUrl) || extractHostname(resolvedAppUrl)) ||
  (isProduction ? "example.com" : "localhost");

const defaultCorsOrigins = isProduction
  ? [resolvedAppUrl, resolvedPublicAppUrl, resolvedAdminAppUrl]
  : ["http://localhost:5173"];

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: Number(process.env.PORT || 4000),
  logLevel: process.env.LOG_LEVEL || "info",
  sentryDsn: process.env.SENTRY_DSN || "",
  redisUrl: process.env.REDIS_URL || "",
  queueConcurrency: Number(process.env.QUEUE_CONCURRENCY || 5),
  assetCleanup: {
    enabled: parseBoolean(process.env.ASSET_CLEANUP_ENABLED, true),
    intervalMs: parseIntWithMin(process.env.ASSET_CLEANUP_INTERVAL_MS, 60 * 60 * 1000, 1000),
  },
  billingMaintenance: {
    enabled: parseBoolean(process.env.BILLING_MAINTENANCE_ENABLED, true),
    intervalMs: parseIntWithMin(process.env.BILLING_MAINTENANCE_INTERVAL_MS, 15 * 60 * 1000, 1000),
    batchSize: parsePositiveInt(process.env.BILLING_MAINTENANCE_BATCH_SIZE, 500),
  },
  appUrl: resolvedAppUrl,
  publicAppUrl: resolvedPublicAppUrl,
  adminAppUrl: resolvedAdminAppUrl,
  appBaseDomain: resolvedBaseDomain,
  publicAppDomain: resolvedBaseDomain,
  frontendUrl: resolvedAppUrl,
  corsOrigins: splitCsv(process.env.CORS_ORIGINS || defaultCorsOrigins.join(",")),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_KEY || "",
    bucket: process.env.R2_BUCKET || "",
    publicBaseUrl: process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || "",
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    fromEmail: process.env.RESEND_FROM_EMAIL || "no-reply@example.com",
  },
  customDomains: {
    cnameTarget: cleanString(process.env.CUSTOM_DOMAIN_CNAME_TARGET || "domains.lensaya.app") || "domains.lensaya.app",
    verificationMode: parseCustomDomainVerificationMode(process.env.CUSTOM_DOMAIN_VERIFICATION_MODE),
    lookupTimeoutMs: parseIntWithMin(process.env.CUSTOM_DOMAIN_LOOKUP_TIMEOUT_MS, 4000, 250),
  },
  chip: {
    apiKey: process.env.CHIP_API_KEY || "",
    apiBaseUrl: process.env.CHIP_API_BASE_URL || "https://gate.chip-in.asia/api/v1",
    webhookSecret: process.env.CHIP_WEBHOOK_SECRET || "",
    successUrl: process.env.CHIP_SUCCESS_URL || "",
    cancelUrl: process.env.CHIP_CANCEL_URL || "",
    requestTimeoutMs: parseIntWithMin(process.env.CHIP_REQUEST_TIMEOUT_MS, 10000, 100),
    maxRetries: parseNonNegativeInt(process.env.CHIP_MAX_RETRIES, 2),
    retryBaseDelayMs: parseIntWithMin(process.env.CHIP_RETRY_BASE_DELAY_MS, 300, 1),
    retryMaxDelayMs: parseIntWithMin(process.env.CHIP_RETRY_MAX_DELAY_MS, 2000, 1),
    brandIds: {
      FREE: cleanString(process.env.CHIP_BRAND_ID_FREE),
      PRO: cleanString(process.env.CHIP_BRAND_ID_PRO),
      STUDIO: cleanString(process.env.CHIP_BRAND_ID_STUDIO),
    },
  },
  billing: {
    provider: (() => {
      const configuredProvider = cleanString(process.env.BILLING_PROVIDER).toLowerCase();
      if (["chip", "mock"].includes(configuredProvider)) {
        return configuredProvider;
      }
      if (String(process.env.NODE_ENV || "").trim().toLowerCase() === "test") {
        return "chip";
      }
      return isLikelyConfiguredApiKey(process.env.CHIP_API_KEY) ? "chip" : "mock";
    })(),
    mockCheckoutPath:
      cleanString(process.env.BILLING_MOCK_CHECKOUT_PATH || "/dashboard/billing/mock-checkout") ||
      "/dashboard/billing/mock-checkout",
  },
  media: {
    webMaxWidth: parsePositiveInt(process.env.MEDIA_WEB_MAX_WIDTH, 1920),
    thumbMaxWidth: parsePositiveInt(process.env.MEDIA_THUMB_MAX_WIDTH, 640),
    webQuality: parseIntWithMin(process.env.MEDIA_WEB_QUALITY, 82, 1),
    thumbQuality: parseIntWithMin(process.env.MEDIA_THUMB_QUALITY, 68, 1),
    watermarkText: String(process.env.FREE_PLAN_WATERMARK_TEXT || "Lensaya").trim() || "Lensaya",
    watermarkOpacity: parsePercentage(process.env.FREE_PLAN_WATERMARK_OPACITY, 0.35),
    enableTransform: parseBoolean(process.env.MEDIA_TRANSFORM_ENABLED, true),
  },
  monitoring: {
    logClientErrors: parseBoolean(process.env.LOG_CLIENT_ERRORS, true),
    workerHeartbeatIntervalMs: parseIntWithMin(process.env.WORKER_HEARTBEAT_INTERVAL_MS, 30000, 1000),
    workerHeartbeatTtlSec: parsePositiveInt(process.env.WORKER_HEARTBEAT_TTL_SEC, 120),
    workerBacklogWarnThreshold: parsePositiveInt(process.env.WORKER_BACKLOG_WARN_THRESHOLD, 20),
  },
  authCookie: {
    domain: process.env.AUTH_COOKIE_DOMAIN || "",
    sameSite: parseSameSite(
      process.env.AUTH_COOKIE_SAMESITE,
      process.env.NODE_ENV === "production" ? "none" : "lax"
    ),
    secure: parseBoolean(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === "production"),
  },
};






