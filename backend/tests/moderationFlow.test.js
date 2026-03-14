import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lensaya?schema=public";
process.env.CHIP_WEBHOOK_SECRET = process.env.CHIP_WEBHOOK_SECRET || "chip-webhook-secret";

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

const adminAuditPatches = [
  {
    target: prisma.adminLog,
    method: "create",
    fn: async () => ({ id: 1 }),
  },
  {
    target: prisma.notification,
    method: "create",
    fn: async () => ({ id: "note-1" }),
  },
];

test("GET /admin/moderation/overview returns moderation stats", async () => {
  await withMethodPatches(
    [
      ...adminAuditPatches,
      {
        target: prisma.asset,
        method: "groupBy",
        fn: async (args) => {
          if (Array.isArray(args?.by) && args.by.includes("photographerId")) {
            return [
              { photographerId: "11111111-1111-4111-8111-111111111111", _count: { _all: 3 } },
              { photographerId: "22222222-2222-4222-8222-222222222222", _count: { _all: 1 } },
            ];
          }

          if (Array.isArray(args?.by) && args.by.includes("purpose")) {
            return [
              { purpose: "PORTFOLIO", _count: { _all: 6 } },
              { purpose: "AVATAR", _count: { _all: 2 } },
            ];
          }

          return [];
        },
      },
      {
        target: prisma.asset,
        method: "count",
        fn: async () => 6,
      },
      {
        target: prisma.user,
        method: "count",
        fn: async ({ where }) => (where?.status === "SUSPENDED" ? 4 : 0),
      },
      {
        target: prisma.adminLog,
        method: "count",
        fn: async () => 5,
      },
    ],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/moderation/overview")
        .set("Authorization", `Bearer ${makeToken("admin-overview")}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.stats.pendingReports, 2);
      assert.equal(res.body.data.stats.flaggedImages, 6);
      assert.equal(res.body.data.stats.suspendedAccounts, 4);
      assert.equal(res.body.data.stats.reviewedToday, 5);
      assert.deepEqual(res.body.data.abuseTypes, [
        { type: "Portfolio", count: 6 },
        { type: "Avatar", count: 2 },
      ]);
    }
  );
});

test("GET /admin/moderation/reports returns grouped pending reports", async () => {
  await withMethodPatches(
    [
      ...adminAuditPatches,
      {
        target: prisma.asset,
        method: "groupBy",
        fn: async () => [
          { photographerId: "11111111-1111-4111-8111-111111111111", _count: { _all: 4 } },
          { photographerId: "22222222-2222-4222-8222-222222222222", _count: { _all: 1 } },
        ],
      },
      {
        target: prisma.photographer,
        method: "findMany",
        fn: async () => [
          {
            id: "11111111-1111-4111-8111-111111111111",
            username: "studio-a",
            studioName: "Studio A",
            status: "ACTIVE",
            user: { fullName: "Alice A", status: "ACTIVE" },
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            username: "studio-b",
            studioName: "Studio B",
            status: "SUSPENDED",
            user: { fullName: "Bob B", status: "SUSPENDED" },
          },
        ],
      },
    ],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/moderation/reports")
        .set("Authorization", `Bearer ${makeToken("admin-reports")}`)
        .query({ page: 1, limit: 20 });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.items.length, 2);
      assert.equal(res.body.data.items[0].reportId, "11111111-1111-4111-8111-111111111111");
      assert.equal(res.body.data.items[0].severity, "MEDIUM");
      assert.equal(res.body.data.items[0].status, "PENDING");
      assert.equal(res.body.data.items[1].status, "SUSPENDED");
    }
  );
});

test("PATCH /admin/moderation/reports/:reportId approve resolves pending report assets", async () => {
  const reportId = "11111111-1111-4111-8111-111111111111";
  let updatedArgs = null;

  await withMethodPatches(
    [
      ...adminAuditPatches,
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async () => ({ id: reportId, userId: "user-1" }),
      },
      {
        target: prisma.asset,
        method: "updateMany",
        fn: async (args) => {
          updatedArgs = args;
          return { count: 3 };
        },
      },
    ],
    async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/moderation/reports/${reportId}`)
        .set("Authorization", `Bearer ${makeToken("admin-report-approve")}`)
        .send({ action: "approve" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.reportId, reportId);
      assert.equal(res.body.data.status, "APPROVED");
      assert.equal(res.body.data.action, "approve");

      assert.equal(updatedArgs.where.photographerId, reportId);
      assert.equal(updatedArgs.where.status, "PENDING");
      assert.equal(updatedArgs.data.status, "READY");
    }
  );
});

test("PATCH /admin/moderation/reports/:reportId suspend updates photographer and user status", async () => {
  const reportId = "22222222-2222-4222-8222-222222222222";
  const txnCalls = [];

  await withMethodPatches(
    [
      ...adminAuditPatches,
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async () => ({ id: reportId, userId: "user-2" }),
      },
      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) => {
          const tx = {
            user: {
              update: async (args) => {
                txnCalls.push({ type: "user.update", args });
                return args;
              },
            },
            photographer: {
              update: async (args) => {
                txnCalls.push({ type: "photographer.update", args });
                return args;
              },
            },
            notification: {
              create: async (args) => {
                txnCalls.push({ type: "notification.create", args });
                return args;
              },
            },
          };
          return callback(tx);
        },
      },
    ],
    async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/moderation/reports/${reportId}`)
        .set("Authorization", `Bearer ${makeToken("admin-report-suspend")}`)
        .send({ action: "suspend" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, "SUSPENDED");

      assert.equal(txnCalls.length, 3);
      assert.equal(txnCalls[0].type, "user.update");
      assert.equal(txnCalls[0].args.where.id, "user-2");
      assert.equal(txnCalls[0].args.data.status, "SUSPENDED");
      assert.equal(txnCalls[1].type, "photographer.update");
      assert.equal(txnCalls[1].args.where.id, reportId);
      assert.equal(txnCalls[1].args.data.status, "SUSPENDED");
      assert.equal(txnCalls[2].type, "notification.create");
    }
  );
});

test("GET /admin/moderation/flagged-images maps approved status filter to READY assets", async () => {
  let findManyArgs = null;

  await withMethodPatches(
    [
      ...adminAuditPatches,
      {
        target: prisma.asset,
        method: "findMany",
        fn: async (args) => {
          findManyArgs = args;
          return [
            {
              id: "33333333-3333-4333-8333-333333333333",
              status: "READY",
              createdAt: new Date("2026-03-10T12:00:00.000Z"),
              cdnUrl: "https://cdn.example.com/image.jpg",
              objectKey: "uploads/test.jpg",
              photographer: {
                studioName: "Studio A",
                username: "studio-a",
                user: { fullName: "Alice A" },
              },
            },
          ];
        },
      },
      {
        target: prisma.asset,
        method: "count",
        fn: async () => 1,
      },
    ],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/moderation/flagged-images")
        .set("Authorization", `Bearer ${makeToken("admin-flagged-list")}`)
        .query({ status: "approved", page: 1, limit: 20 });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(findManyArgs.where.status.in, ["READY"]);
      assert.equal(res.body.data.items.length, 1);
      assert.equal(res.body.data.items[0].imageReportId, "33333333-3333-4333-8333-333333333333");
      assert.equal(res.body.data.items[0].reason, "Approved portfolio image");
      assert.equal(res.body.data.items[0].imageUrl, "https://cdn.example.com/image.jpg");
    }
  );
});

test("PATCH /admin/moderation/flagged-images/:imageReportId approve updates asset status", async () => {
  const imageReportId = "33333333-3333-4333-8333-333333333333";
  let updateArgs = null;

  await withMethodPatches(
    [
      ...adminAuditPatches,
      {
        target: prisma.asset,
        method: "findUnique",
        fn: async () => ({
          id: imageReportId,
          type: "IMAGE",
          purpose: "PORTFOLIO",
          status: "PENDING",
        }),
      },
      {
        target: prisma.asset,
        method: "update",
        fn: async (args) => {
          updateArgs = args;
          return args;
        },
      },
    ],
    async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/moderation/flagged-images/${imageReportId}`)
        .set("Authorization", `Bearer ${makeToken("admin-image-approve")}`)
        .send({ action: "approve" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, "APPROVED");
      assert.equal(updateArgs.where.id, imageReportId);
      assert.equal(updateArgs.data.status, "READY");
    }
  );
});

test("PATCH /admin/moderation/flagged-images/:imageReportId remove deletes portfolio links and marks asset deleted", async () => {
  const imageReportId = "44444444-4444-4444-8444-444444444444";
  const txnCalls = [];

  await withMethodPatches(
    [
      ...adminAuditPatches,
      {
        target: prisma.asset,
        method: "findUnique",
        fn: async () => ({
          id: imageReportId,
          type: "IMAGE",
          purpose: "PORTFOLIO",
          status: "PENDING",
        }),
      },
      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) => {
          const tx = {
            portfolioItem: {
              deleteMany: async (args) => {
                txnCalls.push({ type: "portfolioItem.deleteMany", args });
                return { count: 1 };
              },
            },
            asset: {
              update: async (args) => {
                txnCalls.push({ type: "asset.update", args });
                return args;
              },
            },
          };
          return callback(tx);
        },
      },
    ],
    async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/moderation/flagged-images/${imageReportId}`)
        .set("Authorization", `Bearer ${makeToken("admin-image-remove")}`)
        .send({ action: "remove" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, "REMOVED");
      assert.equal(txnCalls[0].type, "portfolioItem.deleteMany");
      assert.equal(txnCalls[0].args.where.assetId, imageReportId);
      assert.equal(txnCalls[1].type, "asset.update");
      assert.equal(txnCalls[1].args.where.id, imageReportId);
      assert.equal(txnCalls[1].args.data.status, "DELETED");
    }
  );
});
