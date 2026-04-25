import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";

const { app } = await import("../src/app.js");
const { planLimitService } = await import("../src/services/planLimitService.js");

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

test("billing plans: exposes admin-configurable plan gates (limits/features/entitlements)", async () => {
  await withMethodPatches(
    [
      {
        target: planLimitService,
        method: "listAllPlans",
        fn: async () => {
          const raw = [
            {
              id: "p-free",
              name: "FREE",
              sortOrder: 1,
              price: 0,
              yearlyPrice: 0,
              currency: "MYR",
              trialDays: 0,
              referralReward: 0,
              storageCostPerGB: 0,
              maxServices: 3,
              maxPortfolioImages: 30,
              maxPackagesPerService: 5,
              maxPackageFeaturesPerPackage: 5,
              storageGb: 1,
              leadHistoryDays: 30,
              leadVisibilityLimit: 60,
              leadTemplatesCount: 1,
              teamSeats: 1,
              analyticsEnabled: false,
              customDomainEnabled: false,
              hideBrandingEnabled: false,
              leadFiltersEnabled: false,
              leadExportEnabled: false,
              leadRemindersEnabled: false,
              leadAdvancedAnalyticsEnabled: false,
              teamToolsEnabled: false,
              analyticsMode: "NONE",
              leadAnalyticsMode: "NONE",
              supportTier: "STANDARD",
              brandingMode: "FORCED_LENSAYA",
              leadChannels: { whatsapp: true, email: true },
              displayName: "Free",
              tagline: "For getting started",
              subtitle: "Launch your portfolio and start collecting inquiries.",
              badgeText: "Get Started",
              ctaText: "Get Started Free",
              monthlyPriceDisplay: "MYR 0 / month",
              yearlyPriceDisplay: "MYR 0 / year",
              isVisible: true,
              isActive: true,
              isMostPopular: false,
            },
          ];

          return raw.map((row) => planLimitService.normalizePlanRow(row, raw));
        },
      },
    ],
    async () => {
      const res = await request(app).get("/api/v1/billing/plans");
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const [plan] = res.body.data.plans;
      assert.equal(plan.id, "FREE");
      assert.equal(plan.currency, "MYR");

      assert.equal(plan.limits.services, 3);
      assert.equal(plan.limits.portfolioPhotos, 30);
      assert.equal(plan.limits.packagesPerService, 5);
      assert.equal(plan.limits.packageFeatures, 5);
      assert.equal(plan.limits.storage, 1);
      assert.equal(plan.limits.customDomain, false);
      assert.equal(plan.limits.analyticsTools, false);
      assert.equal(plan.limits.teamSectionTools, false);

      assert.equal(plan.features.removeLensayaBranding, false);
      assert.equal(plan.features.leadFiltersEnabled, false);
      assert.equal(plan.features.leadExportEnabled, false);

      assert.equal(plan.entitlements.name, "FREE");
      assert.equal(plan.entitlements.modes.brandingMode, "FORCED_LENSAYA");
      assert.equal(plan.entitlements.leadChannels.whatsapp, true);
    }
  );
});

