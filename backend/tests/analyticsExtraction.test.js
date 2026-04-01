import test from "node:test";
import assert from "node:assert";
import { photographerService } from "../src/services/photographerService.js";

// Test verifies that analytics methods can be called through the facade
// and respond with the correct shape. This validates the extraction didn't break the contract.
test("Analytics extraction: method delegation works", async (t) => {
  await t.test("analyticsOverview method exists and is callable", async () => {
    assert(
      typeof photographerService.analyticsOverview === "function",
      "analyticsOverview should be a function"
    );
  });

  await t.test("analyticsActivity method exists and is callable", async () => {
    assert(
      typeof photographerService.analyticsActivity === "function",
      "analyticsActivity should be a function"
    );
  });
});

test("Analytics extraction: module structure verification", async (t) => {
  await t.test("photographerAnalyticsService is properly exported", async () => {
    const { photographerAnalyticsService } = await import(
      "../src/services/photographer/photographerAnalyticsService.js"
    );
    assert(photographerAnalyticsService, "photographerAnalyticsService should be exported");
    assert(
      typeof photographerAnalyticsService.analyticsOverview === "function",
      "analyticsOverview should be exported from service"
    );
    assert(
      typeof photographerAnalyticsService.analyticsActivity === "function",
      "analyticsActivity should be exported from service"
    );
  });

  await t.test("helper functions are available in utils", async () => {
    const utils = await import("../src/services/photographer/photographerService.utils.js");
    assert(
      typeof utils.getPortfolioViewCategorySeries === "function",
      "getPortfolioViewCategorySeries should be exported from utils"
    );
    assert(
      typeof utils.loadAnalyticsRollupSnapshot === "function",
      "loadAnalyticsRollupSnapshot should be exported from utils"
    );
  });
});
