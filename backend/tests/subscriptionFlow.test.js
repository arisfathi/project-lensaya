import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lensaya?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_API_KEY = process.env.STRIPE_API_KEY || "sk_test_stripe_key";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_stripe_secret";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/config/prisma.js");
const { notificationService } = await import("../src/services/notificationService.js");
const { referralService } = await import("../src/services/referralService.js");
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

const buildStripeSignatureHeader = (rawBody) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = hmacSha256(`${timestamp}.${rawBody}`, process.env.STRIPE_WEBHOOK_SECRET);
  return `t=${timestamp},v1=${signature}`;
};

test("POST /billing/webhook creates subscription + transaction on Stripe invoice.paid", async () => {
  const payload = {
    id: "evt_invoice_paid_1",
    object: "event",
    type: "invoice.paid",
    data: {
      object: {
        object: "invoice",
        id: "in_123",
        amount_paid: 7900,
        currency: "usd",
        payment_intent: "pi_123",
        subscription: "sub_123",
        customer: "cus_123",
        metadata: {
          userId: "stripe-user-1",
          planName: "PRO",
          planTier: "PRO",
          planInterval: "month",
          planCurrency: "USD",
          planPrice: 79,
          referralCode: "REF-STRIPE",
        },
      },
    },
  };
  const rawBody = JSON.stringify(payload);

  let createdSubscription = null;
  let upsertedTransaction = null;
  let notified = null;
  let rewarded = null;

  await withMethodPatches(
    [
      {
        target: prisma.transaction,
        method: "findUnique",
        fn: async () => null,
      },
      {
        target: prisma.transaction,
        method: "upsert",
        fn: async ({ create }) => {
          upsertedTransaction = create;
          return { id: "tx-local-1", ...create };
        },
      },
      {
        target: prisma.transaction,
        method: "create",
        fn: async ({ data }) => ({ id: "tx-local-2", ...data }),
      },
      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) => {
          const tx = {
            user: {
              findUnique: async () => ({
                id: "stripe-user-1",
                photographer: { id: "photographer-1" },
              }),
            },
            subscription: {
              findFirst: async () => null,
              create: async ({ data }) => {
                createdSubscription = data;
                return { id: "subscription-1", ...data };
              },
              update: async ({ data }) => ({ id: "subscription-existing", ...data }),
              updateMany: async () => ({ count: 0 }),
            },
            transaction: prisma.transaction,
            $executeRaw: async () => 1,
          };
          return callback(tx);
        },
      },
      {
        target: notificationService,
        method: "create",
        fn: async (payload) => {
          notified = payload;
          return payload;
        },
      },
      {
        target: referralService,
        method: "markConversionAndReward",
        fn: async (payload) => {
          rewarded = payload;
          return { updated: true };
        },
      },
    ],
    async () => {
      const res = await request(app)
        .post("/api/v1/billing/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", buildStripeSignatureHeader(rawBody))
        .send(rawBody);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.received, true);

      assert.equal(createdSubscription.userId, "stripe-user-1");
      assert.equal(createdSubscription.plan, "PRO");
      assert.equal(createdSubscription.status, "ACTIVE");
      assert.equal(createdSubscription.provider, "STRIPE");
      assert.equal(createdSubscription.providerSubscriptionId, "sub_123");
      assert.equal(createdSubscription.providerCustomerId, "cus_123");

      assert.equal(upsertedTransaction.userId, "stripe-user-1");
      assert.equal(upsertedTransaction.subscriptionId, "subscription-1");
      assert.equal(upsertedTransaction.status, "SUCCEEDED");
      assert.equal(upsertedTransaction.provider, "STRIPE");
      assert.equal(upsertedTransaction.providerTransactionId, "pi_123");

      assert.equal(notified.userId, "stripe-user-1");
      assert.equal(notified.subscriptionId, "subscription-1");
      assert.equal(rewarded.referredUserId, "stripe-user-1");
    }
  );
});

test("POST /billing/webhook ignores duplicate Stripe invoice.paid side effects", async () => {
  const payload = {
    id: "evt_invoice_paid_dup_1",
    object: "event",
    type: "invoice.paid",
    data: {
      object: {
        object: "invoice",
        id: "in_dup",
        amount_paid: 7900,
        currency: "usd",
        payment_intent: "pi_dup",
        subscription: "sub_dup",
        customer: "cus_dup",
        metadata: {
          userId: "stripe-user-dup",
          planName: "PRO",
          planTier: "PRO",
          planInterval: "month",
          planCurrency: "USD",
          planPrice: 79,
          referralCode: "REF-DUP",
        },
      },
    },
  };
  const rawBody = JSON.stringify(payload);

  let notificationCalls = 0;
  let referralCalls = 0;
  let subscriptionCreateCalls = 0;
  let upsertedTransaction = null;

  await withMethodPatches(
    [
      {
        target: prisma.transaction,
        method: "findUnique",
        fn: async () => ({ status: "SUCCEEDED", subscriptionId: "subscription-dup" }),
      },
      {
        target: prisma.subscription,
        method: "findFirst",
        fn: async () => ({
          id: "subscription-dup",
          userId: "stripe-user-dup",
          photographerId: "p-dup",
          plan: "PRO",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
        }),
      },
      {
        target: prisma.transaction,
        method: "upsert",
        fn: async ({ update }) => {
          upsertedTransaction = update;
          return { id: "tx-dup-1", ...update };
        },
      },
      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) => {
          const tx = {
            user: { findUnique: async () => ({ id: "stripe-user-dup", photographer: { id: "p-dup" } }) },
            subscription: {
              findFirst: async () => null,
              create: async () => {
                subscriptionCreateCalls += 1;
                return { id: "sub-created" };
              },
              update: async () => ({ id: "sub-updated" }),
              updateMany: async () => ({ count: 0 }),
            },
            transaction: prisma.transaction,
            $executeRaw: async () => 1,
          };
          return callback(tx);
        },
      },
      {
        target: notificationService,
        method: "create",
        fn: async () => {
          notificationCalls += 1;
          return { id: "note-dup-1" };
        },
      },
      {
        target: referralService,
        method: "markConversionAndReward",
        fn: async () => {
          referralCalls += 1;
          return { updated: true };
        },
      },
    ],
    async () => {
      const res = await request(app)
        .post("/api/v1/billing/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", buildStripeSignatureHeader(rawBody))
        .send(rawBody);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.received, true);
      assert.equal(subscriptionCreateCalls, 0);
      assert.equal(notificationCalls, 0);
      assert.equal(referralCalls, 0);
      assert.equal(upsertedTransaction.status, "SUCCEEDED");
    }
  );
});
