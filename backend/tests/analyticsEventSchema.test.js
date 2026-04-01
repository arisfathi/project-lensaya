import assert from "node:assert/strict";
import test from "node:test";

const { analyticsEventSchema } = await import("../src/utils/validationSchemas.js");

const baseEvent = {
  eventType: "OTHER",
  photographerId: "11111111-1111-4111-8111-111111111111",
};

test("analyticsEventSchema accepts OTHER event with known metadata kind", () => {
  const result = analyticsEventSchema.safeParse({
    ...baseEvent,
    metadata: {
      kind: "analytics_upgrade_cta",
      surface: "analytics_hero",
    },
  });

  assert.equal(result.success, true);
});

test("analyticsEventSchema accepts insight click with allowed action", () => {
  const result = analyticsEventSchema.safeParse({
    ...baseEvent,
    metadata: {
      kind: "analytics_insight_action_click",
      action: "optimize_packages",
    },
  });

  assert.equal(result.success, true);
});

test("analyticsEventSchema rejects unknown metadata kind for OTHER event", () => {
  const result = analyticsEventSchema.safeParse({
    ...baseEvent,
    metadata: {
      kind: "custom_experiment_kind",
    },
  });

  assert.equal(result.success, false);
});

test("analyticsEventSchema rejects invalid insight action", () => {
  const result = analyticsEventSchema.safeParse({
    ...baseEvent,
    metadata: {
      kind: "analytics_insight_action_click",
      action: "click_anything",
    },
  });

  assert.equal(result.success, false);
});

test("analyticsEventSchema rejects action when kind is not insight action", () => {
  const result = analyticsEventSchema.safeParse({
    ...baseEvent,
    metadata: {
      kind: "analytics_upgrade_cta",
      action: "optimize_packages",
    },
  });

  assert.equal(result.success, false);
});
