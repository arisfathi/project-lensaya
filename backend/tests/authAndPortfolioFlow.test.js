import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CHIP_WEBHOOK_SECRET = process.env.CHIP_WEBHOOK_SECRET || "chip-webhook-secret";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/config/prisma.js");
const { authService } = await import("../src/services/authService.js");
const { planLimitService } = await import("../src/services/planLimitService.js");
const { uploadService } = await import("../src/services/uploadService.js");
const { signAccessToken, signRefreshToken } = await import("../src/utils/jwt.js");

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

test("POST /auth/login returns authenticated user payload", async () => {
  await withMethodPatches(
    [
      {
        target: authService,
        method: "login",
        fn: async ({ email }) => ({
          user: {
            id: "auth-user-1",
            email,
            fullName: "Login User",
            username: "login-user",
            role: "PHOTOGRAPHER",
            status: "ACTIVE",
          },
          accessToken: "token-access",
          refreshToken: "token-refresh",
          expiresIn: "15m",
        }),
      },
    ],
    async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "login@example.com",
        password: "password123",
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.id, "auth-user-1");
      assert.equal(res.body.data.user.email, "login@example.com");
      assert.equal(res.body.data.user.username, "login-user");
    }
  );
});

test("GET /auth/me returns latest subscription plan for photographer", async () => {
  const userId = "auth-me-user-1";

  await withMethodPatches(
    [
      {
        target: prisma.user,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.id !== userId) return null;
          return {
            id: userId,
            role: "PHOTOGRAPHER",
            fullName: "Auth Me User",
            email: "authme@example.com",
            username: "auth-me-user",
            status: "ACTIVE",
            photographer: {
              id: "auth-me-photographer-1",
              username: "auth-me-user",
            },
          };
        },
      },
      {
        target: prisma.subscription,
        method: "findFirst",
        fn: async () => ({ plan: "PRO" }),
      },
    ],
    async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${makeToken(userId)}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, userId);
      assert.equal(res.body.data.plan, "PRO");
    }
  );
});

test("GET /auth/me rejects refresh tokens on protected routes", async () => {
  const refreshToken = signRefreshToken({
    sub: "auth-refresh-user-1",
    type: "refresh",
  });

  const res = await request(app)
    .get("/api/v1/auth/me")
    .set("Authorization", `Bearer ${refreshToken}`);

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("POST /portfolio/items creates a portfolio item", async () => {
  const userId = "portfolio-create-user";
  const photographerId = "77777777-7777-4777-8777-777777777777";
  const imageAssetId = "11111111-1111-4111-8111-111111111111";

  await withMethodPatches(
    [
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.userId === userId) {
            return { id: photographerId };
          }
          return null;
        },
      },
      {
        target: planLimitService,
        method: "getPlanByPhotographerId",
        fn: async () => ({ maxPortfolioImages: 100 }),
      },
      {
        target: planLimitService,
        method: "assertLimit",
        fn: () => {},
      },
      {
        target: prisma.portfolioItem,
        method: "count",
        fn: async () => 0,
      },
      {
        target: prisma.asset,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.id !== imageAssetId) return null;
          return {
            id: imageAssetId,
            photographerId,
            uploadedById: userId,
            status: "READY",
            deletedAt: null,
            objectKey: "uploads/test.jpg",
            cdnUrl: "https://cdn.example.com/test.jpg",
          };
        },
      },
      {
        target: prisma.portfolioItem,
        method: "create",
        fn: async ({ data }) => ({
          id: "99999999-9999-4999-8999-999999999999",
          photographerId: data.photographerId,
          serviceId: data.serviceId,
          category: data.category,
          assetId: data.assetId,
          isFeatured: Boolean(data.isFeatured),
          viewsCount: 0,
          createdAt: new Date("2026-03-12T00:00:00.000Z"),
          updatedAt: new Date("2026-03-12T00:00:00.000Z"),
        }),
      },
    ],
    async () => {
      const res = await request(app)
        .post("/api/v1/portfolio/items")
        .set("Authorization", `Bearer ${makeToken(userId)}`)
        .send({
          imageAssetId,
          category: "wedding",
          featured: true,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.item.id, "99999999-9999-4999-8999-999999999999");
      assert.equal(res.body.data.item.featured, true);
    }
  );
});

test("DELETE /portfolio/items/:itemId removes portfolio item", async () => {
  const userId = "portfolio-delete-user";
  const photographerId = "88888888-8888-4888-8888-888888888888";
  const itemId = "portfolio-item-delete-1";

  await withMethodPatches(
    [
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.userId === userId) {
            return { id: photographerId };
          }
          return null;
        },
      },
      {
        target: prisma.portfolioItem,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.id !== itemId) return null;
          return { id: itemId, photographerId, assetId: null };
        },
      },
      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) =>
          callback({
            portfolioItem: {
              delete: async () => ({ id: itemId }),
            },
          }),
      },
    ],
    async () => {
      const res = await request(app)
        .delete(`/api/v1/portfolio/items/${itemId}`)
        .set("Authorization", `Bearer ${makeToken(userId)}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.deleted, true);
    }
  );
});

test("DELETE /users/account cancels active subscriptions during account deletion", async () => {
  const userId = "account-delete-user-1";
  let subscriptionUpdateArgs = null;

  await withMethodPatches(
    [
      {
        target: prisma.user,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.id !== userId) return null;
          return {
            id: userId,
            email: "delete-me@example.com",
            passwordHash: null,
          };
        },
      },
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.userId !== userId) return null;
          return { id: "account-delete-photographer-1" };
        },
      },
      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) =>
          callback({
            user: {
              update: async () => ({ id: userId }),
            },
            photographer: {
              updateMany: async () => ({ count: 1 }),
            },
            passwordResetToken: {
              updateMany: async () => ({ count: 0 }),
            },
            subscription: {
              updateMany: async (args) => {
                subscriptionUpdateArgs = args;
                return { count: 2 };
              },
            },
          }),
      },
    ],
    async () => {
      const res = await request(app)
        .delete("/api/v1/users/account")
        .set("Authorization", `Bearer ${makeToken(userId)}`)
        .send({
          confirmation: "DELETE",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.deleted, true);
      assert.equal(subscriptionUpdateArgs.where.userId, userId);
      assert.deepEqual(subscriptionUpdateArgs.where.status.in, ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"]);
      assert.equal(subscriptionUpdateArgs.data.status, "CANCELED");
    }
  );
});



test("POST /uploads/presign creates a presigned upload for onboarding", async () => {
  const userId = "upload-presign-user";
  const photographerId = "upload-presign-photographer";

  await withMethodPatches(
    [
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.userId === userId) {
            return { id: photographerId };
          }
          return null;
        },
      },
      {
        target: uploadService,
        method: "createPresignedUpload",
        fn: async () => ({
          assetId: "22222222-2222-4222-8222-222222222222",
          uploadUrl: "https://uploads.example.test/presigned",
          publicUrl: "https://cdn.example.test/uploads/22222222-2222-4222-8222-222222222222.jpg",
          headers: { "Content-Type": "image/jpeg" },
        }),
      },
    ],
    async () => {
      const res = await request(app)
        .post("/api/v1/uploads/presign")
        .set("Authorization", `Bearer ${makeToken(userId)}`)
        .send({
          fileName: "cover.jpg",
          mimeType: "image/jpeg",
          size: 12345,
          purpose: "portfolio",
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.assetId, "22222222-2222-4222-8222-222222222222");
      assert.equal(res.body.data.uploadUrl, "https://uploads.example.test/presigned");
    }
  );
});

