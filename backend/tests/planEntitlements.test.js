import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { app } = await import("../src/app.js");
const { planLimitService } = await import("../src/services/planLimitService.js");
const { adminService } = await import("../src/services/adminService.js");
const { signAccessToken } = await import("../src/utils/jwt.js");

const makeToken = (sub, role = "ADMIN") =>
  signAccessToken({
    sub,
    role,
    email: `${sub}@example.com`,
    username: sub,
  });

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

test("plan entitlements: resolves normalized object and upgrade target", async () => {
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
            maxServices: 3,
            maxPortfolioImages: 60,
            maxPackagesPerService: 3,
            maxPackageFeaturesPerPackage: 5,
            storageGb: 1,
            analyticsEnabled: false,
            customDomainEnabled: false,
            hideBrandingEnabled: false,
            leadFiltersEnabled: false,
            leadExportEnabled: false,
            leadRemindersEnabled: false,
            leadAdvancedAnalyticsEnabled: false,
            teamToolsEnabled: false,
            leadHistoryDays: 30,
            leadVisibilityLimit: 60,
            leadTemplatesCount: 1,
            teamSeats: 1,
            analyticsMode: "NONE",
            leadAnalyticsMode: "NONE",
            supportTier: "STANDARD",
            brandingMode: "FORCED_LENSAYA",
            displayName: "Free",
            ctaText: "Get Started Free",
            isVisible: true,
            isActive: true,
            isMostPopular: false,
          },
          {
            id: "p-pro",
            name: "PRO",
            sortOrder: 2,
            maxServices: 12,
            maxPortfolioImages: 600,
            maxPackagesPerService: 10,
            maxPackageFeaturesPerPackage: 10,
            storageGb: 25,
            analyticsEnabled: true,
            customDomainEnabled: true,
            hideBrandingEnabled: true,
            leadFiltersEnabled: true,
            leadExportEnabled: true,
            leadRemindersEnabled: true,
            leadAdvancedAnalyticsEnabled: true,
            teamToolsEnabled: false,
            leadHistoryDays: 365,
            leadVisibilityLimit: -1,
            leadTemplatesCount: 8,
            teamSeats: 3,
            analyticsMode: "ADVANCED",
            leadAnalyticsMode: "ADVANCED",
            supportTier: "STANDARD",
            brandingMode: "REMOVABLE",
            displayName: "Pro",
            ctaText: "Start Pro",
            isVisible: true,
            isActive: true,
            isMostPopular: true,
          },
          ];

          return raw.map((row) => planLimitService.normalizePlanRow(row, raw));
        },
      },
      {
        target: planLimitService,
        method: "getPlanByName",
        fn: async (name) => {
          const plans = await planLimitService.listAllPlans();
          return plans.find((plan) => plan.name === String(name || "").toUpperCase()) || plans[0];
        },
      },
    ],
    async () => {
      const entitlements = await planLimitService.getPlanEntitlements("FREE");
      assert.equal(entitlements.name, "FREE");
      assert.equal(entitlements.limits.maxServices, 3);
      assert.equal(entitlements.features.customDomainEnabled, false);
      assert.equal(entitlements.upgradeTarget, "PRO");
    }
  );
});

test("plan entitlements: unlimited values are preserved", async () => {
  const normalized = planLimitService.normalizePlanRow(
    {
      id: "studio",
      name: "STUDIO",
      maxServices: -1,
      maxPortfolioImages: -1,
      maxPackagesPerService: -1,
      maxPackageFeaturesPerPackage: 20,
      storageGb: -1,
      leadVisibilityLimit: -1,
      leadHistoryDays: -1,
      leadTemplatesCount: -1,
      analyticsEnabled: true,
      customDomainEnabled: true,
      teamToolsEnabled: true,
      hideBrandingEnabled: true,
      leadFiltersEnabled: true,
      leadExportEnabled: true,
      leadRemindersEnabled: true,
      leadAdvancedAnalyticsEnabled: true,
      analyticsMode: "ADVANCED",
      leadAnalyticsMode: "ADVANCED",
      supportTier: "PRIORITY",
      brandingMode: "REMOVABLE",
      leadChannels: { whatsapp: true, email: true },
    },
    []
  );

  const mapped = planLimitService.mapPlanLimits(normalized);
  assert.equal(mapped.services, -1);
  assert.equal(mapped.portfolioImages, -1);
  assert.equal(mapped.storage, -1);
  assert.equal(planLimitService.isLimitReached({ used: 1000, max: -1 }), false);
});

test("plan entitlements: missing config falls back to safe defaults", async () => {
  const normalized = planLimitService.normalizePlanRow({ id: "free", name: "FREE" }, []);
  assert.equal(normalized.maxServices, 3);
  assert.equal(normalized.maxPortfolioImages, 60);
  assert.equal(normalized.analyticsEnabled, false);
  assert.equal(normalized.customDomainEnabled, false);
  assert.equal(normalized.displayName, "Free");
});

test("admin plan update validation rejects invalid analytics mode", async () => {
  const token = makeToken("admin-validation", "ADMIN");

  await withMethodPatches(
    [{ target: adminService, method: "updatePlan", fn: async () => ({ id: "p1" }) }],
    async () => {
      const res = await request(app)
        .put("/api/v1/admin/plans/3fa85f64-5717-4562-b3fc-2c963f66afa6")
        .set("Authorization", `Bearer ${token}`)
        .send({ analyticsMode: "INVALID_MODE" });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    }
  );
});

test("plan entitlements: canAddService returns blocked result with upgrade message when limit reached", async () => {
  await withMethodPatches(
    [
      {
        target: planLimitService,
        method: "getPlanByPhotographerId",
        fn: async () =>
          planLimitService.normalizePlanRow(
            {
              name: "FREE",
              maxServices: 1,
              maxPortfolioImages: 60,
              maxPackagesPerService: 3,
            },
            []
          ),
      },
      {
        target: planLimitService,
        method: "getUpgradeRecommendation",
        fn: async () => ({ plan: { name: "PRO" }, limit: 12 }),
      },
    ],
    async () => {
      const gate = await planLimitService.canAddService({ photographerId: "p1", used: 1 });
      assert.equal(gate.allowed, false);
      assert.equal(gate.metric, "services");
      assert.equal(gate.used, 1);
      assert.equal(gate.limit, 1);
      assert.equal(gate.upgradeTarget, "PRO");
      assert.match(String(gate.message || ""), /Upgrade to Pro/i);
      assert.match(String(gate.message || ""), /\(1\/1\)/);
    }
  );
});

test("plan entitlements: canUploadPortfolioImage allows unlimited plans", async () => {
  await withMethodPatches(
    [
      {
        target: planLimitService,
        method: "getPlanByPhotographerId",
        fn: async () =>
          planLimitService.normalizePlanRow(
            {
              name: "STUDIO",
              maxServices: -1,
              maxPortfolioImages: -1,
              maxPackagesPerService: -1,
            },
            []
          ),
      },
    ],
    async () => {
      const gate = await planLimitService.canUploadPortfolioImage({ photographerId: "p1", used: 9999 });
      assert.equal(gate.allowed, true);
      assert.equal(gate.metric, "portfolioImages");
      assert.equal(gate.limit, -1);
      assert.equal(gate.message, null);
    }
  );
});

test("plan entitlements: feature gate helpers return consistent blocked messages", async () => {
  await withMethodPatches(
    [
      {
        target: planLimitService,
        method: "getPlanEntitlementsByPhotographerId",
        fn: async () => ({
          name: "FREE",
          upgradeTarget: "PRO",
          features: {
            customDomainEnabled: false,
            leadExportEnabled: false,
            leadRemindersEnabled: false,
            teamToolsEnabled: false,
          },
        }),
      },
      {
        target: planLimitService,
        method: "getPlanEntitlementsByUserId",
        fn: async () => ({
          name: "FREE",
          upgradeTarget: "PRO",
          features: {
            hideBrandingEnabled: false,
          },
          modes: {
            brandingMode: "FORCED_LENSAYA",
          },
        }),
      },
    ],
    async () => {
      const customDomain = await planLimitService.canUseCustomDomain({ photographerId: "p1" });
      const leadExport = await planLimitService.canExportLeads({ photographerId: "p1" });
      const leadReminders = await planLimitService.canUseLeadReminders({ photographerId: "p1" });
      const teamTools = await planLimitService.canUseTeamTools({ photographerId: "p1" });
      const branding = await planLimitService.canHideBranding({ userId: "u1" });

      for (const gate of [customDomain, leadExport, leadReminders, teamTools, branding]) {
        assert.equal(gate.allowed, false);
        assert.equal(gate.upgradeTarget, "PRO");
        assert.match(String(gate.message || ""), /Upgrade to Pro/i);
      }
    }
  );
});
