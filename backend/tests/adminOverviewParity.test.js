import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/config/prisma.js");
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

const withFixedDate = async (isoString, callback) => {
  const RealDate = Date;
  const fixed = new RealDate(isoString);

  // Deterministic window tests.
  // Important: return a real `Date` instance so `instanceof Date` checks inside series builders keep working.
  // eslint-disable-next-line no-global-assign
  // @ts-ignore
  Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [fixed] : args));
    }

    static now() {
      return fixed.getTime();
    }
  };

  try {
    await callback();
  } finally {
    // eslint-disable-next-line no-global-assign
    // @ts-ignore
    Date = RealDate;
  }
};

test("parity: GET /admin/dashboard/overview preserves series lengths/order and totals", async () => {
  await withFixedDate("2026-03-15T12:00:00.000Z", async () => {
    const p1 = "11111111-1111-4111-8111-111111111111";
    const p2 = "22222222-2222-4222-8222-222222222222";

    await withMethodPatches(
      [
        { target: prisma.user, method: "count", fn: async () => 100 },
        {
          target: prisma.photographer,
          method: "count",
          fn: async (args) => (args?.where?.status === "ACTIVE" ? 7 : 12),
        },
        { target: prisma.booking, method: "count", fn: async () => 55 },
        {
          target: prisma.transaction,
          method: "aggregate",
          fn: async (args) => {
            const hasMonthWindow = Boolean(args?.where?.createdAt?.gte);
            return { _sum: { amountCents: hasMonthWindow ? 50000 : 120000 } };
          },
        },
        { target: prisma.subscription, method: "count", fn: async () => 9 },
        { target: prisma.asset, method: "count", fn: async () => 42 },
        { target: prisma.asset, method: "aggregate", fn: async () => ({ _sum: { sizeBytes: 12345 } }) },
        {
          target: prisma.user,
          method: "findMany",
          fn: async (args) => {
            if (args?.take === 8) {
              return [
                {
                  id: "u1",
                  fullName: "User One",
                  username: "user1",
                  status: "ACTIVE",
                  photographer: { id: p1, username: "studio1", studioName: "Studio One" },
                  subscriptions: [{ plan: "PRO" }],
                },
                {
                  id: "u2",
                  fullName: "User Two",
                  username: "user2",
                  status: "ACTIVE",
                  photographer: { id: p2, username: "studio2", studioName: "Studio Two" },
                  subscriptions: [{ plan: "FREE" }],
                },
              ];
            }

            if (args?.select?.createdAt && args?.where?.role === "PHOTOGRAPHER") {
              return [
                { createdAt: new Date("2026-02-10T00:00:00.000Z") },
                { createdAt: new Date("2026-03-05T00:00:00.000Z") },
              ];
            }

            if (args?.select?.createdAt && args?.where?.createdAt?.gte) {
              return [
                { createdAt: new Date("2026-02-05T00:00:00.000Z") },
                { createdAt: new Date("2026-02-08T00:00:00.000Z") },
                { createdAt: new Date("2026-03-06T00:00:00.000Z") },
              ];
            }

            if (args?.select?.subscriptions && args?.where?.role === "PHOTOGRAPHER") {
              return [
                { id: "p-user-1", subscriptions: [{ plan: "FREE" }] },
                { id: "p-user-2", subscriptions: [{ plan: "PRO" }] },
                { id: "p-user-3", subscriptions: [{ plan: "STUDIO" }] },
              ];
            }

            return [];
          },
        },
        {
          target: prisma.asset,
          method: "findMany",
          fn: async () => [
            { createdAt: new Date("2026-02-04T00:00:00.000Z") },
            { createdAt: new Date("2026-03-07T00:00:00.000Z") },
            { createdAt: new Date("2026-03-08T00:00:00.000Z") },
          ],
        },
        {
          target: prisma.transaction,
          method: "findMany",
          fn: async () => [
            { createdAt: new Date("2026-02-04T00:00:00.000Z"), amountCents: 10000 },
            { createdAt: new Date("2026-03-08T00:00:00.000Z"), amountCents: 25000 },
          ],
        },
        {
          target: prisma.asset,
          method: "groupBy",
          fn: async () => [
            { photographerId: p1, _count: { _all: 3 } },
            { photographerId: p2, _count: { _all: 7 } },
          ],
        },
      ],
      async () => {
        const res = await request(app)
          .get("/api/v1/admin/dashboard/overview?months=2")
          .set("Authorization", `Bearer ${makeToken("admin-dashboard-parity")}`);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);

        assert.deepEqual(res.body.data, {
          stats: {
            totalUsers: 100,
            totalPhotographers: 12,
            activePhotographers: 7,
            totalBookings: 55,
            totalRevenue: 1200,
            monthlyRevenue: 500,
            activeSubscriptions: 9,
            storageUsage: 12345,
            totalImagesStored: 42,
          },
          growthSeries: [
            { month: "Feb", photographers: 1 },
            { month: "Mar", photographers: 1 },
          ],
          revenueSeries: [
            { month: "Feb", revenue: 100 },
            { month: "Mar", revenue: 250 },
          ],
          userSeries: [
            { month: "Feb", users: 2 },
            { month: "Mar", users: 1 },
          ],
          planDistribution: [
            { plan: "FREE", count: 1 },
            { plan: "PRO", count: 1 },
            { plan: "STUDIO", count: 1 },
          ],
          uploadsSeries: [
            { month: "Feb", uploads: 1 },
            { month: "Mar", uploads: 2 },
          ],
          recentPhotographers: [
            { id: "u1", name: "Studio One", username: "studio1", plan: "PRO", status: "ACTIVE", imagesStored: 3 },
            { id: "u2", name: "Studio Two", username: "studio2", plan: "FREE", status: "ACTIVE", imagesStored: 7 },
          ],
        });
      }
    );
  });
});

test("parity: GET /admin/analytics/overview preserves window defaults and metric calculations", async () => {
  await withFixedDate("2026-03-15T12:00:00.000Z", async () => {
    await withMethodPatches(
      [
        {
          target: prisma.analyticsEvent,
          method: "findMany",
          fn: async (args) => {
            if (args?.where?.eventType === "PAGE_VIEW") {
              return [
                { createdAt: new Date("2026-02-02T00:00:00.000Z") },
                { createdAt: new Date("2026-03-02T00:00:00.000Z") },
              ];
            }
            if (args?.where?.eventType === "PORTFOLIO_VIEW") {
              return [
                { createdAt: new Date("2026-02-10T00:00:00.000Z") },
                { createdAt: new Date("2026-03-10T00:00:00.000Z") },
                { createdAt: new Date("2026-03-11T00:00:00.000Z") },
              ];
            }
            if (args?.select?.visitorId && args?.where?.createdAt?.gte) {
              const isPreviousWindow = Boolean(args.where.createdAt.lt);
              if (isPreviousWindow) {
                return [
                  { visitorId: "v1", sessionId: null, userId: null },
                  { visitorId: null, sessionId: "s1", userId: null },
                ];
              }
              return [
                { visitorId: "v1", sessionId: null, userId: null },
                { visitorId: "v2", sessionId: null, userId: null },
                { visitorId: null, sessionId: "s1", userId: null },
              ];
            }
            return [];
          },
        },
        {
          target: prisma.analyticsEvent,
          method: "groupBy",
          fn: async (args) => {
            if (Array.isArray(args?.by) && args.by.includes("source")) {
              return [
                { source: null, _count: { _all: 3 } },
                { source: "instagram", _count: { _all: 2 } },
              ];
            }
            if (Array.isArray(args?.by) && args.by.includes("eventType") && args.where?.createdAt?.lt) {
              return [
                { eventType: "WHATSAPP_CLICK", _count: { _all: 4 } },
                { eventType: "BOOKING_INTENT", _count: { _all: 2 } },
                { eventType: "PORTFOLIO_VIEW", _count: { _all: 1 } },
              ];
            }
            if (Array.isArray(args?.by) && args.by.includes("eventType")) {
              return [
                { eventType: "WHATSAPP_CLICK", _count: { _all: 5 } },
                { eventType: "BOOKING_INTENT", _count: { _all: 2 } },
                { eventType: "PORTFOLIO_VIEW", _count: { _all: 3 } },
              ];
            }
            return [];
          },
        },
        {
          target: prisma.booking,
          method: "findMany",
          fn: async () => [
            { createdAt: new Date("2026-03-13T00:00:00.000Z") },
            { createdAt: new Date("2026-03-15T00:00:00.000Z") },
          ],
        },
        {
          target: prisma.user,
          method: "findMany",
          fn: async () => [
            { createdAt: new Date("2026-02-05T00:00:00.000Z") },
            { createdAt: new Date("2026-03-06T00:00:00.000Z") },
          ],
        },
      ],
      async () => {
        const res = await request(app)
          .get("/api/v1/admin/analytics/overview?months=2&days=3")
          .set("Authorization", `Bearer ${makeToken("admin-analytics-parity")}`);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);

        assert.deepEqual(res.body.data, {
          trafficSeries: [
            { month: "Feb", visitors: 1 },
            { month: "Mar", visitors: 1 },
          ],
          sourceBreakdown: [
            { id: "source-1", name: "Direct", value: 3 },
            { id: "source-2", name: "Instagram", value: 2 },
          ],
          portfolioViewsSeries: [
            { month: "Feb", views: 1 },
            { month: "Mar", views: 2 },
          ],
          engagementMetrics: [
            { id: "metric-whatsapp-clicks", metric: "WhatsApp Clicks", value: "5", change: "+25.0%", trend: "up" },
            { id: "metric-active-users", metric: "Active Users", value: "3", change: "+50.0%", trend: "up" },
            { id: "metric-booking-intents", metric: "Booking Intents", value: "2", change: "0.0%", trend: "up" },
            { id: "metric-portfolio-views", metric: "Portfolio Views (Window)", value: "3", change: "+200.0%", trend: "up" },
          ],
          bookingsPerDay: [
            { date: "2026-03-13", bookings: 1 },
            { date: "2026-03-14", bookings: 0 },
            { date: "2026-03-15", bookings: 1 },
          ],
          newUserGrowth: [
            { month: "Feb", users: 1 },
            { month: "Mar", users: 1 },
          ],
        });
      }
    );
  });
});

