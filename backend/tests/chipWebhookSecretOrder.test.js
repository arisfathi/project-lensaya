import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { app } = await import("../src/app.js");
const { billingService } = await import("../src/services/billingService.js");
const { hmacSha256 } = await import("../src/utils/crypto.js");

const withMethodPatches = async (patches, callback) => {
  const originals = patches.map((patch) => ({
    target: patch.target,
    method: patch.method,
    original: patch.target[patch.method],
  }));

  for (const patch of patches) {
    patch.target[patch.method] = patch.fn;
  }

  try {
    await callback();
  } finally {
    for (const original of originals) {
      original.target[original.method] = original.original;
    }
  }
};

test("CHIP webhook secret is read dynamically (env test-order safety)", async () => {
  const original = process.env.CHIP_WEBHOOK_SECRET;

  try {
    delete process.env.CHIP_WEBHOOK_SECRET;

    const payload = {
      id: "purchase-wrap-order-1",
      transaction_id: "txn-wrap-order-1",
      status: "paid",
      amount: 7900,
      currency: "usd",
      metadata: { userId: "wrapped-user" },
    };

    const rawBody = JSON.stringify(payload);
    const signature = hmacSha256(rawBody, "chip-webhook-secret");

    // With missing secret, controller should hard-fail with 503 even if signature is provided.
    const resMissing = await request(app)
      .post("/api/v1/billing/webhook")
      .set("Content-Type", "application/json")
      .set("x-chip-signature", signature)
      .send(rawBody);

    assert.equal(resMissing.status, 503);

    // Now set the secret after the first env import and prove the webhook succeeds.
    process.env.CHIP_WEBHOOK_SECRET = "chip-webhook-secret";

    let receivedPayload = null;

    await withMethodPatches(
      [
        {
          target: billingService,
          method: "handlePaymentWebhook",
          fn: async (nextPayload) => {
            receivedPayload = nextPayload;
            return { received: true };
          },
        },
      ],
      async () => {
        const res = await request(app)
          .post("/api/v1/billing/webhook")
          .set("Content-Type", "application/json")
          .set("x-chip-signature", signature)
          .send(rawBody);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.received, true);
        assert.equal(receivedPayload.id, "purchase-wrap-order-1");
      }
    );
  } finally {
    if (original === undefined) {
      delete process.env.CHIP_WEBHOOK_SECRET;
    } else {
      process.env.CHIP_WEBHOOK_SECRET = original;
    }
  }
});