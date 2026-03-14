import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { app } = await import("../src/app.js");
const { env } = await import("../src/config/env.js");
const { prisma } = await import("../src/config/prisma.js");
const { planLimitService } = await import("../src/services/planLimitService.js");

const publicProtocol = (() => {
  try {
    return new URL(env.publicAppUrl).protocol.replace(/:$/, "") || "https";
  } catch {
    return "https";
  }
})();
const buildPublicUrl = (host, path = "/") => `${publicProtocol}://${host}${path}`;
const buildFallbackUrl = (username) => buildPublicUrl(`${username}.${env.publicAppDomain}`, "/");

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

test("GET /public/site resolves active Lensaya subdomains", async () => {
  const managedHost = `raystudio.${env.publicAppDomain}`;

  await withMethodPatches(
    [
      {
        target: prisma.photographer,
        method: "findFirst",
        fn: async ({ where }) => {
          if (where?.username !== "raystudio") return null;
          return {
            id: "photographer-managed-1",
            username: "raystudio",
            studioName: "Ray Studio",
            status: "ACTIVE",
          };
        },
      },
    ],
    async () => {
      const res = await request(app)
        .get("/api/v1/public/site")
        .set("x-tenant-host", managedHost);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.resolutionStatus, "resolved");
      assert.equal(res.body.data.hostType, "managed_subdomain");
      assert.equal(res.body.data.photographer.username, "raystudio");
      assert.equal(res.body.data.siteUrl, buildPublicUrl(managedHost, "/"));
      assert.equal(res.body.data.isCustomDomain, false);
    }
  );
});

test("GET /public/site resolves active custom domains", async () => {
  await withMethodPatches(
    [
      {
        target: prisma.customDomain,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.domain !== "www.raystudio.com") return null;
          return {
            id: "custom-domain-active-1",
            domain: "www.raystudio.com",
            status: "ACTIVE",
            sslStatus: "ISSUED",
            failureReason: null,
            photographer: {
              id: "photographer-custom-1",
              username: "raystudio",
              studioName: "Ray Studio",
              status: "ACTIVE",
            },
          };
        },
      },
      {
        target: planLimitService,
        method: "getPlanByPhotographerId",
        fn: async () => ({ name: "PRO", customDomain: true }),
      },
    ],
    async () => {
      const res = await request(app)
        .get("/api/v1/public/site")
        .set("x-tenant-host", "www.raystudio.com");

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.resolutionStatus, "resolved");
      assert.equal(res.body.data.hostType, "custom_domain");
      assert.equal(res.body.data.photographer.username, "raystudio");
      assert.equal(res.body.data.siteUrl, buildPublicUrl("www.raystudio.com", "/"));
      assert.equal(res.body.data.fallbackUrl, buildFallbackUrl("raystudio"));
      assert.equal(res.body.data.isCustomDomain, true);
    }
  );
});

test("GET /public/site returns broken state for failed custom domains", async () => {
  await withMethodPatches(
    [
      {
        target: prisma.customDomain,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.domain !== "www.brokenstudio.com") return null;
          return {
            id: "custom-domain-broken-1",
            domain: "www.brokenstudio.com",
            status: "FAILED",
            sslStatus: "ERROR",
            failureReason: "Expected a CNAME record pointing to domains.lensaya.app.",
            photographer: {
              id: "photographer-custom-2",
              username: "brokenstudio",
              studioName: "Broken Studio",
              status: "ACTIVE",
            },
          };
        },
      },
      {
        target: planLimitService,
        method: "getPlanByPhotographerId",
        fn: async () => ({ name: "PRO", customDomain: true }),
      },
    ],
    async () => {
      const res = await request(app)
        .get("/api/v1/public/site")
        .set("x-tenant-host", "www.brokenstudio.com");

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.resolutionStatus, "broken");
      assert.equal(res.body.data.failureReason, "Expected a CNAME record pointing to domains.lensaya.app.");
      assert.equal(res.body.data.fallbackUrl, buildFallbackUrl("brokenstudio"));
      assert.equal(res.body.data.siteUrl, null);
    }
  );
});

test("GET /public/site returns upgrade_required when custom-domain entitlement is gone", async () => {
  await withMethodPatches(
    [
      {
        target: prisma.customDomain,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.domain !== "www.expiredstudio.com") return null;
          return {
            id: "custom-domain-upgrade-1",
            domain: "www.expiredstudio.com",
            status: "ACTIVE",
            sslStatus: "ISSUED",
            failureReason: null,
            photographer: {
              id: "photographer-custom-3",
              username: "expiredstudio",
              studioName: "Expired Studio",
              status: "ACTIVE",
            },
          };
        },
      },
      {
        target: planLimitService,
        method: "getPlanByPhotographerId",
        fn: async () => ({ name: "FREE", customDomain: false }),
      },
    ],
    async () => {
      const res = await request(app)
        .get("/api/v1/public/site")
        .set("x-tenant-host", "www.expiredstudio.com");

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.resolutionStatus, "upgrade_required");
      assert.equal(res.body.data.fallbackUrl, buildFallbackUrl("expiredstudio"));
      assert.equal(res.body.data.siteUrl, null);
    }
  );
});

test("GET /public/site ignores platform hosts", async () => {
  const res = await request(app)
    .get("/api/v1/public/site")
    .set("x-tenant-host", `app.${env.publicAppDomain}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.resolutionStatus, "not_public_host");
  assert.equal(res.body.data.hostType, "platform");
});
