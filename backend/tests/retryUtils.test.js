import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { isTransientDatabaseError, retryWithExponentialBackoff } = await import("../src/utils/retry.js");

test("isTransientDatabaseError recognizes transient Prisma error codes", () => {
  const error = new Error("Database temporarily unavailable");
  error.code = "P1001";

  assert.equal(isTransientDatabaseError(error), true);
});

test("isTransientDatabaseError recognizes transient connection messages", () => {
  const error = new Error("Can't reach database server at db.example.com:5432");
  assert.equal(isTransientDatabaseError(error), true);
});

test("retryWithExponentialBackoff retries transient errors until success", async () => {
  let attempts = 0;

  const result = await retryWithExponentialBackoff(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("Can't reach database server at localhost:5432");
        error.code = "P1001";
        throw error;
      }
      return "ok";
    },
    {
      operationName: "retry-test",
      maxAttempts: 4,
      baseDelayMs: 1,
      maxDelayMs: 2,
      shouldRetry: (error) => isTransientDatabaseError(error),
    }
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("retryWithExponentialBackoff does not retry non-transient errors", async () => {
  let attempts = 0;

  await assert.rejects(
    retryWithExponentialBackoff(
      async () => {
        attempts += 1;
        throw new Error("Validation failed");
      },
      {
        operationName: "retry-test-non-transient",
        maxAttempts: 4,
        baseDelayMs: 1,
        maxDelayMs: 2,
        shouldRetry: (error) => isTransientDatabaseError(error),
      }
    ),
    /Validation failed/
  );

  assert.equal(attempts, 1);
});
