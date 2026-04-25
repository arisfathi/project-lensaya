import { prisma } from "../../config/prisma.js";
import { getPagination, buildPagination } from "../../utils/pagination.js";
import { ApiError } from "../../utils/apiError.js";
import { planLimitService } from "../planLimitService.js";
import { PLAN_KEY_BY_NAME, PLAN_NAME_BY_KEY, PLAN_TIERS } from "./adminService.constants.js";
import { toPlanDto, toPlanLimitRecord, toPlanTier } from "./adminService.utils.js";

const looksLikeMissingPlanEntitlementTypes = (error) => {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  if (code === "42704") return true; // undefined_object (e.g. missing enum type)

  return (
    /type\s+"public\."?(AnalyticsMode|LeadAnalyticsMode|SupportTier|BrandingMode)"?\s+does not exist/i.test(message) ||
    /type\s+"(AnalyticsMode|LeadAnalyticsMode|SupportTier|BrandingMode)"\s+does not exist/i.test(message)
  );
};

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

    const updates = entries
      .map(([key, value]) => {
        const payload = value || {};
        const data = {
          ...(payload.services !== undefined ? { maxServices: Number(payload.services) } : {}),
          ...(payload.portfolioImages !== undefined || payload.portfolioPhotos !== undefined
            ? { maxPortfolioImages: Number(payload.portfolioImages ?? payload.portfolioPhotos) }
            : {}),
          ...(payload.packages !== undefined || payload.packagesPerService !== undefined
            ? {
                maxPackages: Number(payload.packages ?? payload.packagesPerService),
                maxPackagesPerService: Number(payload.packages ?? payload.packagesPerService),
              }
            : {}),
          ...(payload.packageFeatures !== undefined || payload.maxPackageFeatures !== undefined
            ? {
                maxPackageFeatures: Number(payload.packageFeatures ?? payload.maxPackageFeatures),
                maxPackageFeaturesPerPackage: Number(
                  payload.packageFeatures ?? payload.maxPackageFeatures
                ),
              }
            : {}),
          ...(payload.storage !== undefined || payload.storageGb !== undefined
            ? {
                storageGB: Number(payload.storage ?? payload.storageGb),
                storageGb: Number(payload.storage ?? payload.storageGb),
              }
            : {}),
          ...(payload.leadHistoryDays !== undefined
            ? { leadHistoryDays: Number(payload.leadHistoryDays) }
            : {}),
          ...(payload.leadVisibilityLimit !== undefined
            ? { leadVisibilityLimit: Number(payload.leadVisibilityLimit) }
            : {}),
          ...(payload.leadTemplatesCount !== undefined
            ? { leadTemplatesCount: Number(payload.leadTemplatesCount) }
            : {}),
          ...(payload.teamSeats !== undefined ? { teamSeats: Number(payload.teamSeats) } : {}),
          ...(payload.customDomain !== undefined || payload.customDomainEnabled !== undefined
            ? {
                customDomain: Boolean(payload.customDomain ?? payload.customDomainEnabled),
                customDomainEnabled: Boolean(payload.customDomain ?? payload.customDomainEnabled),
              }
            : {}),
          ...(payload.analyticsTools !== undefined || payload.analyticsEnabled !== undefined
            ? {
                analyticsTools: Boolean(payload.analyticsTools ?? payload.analyticsEnabled),
                analyticsEnabled: Boolean(payload.analyticsTools ?? payload.analyticsEnabled),
              }
            : {}),
          ...(payload.hideBrandingEnabled !== undefined
            ? { hideBrandingEnabled: Boolean(payload.hideBrandingEnabled) }
            : {}),
          ...(payload.leadFiltersEnabled !== undefined
            ? { leadFiltersEnabled: Boolean(payload.leadFiltersEnabled) }
            : {}),
          ...(payload.leadExportEnabled !== undefined
            ? { leadExportEnabled: Boolean(payload.leadExportEnabled) }
            : {}),
          ...(payload.leadRemindersEnabled !== undefined
            ? { leadRemindersEnabled: Boolean(payload.leadRemindersEnabled) }
            : {}),
          ...(payload.leadAdvancedAnalyticsEnabled !== undefined
            ? { leadAdvancedAnalyticsEnabled: Boolean(payload.leadAdvancedAnalyticsEnabled) }
            : {}),
          ...(payload.teamSectionTools !== undefined || payload.teamToolsEnabled !== undefined
            ? {
                teamSectionTools: Boolean(payload.teamSectionTools ?? payload.teamToolsEnabled),
                teamToolsEnabled: Boolean(payload.teamSectionTools ?? payload.teamToolsEnabled),
              }
            : {}),
          ...(payload.isVisible !== undefined ? { isVisible: Boolean(payload.isVisible) } : {}),
          ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
          ...(payload.isMostPopular !== undefined
            ? { isMostPopular: Boolean(payload.isMostPopular) }
            : {}),
          ...(payload.analyticsMode !== undefined
            ? { analyticsMode: String(payload.analyticsMode).toUpperCase() }
            : {}),
          ...(payload.leadAnalyticsMode !== undefined
            ? { leadAnalyticsMode: String(payload.leadAnalyticsMode).toUpperCase() }
            : {}),
          ...(payload.supportTier !== undefined
            ? { supportTier: String(payload.supportTier).toUpperCase() }
            : {}),
          ...(payload.brandingMode !== undefined
            ? { brandingMode: String(payload.brandingMode).toUpperCase() }
            : {}),
          ...(payload.leadChannels !== undefined ? { leadChannels: payload.leadChannels } : {}),
          ...(payload.displayName !== undefined ? { displayName: String(payload.displayName) } : {}),
          ...(payload.tagline !== undefined ? { tagline: payload.tagline ? String(payload.tagline) : null } : {}),
          ...(payload.subtitle !== undefined
            ? { subtitle: payload.subtitle ? String(payload.subtitle) : null }
            : {}),
          ...(payload.badgeText !== undefined
            ? { badgeText: payload.badgeText ? String(payload.badgeText) : null }
            : {}),
          ...(payload.ctaText !== undefined ? { ctaText: payload.ctaText ? String(payload.ctaText) : null } : {}),
          ...(payload.monthlyPriceDisplay !== undefined
            ? {
                monthlyPriceDisplay: payload.monthlyPriceDisplay
                  ? String(payload.monthlyPriceDisplay)
                  : null,
              }
            : {}),
          ...(payload.yearlyPriceDisplay !== undefined
            ? {
                yearlyPriceDisplay: payload.yearlyPriceDisplay
                  ? String(payload.yearlyPriceDisplay)
                  : null,
              }
            : {}),
          ...(payload.sortOrder !== undefined ? { sortOrder: Number(payload.sortOrder) } : {}),
          ...(payload.price !== undefined ? { price: Number(payload.price) } : {}),
          ...(payload.yearlyPrice !== undefined ? { yearlyPrice: Number(payload.yearlyPrice) } : {}),
          ...(payload.currency !== undefined ? { currency: String(payload.currency).toUpperCase() } : {}),
          ...(payload.trialDays !== undefined ? { trialDays: Number(payload.trialDays) } : {}),
          ...(payload.referralReward !== undefined
            ? { referralReward: Number(payload.referralReward) }
            : {}),
          ...(payload.storageCostPerGB !== undefined
            ? { storageCostPerGB: Number(payload.storageCostPerGB) }
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

    let results = [];
    try {
      results = await prisma.$transaction(updates);
      const anyMissing = results.some((result) => result.count === 0);
      if (anyMissing) {
        throw new ApiError(404, "Subscription plan not found");
      }
    } catch (error) {
      if (looksLikeMissingPlanEntitlementTypes(error)) {
        throw new ApiError(
          500,
          'Database is missing subscription plan entitlement types. Apply the latest Prisma migrations (e.g. run "npm run prisma:migrate:deploy" in `backend/`).'
        );
      }
      throw error;
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
        .sort((a, b) => Number(a.sortOrder ?? PLAN_TIERS.indexOf(a.name)) - Number(b.sortOrder ?? PLAN_TIERS.indexOf(b.name)))
        .map(toPlanDto),
    };
  },

  async updatePlan(planId, payload) {
    const existing = await planLimitService.getPlanById(planId);

    const data = {
      ...(payload.name !== undefined ? { name: String(payload.name).toUpperCase() } : {}),
      ...(payload.displayName !== undefined ? { displayName: String(payload.displayName) } : {}),
      ...(payload.tagline !== undefined ? { tagline: payload.tagline ? String(payload.tagline) : null } : {}),
      ...(payload.subtitle !== undefined ? { subtitle: payload.subtitle ? String(payload.subtitle) : null } : {}),
      ...(payload.badgeText !== undefined ? { badgeText: payload.badgeText ? String(payload.badgeText) : null } : {}),
      ...(payload.ctaText !== undefined ? { ctaText: payload.ctaText ? String(payload.ctaText) : null } : {}),
      ...(payload.monthlyPriceDisplay !== undefined
        ? { monthlyPriceDisplay: payload.monthlyPriceDisplay ? String(payload.monthlyPriceDisplay) : null }
        : {}),
      ...(payload.yearlyPriceDisplay !== undefined
        ? { yearlyPriceDisplay: payload.yearlyPriceDisplay ? String(payload.yearlyPriceDisplay) : null }
        : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: Number(payload.sortOrder) } : {}),
      ...(payload.isVisible !== undefined ? { isVisible: Boolean(payload.isVisible) } : {}),
      ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
      ...(payload.isMostPopular !== undefined ? { isMostPopular: Boolean(payload.isMostPopular) } : {}),
      ...(payload.price !== undefined ? { price: Number(payload.price) } : {}),
      ...(payload.yearlyPrice !== undefined ? { yearlyPrice: Number(payload.yearlyPrice) } : {}),
      ...(payload.currency !== undefined ? { currency: String(payload.currency).toUpperCase() } : {}),
      ...(payload.trialDays !== undefined ? { trialDays: Number(payload.trialDays) } : {}),
      ...(payload.referralReward !== undefined ? { referralReward: Number(payload.referralReward) } : {}),
      ...(payload.storageCostPerGB !== undefined ? { storageCostPerGB: Number(payload.storageCostPerGB) } : {}),
      ...(payload.maxServices !== undefined ? { maxServices: Number(payload.maxServices) } : {}),
      ...(payload.maxPortfolioImages !== undefined ? { maxPortfolioImages: Number(payload.maxPortfolioImages) } : {}),
      ...(payload.maxPackages !== undefined || payload.maxPackagesPerService !== undefined
        ? {
            maxPackages: Number(payload.maxPackages ?? payload.maxPackagesPerService),
            maxPackagesPerService: Number(payload.maxPackages ?? payload.maxPackagesPerService),
          }
        : {}),
      ...(payload.maxPackageFeatures !== undefined || payload.maxPackageFeaturesPerPackage !== undefined
        ? {
            maxPackageFeatures: Number(
              payload.maxPackageFeatures ?? payload.maxPackageFeaturesPerPackage
            ),
            maxPackageFeaturesPerPackage: Number(
              payload.maxPackageFeatures ?? payload.maxPackageFeaturesPerPackage
            ),
          }
        : {}),
      ...(payload.storageGB !== undefined || payload.storageGb !== undefined
        ? {
            storageGB: Number(payload.storageGB ?? payload.storageGb),
            storageGb: Number(payload.storageGB ?? payload.storageGb),
          }
        : {}),
      ...(payload.leadHistoryDays !== undefined ? { leadHistoryDays: Number(payload.leadHistoryDays) } : {}),
      ...(payload.leadVisibilityLimit !== undefined
        ? { leadVisibilityLimit: Number(payload.leadVisibilityLimit) }
        : {}),
      ...(payload.leadTemplatesCount !== undefined
        ? { leadTemplatesCount: Number(payload.leadTemplatesCount) }
        : {}),
      ...(payload.teamSeats !== undefined ? { teamSeats: Number(payload.teamSeats) } : {}),
      ...(payload.customDomain !== undefined || payload.customDomainEnabled !== undefined
        ? {
            customDomain: Boolean(payload.customDomain ?? payload.customDomainEnabled),
            customDomainEnabled: Boolean(payload.customDomain ?? payload.customDomainEnabled),
          }
        : {}),
      ...(payload.analyticsTools !== undefined || payload.analyticsEnabled !== undefined
        ? {
            analyticsTools: Boolean(payload.analyticsTools ?? payload.analyticsEnabled),
            analyticsEnabled: Boolean(payload.analyticsTools ?? payload.analyticsEnabled),
          }
        : {}),
      ...(payload.hideBrandingEnabled !== undefined
        ? { hideBrandingEnabled: Boolean(payload.hideBrandingEnabled) }
        : {}),
      ...(payload.leadFiltersEnabled !== undefined
        ? { leadFiltersEnabled: Boolean(payload.leadFiltersEnabled) }
        : {}),
      ...(payload.leadExportEnabled !== undefined
        ? { leadExportEnabled: Boolean(payload.leadExportEnabled) }
        : {}),
      ...(payload.leadRemindersEnabled !== undefined
        ? { leadRemindersEnabled: Boolean(payload.leadRemindersEnabled) }
        : {}),
      ...(payload.leadAdvancedAnalyticsEnabled !== undefined
        ? { leadAdvancedAnalyticsEnabled: Boolean(payload.leadAdvancedAnalyticsEnabled) }
        : {}),
      ...(payload.teamSectionTools !== undefined || payload.teamToolsEnabled !== undefined
        ? {
            teamSectionTools: Boolean(payload.teamSectionTools ?? payload.teamToolsEnabled),
            teamToolsEnabled: Boolean(payload.teamSectionTools ?? payload.teamToolsEnabled),
          }
        : {}),
      ...(payload.analyticsMode !== undefined
        ? { analyticsMode: String(payload.analyticsMode).toUpperCase() }
        : {}),
      ...(payload.leadAnalyticsMode !== undefined
        ? { leadAnalyticsMode: String(payload.leadAnalyticsMode).toUpperCase() }
        : {}),
      ...(payload.supportTier !== undefined ? { supportTier: String(payload.supportTier).toUpperCase() } : {}),
      ...(payload.brandingMode !== undefined
        ? { brandingMode: String(payload.brandingMode).toUpperCase() }
        : {}),
      ...(payload.leadChannels !== undefined ? { leadChannels: payload.leadChannels } : {}),
    };

    if (!Object.keys(data).length) {
      return toPlanDto(existing);
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data,
    });

    await planLimitService.invalidatePlanCache();

    return toPlanDto(updated);
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
