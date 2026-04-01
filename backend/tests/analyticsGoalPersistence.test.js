import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { analyticsGoalUpdateSchema } = await import("../src/utils/validationSchemas.js");
const { prisma } = await import("../src/config/prisma.js");
const { photographerAnalyticsService } = await import("../src/services/photographer/photographerAnalyticsService.js");

const withMethodPatch = async (target, method, fn, callback) => {
  const original = target[method];
  target[method] = fn;
  try {
    await callback();
  } finally {
    target[method] = original;
  }
};

test("analyticsGoalUpdateSchema accepts positive integer target", () => {
  const result = analyticsGoalUpdateSchema.safeParse({ inquiryGoalTarget: 24 });
  assert.equal(result.success, true);
});

test("analyticsGoalUpdateSchema rejects non-positive target", () => {
  const result = analyticsGoalUpdateSchema.safeParse({ inquiryGoalTarget: 0 });
  assert.equal(result.success, false);
});

test("updateAnalyticsGoal persists inquiry goal target", async () => {
  let capturedArgs = null;

  await withMethodPatch(
    prisma.photographer,
    "update",
    async (args) => {
      capturedArgs = args;
      return { inquiryGoalTarget: 31 };
    },
    async () => {
      const response = await photographerAnalyticsService.updateAnalyticsGoal(
        { photographerId: "11111111-1111-4111-8111-111111111111" },
        { inquiryGoalTarget: 31 }
      );

      assert.deepEqual(response, { inquiryGoalTarget: 31 });
    }
  );

  assert.ok(capturedArgs);
  assert.equal(capturedArgs.where.id, "11111111-1111-4111-8111-111111111111");
  assert.equal(capturedArgs.data.inquiryGoalTarget, 31);
});
