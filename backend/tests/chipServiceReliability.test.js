import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../src/utils/apiError.js";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lensaya?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { chipService } = await import("../src/services/chipService.js");
const { env } = await import("../src/config/env.js");

const withTemporaryChipConfig = async (overrides, callback) => {
  const previous = {
    apiKey: env.chip.apiKey,
    requestTimeoutMs: env.chip.requestTimeoutMs,
    maxRetries: env.chip.maxRetries,
    retryBaseDelayMs: env.chip.retryBaseDelayMs,
    retryMaxDelayMs: env.chip.retryMaxDelayMs,
  };

  Object.assign(env.chip, overrides);
  try {
    await callback();
  } finally {
    Object.assign(env.chip, previous);
  }
};

test("chipService.createCheckoutSession retries transient CHIP errors", async () => {
  const originalFetch = global.fetch;
  let attemptCount = 0;

  global.fetch = async () => {
    attemptCount += 1;
    if (attemptCount === 1) {
      return new Response(JSON.stringify({ message: "temporary outage" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        checkout_url: "https://checkout.chip-in.asia/session",
        id: "purchase_retry_ok",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  };

  try {
    await withTemporaryChipConfig(
      {
        apiKey: "chip_test_key",
        maxRetries: 1,
        retryBaseDelayMs: 1,
        retryMaxDelayMs: 1,
        requestTimeoutMs: 1000,
      },
      async () => {
        const result = await chipService.createCheckoutSession({
          targetPlanId: "brand_test",
          amountCents: 7900,
          currency: "USD",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
          metadata: { userId: "user-1" },
        });

        assert.equal(attemptCount, 2);
        assert.equal(result.checkoutUrl, "https://checkout.chip-in.asia/session");
        assert.equal(result.sessionId, "purchase_retry_ok");
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("chipService.createCheckoutSession fails with timeout ApiError when CHIP stalls", async () => {
  const originalFetch = global.fetch;

  global.fetch = async (_url, options = {}) =>
    new Promise((_resolve, reject) => {
      const signal = options.signal;
      if (signal) {
        signal.addEventListener("abort", () => {
          const timeoutError = new Error("aborted");
          timeoutError.name = "AbortError";
          reject(timeoutError);
        });
      }
    });

  try {
    await withTemporaryChipConfig(
      {
        apiKey: "chip_test_key",
        maxRetries: 0,
        requestTimeoutMs: 10,
      },
      async () => {
        await assert.rejects(
          () =>
            chipService.createCheckoutSession({
              targetPlanId: "brand_timeout",
              amountCents: 7900,
              currency: "USD",
              successUrl: "https://example.com/success",
              cancelUrl: "https://example.com/cancel",
              metadata: { userId: "user-timeout" },
            }),
          (error) => error instanceof ApiError && error.statusCode === 504
        );
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});
