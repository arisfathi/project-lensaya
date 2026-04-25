import dotenv from "dotenv";

dotenv.config();

const args = new Set(process.argv.slice(2));
const forceProduction = args.has("--production");
const nodeEnv = String(process.env.NODE_ENV || "development").trim().toLowerCase();
const isProduction = forceProduction || nodeEnv === "production";

const clean = (value) => String(value || "").trim();
const isMissing = (value) => clean(value) === "";
const isPlaceholder = (value) => {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes("replace-with") ||
    normalized.includes("example.com") ||
    normalized.includes("your-") ||
    normalized === "changeme"
  );
};

if (!isProduction) {
  console.log("[env-check] Skipped: NODE_ENV is not production. Use --production to force checks.");
  process.exit(0);
}

const errors = [];
const warnings = [];

const requireNonEmpty = (key) => {
  if (isMissing(process.env[key])) {
    errors.push(`${key} is required in production`);
  }
};

const requireNotPlaceholder = (key) => {
  if (isPlaceholder(process.env[key])) {
    errors.push(`${key} contains a placeholder or unsafe default value`);
  }
};

// Core runtime requirements
requireNonEmpty("DATABASE_URL");
requireNotPlaceholder("DATABASE_URL");
requireNonEmpty("JWT_SECRET");
requireNotPlaceholder("JWT_SECRET");

if (isMissing(process.env.APP_URL) && isMissing(process.env.FRONTEND_URL)) {
  errors.push("APP_URL (or FRONTEND_URL) is required in production");
}

if (isMissing(process.env.PUBLIC_APP_URL) && isMissing(process.env.PUBLIC_URL) && isMissing(process.env.APP_BASE_URL)) {
  errors.push("PUBLIC_APP_URL (or PUBLIC_URL/APP_BASE_URL) is required in production");
}

// Billing provider checks
const billingProvider = clean(process.env.BILLING_PROVIDER).toLowerCase() || "stripe";
const stripeConfigured = !isMissing(process.env.STRIPE_API_KEY) && !isPlaceholder(process.env.STRIPE_API_KEY);

if (billingProvider === "mock") {
  errors.push("BILLING_PROVIDER=mock is not allowed for production");
}

if (!["auto", "stripe", ""].includes(billingProvider)) {
  errors.push(`BILLING_PROVIDER must be one of auto|stripe|mock (received: ${billingProvider})`);
}

if (billingProvider === "auto") {
  warnings.push("BILLING_PROVIDER=auto is deprecated; use BILLING_PROVIDER=stripe in production");
}

requireNonEmpty("STRIPE_API_KEY");
requireNotPlaceholder("STRIPE_API_KEY");

if (stripeConfigured) {
  requireNonEmpty("STRIPE_WEBHOOK_SECRET");
  requireNotPlaceholder("STRIPE_WEBHOOK_SECRET");
}

// Domain checks
if (clean(process.env.CUSTOM_DOMAIN_VERIFICATION_MODE).toLowerCase() !== "dns") {
  errors.push("CUSTOM_DOMAIN_VERIFICATION_MODE must be dns in production");
}

// Operational warnings
if (isMissing(process.env.REDIS_URL)) {
  warnings.push("REDIS_URL is empty; queues run in degraded/fallback mode");
}

if (isPlaceholder(process.env.SENTRY_DSN)) {
  warnings.push("SENTRY_DSN is missing or placeholder; production errors may be harder to diagnose");
}

if (errors.length > 0) {
  console.error("[env-check] Production environment check failed:\n");
  for (const message of errors) {
    console.error(`  - ${message}`);
  }

  if (warnings.length > 0) {
    console.error("\n[env-check] Additional warnings:");
    for (const message of warnings) {
      console.error(`  - ${message}`);
    }
  }

  process.exit(1);
}

console.log("[env-check] Production environment check passed.");
if (warnings.length > 0) {
  console.log("[env-check] Warnings:");
  for (const message of warnings) {
    console.log(`  - ${message}`);
  }
}
