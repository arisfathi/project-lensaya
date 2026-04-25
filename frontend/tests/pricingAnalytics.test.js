import assert from "node:assert/strict";
import test from "node:test";

import { buildPricingAnalyticsMetadata } from "../src/lib/pricingAnalytics.js";

test("buildPricingAnalyticsMetadata normalizes core pricing fields", () => {
  const metadata = buildPricingAnalyticsMetadata({
    eventName: "usage_limit_blocked",
    pageContext: "dashboard_overview_usage",
    currentPlan: "free",
    targetPlan: "pro",
    featureKey: "services",
    currentUsage: 12,
    allowedLimit: 10,
  });

  assert.equal(metadata.event_name, "usage_limit_blocked");
  assert.equal(metadata.page_context, "dashboard_overview_usage");
  assert.equal(metadata.current_plan, "FREE");
  assert.equal(metadata.target_plan, "PRO");
  assert.equal(metadata.feature_key, "services");
  assert.equal(metadata.current_usage, 12);
  assert.equal(metadata.allowed_limit, 10);
});

test("buildPricingAnalyticsMetadata tolerates unknown plans and merges extra metadata", () => {
  const metadata = buildPricingAnalyticsMetadata({
    eventName: "pricing_compare_interaction",
    pageContext: "public_pricing_page",
    currentPlan: "anonymous",
    targetPlan: null,
    featureKey: null,
    currentUsage: null,
    allowedLimit: null,
    metadata: {
      interaction: "billing_cycle_toggle",
      selected_cycle: "yearly",
    },
  });

  assert.equal(metadata.current_plan, null);
  assert.equal(metadata.target_plan, null);
  assert.equal(metadata.feature_key, null);
  assert.equal(metadata.interaction, "billing_cycle_toggle");
  assert.equal(metadata.selected_cycle, "yearly");
});
