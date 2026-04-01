import test from "node:test";
import assert from "node:assert";
import { photographerService } from "../src/services/photographerService.js";

test("Dashboard extraction: method delegation works", async (t) => {
  await t.test("dashboardOverview method exists and is callable", async () => {
    assert(
      typeof photographerService.dashboardOverview === "function",
      "dashboardOverview should be a function"
    );
  });

  await t.test("websiteSummary method exists and is callable", async () => {
    assert(
      typeof photographerService.websiteSummary === "function",
      "websiteSummary should be a function"
    );
  });
});

test("Dashboard extraction: module structure verification", async (t) => {
  await t.test("photographerDashboardService is properly exported", async () => {
    const { photographerDashboardService } = await import(
      "../src/services/photographer/photographerDashboardService.js"
    );
    assert(photographerDashboardService, "photographerDashboardService should be exported");
    assert(
      typeof photographerDashboardService.dashboardOverview === "function",
      "dashboardOverview should be exported from service"
    );
    assert(
      typeof photographerDashboardService.websiteSummary === "function",
      "websiteSummary should be exported from service"
    );
  });

  await t.test("all facade methods still available", async () => {
    // Profile methods
    assert(
      typeof photographerService.getProfile === "function",
      "getProfile should be available via facade (Phase 5)"
    );
    // Portfolio methods
    assert(
      typeof photographerService.listPortfolioItems === "function",
      "listPortfolioItems should be available via facade"
    );
    // Service methods
    assert(
      typeof photographerService.listServices === "function",
      "listServices should be available via facade (Phase 2)"
    );
    // Package methods
    assert(
      typeof photographerService.listPackages === "function",
      "listPackages should be available via facade (Phase 2)"
    );
    // Availability methods
    assert(
      typeof photographerService.getAvailability === "function",
      "getAvailability should be available via facade (Phase 3)"
    );
    // Analytics methods
    assert(
      typeof photographerService.analyticsOverview === "function",
      "analyticsOverview should be available via facade (Phase 4)"
    );
  });
});
