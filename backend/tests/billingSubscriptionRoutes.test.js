import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lensaya?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { app } = await import("../src/app.js");
const { billingService } = await import("../src/services/billingService.js");
const { signAccessToken } = await import("../src/utils/jwt.js");

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

const makeAccessToken = (sub) =>
  signAccessToken({
    sub,
    role: "PHOTOGRAPHER",
    email: `${sub}@example.com`,
    username: sub,
  });

test("POST /billing/change-plan delegates to billingService.changePlan", async () => {
  const token = makeAccessToken("billing-route-user-1");
  let capturedUserId = null;
  let capturedPayload = null;

  await withMethodPatches(
    [
      {
        target: billingService,
        method: "changePlan",
        fn: async (userId, payload) => {
          capturedUserId = userId;
          capturedPayload = payload;
          return {
            action: "checkout_required",
            currentPlan: "FREE",
            targetPlan: "PRO",
            billingCycle: "monthly",
            checkoutUrl: "https://checkout.stripe.test/session-1",
            sessionId: "cs_test_1",
          };
        },
      },
    ],
    async () => {
      const response = await request(app)
        .post("/api/v1/billing/change-plan")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetPlanId: "PRO",
          billingCycle: "monthly",
          successUrl: "https://app.example.com/checkout/success",
          cancelUrl: "https://app.example.com/checkout/canceled",
        });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.action, "checkout_required");
      assert.equal(capturedUserId, "billing-route-user-1");
      assert.equal(capturedPayload.targetPlanId, "PRO");
      assert.equal(capturedPayload.billingCycle, "monthly");
    }
  );
});

test("POST /billing/subscription/cancel delegates to billingService.cancelSubscription", async () => {
  const token = makeAccessToken("billing-route-user-2");
  let capturedUserId = null;
  let capturedPayload = null;

  await withMethodPatches(
    [
      {
        target: billingService,
        method: "cancelSubscription",
        fn: async (userId, payload) => {
          capturedUserId = userId;
          capturedPayload = payload;
          return {
            action: "scheduled",
            plan: "PRO",
            status: "ACTIVE",
            renewAt: new Date("2026-06-01T00:00:00.000Z").toISOString(),
            usage: {},
          };
        },
      },
    ],
    async () => {
      const response = await request(app)
        .post("/api/v1/billing/subscription/cancel")
        .set("Authorization", `Bearer ${token}`)
        .send({ atPeriodEnd: true });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.action, "scheduled");
      assert.equal(capturedUserId, "billing-route-user-2");
      assert.equal(capturedPayload.atPeriodEnd, true);
    }
  );
});

test("POST /billing/subscription/resume delegates to billingService.resumeSubscription", async () => {
  const token = makeAccessToken("billing-route-user-3");
  let capturedUserId = null;

  await withMethodPatches(
    [
      {
        target: billingService,
        method: "resumeSubscription",
        fn: async (userId) => {
          capturedUserId = userId;
          return {
            action: "resumed",
            plan: "PRO",
            status: "ACTIVE",
            renewAt: new Date("2026-06-01T00:00:00.000Z").toISOString(),
            usage: {},
          };
        },
      },
    ],
    async () => {
      const response = await request(app)
        .post("/api/v1/billing/subscription/resume")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.action, "resumed");
      assert.equal(capturedUserId, "billing-route-user-3");
    }
  );
});

test("POST /billing/portal-session delegates to billingService.createPortalSession", async () => {
  const token = makeAccessToken("billing-route-user-4");
  let capturedUserId = null;
  let capturedReturnUrl = null;

  await withMethodPatches(
    [
      {
        target: billingService,
        method: "createPortalSession",
        fn: async (userId, returnUrl) => {
          capturedUserId = userId;
          capturedReturnUrl = returnUrl;
          return {
            portalUrl: "https://billing.stripe.com/session/test_1",
            returnUrl,
            provider: "stripe",
            capabilities: {
              changePlan: true,
              cancelAtPeriodEnd: true,
              resume: false,
              transactions: true,
              inAppBillingCenter: true,
            },
            subscription: {
              plan: "PRO",
              status: "ACTIVE",
              billingState: "active",
              renewAt: new Date("2026-06-01T00:00:00.000Z").toISOString(),
              billingCycle: "monthly",
              cancelAtPeriodEnd: false,
              pendingChange: null,
            },
          };
        },
      },
    ],
    async () => {
      const response = await request(app)
        .post("/api/v1/billing/portal-session")
        .set("Authorization", `Bearer ${token}`)
        .send({ returnUrl: "https://app.example.com/dashboard/transactions?billing=1" });

      assert.equal(response.status, 201);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.provider, "stripe");
      assert.equal(capturedUserId, "billing-route-user-4");
      assert.equal(capturedReturnUrl, "https://app.example.com/dashboard/transactions?billing=1");
    }
  );
});
