import { prisma } from "../config/prisma.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { notificationService } from "./notificationService.js";

const REFERRAL_PREFIX = "REF-";
const CONVERSION_STATUSES = ["CONVERTED", "REWARDED"];
const ACTIVE_REFERRAL_STATUSES = ["CLICKED", "SIGNED_UP", "CONVERTED", "REWARDED"];
const BILLING_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"];

const isConversionStatus = (status) => CONVERSION_STATUSES.includes(status);

const normalizeToken = (value = "") =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

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

const resolveRewardCentsFromPlan = async (referredUserId) => {
  if (!referredUserId) return 0;

  const latestSubscription = await prisma.subscription.findFirst({
    where: {
      userId: referredUserId,
      status: { in: BILLING_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    select: { plan: true },
  });

  const planName = (latestSubscription?.plan || "FREE").toString();
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { name: planName },
    select: { referralReward: true },
  });

  return decimalToCents(plan?.referralReward || 0);
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
    const signups = countsByStatus.get("SIGNED_UP") || 0;
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
    if (!normalizedCode) {
      return { tracked: true };
    }

    const referrer = await resolveReferrerByCode(normalizedCode);
    if (referrer) {
      const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await prisma.referral.findFirst({
        where: {
          referrerUserId: referrer.id,
          visitorId,
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
            visitorId,
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
    if (!referrer || referrer.id === referredUserId) {
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

    const existingForUser = await prisma.referral.findUnique({
      where: { referredUserId },
    });

    if (existingForUser) {
      if (existingForUser.referrerUserId !== referrer.id) {
        return { updated: false };
      }

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

      return { updated: true, referralId: updated.id };
    }

    const candidate = await prisma.referral.findFirst({
      where: {
        referrerUserId: referrer.id,
        code: normalizedCode,
        referredUserId: null,
        status: { in: ["CLICKED", "SIGNED_UP"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (candidate) {
      const updated = await prisma.referral.update({
        where: { id: candidate.id },
        data: {
          status: "SIGNED_UP",
          referredUserId,
          referredEmail: referredEmail || candidate.referredEmail,
        },
      });

      if (!candidate.referredUserId || candidate.status !== "SIGNED_UP") {
        await notifyReferrerSignup();
      }

      return { updated: true, referralId: updated.id };
    }

    const created = await prisma.referral.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId,
        referredEmail: referredEmail || null,
        code: normalizedCode,
        status: "SIGNED_UP",
      },
    });

    await notifyReferrerSignup();

    return { updated: true, referralId: created.id };
  },

  async markConversionAndReward({ referredUserId, referralCode, rewardCents }) {
    if (!referredUserId) {
      return { updated: false };
    }

    const normalizedCode = normalizeReferralCode(referralCode);
    const computedPlanRewardCents = await resolveRewardCentsFromPlan(referredUserId);
    const normalizedRewardCents = Number.isFinite(Number(rewardCents))
      ? Math.max(Math.round(Number(rewardCents)), 0)
      : computedPlanRewardCents;

    let referral = await prisma.referral.findUnique({
      where: { referredUserId },
    });

    if (!referral && normalizedCode) {
      const referrer = await resolveReferrerByCode(normalizedCode);
      if (referrer && referrer.id !== referredUserId) {
        referral = await prisma.referral.findFirst({
          where: {
            referrerUserId: referrer.id,
            code: normalizedCode,
          },
          orderBy: { createdAt: "desc" },
        });

        if (referral && !referral.referredUserId) {
          referral = await prisma.referral.update({
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

    const now = new Date();
    let current = referral;

    if (current.status === "CONVERTED" && current.convertedAt) {
      return { updated: false, alreadyConverted: true, referralId: current.id };
    }

    const nextRewardCents = current.rewardCents > 0 ? current.rewardCents : normalizedRewardCents;

    current = await prisma.referral.update({
      where: { id: current.id },
      data: {
        status: "CONVERTED",
        rewardCents: nextRewardCents,
        convertedAt: current.convertedAt || now,
      },
    });

    await notificationService.create({
      userId: current.referrerUserId,
      type: "MARKETING",
      title: "Referral converted",
      body: `A referred user converted successfully. Reward earned: $${(
        current.rewardCents / 100
      ).toFixed(2)}.`,
      actionUrl: "/dashboard/referrals",
    });

    return { updated: true, referralId: current.id, rewardCents: current.rewardCents };
  },
};
