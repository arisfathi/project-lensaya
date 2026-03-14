import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/config/prisma.js");
const { planLimitService } = await import("../src/services/planLimitService.js");
const { customDomainService } = await import("../src/services/customDomainService.js");
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

test("GET /profile/custom-domain returns fallback state for ineligible users", async () => {
  const userId = "custom-domain-free-user";

  await withMethodPatches(
    [
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.userId !== userId) return null;
          return {
            id: "photographer-free-1",
            username: "rayfree",
            studioName: "Ray Free",
            customDomain: null,
          };
        },
      },
      {
        target: planLimitService,
        method: "getPlanByUserId",
        fn: async () => ({ name: "FREE", customDomain: false }),
      },
    ],
    async () => {
      const res = await request(app)
        .get("/api/v1/profile/custom-domain")
        .set("Authorization", `Bearer ${makeToken(userId)}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.eligible, false);
      assert.equal(res.body.data.domain, null);
      assert.equal(res.body.data.fallbackUrl.startsWith("https://rayfree."), true);
    }
  );
});

test("PUT /profile/custom-domain normalizes apex domains to www and stores awaiting DNS state", async () => {
  const userId = "custom-domain-pro-user";
  let storedDomain = null;

  await withMethodPatches(
    [
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.userId !== userId) return null;
          return {
            id: "photographer-pro-1",
            username: "raypro",
            studioName: "Ray Pro",
            customDomain: storedDomain,
          };
        },
      },
      {
        target: planLimitService,
        method: "getPlanByUserId",
        fn: async () => ({ name: "PRO", customDomain: true }),
      },
      {
        target: prisma.customDomain,
        method: "findFirst",
        fn: async () => null,
      },
      {
        target: prisma.customDomain,
        method: "create",
        fn: async ({ data }) => {
          storedDomain = {
            id: "custom-domain-1",
            ...data,
            createdAt: new Date("2026-03-14T00:00:00.000Z"),
            updatedAt: new Date("2026-03-14T00:00:00.000Z"),
          };
          return storedDomain;
        },
      },
      {
        target: prisma.customDomain,
        method: "update",
        fn: async ({ data }) => {
          storedDomain = {
            ...(storedDomain || {
              id: "custom-domain-1",
              photographerId: "photographer-pro-1",
              createdAt: new Date("2026-03-14T00:00:00.000Z"),
            }),
            ...data,
            updatedAt: new Date("2026-03-14T00:00:00.000Z"),
          };
          return storedDomain;
        },
      },
    ],
    async () => {
      const res = await request(app)
        .put("/api/v1/profile/custom-domain")
        .set("Authorization", `Bearer ${makeToken(userId)}`)
        .send({ domain: "raystudio.com" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.domain, "www.raystudio.com");
      assert.equal(res.body.data.status, "awaiting_dns");
      assert.equal(res.body.data.sslStatus, "pending");
      assert.equal(res.body.data.dnsInstructions.host, "www");
      assert.equal(res.body.data.dnsInstructions.value, "domains.lensaya.app");
    }
  );
});

test("POST /profile/custom-domain/verify activates the connected domain in mock mode", async () => {
  const userId = "custom-domain-verify-user";
  let storedDomain = {
    id: "custom-domain-verify-1",
    photographerId: "photographer-verify-1",
    domain: "www.raystudio.com",
    apexDomain: "raystudio.com",
    host: "www",
    status: "AWAITING_DNS",
    sslStatus: "PENDING",
    failureReason: null,
    lastCheckedAt: null,
    verifiedAt: null,
    createdAt: new Date("2026-03-14T00:00:00.000Z"),
    updatedAt: new Date("2026-03-14T00:00:00.000Z"),
  };

  await withMethodPatches(
    [
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.userId !== userId) return null;
          return {
            id: "photographer-verify-1",
            username: "rayverify",
            studioName: "Ray Verify",
            customDomain: storedDomain,
          };
        },
      },
      {
        target: planLimitService,
        method: "getPlanByUserId",
        fn: async () => ({ name: "PRO", customDomain: true }),
      },
      {
        target: prisma.customDomain,
        method: "update",
        fn: async ({ data }) => {
          storedDomain = {
            ...storedDomain,
            ...data,
            updatedAt: new Date("2026-03-14T00:00:00.000Z"),
          };
          return storedDomain;
        },
      },
      {
        target: customDomainService,
        method: "runVerification",
        fn: async () => ({
          status: "ACTIVE",
          sslStatus: "ISSUED",
          failureReason: null,
        }),
      },
    ],
    async () => {
      const res = await request(app)
        .post("/api/v1/profile/custom-domain/verify")
        .set("Authorization", `Bearer ${makeToken(userId)}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, "active");
      assert.equal(res.body.data.sslStatus, "issued");
      assert.ok(res.body.data.lastCheckedAt);
    }
  );
});

test("DELETE /profile/custom-domain removes the saved configuration", async () => {
  const userId = "custom-domain-delete-user";
  let storedDomain = {
    id: "custom-domain-delete-1",
    photographerId: "photographer-delete-1",
    domain: "www.raystudio.com",
    apexDomain: "raystudio.com",
    host: "www",
    status: "ACTIVE",
    sslStatus: "ISSUED",
    failureReason: null,
    lastCheckedAt: new Date("2026-03-14T00:00:00.000Z"),
    verifiedAt: new Date("2026-03-14T00:00:00.000Z"),
    createdAt: new Date("2026-03-14T00:00:00.000Z"),
    updatedAt: new Date("2026-03-14T00:00:00.000Z"),
  };

  await withMethodPatches(
    [
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.userId !== userId) return null;
          return {
            id: "photographer-delete-1",
            username: "raydelete",
            studioName: "Ray Delete",
            customDomain: storedDomain,
          };
        },
      },
      {
        target: planLimitService,
        method: "getPlanByUserId",
        fn: async () => ({ name: "PRO", customDomain: true }),
      },
      {
        target: prisma.customDomain,
        method: "delete",
        fn: async () => {
          storedDomain = null;
          return { id: "custom-domain-delete-1" };
        },
      },
    ],
    async () => {
      const res = await request(app)
        .delete("/api/v1/profile/custom-domain")
        .set("Authorization", `Bearer ${makeToken(userId)}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.deleted, true);
      assert.equal(res.body.data.domain, null);
    }
  );
});

