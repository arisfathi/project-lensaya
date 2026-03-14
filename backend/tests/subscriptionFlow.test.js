import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CHIP_WEBHOOK_SECRET = process.env.CHIP_WEBHOOK_SECRET || "chip-webhook-secret";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/config/prisma.js");
const { notificationService } = await import("../src/services/notificationService.js");
const { referralService } = await import("../src/services/referralService.js");
const { signAccessToken } = await import("../src/utils/jwt.js");
const { hmacSha256 } = await import("../src/utils/crypto.js");

const makeToken = (sub, role = "PHOTOGRAPHER") =>
  signAccessToken({
    sub,
    role,
    email: `${sub}@example.com`,
    username: sub,
  });

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

test("POST /billing/webhook links transaction to subscription and user on successful payment", async () => {
  const payload = {
    id: "purchase_chip_001",
    transaction_id: "txn_chip_001",
    status: "paid",
    amount: 7900,
    currency: "usd",
    metadata: {
      userId: "webhook-user-1",
      planName: "PRO",
      planInterval: "month",
      planCurrency: "USD",
      planPrice: 79,
      referralCode: "REF-TEST",
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = hmacSha256(rawBody, process.env.CHIP_WEBHOOK_SECRET);

  let createdSubscription = null;
  let upsertedTransaction = null;
  let notified = null;
  let rewarded = null;

  await withMethodPatches(
    [
      {
        target: prisma.subscriptionPlan,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.name === "PRO") {
            return {
              id: "22222222-2222-4222-8222-222222222222",
              name: "PRO",
              currency: "USD",
              price: 79,
              trialDays: 0,
            };
          }
          return null;
        },
      },
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
                id: "webhook-user-1",
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
        .set("x-chip-signature", signature)
        .send(rawBody);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.received, true);

      assert.equal(createdSubscription.userId, "webhook-user-1");
      assert.equal(createdSubscription.plan, "PRO");
      assert.equal(createdSubscription.status, "ACTIVE");

      assert.equal(upsertedTransaction.userId, "webhook-user-1");
      assert.equal(upsertedTransaction.subscriptionId, "subscription-1");
      assert.equal(upsertedTransaction.status, "SUCCEEDED");
      assert.equal(upsertedTransaction.providerTransactionId, "txn_chip_001");

      assert.equal(notified.userId, "webhook-user-1");
      assert.equal(notified.subscriptionId, "subscription-1");
      assert.equal(rewarded.referredUserId, "webhook-user-1");
    }
  );
});

test("POST /billing/webhook ignores duplicate succeeded webhook side effects", async () => {
  const payload = {
    id: "purchase_chip_dup_1",
    transaction_id: "txn_chip_dup_1",
    status: "paid",
    amount: 7900,
    currency: "usd",
    metadata: {
      userId: "webhook-user-dup",
      planName: "PRO",
      planInterval: "month",
      planCurrency: "USD",
      planPrice: 79,
      referralCode: "REF-DUP",
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = hmacSha256(rawBody, process.env.CHIP_WEBHOOK_SECRET);

  let transactionWrapperCalls = 0;
  let notificationCalls = 0;
  let referralCalls = 0;
  let upsertedTransaction = null;

  await withMethodPatches(
    [
      {
        target: prisma.subscriptionPlan,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.name === "PRO") {
            return {
              id: "22222222-2222-4222-8222-222222222222",
              name: "PRO",
              currency: "USD",
              price: 79,
              trialDays: 0,
            };
          }
          return null;
        },
      },
      {
        target: prisma.transaction,
        method: "findUnique",
        fn: async () => ({ status: "SUCCEEDED", subscriptionId: "subscription-dup-1" }),
      },
      {
        target: prisma.subscription,
        method: "findFirst",
        fn: async () => ({
          id: "subscription-dup-1",
          userId: "webhook-user-dup",
          photographerId: "photographer-dup-1",
          plan: "PRO",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
        }),
      },
      {
        target: prisma,
        method: "$transaction",
        fn: async () => {
          transactionWrapperCalls += 1;
          throw new Error("subscription transaction should not run for duplicate succeeded webhook");
        },
      },
      {
        target: prisma.transaction,
        method: "upsert",
        fn: async ({ create }) => {
          upsertedTransaction = create;
          return { id: "tx-dup-1", ...create };
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
        .set("x-chip-signature", signature)
        .send(rawBody);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.received, true);
      assert.equal(transactionWrapperCalls, 0);
      assert.equal(notificationCalls, 0);
      assert.equal(referralCalls, 0);
      assert.equal(upsertedTransaction.status, "SUCCEEDED");
      assert.equal(upsertedTransaction.subscriptionId, "subscription-dup-1");
    }
  );
});

test("POST /billing/webhook does not regress succeeded transaction when failed arrives later", async () => {
  const payload = {
    id: "purchase_chip_order_1",
    transaction_id: "txn_chip_order_1",
    status: "failed",
    amount: 7900,
    currency: "usd",
    metadata: {
      userId: "webhook-user-order",
      planName: "PRO",
      planInterval: "month",
      planCurrency: "USD",
      planPrice: 79,
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = hmacSha256(rawBody, process.env.CHIP_WEBHOOK_SECRET);

  let subscriptionUpdateCalls = 0;
  let upsertedTransaction = null;

  await withMethodPatches(
    [
      {
        target: prisma.subscriptionPlan,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.name === "PRO") {
            return {
              id: "22222222-2222-4222-8222-222222222222",
              name: "PRO",
              currency: "USD",
              price: 79,
              trialDays: 0,
            };
          }
          return null;
        },
      },
      {
        target: prisma.transaction,
        method: "findUnique",
        fn: async () => ({ status: "SUCCEEDED", subscriptionId: "subscription-order-1" }),
      },
      {
        target: prisma.subscription,
        method: "findFirst",
        fn: async () => ({
          id: "subscription-order-1",
          userId: "webhook-user-order",
          photographerId: "photographer-order-1",
          plan: "PRO",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
        }),
      },
      {
        target: prisma.subscription,
        method: "update",
        fn: async () => {
          subscriptionUpdateCalls += 1;
          return { id: "subscription-order-1" };
        },
      },
      {
        target: prisma.transaction,
        method: "upsert",
        fn: async ({ create }) => {
          upsertedTransaction = create;
          return { id: "tx-order-1", ...create };
        },
      },
      {
        target: notificationService,
        method: "create",
        fn: async () => ({ id: "note-order-1" }),
      },
      {
        target: referralService,
        method: "markConversionAndReward",
        fn: async () => ({ updated: true }),
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
      assert.equal(subscriptionUpdateCalls, 0);
      assert.equal(upsertedTransaction.status, "SUCCEEDED");
    }
  );
});

test("POST /billing/webhook does not mark past due before current period ends", async () => {
  const payload = {
    id: "purchase_chip_failed_early",
    transaction_id: "txn_chip_failed_early",
    status: "failed",
    amount: 7900,
    currency: "usd",
    metadata: {
      userId: "webhook-user-early-fail",
      planName: "PRO",
      planInterval: "month",
      planCurrency: "USD",
      planPrice: 79,
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = hmacSha256(rawBody, process.env.CHIP_WEBHOOK_SECRET);

  let subscriptionUpdateCalls = 0;
  let notificationCalls = 0;
  let referralCalls = 0;
  let upsertedTransaction = null;

  await withMethodPatches(
    [
      {
        target: prisma.subscriptionPlan,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.name === "PRO") {
            return {
              id: "22222222-2222-4222-8222-222222222222",
              name: "PRO",
              currency: "USD",
              price: 79,
              trialDays: 0,
            };
          }
          return null;
        },
      },
      {
        target: prisma.transaction,
        method: "findUnique",
        fn: async () => null,
      },
      {
        target: prisma.subscription,
        method: "findFirst",
        fn: async () => ({
          id: "subscription-early-fail-1",
          userId: "webhook-user-early-fail",
          photographerId: "photographer-early-fail-1",
          plan: "PRO",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
        }),
      },
      {
        target: prisma.subscription,
        method: "update",
        fn: async () => {
          subscriptionUpdateCalls += 1;
          return { id: "subscription-early-fail-1" };
        },
      },
      {
        target: prisma.transaction,
        method: "upsert",
        fn: async ({ create }) => {
          upsertedTransaction = create;
          return { id: "tx-early-fail-1", ...create };
        },
      },
      {
        target: notificationService,
        method: "create",
        fn: async () => {
          notificationCalls += 1;
          return { id: "note-early-fail-1" };
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
        .set("x-chip-signature", signature)
        .send(rawBody);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.received, true);
      assert.equal(subscriptionUpdateCalls, 0);
      assert.equal(notificationCalls, 0);
      assert.equal(referralCalls, 0);
      assert.equal(upsertedTransaction.status, "FAILED");
      assert.equal(upsertedTransaction.subscriptionId, "subscription-early-fail-1");
    }
  );
});

test("POST /billing/webhook ignores stale success event for previously canceled subscription", async () => {
  const payload = {
    id: "purchase_chip_stale_success",
    transaction_id: "txn_chip_stale_success",
    status: "paid",
    amount: 7900,
    currency: "usd",
    metadata: {
      userId: "webhook-user-stale-success",
      planName: "PRO",
      planInterval: "month",
      planCurrency: "USD",
      planPrice: 79,
      referralCode: "REF-STALE",
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = hmacSha256(rawBody, process.env.CHIP_WEBHOOK_SECRET);

  const staleCanceledSubscription = {
    id: "subscription-stale-pro",
    userId: "webhook-user-stale-success",
    photographerId: "photographer-stale-1",
    plan: "PRO",
    status: "CANCELED",
    currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const activeStudioSubscription = {
    id: "subscription-active-studio",
    userId: "webhook-user-stale-success",
    photographerId: "photographer-stale-1",
    plan: "STUDIO",
    status: "ACTIVE",
    currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
  };

  let createCalls = 0;
  let updateCalls = 0;
  let updateManyCalls = 0;
  let notificationCalls = 0;
  let referralCalls = 0;
  let upsertedTransaction = null;

  await withMethodPatches(
    [
      {
        target: prisma.subscriptionPlan,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.name === "PRO") {
            return {
              id: "22222222-2222-4222-8222-222222222222",
              name: "PRO",
              currency: "USD",
              price: 79,
              trialDays: 0,
            };
          }
          return null;
        },
      },
      {
        target: prisma.transaction,
        method: "findUnique",
        fn: async () => null,
      },
      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) => {
          const tx = {
            user: {
              findUnique: async () => ({
                id: "webhook-user-stale-success",
                photographer: { id: "photographer-stale-1" },
              }),
            },
            subscription: {
              findFirst: async ({ where }) => {
                if (Array.isArray(where?.OR) && where.OR.length > 0) {
                  return staleCanceledSubscription;
                }
                if (where?.plan?.not === "FREE") {
                  return activeStudioSubscription;
                }
                if (where?.status?.in) {
                  return activeStudioSubscription;
                }
                return null;
              },
              create: async ({ data }) => {
                createCalls += 1;
                return { id: "created-subscription", ...data };
              },
              update: async ({ data }) => {
                updateCalls += 1;
                return { id: "updated-subscription", ...data };
              },
              updateMany: async () => {
                updateManyCalls += 1;
                return { count: 0 };
              },
            },
          };
          return callback(tx);
        },
      },
      {
        target: prisma.transaction,
        method: "upsert",
        fn: async ({ create }) => {
          upsertedTransaction = create;
          return { id: "tx-stale-success-1", ...create };
        },
      },
      {
        target: notificationService,
        method: "create",
        fn: async () => {
          notificationCalls += 1;
          return { id: "note-stale-success-1" };
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
        .set("x-chip-signature", signature)
        .send(rawBody);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.received, true);
      assert.equal(createCalls, 0);
      assert.equal(updateCalls, 0);
      assert.equal(updateManyCalls, 0);
      assert.equal(notificationCalls, 0);
      assert.equal(referralCalls, 0);
      assert.equal(upsertedTransaction.subscriptionId, "subscription-active-studio");
      assert.equal(upsertedTransaction.status, "SUCCEEDED");
    }
  );
});
