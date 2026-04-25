import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lensaya?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { billingReceiptService } = await import("../src/services/billingReceiptService.js");
const { prisma } = await import("../src/config/prisma.js");
const { emailService } = await import("../src/services/emailService.js");

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

test("billingReceiptService.sendReceiptForTransaction sends email and persists receipt marker", async () => {
  let sentEmail = null;
  let updatedMetadata = null;

  await withMethodPatches(
    [
      {
        target: prisma.transaction,
        method: "findUnique",
        fn: async () => ({
          id: "tx-1",
          status: "SUCCEEDED",
          amountCents: 7900,
          currency: "USD",
          provider: "STRIPE",
          providerTransactionId: "txn_123",
          processedAt: new Date("2026-04-15T00:00:00.000Z"),
          createdAt: new Date("2026-04-15T00:00:00.000Z"),
          metadata: { metadataKey: "value" },
          subscription: { plan: "PRO", billingInterval: "MONTHLY" },
          user: { email: "customer@example.com", fullName: "Customer One" },
        }),
      },
      {
        target: emailService,
        method: "send",
        fn: async (payload) => {
          sentEmail = payload;
          return { id: "email_1" };
        },
      },
      {
        target: prisma.transaction,
        method: "update",
        fn: async ({ data }) => {
          updatedMetadata = data?.metadata || null;
          return { id: "tx-1" };
        },
      },
    ],
    async () => {
      const result = await billingReceiptService.sendReceiptForTransaction("tx-1");
      assert.equal(result.sent, true);
      assert.ok(result.receiptNumber);
    }
  );

  assert.ok(sentEmail);
  assert.equal(sentEmail.to, "customer@example.com");
  assert.ok(String(sentEmail.subject).includes("receipt"));
  assert.ok(String(sentEmail.html).includes("Receipt"));

  assert.ok(updatedMetadata);
  assert.equal(updatedMetadata.metadataKey, "value");
  assert.ok(updatedMetadata.lensayaReceipt);
  assert.ok(updatedMetadata.lensayaReceipt.sentAt);
  assert.equal(updatedMetadata.lensayaReceipt.email, "customer@example.com");
});

test("billingReceiptService.sendReceiptForTransaction skips when already sent", async () => {
  let sendCalled = 0;
  let updateCalled = 0;

  await withMethodPatches(
    [
      {
        target: prisma.transaction,
        method: "findUnique",
        fn: async () => ({
          id: "tx-2",
          status: "SUCCEEDED",
          amountCents: 7900,
          currency: "USD",
          provider: "STRIPE",
          providerTransactionId: "txn_456",
          processedAt: new Date("2026-04-15T00:00:00.000Z"),
          createdAt: new Date("2026-04-15T00:00:00.000Z"),
          metadata: { lensayaReceipt: { number: "LSY-20260415-TX2", sentAt: "2026-04-15T00:01:00.000Z" } },
          subscription: { plan: "PRO", billingInterval: "MONTHLY" },
          user: { email: "customer@example.com", fullName: "Customer One" },
        }),
      },
      {
        target: emailService,
        method: "send",
        fn: async () => {
          sendCalled += 1;
          return { id: "email_2" };
        },
      },
      {
        target: prisma.transaction,
        method: "update",
        fn: async () => {
          updateCalled += 1;
          return { id: "tx-2" };
        },
      },
    ],
    async () => {
      const result = await billingReceiptService.sendReceiptForTransaction("tx-2");
      assert.equal(result.skipped, true);
      assert.equal(result.reason, "already_sent");
    }
  );

  assert.equal(sendCalled, 0);
  assert.equal(updateCalled, 0);
});
