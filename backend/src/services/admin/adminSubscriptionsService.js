import { prisma } from "../../config/prisma.js";
import { getPagination, buildPagination } from "../../utils/pagination.js";
import { ApiError } from "../../utils/apiError.js";
import { planLimitService } from "../planLimitService.js";
import { PLAN_KEY_BY_NAME, PLAN_NAME_BY_KEY, PLAN_TIERS } from "./adminService.constants.js";
import { defaultPackageFeatureLimit, toPlanDto, toPlanLimitRecord, toPlanTier } from "./adminService.utils.js";

export const adminSubscriptionsService = {
  async subscriptionsOverview() {
    const rows = await prisma.$queryRaw`
      SELECT
        CASE
          WHEN ls."status" IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'INCOMPLETE')
            THEN COALESCE(ls."plan", 'FREE')
          ELSE 'FREE'
        END AS "plan",
        COUNT(*)::bigint AS "count"
      FROM "User" u
      LEFT JOIN LATERAL (
        SELECT s."plan", s."status"
        FROM "Subscription" s
        WHERE s."userId" = u."id"
        ORDER BY s."createdAt" DESC
        LIMIT 1
      ) ls ON TRUE
      WHERE u."role" = 'PHOTOGRAPHER'
      GROUP BY 1
    `;

    const planStats = { FREE: 0, PRO: 0, STUDIO: 0 };
    for (const row of rows) {
      const plan = toPlanTier(row?.plan);
      planStats[plan] += Number(row?.count || 0);
    }

    const upgrades = planStats.PRO + planStats.STUDIO;

    return {
      planStats,
      distribution: Object.entries(planStats).map(([plan, count]) => ({ plan, count })),
      upgradesDowngrades: { upgrades, downgrades: 0 },
    };
  },

  async getPlanLimits() {
    const plans = await planLimitService.listAllPlans();
    const planMap = new Map(plans.map((plan) => [plan.name, plan]));

    const normalized = {};
    for (const [planName, key] of Object.entries(PLAN_KEY_BY_NAME)) {
      const row = planMap.get(planName);
      if (!row) {
        throw new ApiError(500, "Subscription plans are not configured");
      }
      normalized[key] = toPlanLimitRecord(row);
    }

    return normalized;
  },

  async updatePlanLimits(limits, { getPlanLimits }) {
    const entries = Object.entries(limits || {}).filter(([key, value]) => {
      if (!PLAN_NAME_BY_KEY[key]) return false;
      return Boolean(value && typeof value === "object");
    });

    if (!entries.length) {
      return { updated: true, limits: await getPlanLimits() };
    }

    const [supportsAnalyticsTools, supportsTeamSectionTools, supportsMaxPackageFeatures] = await Promise.all([
      planLimitService.supportsAnalyticsToolsColumn(),
      planLimitService.supportsTeamSectionToolsColumn(),
      planLimitService.supportsMaxPackageFeaturesColumn(),
    ]);

    const updates = entries
      .map(([key, value]) => {
        const payload = value || {};
        const data = {
          ...(payload.services !== undefined ? { maxServices: Number(payload.services) } : {}),
          ...(payload.portfolioImages !== undefined || payload.portfolioPhotos !== undefined
            ? { maxPortfolioImages: Number(payload.portfolioImages ?? payload.portfolioPhotos) }
            : {}),
          ...(payload.packages !== undefined || payload.packagesPerService !== undefined
            ? { maxPackages: Number(payload.packages ?? payload.packagesPerService) }
            : {}),
          ...(supportsMaxPackageFeatures &&
          (payload.packageFeatures !== undefined || payload.maxPackageFeatures !== undefined)
            ? { maxPackageFeatures: Number(payload.packageFeatures ?? payload.maxPackageFeatures) }
            : {}),
          ...(payload.storage !== undefined ? { storageGB: Number(payload.storage) } : {}),
          ...(payload.customDomain !== undefined ? { customDomain: Boolean(payload.customDomain) } : {}),
          ...(supportsAnalyticsTools && payload.analyticsTools !== undefined
            ? { analyticsTools: Boolean(payload.analyticsTools) }
            : {}),
          ...(supportsTeamSectionTools && payload.teamSectionTools !== undefined
            ? { teamSectionTools: Boolean(payload.teamSectionTools) }
            : {}),
        };

        if (Object.keys(data).length === 0) {
          return null;
        }

        return prisma.subscriptionPlan.updateMany({
          where: { name: PLAN_NAME_BY_KEY[key] },
          data,
        });
      })
      .filter(Boolean);

    if (!updates.length) {
      return {
        updated: true,
        limits: await getPlanLimits(),
      };
    }

    const results = await prisma.$transaction(updates);
    const anyMissing = results.some((result) => result.count === 0);
    if (anyMissing) {
      throw new ApiError(404, "Subscription plan not found");
    }

    await planLimitService.invalidatePlanCache();

    return {
      updated: true,
      limits: await getPlanLimits(),
    };
  },

  async listPlans() {
    const items = await planLimitService.listAllPlans();
    return {
      items: items
        .slice()
        .sort((a, b) => PLAN_TIERS.indexOf(a.name) - PLAN_TIERS.indexOf(b.name))
        .map(toPlanDto),
    };
  },

  async updatePlan(planId, payload) {
    const existing = await planLimitService.getPlanById(planId);
    const [supportsAnalyticsTools, supportsTeamSectionTools, supportsMaxPackageFeatures] = await Promise.all([
      planLimitService.supportsAnalyticsToolsColumn(),
      planLimitService.supportsTeamSectionToolsColumn(),
      planLimitService.supportsMaxPackageFeaturesColumn(),
    ]);

    const data = {
      ...(payload.name !== undefined ? { name: String(payload.name).toUpperCase() } : {}),
      ...(payload.price !== undefined ? { price: Number(payload.price) } : {}),
      ...(payload.yearlyPrice !== undefined ? { yearlyPrice: Number(payload.yearlyPrice) } : {}),
      ...(payload.currency !== undefined ? { currency: String(payload.currency).toUpperCase() } : {}),
      ...(payload.trialDays !== undefined ? { trialDays: Number(payload.trialDays) } : {}),
      ...(payload.referralReward !== undefined ? { referralReward: Number(payload.referralReward) } : {}),
      ...(payload.storageCostPerGB !== undefined ? { storageCostPerGB: Number(payload.storageCostPerGB) } : {}),
      ...(payload.maxServices !== undefined ? { maxServices: Number(payload.maxServices) } : {}),
      ...(payload.maxPortfolioImages !== undefined ? { maxPortfolioImages: Number(payload.maxPortfolioImages) } : {}),
      ...(payload.maxPackages !== undefined ? { maxPackages: Number(payload.maxPackages) } : {}),
      ...(supportsMaxPackageFeatures && payload.maxPackageFeatures !== undefined
        ? { maxPackageFeatures: Number(payload.maxPackageFeatures) }
        : {}),
      ...(payload.storageGB !== undefined ? { storageGB: Number(payload.storageGB) } : {}),
      ...(payload.customDomain !== undefined ? { customDomain: Boolean(payload.customDomain) } : {}),
      ...(supportsAnalyticsTools && payload.analyticsTools !== undefined
        ? { analyticsTools: Boolean(payload.analyticsTools) }
        : {}),
      ...(supportsTeamSectionTools && payload.teamSectionTools !== undefined
        ? { teamSectionTools: Boolean(payload.teamSectionTools) }
        : {}),
    };

    if (!Object.keys(data).length) {
      return toPlanDto(existing);
    }

    const baseSelect = {
      id: true,
      name: true,
      price: true,
      yearlyPrice: true,
      currency: true,
      trialDays: true,
      referralReward: true,
      storageCostPerGB: true,
      maxServices: true,
      maxPortfolioImages: true,
      maxPackages: true,
      ...(supportsMaxPackageFeatures ? { maxPackageFeatures: true } : {}),
      storageGB: true,
      customDomain: true,
      createdAt: true,
      updatedAt: true,
    };

    const updated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data,
      select:
        supportsAnalyticsTools || supportsTeamSectionTools
          ? {
              ...baseSelect,
              ...(supportsAnalyticsTools ? { analyticsTools: true } : {}),
              ...(supportsTeamSectionTools ? { teamSectionTools: true } : {}),
              ...(supportsMaxPackageFeatures ? { maxPackageFeatures: true } : {}),
            }
          : baseSelect,
    });

    await planLimitService.invalidatePlanCache();

    const normalizedUpdated = {
      ...updated,
      analyticsTools:
        supportsAnalyticsTools && typeof updated.analyticsTools === "boolean" ? updated.analyticsTools : updated.name !== "FREE",
      teamSectionTools:
        supportsTeamSectionTools && typeof updated.teamSectionTools === "boolean"
          ? updated.teamSectionTools
          : updated.name === "STUDIO",
      maxPackageFeatures:
        supportsMaxPackageFeatures && Number.isFinite(Number(updated.maxPackageFeatures))
          ? Number(updated.maxPackageFeatures)
          : defaultPackageFeatureLimit(updated.name),
    };

    return toPlanDto(normalizedUpdated);
  },

  async subscriptionChanges(query) {
    const { page, limit, skip, take } = getPagination(query);
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.subscription.count(),
    ]);

    return {
      items: items.map((s) => ({
        user: s.userId,
        from: "FREE",
        to: s.plan,
        action: s.plan === "FREE" ? "downgraded" : "upgraded",
        at: s.createdAt,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },
};

