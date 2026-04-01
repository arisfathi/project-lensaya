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

test("GET /profile and /profile/username-preview are available to authenticated users", async () => {
  const userId = "profile-user-1";

  await withMethodPatches(
    [
      {
        target: planLimitService,
        method: "getPlanByUserId",
        fn: async () => ({ name: "FREE", customDomain: false, analyticsTools: false }),
      },
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.userId !== userId) return null;
          return {
            id: "photographer-profile-1",
            studioName: "Ray Studio",
            username: "raystudio",
            bio: null,
            heroTitle: null,
            heroSubtitle: null,
            heroImageUrl: null,
            showHero: true,
            location: null,
            city: null,
            country: null,
            specialty: null,
            style: null,
            hideBranding: false,
            instagramHandle: null,
            facebookUrl: null,
            tiktokHandle: null,
            whatsappNumber: null,
            themeColor: null,
            avatarAsset: null,
            bannerAsset: null,
            user: {
              id: userId,
              email: "ray@example.com",
              fullName: "Ray",
              username: null,
              status: "ACTIVE",
              emailVerifiedAt: new Date("2026-03-27T00:00:00.000Z"),
            },
            websiteUrl: "raystudio.lensaya.com",
          };
        },
      },
      {
        target: prisma.photographer,
        method: "findFirst",
        fn: async () => null,
      },
      {
        target: prisma.user,
        method: "findFirst",
        fn: async () => null,
      },
    ],
    async () => {
      const token = makeToken(userId);

      const profileRes = await request(app)
        .get("/api/v1/profile")
        .set("Authorization", `Bearer ${token}`);

      assert.equal(profileRes.status, 200);
      assert.equal(profileRes.body.success, true);
      assert.equal(profileRes.body.data.username, "raystudio");

      const previewRes = await request(app)
        .get("/api/v1/profile/username-preview")
        .query({ studioName: "AF Studio" })
        .set("Authorization", `Bearer ${token}`);

      assert.equal(previewRes.status, 200);
      assert.equal(previewRes.body.success, true);
      assert.equal(previewRes.body.data.studioName, "AF Studio");
    }
  );
});

test("GET /profile/custom-domain remains available on the restored profile routes", async () => {
  const userId = "profile-domain-user";

  await withMethodPatches(
    [
      {
        target: planLimitService,
        method: "getPlanByUserId",
        fn: async () => ({ name: "FREE", customDomain: false, analyticsTools: false }),
      },
      {
        target: prisma.photographer,
        method: "findUnique",
        fn: async ({ where }) => {
          if (where?.userId !== userId) return null;
          return {
            id: "photographer-domain-1",
            username: "raydomain",
            studioName: "Ray Domain",
            customDomain: null,
          };
        },
      },
      {
        target: customDomainService,
        method: "getState",
        fn: async () => ({
          deleted: false,
          eligible: false,
          currentPlan: "FREE",
          domain: null,
          status: null,
          sslStatus: null,
          failureReason: null,
          lastCheckedAt: null,
          verifiedAt: null,
          fallbackUrl: "https://raydomain.lensaya.com",
          dnsInstructions: null,
          verificationMode: "mock",
        }),
      },
    ],
    async () => {
      const token = makeToken(userId);
      const res = await request(app)
        .get("/api/v1/profile/custom-domain")
        .set("Authorization", `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.fallbackUrl, "https://raydomain.lensaya.com");
    }
  );
});