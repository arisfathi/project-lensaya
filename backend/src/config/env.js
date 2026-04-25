import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const splitCsv = (value = "") =>
  String(value || "")
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

const cleanString = (value) => String(value || "").trim();

const parseCustomDomainVerificationMode = (value) => {
  const normalized = cleanString(value).toLowerCase();
  return normalized === "dns" ? "dns" : "mock";
};

const isLikelyConfiguredStripeApiKey = (value = "") => {
  const normalized = cleanString(value);
  if (!normalized) return false;
  return !/replace[-_ ]with[-_ ]stripe[-_ ]api[-_ ]key/i.test(normalized);
};

const parsePercentage = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return fallback;
  return parsed;
};

const parseUrlSafe = (value) => {
  try {
    return new URL(String(value || "").trim());
  } catch {
    return null;
  }
};

const isLocalHost = (hostname = "") => {
  const normalized = String(hostname || "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

const resolveBillingProvider = () => {
  const configuredProvider = cleanString(process.env.BILLING_PROVIDER).toLowerCase();
  if (["mock", "stripe"].includes(configuredProvider)) {
    return configuredProvider;
  }

  if (String(process.env.NODE_ENV || "").trim().toLowerCase() === "test") {
    return "stripe";
  }

  if (isLikelyConfiguredStripeApiKey(process.env.STRIPE_API_KEY)) {
    return "stripe";
  }

  return "mock";
};

const isProduction = process.env.NODE_ENV === "production";
const resolvedBillingProvider = resolveBillingProvider();

if (isProduction && !process.env.APP_URL && !process.env.FRONTEND_URL) {
  throw new Error("APP_URL (or FRONTEND_URL) is required in production");
}

if (isProduction && !process.env.PUBLIC_APP_URL && !process.env.PUBLIC_URL && !process.env.APP_BASE_URL) {
  throw new Error("PUBLIC_APP_URL (or PUBLIC_URL/APP_BASE_URL) is required in production");
}

if (isProduction && resolvedBillingProvider !== "stripe") {
  throw new Error("Production billing must use Stripe. Set BILLING_PROVIDER=stripe and configure Stripe credentials.");
}

if (isProduction && resolvedBillingProvider === "stripe") {
  if (!isLikelyConfiguredStripeApiKey(process.env.STRIPE_API_KEY)) {
    throw new Error("STRIPE_API_KEY is required in production when BILLING_PROVIDER=stripe");
  }
  if (!cleanString(process.env.STRIPE_WEBHOOK_SECRET)) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required in production when BILLING_PROVIDER=stripe");
  }
}

const appleAuthEnabled = parseBoolean(process.env.APPLE_AUTH_ENABLED, false);
const appleTokenExchangeEnabled = parseBoolean(process.env.APPLE_TOKEN_EXCHANGE_ENABLED, true);

if (appleAuthEnabled) {
  if (!cleanString(process.env.APPLE_CLIENT_ID)) {
    throw new Error("APPLE_CLIENT_ID is required when APPLE_AUTH_ENABLED=true");
  }

  if (appleTokenExchangeEnabled) {
    const missingAppleEnv = ["APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY", "APPLE_REDIRECT_URI"].filter(
      (key) => !cleanString(process.env[key])
    );
    if (missingAppleEnv.length > 0) {
      throw new Error("Missing required Apple Sign-In env vars: " + missingAppleEnv.join(", "));
    }

    const privateKeyRaw = String(process.env.APPLE_PRIVATE_KEY || "").trim();
    const normalizedPrivateKey =
      privateKeyRaw.includes("\\n") && !privateKeyRaw.includes("\n") ? privateKeyRaw.replace(/\\n/g, "\n") : privateKeyRaw;

    if (!normalizedPrivateKey.includes("BEGIN PRIVATE KEY") || !normalizedPrivateKey.includes("END PRIVATE KEY")) {
      throw new Error("APPLE_PRIVATE_KEY must contain a valid .p8 key block (BEGIN PRIVATE KEY / END PRIVATE KEY)");
    }

    const redirectUri = cleanString(process.env.APPLE_REDIRECT_URI);
    const redirectUrl = parseUrlSafe(redirectUri);
    if (!redirectUrl) {
      throw new Error("APPLE_REDIRECT_URI must be a valid absolute URL");
    }

    if (!["http:", "https:"].includes(redirectUrl.protocol)) {
      throw new Error("APPLE_REDIRECT_URI must use http or https");
    }

    if (isProduction && redirectUrl.protocol !== "https:") {
      throw new Error("APPLE_REDIRECT_URI must use https in production");
    }

    const expectedHostCandidates = [
      extractHostname(process.env.APP_URL || process.env.FRONTEND_URL || ""),
      extractHostname(process.env.PUBLIC_APP_URL || process.env.PUBLIC_URL || process.env.APP_BASE_URL || ""),
    ].filter(Boolean);

    if (expectedHostCandidates.length > 0) {
      const redirectHost = String(redirectUrl.hostname || "").toLowerCase();
      const matchesExpectedHost = expectedHostCandidates.some((host) => host === redirectHost);
      if (!matchesExpectedHost && !(!isProduction && isLocalHost(redirectHost))) {
        throw new Error("APPLE_REDIRECT_URI hostname must match APP_URL/FRONTEND_URL or PUBLIC_APP_URL/PUBLIC_URL host");
      }
    }

    process.env.APPLE_PRIVATE_KEY = normalizedPrivateKey;
  }
}

const defaultAppUrl = isProduction ? "https://app.example.com" : "http://localhost:5173";
const resolvedAppUrl = normalizeUrl(process.env.APP_URL || process.env.FRONTEND_URL || defaultAppUrl, defaultAppUrl);
const resolvedPublicAppUrl = normalizeUrl(
  process.env.PUBLIC_APP_URL || process.env.PUBLIC_URL || process.env.APP_BASE_URL || resolvedAppUrl,
  resolvedAppUrl
);
const resolvedAdminAppUrl = normalizeUrl(process.env.ADMIN_APP_URL || process.env.ADMIN_URL || resolvedAppUrl, resolvedAppUrl);

const configuredBaseDomain = String(process.env.APP_BASE_DOMAIN || "").trim().toLowerCase();
const resolvedBaseDomain =
  configuredBaseDomain ||
  stripManagedSubdomain(extractHostname(resolvedPublicAppUrl) || extractHostname(resolvedAppUrl)) ||
  (isProduction ? "example.com" : "localhost");

const defaultCorsOrigins = isProduction ? [resolvedAppUrl, resolvedPublicAppUrl, resolvedAdminAppUrl] : ["http://localhost:5173"];

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

  notificationReminders: {
    enabled: parseBoolean(process.env.NOTIFICATION_REMINDERS_ENABLED, true),
    intervalMs: parseIntWithMin(process.env.NOTIFICATION_REMINDERS_INTERVAL_MS, 15 * 60 * 1000, 1000),
    scanBatchSize: parsePositiveInt(process.env.NOTIFICATION_REMINDERS_BATCH_SIZE, 200),
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
  databasePool: {
    maxOverride: Number(process.env.DATABASE_POOL_MAX_OVERRIDE || 0),
    maxApi: parsePositiveInt(process.env.DATABASE_POOL_MAX_API, 10),
    maxWorker: parsePositiveInt(process.env.DATABASE_POOL_MAX_WORKER, 5),
    idleTimeoutMs: parseIntWithMin(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS, 30000, 1000),
    connectionTimeoutMs: parseIntWithMin(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS, 10000, 100),
  },

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",

  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",

  appleAuth: {
    enabled: appleAuthEnabled,
    clientId: process.env.APPLE_CLIENT_ID || "",
    tokenExchangeEnabled: appleTokenExchangeEnabled,
    teamId: process.env.APPLE_TEAM_ID || "",
    keyId: process.env.APPLE_KEY_ID || "",
    privateKey: process.env.APPLE_PRIVATE_KEY || "",
    redirectUri: process.env.APPLE_REDIRECT_URI || "",
  },

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

  billing: {
    provider: resolvedBillingProvider,
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
    sameSite: parseSameSite(process.env.AUTH_COOKIE_SAMESITE, process.env.NODE_ENV === "production" ? "none" : "lax"),
    secure: parseBoolean(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === "production"),
  },
};
