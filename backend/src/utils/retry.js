const TRANSIENT_DATABASE_ERROR_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database connection timed out
  "P1008", // Operations timed out
  "P1017", // Server closed connection
  "P2024", // Timed out waiting for a connection from pool
  "P2034", // Transaction conflict / deadlock
]);

const TRANSIENT_DATABASE_MESSAGE_PATTERNS = [
  /can't reach database server/i,
  /database.*timed out/i,
  /timed out fetching a new connection/i,
  /connection.+closed/i,
  /connection.+terminated/i,
  /read econnreset/i,
  /econnreset/i,
  /etimedout/i,
  /econnrefused/i,
  /too many connections/i,
  /the database system is starting up/i,
  /remaining connection slots are reserved/i,
];

const wait = (ms, { unref = false } = {}) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (unref && typeof timer?.unref === "function") {
      timer.unref();
    }
  });

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const isTransientDatabaseError = (error) => {
  if (!error || typeof error !== "object") return false;

  const code = String(error.code || "").trim().toUpperCase();
  if (TRANSIENT_DATABASE_ERROR_CODES.has(code)) return true;

  const message = `${String(error.message || "")} ${String(error?.meta?.cause || "")}`.trim();
  if (!message) return false;

  return TRANSIENT_DATABASE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
};

export const computeExponentialBackoffMs = ({
  attempt,
  baseDelayMs = 1000,
  maxDelayMs = 60000,
  jitterRatio = 0.2,
}) => {
  const normalizedAttempt = Math.max(toPositiveInt(attempt, 1), 1);
  const normalizedBase = Math.max(toPositiveInt(baseDelayMs, 1000), 1);
  const normalizedMax = Math.max(toPositiveInt(maxDelayMs, 60000), normalizedBase);
  const normalizedJitterRatio = Number.isFinite(jitterRatio)
    ? Math.max(Math.min(Number(jitterRatio), 1), 0)
    : 0.2;

  const exponentialDelay = Math.min(normalizedBase * 2 ** (normalizedAttempt - 1), normalizedMax);
  const jitter = Math.round(exponentialDelay * normalizedJitterRatio * Math.random());
  return Math.min(exponentialDelay + jitter, normalizedMax);
};

export const retryWithExponentialBackoff = async (
  operation,
  {
    operationName = "operation",
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 60000,
    jitterRatio = 0.2,
    unrefDelayTimer = false,
    shouldRetry = () => true,
    onRetry = null,
  } = {}
) => {
  const normalizedMaxAttempts = Math.max(toPositiveInt(maxAttempts, 3), 1);
  let attempt = 1;

  while (attempt <= normalizedMaxAttempts) {
    try {
      return await operation({ attempt, maxAttempts: normalizedMaxAttempts, operationName });
    } catch (error) {
      const canRetry = attempt < normalizedMaxAttempts && shouldRetry(error, { attempt, operationName });
      if (!canRetry) {
        throw error;
      }

      const retryDelayMs = computeExponentialBackoffMs({
        attempt,
        baseDelayMs,
        maxDelayMs,
        jitterRatio,
      });

      if (typeof onRetry === "function") {
        await onRetry({
          error,
          operationName,
          attempt,
          maxAttempts: normalizedMaxAttempts,
          retryDelayMs,
        });
      }

      await wait(retryDelayMs, { unref: Boolean(unrefDelayTimer) });
      attempt += 1;
    }
  }

  throw new Error(`${operationName} failed after retry attempts were exhausted`);
};
