import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import bcrypt from "bcryptjs";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CHIP_WEBHOOK_SECRET = process.env.CHIP_WEBHOOK_SECRET || "chip-webhook-secret";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/config/prisma.js");
const { authService } = await import("../src/services/authService.js");
const { bookingService } = await import("../src/services/bookingService.js");
const { billingService } = await import("../src/services/billingService.js");
const { emailService } = await import("../src/services/emailService.js");
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

test("authService.signup dispatches welcome email asynchronously", async () => {
  let sendWelcomeCalls = 0;
  const SEND_DELAY_MS = 140;

  await withMethodPatches(
    [
      {
        target: bcrypt,
        method: "hash",
        fn: async () => "hashed-password",
      },
      {
        target: prisma.user,
        method: "findUnique",
        fn: async () => null,
      },
      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) => {
          const tx = {
            user: {
              create: async ({ data }) => ({
                id: "signup-user-1",
                email: data.email,
                fullName: data.fullName,
                role: data.role || "PHOTOGRAPHER",
                status: "ACTIVE",
              }),
              findUnique: async () => ({
                id: "signup-user-1",
                email: "new@example.com",
                fullName: "New User",
                role: "PHOTOGRAPHER",
                status: "ACTIVE",
                photographer: {
                  id: "signup-photographer-1",
                  username: "newuser",
                },
              }),
            },
            photographer: {
              findUnique: async () => null,
              create: async ({ data }) => ({
                id: "signup-photographer-1",
                ...data,
              }),
            },
            subscriptionPlan: {
              findFirst: async () => ({
                name: "FREE",
                trialDays: 0,
              }),
            },
            subscription: {
              create: async ({ data }) => ({
                id: "signup-subscription-1",
                ...data,
              }),
            },
          };

          return callback(tx);
        },
      },
      {
        target: emailService,
        method: "sendWelcome",
        fn: async () => {
          sendWelcomeCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
          return { id: "email-welcome-1" };
        },
      },
    ],
    async () => {
      const startedAt = Date.now();
      const result = await authService.signup(
        {
          fullName: "New User",
          email: "new@example.com",
          password: "Password123!",
        },
        { requestId: "signup-req-1" }
      );
      const elapsedMs = Date.now() - startedAt;

      assert.equal(result.user.email, "new@example.com");
      assert.ok(elapsedMs < SEND_DELAY_MS);

      await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS + 30));
      assert.equal(sendWelcomeCalls, 1);
    }
  );
});

test("POST /public/bookings accepts inquiry payload and returns booking intent response", async () => {
  let capturedPayload = null;
  let capturedContext = null;

  await withMethodPatches(
    [
      {
        target: bookingService,
        method: "createPublicBooking",
        fn: async (payload, context) => {
          capturedPayload = payload;
          capturedContext = context;
          return {
            bookingId: "booking-intent-1",
            status: "pending",
            whatsappUrl: "https://wa.me/60123456789",
            summary: "Booking summary",
          };
        },
      },
    ],
    async () => {
      const res = await request(app).post("/api/v1/public/bookings").send({
        photographerUsername: "studioalpha",
        name: "Client Name",
        email: "client@example.com",
        preferredDate: "2026-06-01T00:00:00.000Z",
        message: "Need wedding coverage",
        source: "WEBSITE",
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.bookingId, "booking-intent-1");
      assert.equal(capturedPayload.photographerUsername, "studioalpha");
      assert.equal(capturedPayload.name, "Client Name");
      assert.ok(capturedContext);
      assert.equal(typeof capturedContext.requestId, "string");
    }
  );
});

test("POST /billing/webhook rejects malformed payloads with missing required fields", async () => {
  const malformedPayload = {
    id: "purchase-malformed-1",
    transaction_id: "txn-malformed-1",
  };
  const rawBody = JSON.stringify(malformedPayload);
  const signature = hmacSha256(rawBody, process.env.CHIP_WEBHOOK_SECRET);

  const res = await request(app)
    .post("/api/v1/billing/webhook")
    .set("Content-Type", "application/json")
    .set("x-chip-signature", signature)
    .send(rawBody);

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test("POST /billing/webhook accepts wrapped payload shape and normalizes data for handler", async () => {
  const innerPayload = {
    id: "purchase-wrap-1",
    transaction_id: "txn-wrap-1",
    status: "paid",
    amount: 7900,
    currency: "usd",
    metadata: { userId: "wrapped-user" },
  };
  const wrappedPayload = {
    event: "payment.updated",
    data: innerPayload,
  };
  const rawBody = JSON.stringify(wrappedPayload);
  const signature = hmacSha256(rawBody, process.env.CHIP_WEBHOOK_SECRET);

  let receivedPayload = null;

  await withMethodPatches(
    [
      {
        target: billingService,
        method: "handlePaymentWebhook",
        fn: async (payload) => {
          receivedPayload = payload;
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
      assert.equal(receivedPayload.id, "purchase-wrap-1");
      assert.equal(receivedPayload.transaction_id, "txn-wrap-1");
      assert.equal(receivedPayload.status, "paid");
      assert.equal(receivedPayload._envelope.event, "payment.updated");
    }
  );
});
