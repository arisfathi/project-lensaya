import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/config/prisma.js");
const { photographerService } = await import("../src/services/photographerService.js");
const { signAccessToken } = await import("../src/utils/jwt.js");

const makeToken = (sub, role = "PHOTOGRAPHER") =>
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

test("GET /dashboard/overview and /dashboard/website-summary are mounted for verified users", async () => {
  const userId = "dashboard-user-1";

  await withMethodPatches(
    [
      {
        target: prisma.user,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.id !== userId) return null;
          return {
            id: userId,
            status: "ACTIVE",
            emailVerifiedAt: new Date("2026-03-27T00:00:00.000Z"),
          };
        },
      },
      {
        target: photographerService,
        method: "dashboardOverview",
        fn: async () => ({
          photographerId: "photographer-1",
          stats: { portfolioViews: 0, whatsappClicks: 0, inquiries: 0, conversionRate: 0 },
          trafficSeries: [],
          categorySeries: [],
          analyticsAccess: {
            tier: "FREE",
            hasFullAccess: false,
            upgradeTarget: "PRO",
            lockedSections: [],
          },
          analyticsPreview: {
            topCategories: [],
            totalCategoriesTracked: 0,
          },
          quickCounts: {
            portfolioCount: 0,
            serviceCount: 0,
            packageCount: 0,
            bookingCount: 0,
          },
        }),
      },
      {
        target: photographerService,
        method: "websiteSummary",
        fn: async () => ({
          websiteUrl: "https://example.com",
          portfolioCount: 0,
          serviceCount: 0,
          packageCount: 0,
          lastUpdated: new Date("2026-03-27T00:00:00.000Z"),
        }),
      },
    ],
    async () => {
      const token = makeToken(userId);

      const overviewRes = await request(app)
        .get("/api/v1/dashboard/overview")
        .set("Authorization", `Bearer ${token}`);

      assert.equal(overviewRes.status, 200);
      assert.equal(overviewRes.body.success, true);
      assert.equal(overviewRes.body.data.photographerId, "photographer-1");

      const websiteRes = await request(app)
        .get("/api/v1/dashboard/website-summary")
        .set("Authorization", `Bearer ${token}`);

      assert.equal(websiteRes.status, 200);
      assert.equal(websiteRes.body.success, true);
      assert.equal(websiteRes.body.data.websiteUrl, "https://example.com");
    }
  );
});