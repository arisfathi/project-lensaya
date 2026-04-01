import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { authService } = await import("../src/services/authService.js");
const { referralService } = await import("../src/services/referralService.js");
const { prisma } = await import("../src/config/prisma.js");
const { emailService } = await import("../src/services/emailService.js");
const { ApiError } = await import("../src/utils/apiError.js");

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

const DAY_MS = 24 * 60 * 60 * 1000;
const REFERRAL_TRIAL_MS = 14 * DAY_MS;
const REWARD_EXTENSION_MS = 30 * DAY_MS;
const settleAsyncWork = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeReferrer = (id = "referrer-1", username = "friend") => ({
  id,
  photographer: {
    username,
  },
});

const makeSignupTx = ({ referrerUsername = "friend", capture, existingFreeTrialDays = 0 }) => ({
  user: {
    create: async ({ data }) => ({
      id: "new-user-1",
      ...data,
      role: data.role || "PHOTOGRAPHER",
      status: data.status || "ACTIVE",
      emailVerifiedAt: data.emailVerifiedAt || new Date("2026-03-27T00:00:00.000Z"),
    }),
    findUnique: async ({ where }) => {
      if (where?.id === "new-user-1") {
        return {
          id: "new-user-1",
          email: "new@example.com",
          fullName: "New User",
          role: "PHOTOGRAPHER",
          status: "ACTIVE",
          emailVerifiedAt: new Date("2026-03-27T00:00:00.000Z"),
          photographer: {
            id: "photographer-new-1",
            username: "new-user-1",
          },
        };
      }
      return null;
    },
    findFirst: async ({ where }) => {
      const token = where?.OR?.[0]?.username || where?.OR?.[1]?.photographer?.is?.username;
      if (token === referrerUsername) {
        return makeReferrer();
      }
      return null;
    },
  },
  photographer: {
    findUnique: async () => null,
    create: async ({ data }) => ({
      id: "photographer-new-1",
      ...data,
    }),
  },
  subscriptionPlan: {
    findFirst: async () => ({
      name: "FREE",
      trialDays: existingFreeTrialDays,
    }),
  },
  subscription: {
    create: async ({ data }) => {
      capture.subscriptionCreate = data;
      return {
        id: "subscription-new-1",
        ...data,
      };
    },
  },
  referral: {
    findUnique: async () => null,
    findFirst: async () => null,
    create: async ({ data }) => {
      capture.referralCreate = data;
      return {
        id: "referral-new-1",
        ...data,
      };
    },
    update: async ({ data }) => ({
      id: "referral-new-1",
      ...data,
    }),
  },
  emailVerificationToken: {
    updateMany: async () => ({ count: 0 }),
    create: async ({ data }) => ({
      id: "verification-token-1",
      ...data,
    }),
  },
  notification: {
    create: async () => ({ id: "notification-1" }),
  },
});

const makeVerifyTx = (state, capture) => ({
  user: {
    findUnique: async ({ where }) => {
      if (where?.id === state.userId) {
        return {
          id: state.userId,
          photographer: {
            id: state.photographerId,
          },
        };
      }
      return null;
    },
    update: async ({ data }) => {
      state.userEmailVerifiedAt = data.emailVerifiedAt || null;
      return {
        id: state.userId,
        emailVerifiedAt: state.userEmailVerifiedAt,
      };
    },
  },
  emailVerificationToken: {
    update: async () => ({ id: state.tokenId }),
    updateMany: async () => ({ count: 0 }),
  },
  referral: {
    findUnique: async () => state.referral,
    update: async ({ data }) => {
      state.referral = {
        ...state.referral,
        ...data,
      };
      return state.referral;
    },
  },
  subscription: {
    findFirst: async () => state.subscription,
    update: async ({ data }) => {
      state.subscriptionUpdateCalls += 1;
      capture.subscriptionUpdate = data;
      state.subscription = {
        ...state.subscription,
        ...data,
      };
      return state.subscription;
    },
    create: async ({ data }) => {
      state.subscriptionCreateCalls += 1;
      capture.subscriptionCreate = data;
      state.subscription = {
        id: "subscription-trial-1",
        ...data,
      };
      return state.subscription;
    },
  },
  notification: {
    create: async () => ({ id: "notification-verify-1" }),
  },
});

const makeRewardTx = (state, capture, activePaid, freeSubscription) => ({
  $queryRaw: async () => undefined,
  user: {
    findUnique: async ({ where }) => {
      if (where?.id === state.referrerUserId) {
        return {
          id: state.referrerUserId,
          photographer: {
            id: state.referrerPhotographerId,
          },
        };
      }
      return null;
    },
  },
  subscription: {
    findFirst: async ({ where }) => {
      if (where?.plan?.not === "FREE") {
        return activePaid;
      }
      if (where?.plan === "FREE") {
        return freeSubscription;
      }
      return null;
    },
    update: async ({ data }) => {
      state.subscriptionUpdateCalls += 1;
      capture.subscriptionUpdate = data;
      state.rewardSubscription = {
        ...(state.rewardSubscription || activePaid || freeSubscription || {}),
        ...data,
      };
      return state.rewardSubscription;
    },
    create: async ({ data }) => {
      state.subscriptionCreateCalls += 1;
      capture.subscriptionCreate = data;
      state.rewardSubscription = {
        id: "reward-subscription-1",
        ...data,
      };
      return state.rewardSubscription;
    },
  },
  referral: {
    findUnique: async () => state.referral,
    findFirst: async () => null,
    update: async ({ data }) => {
      state.referral = {
        ...state.referral,
        ...data,
      };
      return state.referral;
    },
  },
  notification: {
    create: async ({ data }) => {
      state.notificationCalls += 1;
      capture.notification = data;
      return { id: "notification-reward-1" };
    },
  },
});

test("referralService.markSignedUp blocks same-email self referral attempts", async () => {
  const updates = [];

  await withMethodPatches(
    [
      {
        target: prisma.user,
        method: "findFirst",
        fn: async ({ where }) => {
          const token = where?.OR?.[0]?.username || where?.OR?.[1]?.photographer?.is?.username;
          if (token === "friend") {
            return {
              id: "referrer-1",
              email: "friend@example.com",
              photographer: { username: "friend" },
            };
          }
          return null;
        },
      },
      {
        target: prisma.referral,
        method: "findUnique",
        fn: async () => null,
      },
      {
        target: prisma.referral,
        method: "findFirst",
        fn: async () => null,
      },
      {
        target: prisma.referral,
        method: "update",
        fn: async ({ data }) => {
          updates.push(data);
          return { id: "referral-1", ...data };
        },
      },
      {
        target: prisma.referral,
        method: "create",
        fn: async ({ data }) => {
          updates.push(data);
          return { id: "referral-1", ...data };
        },
      },
    ],
    async () => {
      const result = await referralService.markSignedUp({
        referralCode: "REF-friend",
        referredUserId: "new-user-1",
        referredEmail: "friend@example.com",
      });

      assert.equal(result.updated, false);
      assert.equal(updates.length, 0);
    }
  );
});
test("referralService.track records a single click for the same visitor", async () => {
  const clicks = [];

  await withMethodPatches(
    [
      {
        target: prisma.user,
        method: "findFirst",
        fn: async ({ where }) => {
          const token = where?.OR?.[0]?.username || where?.OR?.[1]?.photographer?.is?.username;
          if (token === "friend") {
            return makeReferrer();
          }
          return null;
        },
      },
      {
        target: prisma.referral,
        method: "findFirst",
        fn: async ({ where }) =>
          clicks.find(
            (item) =>
              item.referrerUserId === where?.referrerUserId &&
              item.visitorId === where?.visitorId &&
              item.status === where?.status
          ) || null,
      },
      {
        target: prisma.referral,
        method: "create",
        fn: async ({ data }) => {
          clicks.push({
            ...data,
            createdAt: new Date(),
          });
          return data;
        },
      },
    ],
    async () => {
      await referralService.track({ referralCode: " REF-friend ", visitorId: " visitor-abc " });
      await referralService.track({ referralCode: "REF-friend", visitorId: "visitor-abc" });

      assert.equal(clicks.length, 1);
      assert.equal(clicks[0].visitorId, "visitor-abc");
      assert.equal(clicks[0].code, "REF-friend");
    }
  );
});

test("authService.signup immediately grants the referral trial for referred signups", async () => {
  const capture = {};

  await withMethodPatches(
    [
      {
        target: bcrypt,
        method: "hash",
        fn: async () => "hashed-password",
      },
      {
        target: prisma.user,
        method: "findUnique",
        fn: async () => null,
      },

      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) => callback(makeSignupTx({ referrerUsername: "friend", capture })),
      },
    ],
    async () => {
      const result = await authService.signup(
        {
          fullName: "New User",
          email: "new@example.com",
          password: "Password123!",
          referralCode: "REF-friend",
        },
        { requestId: "signup-referral-1" }
      );

      await settleAsyncWork();

      assert.equal(result.user.email, "new@example.com");
      assert.equal(typeof result.user.emailVerifiedAt, "string");
      assert.equal(capture.subscriptionCreate.plan, "FREE");
      assert.equal(capture.subscriptionCreate.status, "ACTIVE");
      assert.equal(capture.referralCreate.status, "SIGNED_UP");
      assert.equal(capture.referralCreate.code, "REF-friend");
      assert.equal(capture.referralCreate.referredUserId, "new-user-1");
    }
  );
});

test("authService.signup ignores invalid referral codes and still succeeds", async () => {
  const capture = {};

  await withMethodPatches(
    [
      {
        target: bcrypt,
        method: "hash",
        fn: async () => "hashed-password",
      },
      {
        target: prisma.user,
        method: "findUnique",
        fn: async () => null,
      },

      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) =>
          callback(
            makeSignupTx({
              referrerUsername: "no-match",
              capture,
            })
          ),
      },
    ],
    async () => {
      const result = await authService.signup(
        {
          fullName: "No Referral User",
          email: "no-referral@example.com",
          password: "Password123!",
          referralCode: "REF-invalid",
        },
        { requestId: "signup-invalid-referral-1" }
      );

      await settleAsyncWork();

      assert.equal(result.user.email, "new@example.com");
      assert.equal(capture.subscriptionCreate.plan, "FREE");
      assert.equal(capture.referralCreate, undefined);
    }
  );
});

test("authService.verifyEmail is a no-op when verification is removed", async () => {
  const result = await authService.verifyEmail({ token: "ver_token_1" }, { requestId: "verify-referral-1" });
  const resend = await authService.resendVerification({ email: "new@example.com" }, { requestId: "verify-referral-2" });

  assert.equal(result.message, "Email verification is no longer required.");
  assert.equal(resend.message, "Email verification is no longer required.");
});
test("authService.signup rejects existing email even with referral code", async () => {
  await withMethodPatches(
    [
      {
        target: prisma.user,
        method: "findUnique",
        fn: async () => ({
          id: "existing-user-1",
          email: "existing@example.com",
        }),
      },
    ],
    async () => {
      await assert.rejects(
        () =>
          authService.signup({
            fullName: "Existing User",
            email: "existing@example.com",
            password: "Password123!",
            referralCode: "REF-friend",
          }),
        (error) => error instanceof ApiError && error.statusCode === 409
      );
    }
  );
});

test("referralService.markSignedUp blocks self-referrals", async () => {
  await withMethodPatches(
    [
      {
        target: prisma.user,
        method: "findFirst",
        fn: async () => ({
          id: "same-user-1",
          photographer: {
            username: "same-user-1",
          },
        }),
      },
    ],
    async () => {
      const result = await referralService.markSignedUp({
        referralCode: "REF-same-user-1",
        referredUserId: "same-user-1",
        referredEmail: "same@example.com",
      });

      assert.equal(result.updated, false);
    }
  );
});

const runRewardScenario = async ({
  name,
  activePaid,
  freeSubscription,
  expectedPlan,
  expectedStatus,
  expectCreate,
  repeatCall = false,
}) => {
  const state = {
    referrerUserId: "referrer-1",
    referrerPhotographerId: "photographer-referrer-1",
    referral: {
      id: "referral-reward-1",
      referrerUserId: "referrer-1",
      referredUserId: "new-user-1",
      status: "SIGNED_UP",
      rewardGrantedAt: null,
      convertedAt: null,
      rewardPlan: null,
      rewardDays: 0,
      rewardCents: 0,
    },
    subscriptionUpdateCalls: 0,
    subscriptionCreateCalls: 0,
    notificationCalls: 0,
    rewardSubscription: null,
  };
  const capture = {};

  await withMethodPatches(
    [
      {
        target: prisma,
        method: "$transaction",
        fn: async (callback) => callback(makeRewardTx(state, capture, activePaid, freeSubscription)),
      },
    ],
    async () => {
      const first = await referralService.markConversionAndReward({ referredUserId: "new-user-1" });

      assert.equal(first.updated, true, name);
      assert.equal(state.referral.status, "REWARDED");
      assert.equal(state.referral.rewardGrantedAt instanceof Date, true);
      assert.equal(state.referral.rewardPlan, expectedPlan);
      assert.equal(state.referral.rewardDays, 30);
      assert.equal(state.subscriptionUpdateCalls, expectCreate ? 0 : 1);
      assert.equal(state.subscriptionCreateCalls, expectCreate ? 1 : 0);

      if (expectCreate) {
        assert.equal(capture.subscriptionCreate.plan, "PRO");
        assert.equal(capture.subscriptionCreate.status, "TRIALING");
        assert.equal(
          capture.subscriptionCreate.currentPeriodEnd.getTime() - capture.subscriptionCreate.currentPeriodStart.getTime(),
          REWARD_EXTENSION_MS
        );
      } else if (activePaid) {
        assert.equal(state.rewardSubscription.plan, expectedPlan);
        assert.equal(
          state.rewardSubscription.currentPeriodEnd.getTime() - activePaid.currentPeriodEnd.getTime(),
          REWARD_EXTENSION_MS
        );
        assert.equal(state.rewardSubscription.status || expectedStatus, expectedStatus);
        if (expectedStatus === "TRIALING") {
          assert.equal(state.rewardSubscription.trialEndsAt.getTime(), state.rewardSubscription.currentPeriodEnd.getTime());
        }
      } else {
        assert.equal(state.rewardSubscription.plan, "PRO");
        assert.equal(
          state.rewardSubscription.currentPeriodEnd.getTime() - state.rewardSubscription.currentPeriodStart.getTime(),
          REWARD_EXTENSION_MS
        );
        assert.equal(state.rewardSubscription.status, "TRIALING");
      }

      if (repeatCall) {
        const second = await referralService.markConversionAndReward({ referredUserId: "new-user-1" });
        assert.equal(second.updated, false);
        assert.equal(second.alreadyRewarded, true);
        assert.equal(state.subscriptionUpdateCalls, expectCreate ? 0 : 1);
        assert.equal(state.subscriptionCreateCalls, expectCreate ? 1 : 0);
      }
    }
  );
};

test("referralService.markConversionAndReward grants Free referrers 30 days of Pro", async () => {
  await runRewardScenario({
    name: "free-referrer",
    activePaid: null,
    freeSubscription: {
      id: "subscription-free-2",
      userId: "referrer-1",
      photographerId: "photographer-referrer-1",
      plan: "FREE",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
    },
    expectedPlan: "PRO",
    expectedStatus: "TRIALING",
    expectCreate: false,
  });
});

test("referralService.markConversionAndReward extends an active Pro subscription by 30 days", async () => {
  await runRewardScenario({
    name: "pro-referrer",
    activePaid: {
      id: "subscription-pro-1",
      userId: "referrer-1",
      photographerId: "photographer-referrer-1",
      plan: "PRO",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    },
    freeSubscription: null,
    expectedPlan: "PRO",
    expectedStatus: "ACTIVE",
    expectCreate: false,
  });
});

test("referralService.markConversionAndReward extends an active Studio subscription by 30 days", async () => {
  await runRewardScenario({
    name: "studio-referrer",
    activePaid: {
      id: "subscription-studio-1",
      userId: "referrer-1",
      photographerId: "photographer-referrer-1",
      plan: "STUDIO",
      status: "TRIALING",
      currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
      trialEndsAt: new Date("2026-04-01T00:00:00.000Z"),
    },
    freeSubscription: null,
    expectedPlan: "STUDIO",
    expectedStatus: "TRIALING",
    expectCreate: false,
  });
});

test("referralService.markConversionAndReward is idempotent for repeated billing events", async () => {
  await runRewardScenario({
    name: "repeat-reward",
    activePaid: {
      id: "subscription-pro-repeat-1",
      userId: "referrer-1",
      photographerId: "photographer-referrer-1",
      plan: "PRO",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    },
    freeSubscription: null,
    expectedPlan: "PRO",
    expectedStatus: "ACTIVE",
    expectCreate: false,
    repeatCall: true,
  });
});



