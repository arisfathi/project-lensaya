import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { app } = await import("../src/app.js");
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

const authHeader = () => ({ Authorization: `Bearer ${makeToken("admin-contract", "ADMIN")}` });

test("contract: GET /api/v1/admin/dashboard/overview", async () => {
  const expected = {
    stats: { totalPhotographers: 12, activePhotographers: 7, monthlyRevenue: 1234.5, totalImagesStored: 42 },
    growthSeries: [{ month: "Jan", photographers: 1 }],
    planDistribution: [{ plan: "FREE", count: 10 }],
    uploadsSeries: [{ month: "Jan", uploads: 3 }],
    revenueSeries: [{ month: "Jan", revenue: 99.99 }],
    recentPhotographers: [{ id: "u1", name: "A", username: "a", plan: "FREE", status: "ACTIVE", imagesStored: 1 }],
  };

  await withMethodPatches(
    [{ target: adminService, method: "dashboardOverview", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/overview")
        .set(authHeader());

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
      assert.equal(res.body.error, null);
    }
  );
});

test("contract: GET /api/v1/admin/analytics/overview", async () => {
  const expected = {
    trafficSeries: [{ month: "Jan", visitors: 1 }],
    sourceBreakdown: [{ id: "source-1", name: "Direct", value: 1 }],
    portfolioViewsSeries: [{ month: "Jan", views: 1 }],
    engagementMetrics: [{ id: "metric-1", metric: "Active Users", value: "1", change: "+0.0%", trend: "up" }],
    bookingsPerDay: [{ date: "2026-03-01", bookings: 1 }],
    newUserGrowth: [{ month: "Jan", users: 1 }],
  };

  await withMethodPatches(
    [{ target: adminService, method: "analyticsOverview", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/overview?months=6&days=30")
        .set(authHeader());

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/photographers", async () => {
  const expected = {
    items: [
      {
        id: "u1",
        name: "User One",
        username: "user1",
        avatarUrl: null,
        plan: "PRO",
        status: "ACTIVE",
        portfolioCount: 2,
        imagesStored: 5,
        joinDate: "2026-03-01T00:00:00.000Z",
        lastActive: null,
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    countsByPlan: { FREE: 0, PRO: 1, STUDIO: 0 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "listPhotographers", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/photographers?page=1&limit=20&search=test&plan=PRO&status=ACTIVE")
        .set(authHeader());

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});


test("contract: GET /api/v1/admin/photographers/:id", async () => {
  const expected = {
    photographer: { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", email: "u1@example.com", fullName: "User One", username: "user1", status: "ACTIVE" },
    subscription: null,
    storage: { totalBytes: 123, imageCount: 4 },
    activity: { portfolioCount: 2, bookingCount: 1, portfolioViews: 10, lastActive: null },
  };

  await withMethodPatches(
    [{ target: adminService, method: "photographerDetail", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/photographers/3fa85f64-5717-4562-b3fc-2c963f66afa6").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/photographers/export", async () => {
  const expected = {
    downloadUrl: "data:text/csv;charset=utf-8,hello",
    fileName: "photographers-2026-03-01.csv",
    count: 1,
    filters: { search: "test", plan: "PRO", status: "ACTIVE" },
  };

  await withMethodPatches(
    [{ target: adminService, method: "exportPhotographers", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/photographers/export?page=1&limit=20&search=test&plan=PRO&status=ACTIVE")
        .set(authHeader());

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/subscriptions/overview", async () => {
  const expected = {
    planStats: { FREE: 1, PRO: 2, STUDIO: 3 },
    distribution: [{ plan: "FREE", count: 1 }],
    upgradesDowngrades: { upgrades: 5, downgrades: 0 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "subscriptionsOverview", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/subscriptions/overview").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});
test("contract: GET /api/v1/admin/subscriptions/plan-limits", async () => {
  const expected = {
    free: { services: 3 },
    pro: { services: 10 },
    studio: { services: -1 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "getPlanLimits", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/subscriptions/plan-limits")
        .set(authHeader());

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});


test("contract: PATCH /api/v1/admin/subscriptions/plan-limits", async () => {
  const expected = { updated: true, limits: { free: { services: 3 } } };

  await withMethodPatches(
    [{ target: adminService, method: "updatePlanLimits", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .patch("/api/v1/admin/subscriptions/plan-limits")
        .set(authHeader())
        .send({ free: { services: 3 } });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});
test("contract: GET /api/v1/admin/plans", async () => {
  const expected = {
    items: [
      {
        id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        name: "PRO",
        price: 29,
        yearlyPrice: 290,
        currency: "USD",
        trialDays: 7,
        referralReward: 0,
        storageCostPerGB: 0,
        maxServices: 10,
        maxPortfolioImages: 100,
        maxPackages: 5,
        maxPackageFeatures: 10,
        storageGB: 10,
        customDomain: true,
        analyticsTools: true,
        teamSectionTools: false,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ],
  };

  await withMethodPatches(
    [{ target: adminService, method: "listPlans", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/plans").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/subscriptions/public-pricing", async () => {
  const expected = {
    section: { title: "Custom pricing title", subtitle: "Custom pricing subtitle" },
    faq: [{ question: "Can I edit this?", answer: "Yes." }],
    upgradeCopy: {
      transitions: {
        PRO: { title: "Custom pro title", description: "Custom pro description" },
        STUDIO: { title: "Custom studio title", description: "Custom studio description" },
      },
      warning: "Custom warning",
      blocked: "Custom blocked",
      empty: "Custom empty",
    },
    bullets: { FREE: [], PRO: [], STUDIO: [] },
    compareRows: [],
    updatedAt: "2026-03-01T00:00:00.000Z",
  };

  await withMethodPatches(
    [{ target: adminService, method: "getPublicPricingContent", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/subscriptions/public-pricing").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: PATCH /api/v1/admin/subscriptions/public-pricing", async () => {
  const expected = {
    saved: true,
    section: { title: "Custom pricing title", subtitle: "Custom pricing subtitle" },
    faq: [{ question: "Can I edit this?", answer: "Yes." }],
    upgradeCopy: {
      transitions: {
        PRO: { title: "Custom pro title", description: "Custom pro description" },
        STUDIO: { title: "Custom studio title", description: "Custom studio description" },
      },
      warning: "Custom warning",
      blocked: "Custom blocked",
      empty: "Custom empty",
    },
    bullets: { FREE: [], PRO: [], STUDIO: [] },
    compareRows: [],
    updatedAt: "2026-03-01T00:00:00.000Z",
  };

  await withMethodPatches(
    [{ target: adminService, method: "updatePublicPricingContent", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .patch("/api/v1/admin/subscriptions/public-pricing")
        .set(authHeader())
        .send({ section: { title: "Custom pricing title", subtitle: "Custom pricing subtitle" } });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/revenue/overview", async () => {
  const expected = { mrr: 100, successRate: 50, ytdRevenue: 200, activeSubscriptions: 3, subscriptionRevenue: 150, transactionTotals: { total: 1, succeeded: 1, failed: 0, pending: 0, refunded: 0, canceled: 0 } };

  await withMethodPatches(
    [{ target: adminService, method: "revenueOverview", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/revenue/overview").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});


test("contract: GET /api/v1/admin/revenue/monthly", async () => {
  const expected = { series: [{ month: "Jan", revenue: 99.99 }] };

  await withMethodPatches(
    [{ target: adminService, method: "monthlyRevenue", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/revenue/monthly").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/revenue/by-plan", async () => {
  const expected = { items: [{ plan: "FREE", revenue: 0 }, { plan: "PRO", revenue: 10 }, { plan: "STUDIO", revenue: 20 }] };

  await withMethodPatches(
    [{ target: adminService, method: "revenueByPlan", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/revenue/by-plan").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/revenue/transactions", async () => {
  const expected = {
    items: [{ id: "t1", photographer: "User One", plan: "PRO", amount: 29, status: "succeeded", date: "2026-03-01T00:00:00.000Z" }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "revenueTransactions", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/revenue/transactions?page=1&limit=20").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/storage/overview", async () => {
  const expected = {
    totalStorage: { _sum: { sizeBytes: 1 } },
    totalImages: 2,
    avgPerUser: 0.5,
    monthlyGrowth: 3,
    neonDatabaseSizeBytes: 4,
  };

  await withMethodPatches(
    [{ target: adminService, method: "storageOverview", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/storage/overview").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/storage/by-plan", async () => {
  const expected = { items: [{ plan: "FREE", usage: 0 }, { plan: "PRO", usage: 1 }, { plan: "STUDIO", usage: 2 }] };

  await withMethodPatches(
    [{ target: adminService, method: "storageByPlan", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/storage/by-plan").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/storage/uploads", async () => {
  const expected = { series: [{ month: "Jan", uploads: 1 }] };

  await withMethodPatches(
    [{ target: adminService, method: "storageUploads", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/storage/uploads?page=1&limit=20&months=6").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/storage/top-users", async () => {
  const expected = {
    items: [{ userId: "u1", name: "Studio", plan: "PRO", storageUsed: 10, imageCount: 2, quotaPercent: 50 }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "storageTopUsers", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/storage/top-users?page=1&limit=20").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});
test("contract: GET /api/v1/admin/storage/r2-overview", async () => {
  const expected = {
    configured: true,
    connected: true,
    bucket: "bucket",
    prefix: "uploads/",
    totalBytes: 1,
    totalObjects: 2,
    dbReadyBytes: 1,
    dbReadyObjects: 2,
    deltaBytes: 0,
    truncated: false,
    lastSyncedAt: "2026-03-01T00:00:00.000Z",
    message: null,
  };

  await withMethodPatches(
    [{ target: adminService, method: "storageR2Overview", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/storage/r2-overview").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});


test("contract: GET /api/v1/admin/moderation/overview", async () => {
  const expected = {
    stats: { pendingReports: 1, reviewedToday: 2, suspendedAccounts: 3, flaggedImages: 4 },
    abuseTypes: [{ type: "Portfolio", count: 1 }],
  };

  await withMethodPatches(
    [{ target: adminService, method: "moderationOverview", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/moderation/overview").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});
test("contract: GET /api/v1/admin/moderation/reports", async () => {
  const expected = {
    items: [
      {
        reportId: "00000000-0000-0000-0000-000000000000",
        photographer: "Example",
        reports: 1,
        reason: "Reason",
        severity: "LOW",
        status: "PENDING",
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "moderationReports", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/moderation/reports?page=1&limit=20")
        .set(authHeader());

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});


test("contract: PATCH /api/v1/admin/moderation/reports/:reportId", async () => {
  const expected = { reportId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", status: "APPROVED", action: "approve" };

  await withMethodPatches(
    [{ target: adminService, method: "moderationPatchReport", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .patch("/api/v1/admin/moderation/reports/3fa85f64-5717-4562-b3fc-2c963f66afa6")
        .set(authHeader())
        .send({ action: "approve" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/moderation/flagged-images", async () => {
  const expected = {
    items: [{ imageReportId: "7b3f5b96-9c5d-4b2a-9e72-1b0c9b6d1a11", photographer: "A", reason: "Flagged", reports: 1, date: "2026-03-01T00:00:00.000Z", imageUrl: null }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "flaggedImages", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/moderation/flagged-images?page=1&limit=20").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: PATCH /api/v1/admin/moderation/flagged-images/:imageReportId", async () => {
  const expected = { imageReportId: "7b3f5b96-9c5d-4b2a-9e72-1b0c9b6d1a11", status: "REMOVED" };

  await withMethodPatches(
    [{ target: adminService, method: "patchFlaggedImage", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .patch("/api/v1/admin/moderation/flagged-images/7b3f5b96-9c5d-4b2a-9e72-1b0c9b6d1a11")
        .set(authHeader())
        .send({ action: "remove" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});
test("contract: GET /api/v1/admin/content", async () => {
  const expected = {
    items: [
      {
        id: "c1",
        section: "BLOG",
        slug: "hello",
        title: "Hello",
        excerpt: null,
        contentMarkdown: "# Hello",
        status: "DRAFT",
        sortOrder: 0,
        publishedAt: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "contentList", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/content?page=1&limit=20&section=BLOG&status=DRAFT&search=hello")
        .set(authHeader());

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: PATCH /api/v1/admin/photographers/:id/status", async () => {
  const expected = { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", status: "active" };

  await withMethodPatches(
    [{ target: adminService, method: "setPhotographerStatus", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .patch("/api/v1/admin/photographers/3fa85f64-5717-4562-b3fc-2c963f66afa6/status")
        .set(authHeader())
        .send({ status: "active" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/referrals/overview", async () => {
  const expected = {
    stats: { totalReferrals: 10, conversions: 2, repeatVisitorClicks: 1 },
    growthSeries: [{ month: "Jan", referrals: 1, conversions: 0 }],
  };

  await withMethodPatches(
    [{ target: adminService, method: "referralsOverview", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/referrals/overview").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/referrals/top-referrers", async () => {
  const expected = {
    items: [{ userId: "u1", referrals: 10, conversions: 2, conversionRate: 20, rewardEarned: 5 }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "topReferrers", fn: async () => expected }],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/referrals/top-referrers?page=1&limit=20")
        .set(authHeader());

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/logs", async () => {
  const expected = {
    items: [
      {
        id: "1",
        timestamp: "2026-03-01T00:00:00.000Z",
        event: "ADMIN_TEST",
        user: "admin",
        ip: "127.0.0.1",
        status: "INFO",
        details: { ok: true },
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "systemLogs", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/logs?page=1&limit=20").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/system-logs", async () => {
  const expected = {
    items: [
      {
        id: "1",
        timestamp: "2026-03-01T00:00:00.000Z",
        event: "ADMIN_TEST",
        user: "admin",
        ip: "127.0.0.1",
        status: "INFO",
        details: { ok: true },
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  await withMethodPatches(
    [{ target: adminService, method: "systemLogs", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/system-logs?page=1&limit=20").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/worker-health", async () => {
  const expected = {
    ok: true,
    workers: [{ name: "w1", ok: true }],
  };

  await withMethodPatches(
    [{ target: adminService, method: "workerHealth", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/worker-health").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});

test("contract: GET /api/v1/admin/system/worker-health", async () => {
  const expected = {
    ok: true,
    workers: [{ name: "w1", ok: true }],
  };

  await withMethodPatches(
    [{ target: adminService, method: "workerHealth", fn: async () => expected }],
    async () => {
      const res = await request(app).get("/api/v1/admin/system/worker-health").set(authHeader());
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, expected);
    }
  );
});
