import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { emailService } from "./emailService.js";
import { notificationService } from "./notificationService.js";

const REFERRAL_PREFIX = "REF-";
const CONVERSION_STATUSES = ["CONVERTED", "REWARDED"];
const SIGNUP_REWARD_STATUSES = ["SIGNED_UP_REWARDED"];
const ACTIVE_REFERRAL_STATUSES = ["CLICKED", "SIGNED_UP", "CONVERTED", "REWARDED", "SIGNED_UP_REWARDED"];
const BILLING_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"];
const REWARD_EXTENSION_DAYS = 30;
const REWARD_EXTENSION_MS = REWARD_EXTENSION_DAYS * 24 * 60 * 60 * 1000;
const SIGNUP_REWARD_FREE_DAYS = 7;
const SIGNUP_REWARD_FREE_MS = SIGNUP_REWARD_FREE_DAYS * 24 * 60 * 60 * 1000;
const SIGNUP_REWARD_PAID_DAYS = 14;
const SIGNUP_REWARD_PAID_MS = SIGNUP_REWARD_PAID_DAYS * 24 * 60 * 60 * 1000;
const REWARDABLE_PAID_PLANS = new Set(["PRO", "STUDIO"]);

const isConversionStatus = (status) => CONVERSION_STATUSES.includes(status);

const isSignupRewardStatus = (status) => SIGNUP_REWARD_STATUSES.includes(status);

const normalizeToken = (value = "") =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

const normalizeVisitorId = (value = "") => {
  const token = String(value || "").trim();
  if (!token) return null;
  return token.slice(0, 191);
};

const normalizeReferralCode = (code = "") => {
  const raw = String(code || "").trim();
  if (!raw) return null;

  const token = raw.toUpperCase().startsWith(REFERRAL_PREFIX)
    ? raw.slice(REFERRAL_PREFIX.length)
    : raw;
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) return null;
  return `${REFERRAL_PREFIX}${normalizedToken}`;
};

const buildReferralCodeFromUsername = (username = "") => {
  const normalized = normalizeToken(username);
  if (!normalized) return null;
  return `${REFERRAL_PREFIX}${normalized}`;
};

const decimalToCents = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
};

const resolveRewardCentsFromGrantPlan = async (planName) => {
  const normalizedPlan = String(planName || "").trim().toUpperCase();
  if (!normalizedPlan) return 0;
  if (!prisma.subscriptionPlan || typeof prisma.subscriptionPlan.findUnique !== "function") {
    return 0;
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { name: normalizedPlan },
    select: { price: true },
  });

  return decimalToCents(plan?.price || 0);
};

const resolveReferrerByCode = async (referralCode) => {
  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) return null;

  const token = normalizedCode.slice(REFERRAL_PREFIX.length);

  let referrer = await prisma.user.findFirst({
    where: {
      OR: [{ username: token }, { photographer: { is: { username: token } } }],
    },
    include: {
      photographer: {
        select: { username: true },
      },
    },
  });

  // Legacy fallback for older REF-<userIdPrefix> codes.
  if (!referrer && token.length >= 6) {
    referrer = await prisma.user.findFirst({
      where: { id: { startsWith: token } },
      include: {
        photographer: {
          select: { username: true },
        },
      },
    });
  }

  return referrer;
};

const acquireReferralRewardLockTx = async (tx, token) => {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken || typeof tx?.$executeRaw !== "function") {
    return;
  }

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${normalizedToken}))`; 
};

const resolveSignupRewardGrantTx = async (tx, referrerUserId, now) => {
  if (!referrerUserId) {
    return null;
  }

  const user = await tx.user.findUnique({
    where: { id: referrerUserId },
    select: {
      photographer: {
        select: { id: true },
      },
    },
  });

  if (!user) {
    return null;
  }

  const activePaid = await tx.subscription.findFirst({
    where: {
      userId: referrerUserId,
      plan: { not: "FREE" },
      status: { in: BILLING_STATUSES },
    },
    orderBy: [{ currentPeriodStart: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      plan: true,
      status: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      photographerId: true,
    },
  });

  if (activePaid && REWARDABLE_PAID_PLANS.has(activePaid.plan)) {
    const baseEnd = activePaid.currentPeriodEnd && activePaid.currentPeriodEnd > now ? activePaid.currentPeriodEnd : now;
    const rewardMs = SIGNUP_REWARD_PAID_MS;
    const rewardEndsAt = new Date(baseEnd.getTime() + rewardMs);
    const updated = await tx.subscription.update({
      where: { id: activePaid.id },
      data: {
        currentPeriodEnd: rewardEndsAt,
        ...(activePaid.status === "TRIALING" ? { trialEndsAt: rewardEndsAt } : {}),
      },
    });

    return {
      subscription: updated,
      rewardPlan: activePaid.plan,
      rewardDays: SIGNUP_REWARD_PAID_DAYS,
      rewardCents: await resolveRewardCentsFromGrantPlan(activePaid.plan),
      rewardLabel:
        activePaid.plan === "STUDIO"
          ? "14-day Studio extension"
          : "14-day Pro extension",
    };
  }

  const existingFree = await tx.subscription.findFirst({
    where: {
      userId: referrerUserId,
      plan: "FREE",
      status: { in: BILLING_STATUSES },
    },
    orderBy: [{ currentPeriodStart: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      photographerId: true,
    },
  });

  const rewardEndsAt = new Date(now.getTime() + SIGNUP_REWARD_FREE_MS);
  const rewardPlan = "PRO";
  const rewardCents = await resolveRewardCentsFromGrantPlan(rewardPlan);

  if (existingFree) {
    const updated = await tx.subscription.update({
      where: { id: existingFree.id },
      data: {
        photographerId: existingFree.photographerId || user.photographer?.id || null,
        plan: rewardPlan,
        status: "TRIALING",
        provider: "MANUAL",
        billingInterval: "MONTHLY",
        currentPeriodStart: now,
        currentPeriodEnd: rewardEndsAt,
        pendingPlan: null,
        pendingBillingInterval: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEndsAt: rewardEndsAt,
        startedAt: now,
      },
    });

    return {
      subscription: updated,
      rewardPlan,
      rewardDays: SIGNUP_REWARD_FREE_DAYS,
      rewardCents,
      rewardLabel: "7-day Pro trial",
    };
  }

  const created = await tx.subscription.create({
    data: {
      userId: referrerUserId,
      photographerId: user.photographer?.id || null,
      plan: rewardPlan,
      status: "TRIALING",
      provider: "MANUAL",
      billingInterval: "MONTHLY",
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: rewardEndsAt,
      pendingPlan: null,
      pendingBillingInterval: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt: rewardEndsAt,
    },
  });

  return {
    subscription: created,
    rewardPlan,
    rewardDays: SIGNUP_REWARD_FREE_DAYS,
    rewardCents,
    rewardLabel: "7-day Pro trial",
  };
};

const resolveReferralRewardGrantTx = async (tx, referrerUserId, now) => {
  if (!referrerUserId) {
    return null;
  }

  const user = await tx.user.findUnique({
    where: { id: referrerUserId },
    select: {
      photographer: {
        select: { id: true },
      },
    },
  });

  if (!user) {
    return null;
  }

  const activePaid = await tx.subscription.findFirst({
    where: {
      userId: referrerUserId,
      plan: { not: "FREE" },
      status: { in: BILLING_STATUSES },
    },
    orderBy: [{ currentPeriodStart: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      plan: true,
      status: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      photographerId: true,
    },
  });

  if (activePaid && REWARDABLE_PAID_PLANS.has(activePaid.plan)) {
    const baseEnd = activePaid.currentPeriodEnd || now;
    const rewardEndsAt = new Date(baseEnd.getTime() + REWARD_EXTENSION_MS);
    const updated = await tx.subscription.update({
      where: { id: activePaid.id },
      data: {
        currentPeriodEnd: rewardEndsAt,
        ...(activePaid.status === "TRIALING" ? { trialEndsAt: rewardEndsAt } : {}),
      },
    });

    return {
      subscription: updated,
      rewardPlan: activePaid.plan,
      rewardDays: REWARD_EXTENSION_DAYS,
      rewardCents: await resolveRewardCentsFromGrantPlan(activePaid.plan),
      rewardLabel:
        activePaid.plan === "STUDIO"
          ? "30-day Studio extension"
          : "30-day Pro extension",
    };
  }

  const existingFree = await tx.subscription.findFirst({
    where: {
      userId: referrerUserId,
      plan: "FREE",
      status: { in: BILLING_STATUSES },
    },
    orderBy: [{ currentPeriodStart: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      photographerId: true,
    },
  });

  const rewardEndsAt = new Date(now.getTime() + REWARD_EXTENSION_MS);
  const rewardPlan = "PRO";
  const rewardCents = await resolveRewardCentsFromGrantPlan(rewardPlan);

  if (existingFree) {
    const updated = await tx.subscription.update({
      where: { id: existingFree.id },
      data: {
        photographerId: existingFree.photographerId || user.photographer?.id || null,
        plan: rewardPlan,
        status: "TRIALING",
        provider: "MANUAL",
        billingInterval: "MONTHLY",
        currentPeriodStart: now,
        currentPeriodEnd: rewardEndsAt,
        pendingPlan: null,
        pendingBillingInterval: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEndsAt: rewardEndsAt,
        startedAt: now,
      },
    });

    return {
      subscription: updated,
      rewardPlan,
      rewardDays: REWARD_EXTENSION_DAYS,
      rewardCents,
      rewardLabel: "30-day Pro access",
    };
  }

  const created = await tx.subscription.create({
    data: {
      userId: referrerUserId,
      photographerId: user.photographer?.id || null,
      plan: rewardPlan,
      status: "TRIALING",
      provider: "MANUAL",
      billingInterval: "MONTHLY",
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: rewardEndsAt,
      pendingPlan: null,
      pendingBillingInterval: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt: rewardEndsAt,
    },
  });

  return {
    subscription: created,
    rewardPlan,
    rewardDays: REWARD_EXTENSION_DAYS,
    rewardCents,
    rewardLabel: "30-day Pro access",
  };
};
export const referralService = {
  normalizeReferralCode,
  buildReferralCodeFromUsername,

  async me(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { photographer: true },
    });

    if (!user) {
      return {
        referralCode: null,
        totalReferrals: 0,
        clicks: 0,
        signups: 0,
        conversions: 0,
        conversionRate: 0,
        rewardsEarned: 0,
        activeReferrals: 0,
        // Legacy keys
        code: null,
        rewardEarned: 0,
      };
    }

    const username = user.photographer?.username || user.username || "";
    const referralCode = buildReferralCodeFromUsername(username);

    const [totalReferrals, rewards, statusCounts] = await Promise.all([
      prisma.referral.count({ where: { referrerUserId: userId } }),
      prisma.referral.aggregate({
        where: { referrerUserId: userId },
        _sum: { rewardCents: true },
      }),
      prisma.referral.groupBy({
        by: ["status"],
        where: {
          referrerUserId: userId,
        },
        _count: { _all: true },
      }),
    ]);

    const countsByStatus = new Map(statusCounts.map((item) => [item.status, item._count._all]));
    const clicks = countsByStatus.get("CLICKED") || 0;
    const signups = (countsByStatus.get("SIGNED_UP") || 0) + (countsByStatus.get("SIGNED_UP_REWARDED") || 0);
    const conversions = CONVERSION_STATUSES.reduce(
      (sum, status) => sum + (countsByStatus.get(status) || 0),
      0
    );
    const activeReferrals = ACTIVE_REFERRAL_STATUSES.reduce(
      (sum, status) => sum + (countsByStatus.get(status) || 0),
      0
    );

    const rewardsEarned = (rewards._sum.rewardCents || 0) / 100;
    const conversionRate = totalReferrals ? Number(((conversions / totalReferrals) * 100).toFixed(2)) : 0;

    return {
      referralCode,
      totalReferrals,
      clicks,
      signups,
      conversions,
      conversionRate,
      rewardsEarned,
      activeReferrals,
      // Legacy keys for compatibility
      code: referralCode,
      rewardEarned: rewardsEarned,
    };
  },

  async myEvents(userId, query) {
    const { page, limit, skip, take } = getPagination(query);

    const [items, total] = await Promise.all([
      prisma.referral.findMany({
        where: { referrerUserId: userId },
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          referredUser: {
            select: { email: true },
          },
        },
      }),
      prisma.referral.count({ where: { referrerUserId: userId } }),
    ]);

    return {
      items: items.map((item) => ({
        visitorEmail: item.referredEmail || item.referredUser?.email || null,
        status: item.status,
        reward: item.rewardCents / 100,
        date: item.convertedAt || item.createdAt,
        // Legacy keys for compatibility
        referredUser: item.referredUserId,
        createdAt: item.createdAt,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },

  async track({ referralCode, visitorId }) {
    const normalizedCode = normalizeReferralCode(referralCode);
    const normalizedVisitorId = normalizeVisitorId(visitorId);

    if (!normalizedCode) {
      return { tracked: true };
    }

    const referrer = await resolveReferrerByCode(normalizedCode);
    if (referrer && normalizedVisitorId) {
      const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await prisma.referral.findFirst({
        where: {
          referrerUserId: referrer.id,
          visitorId: normalizedVisitorId,
          status: "CLICKED",
          createdAt: { gte: lastDay },
        },
        select: { id: true },
      });

      if (!existing) {
        await prisma.referral.create({
          data: {
            referrerUserId: referrer.id,
            code: normalizedCode,
            visitorId: normalizedVisitorId,
            status: "CLICKED",
          },
        });
      }
    }

    return { tracked: true };
  },

  async markSignedUp({ referralCode, referredUserId, referredEmail }) {
    const normalizedCode = normalizeReferralCode(referralCode);
    if (!normalizedCode || !referredUserId) {
      return { updated: false };
    }

    const referrer = await resolveReferrerByCode(normalizedCode);
    if (
      !referrer ||
      referrer.id === referredUserId ||
      normalizeEmail(referrer.email) === normalizeEmail(referredEmail)
    ) {
      return { updated: false };
    }

    const signupEmail = referredEmail || "A new user";
    const notifyReferrerSignup = async () =>
      notificationService.create({
        userId: referrer.id,
        type: "MARKETING",
        title: "New referral signup",
        body: `${signupEmail} signed up using your referral code.`,
        actionUrl: "/dashboard/referrals",
      });
    const dispatchReferralRewardEmailAsync = ({ to, rewardLabel, referralCode, signedUpEmail }) => {
      if (!to || !rewardLabel) return;

      void emailService
        .send({
          to,
          subject: "Congrats! You earned a referral reward",
          html: `
            <p>Congrats! You earned <b>${rewardLabel}</b>.</p>
            <p>You got this because ${signedUpEmail || "a new user"} signed up with your referral code${referralCode ? ` <b>${referralCode}</b>` : ""}.</p>
            <p>You can view details in your dashboard referrals page.</p>
          `,
          text: `Congrats! You earned ${rewardLabel}. You got this because ${signedUpEmail || "a new user"} signed up with your referral code${referralCode ? ` ${referralCode}` : ""}.`,
        })
        .catch((emailError) => {
          logger.error({ err: emailError, email: to }, "Failed to send referral reward email");
          captureException(emailError, {
            service: "referralService",
            action: "dispatchReferralRewardEmailAsync",
            email: to,
          });
        });
    };

    const notifyReferrerRewardBlast = async (userId, rewardTarget, referralCode, referrerEmail) => {
      if (!userId || !rewardTarget) return;

      await notificationService.createMany([
        {
          userId,
          type: "MARKETING",
          title: "Referral reward unlocked",
          body: `Congrats! You earned ${rewardTarget.rewardLabel}.`,
          actionUrl: "/dashboard/referrals",
        },
        {
          userId,
          type: "MARKETING",
          title: "Why you got this reward",
          body: `${signupEmail} signed up with your referral code${referralCode ? ` (${referralCode})` : ""}.`,
          actionUrl: "/dashboard/referrals",
        },
        {
          userId,
          type: "MARKETING",
          title: "Check your updated plan",
          body: "Your plan access has been updated. Open billing to see your new trial or extension period.",
          actionUrl: "/dashboard/pricing",
        },
      ]);

      dispatchReferralRewardEmailAsync({
        to: referrerEmail,
        rewardLabel: rewardTarget.rewardLabel,
        referralCode,
        signedUpEmail: signupEmail,
      });
    };

    const existingForUser = await prisma.referral.findUnique({
      where: { referredUserId },
    });

    if (existingForUser) {
      if (existingForUser.referrerUserId !== referrer.id) {
        return { updated: false };
      }

      const isNewSignup = existingForUser.status === "CLICKED" || !existingForUser.referredUserId;
      const updated = await prisma.referral.update({
        where: { id: existingForUser.id },
        data: {
          code: normalizedCode,
          status: isConversionStatus(existingForUser.status) ? existingForUser.status : "SIGNED_UP",
          referredEmail: referredEmail || existingForUser.referredEmail,
        },
      });

      if (existingForUser.status === "CLICKED") {
        await notifyReferrerSignup();
      }

      // Grant signup reward if this is a new signup and not already rewarded
      if (isNewSignup && !isSignupRewardStatus(existingForUser.status) && !isConversionStatus(existingForUser.status)) {
        const signupRewardTarget = await prisma.$transaction(async (tx) => {
          return resolveSignupRewardGrantTx(tx, existingForUser.referrerUserId, new Date());
        });
        
        if (signupRewardTarget) {
          await notifyReferrerRewardBlast(existingForUser.referrerUserId, signupRewardTarget, normalizedCode, referrer.email);
          
          await prisma.referral.update({
            where: { id: existingForUser.id },
            data: {
              status: "SIGNED_UP_REWARDED",
              rewardCents: signupRewardTarget.rewardCents,
              rewardPlan: signupRewardTarget.rewardPlan,
              rewardDays: signupRewardTarget.rewardDays,
              rewardGrantedAt: new Date(),
            },
          });
        }
      }

      return { updated: true, referralId: updated.id };
    }

    const candidate = await prisma.referral.findFirst({
      where: {
        referrerUserId: referrer.id,
        code: normalizedCode,
        referredUserId: null,
        status: { in: ["CLICKED", "SIGNED_UP", "SIGNED_UP_REWARDED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (candidate) {
      const isNewSignup = !candidate.referredUserId;
      
      let updateData = {
        referredUserId,
        referredEmail: referredEmail || candidate.referredEmail,
      };

      // Grant signup reward if this is a new signup
      if (isNewSignup) {
        const signupRewardTarget = await prisma.$transaction(async (tx) => {
          return resolveSignupRewardGrantTx(tx, candidate.referrerUserId, new Date());
        });

        updateData.status = "SIGNED_UP_REWARDED";
        updateData.rewardCents = signupRewardTarget.rewardCents;
        updateData.rewardPlan = signupRewardTarget.rewardPlan;
        updateData.rewardDays = signupRewardTarget.rewardDays;
        updateData.rewardGrantedAt = new Date();
      } else {
        updateData.status = "SIGNED_UP";
      }

      const updated = await prisma.referral.update({
        where: { id: candidate.id },
        data: updateData,
      });

      if (isNewSignup) {
        await notifyReferrerRewardBlast(candidate.referrerUserId, {
          rewardLabel:
            updateData.rewardPlan === "STUDIO"
              ? "14-day Studio extension"
              : updateData.rewardPlan === "PRO"
                ? "14-day Pro extension"
                : "7-day Pro trial",
        }, candidate.code, referrer.email);
      } else {
        await notifyReferrerSignup();
      }

      return { updated: true, referralId: updated.id };
    }

    const signupRewardTarget = await prisma.$transaction(async (tx) => {
      return resolveSignupRewardGrantTx(tx, referrer.id, new Date());
    });

    const created = await prisma.referral.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId,
        referredEmail: referredEmail || null,
        code: normalizedCode,
        status: "SIGNED_UP_REWARDED",
        rewardCents: signupRewardTarget.rewardCents,
        rewardPlan: signupRewardTarget.rewardPlan,
        rewardDays: signupRewardTarget.rewardDays,
        rewardGrantedAt: new Date(),
      },
    });

    await notifyReferrerRewardBlast(referrer.id, signupRewardTarget, normalizedCode, referrer.email);

    return { updated: true, referralId: created.id };
  },

  async markConversionAndReward({ referredUserId, referralCode, rewardCents }) {
    if (!referredUserId) {
      return { updated: false };
    }

    const normalizedCode = normalizeReferralCode(referralCode);

    return prisma.$transaction(async (tx) => {
      await acquireReferralRewardLockTx(tx, `referral-reward:${referredUserId}`);

      const fallbackRewardCents = Number.isFinite(Number(rewardCents))
        ? Math.max(Math.round(Number(rewardCents)), 0)
        : 0;

      let referral = await tx.referral.findUnique({
        where: { referredUserId },
      });

      if (!referral && normalizedCode) {
        const referrer = await resolveReferrerByCode(normalizedCode);
        if (referrer && referrer.id !== referredUserId) {
          referral = await tx.referral.findFirst({
            where: {
              referrerUserId: referrer.id,
              code: normalizedCode,
            },
            orderBy: { createdAt: "desc" },
          });

          if (referral && !referral.referredUserId) {
            referral = await tx.referral.update({
              where: { id: referral.id },
              data: {
                referredUserId,
                status: isConversionStatus(referral.status) ? referral.status : "SIGNED_UP",
              },
            });
          }
        }
      }

      if (!referral) {
        return { updated: false };
      }

      if (referral.referrerUserId === referredUserId) {
        return { updated: false };
      }

      if (referral.rewardGrantedAt || referral.status === "REWARDED") {
        return { updated: false, alreadyRewarded: true, referralId: referral.id };
      }

      if (referral.status === "CONVERTED" && referral.convertedAt) {
        return { updated: false, alreadyConverted: true, referralId: referral.id };
      }

      const now = new Date();
      const rewardTarget = await resolveReferralRewardGrantTx(tx, referral.referrerUserId, now);
      if (!rewardTarget) {
        return { updated: false };
      }

      const rewardCentsToRecord = rewardTarget.rewardCents > 0 ? rewardTarget.rewardCents : fallbackRewardCents;

      const current = await tx.referral.update({
        where: { id: referral.id },
        data: {
          status: "REWARDED",
          rewardCents: rewardCentsToRecord,
          rewardPlan: rewardTarget.rewardPlan,
          rewardDays: rewardTarget.rewardDays,
          rewardGrantedAt: now,
          convertedAt: referral.convertedAt || now,
        },
      });

      await tx.notification.create({
        data: {
          userId: current.referrerUserId,
          type: "MARKETING",
          title: "Referral converted",
          body: "A referred user converted successfully. Reward earned: " + rewardTarget.rewardLabel + ".",
          actionUrl: "/dashboard/referrals",
        },
      });

      return {
        updated: true,
        referralId: current.id,
        rewardCents: current.rewardCents,
        rewardPlan: current.rewardPlan,
        rewardDays: current.rewardDays,
      };
    });
  },
};


