import test from "node:test";
import assert from "node:assert";
import { photographerService } from "../src/services/photographerService.js";

test("Profile extraction: method delegation works", async (t) => {
  await t.test("getProfile method exists and is callable", async () => {
    assert(
      typeof photographerService.getProfile === "function",
      "getProfile should be a function"
    );
  });

  await t.test("previewUsername method exists and is callable", async () => {
    assert(
      typeof photographerService.previewUsername === "function",
      "previewUsername should be a function"
    );
  });

  await t.test("updateProfile method exists and is callable", async () => {
    assert(
      typeof photographerService.updateProfile === "function",
      "updateProfile should be a function"
    );
  });

  await t.test("updateHero method exists and is callable", async () => {
    assert(
      typeof photographerService.updateHero === "function",
      "updateHero should be a function"
    );
  });
});

test("Profile extraction: module structure verification", async (t) => {
  await t.test("photographerProfileService is properly exported", async () => {
    const { photographerProfileService } = await import(
      "../src/services/photographer/photographerProfileService.js"
    );
    assert(photographerProfileService, "photographerProfileService should be exported");
    assert(
      typeof photographerProfileService.getProfile === "function",
      "getProfile should be exported from service"
    );
    assert(
      typeof photographerProfileService.previewUsername === "function",
      "previewUsername should be exported from service"
    );
    assert(
      typeof photographerProfileService.updateProfile === "function",
      "updateProfile should be exported from service"
    );
    assert(
      typeof photographerProfileService.updateHero === "function",
      "updateHero should be exported from service"
    );
  });

  await t.test("dashboard methods still exist in facade", async () => {
    assert(
      typeof photographerService.dashboardOverview === "function",
      "dashboardOverview should still be available"
    );
    assert(
      typeof photographerService.websiteSummary === "function",
      "websiteSummary should still be available"
    );
  });

  await t.test("portfolio methods still exist in facade", async () => {
    assert(
      typeof photographerService.listPortfolioItems === "function",
      "listPortfolioItems should still be available"
    );
    assert(
      typeof photographerService.createPortfolioItem === "function",
      "createPortfolioItem should still be available"
    );
  });

  await t.test("already-extracted methods still available via facade", async () => {
    assert(
      typeof photographerService.listServices === "function",
      "listServices should be available via facade (Phase 2)"
    );
    assert(
      typeof photographerService.getAvailability === "function",
      "getAvailability should be available via facade (Phase 3)"
    );
    assert(
      typeof photographerService.analyticsOverview === "function",
      "analyticsOverview should be available via facade (Phase 4)"
    );
  });
});
