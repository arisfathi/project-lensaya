import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";

const PLAN_LIMIT_ERROR_MESSAGE = "Plan limit reached. Upgrade your plan.";
const ANALYTICS_TOOLS_ERROR_MESSAGE = "Analytics tools are available on Pro and Studio plans.";
const BILLING_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"];
const DEFAULT_ANALYTICS_TOOLS_BY_PLAN = {
  FREE: false,
  PRO: true,
  STUDIO: true,
};
const PLAN_ORDER = ["FREE", "PRO", "STUDIO"];
const LIMIT_METRIC_CONFIG = {
  services: {
    field: "maxServices",
    noun: "service",
    displayName: "service limit",
    upgradeLabel: "services",
  },
  portfolioImages: {
    field: "maxPortfolioImages",
    noun: "portfolio photo",
    displayName: "portfolio photo limit",
    upgradeLabel: "portfolio photos",
  },
  packagesPerService: {
    field: "maxPackages",
    noun: "package per service",
    displayName: "package limit per service",
    upgradeLabel: "packages per service",
  },
  storage: {
    field: "storageGB",
    noun: "storage",
    displayName: "storage safety limit",
    upgradeLabel: "GB storage",
  },
};
let analyticsToolsColumnSupportedCache = null;

const normalizePlanName = (value = "") => String(value || "").trim().toUpperCase();
const isUnlimited = (value) => Number(value) < 0;
const planRank = (name) => {
  const index = PLAN_ORDER.indexOf(normalizePlanName(name));
  return index === -1 ? -1 : index;
};
const comparePlansByRank = (a, b) => planRank(a?.name) - planRank(b?.name);
const toPlanLabel = (name = "") => {
  const normalized = normalizePlanName(name).toLowerCase();
  if (!normalized) return "Plan";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};
const metricLimitValue = (plan, metric) => {
  const config = LIMIT_METRIC_CONFIG[metric];
  if (!config || !plan) return null;
  return Number(plan[config.field]);
};
const hasHigherLimit = (candidateLimit, currentLimit) => {
  if (candidateLimit === null || currentLimit === null) return false;
  if (isUnlimited(currentLimit)) return false;
  if (isUnlimited(candidateLimit)) return true;
  return Number(candidateLimit) > Number(currentLimit);
};
const formatMetricLimit = (metric, limit) => {
  if (isUnlimited(limit)) return "unlimited";
  if (metric === "storage") return `${Number(limit)} GB`;
  return `${Number(limit)}`;
};
const formatUsageFraction = (used, limit) => {
  if (isUnlimited(limit)) return `${Number(used)}/unlimited`;
  return `${Number(used)}/${Number(limit)}`;
};
const metricReachedMessage = ({ metric, used, limit, planName, contextLabel, recommendation }) => {
  const config = LIMIT_METRIC_CONFIG[metric];
  if (!config) return PLAN_LIMIT_ERROR_MESSAGE;

  const planLabel = toPlanLabel(planName || "FREE");
  const usage = formatUsageFraction(used, limit);
  const contextSuffix = contextLabel ? ` for "${contextLabel}"` : "";
  const noun = Number(limit) === 1 ? config.noun : config.upgradeLabel;

  let message = `You reached your ${config.displayName}${contextSuffix} (${usage}) on the ${planLabel} plan.`;

  if (recommendation?.plan && recommendation?.limit !== null) {
    const nextPlanLabel = toPlanLabel(recommendation.plan.name);
    const nextLimit = formatMetricLimit(metric, recommendation.limit);
    message += ` Upgrade to ${nextPlanLabel} for up to ${nextLimit} ${noun}.`;
  } else {
    message += " Upgrade your plan to continue.";
  }

  return message;
};

const ensurePlansConfigured = (rows) => {
  const required = ["FREE", "PRO", "STUDIO"];
  const names = new Set(rows.map((row) => row.name));
  const missing = required.filter((name) => !names.has(name));
  if (missing.length > 0) {
    throw new ApiError(500, "Subscription plans are not configured");
  }
};

const isMissingAnalyticsToolsColumnError = (error) => {
  const message = error instanceof Error ? error.message : String(error || "");
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : "";
  if (String(code) === "P2022" && /analyticsTools/i.test(message)) return true;
  return /column .*analyticsTools.* does not exist/i.test(message);
};

const normalizeLegacyPlan = (row) => {
  const normalizedName = normalizePlanName(row?.name || "FREE");
  const analyticsDefault =
    DEFAULT_ANALYTICS_TOOLS_BY_PLAN[normalizedName] ?? DEFAULT_ANALYTICS_TOOLS_BY_PLAN.FREE;

  return {
    ...row,
    analyticsTools: analyticsDefault,
  };
};

const fetchLegacyPlans = async () => {
  const rows = await prisma.$queryRaw`
    SELECT
      "id",
      "name",
      "maxServices",
      "maxPortfolioImages",
      "maxPackages",
      "storageGB",
      "customDomain",
      "price",
      "currency",
      "trialDays",
      "referralReward",
      "storageCostPerGB",
      "createdAt",
      "updatedAt"
    FROM "SubscriptionPlan"
    ORDER BY "name" ASC
  `;
  return rows.map(normalizeLegacyPlan);
};

const fetchLegacyPlanByName = async (name) => {
  const rows = await prisma.$queryRaw`
    SELECT
      "id",
      "name",
      "maxServices",
      "maxPortfolioImages",
      "maxPackages",
      "storageGB",
      "customDomain",
      "price",
      "currency",
      "trialDays",
      "referralReward",
      "storageCostPerGB",
      "createdAt",
      "updatedAt"
    FROM "SubscriptionPlan"
    WHERE "name" = ${name}
    LIMIT 1
  `;
  return rows.length ? normalizeLegacyPlan(rows[0]) : null;
};

const fetchLegacyPlanById = async (planId) => {
  const rows = await prisma.$queryRaw`
    SELECT
      "id",
      "name",
      "maxServices",
      "maxPortfolioImages",
      "maxPackages",
      "storageGB",
      "customDomain",
      "price",
      "currency",
      "trialDays",
      "referralReward",
      "storageCostPerGB",
      "createdAt",
      "updatedAt"
    FROM "SubscriptionPlan"
    WHERE "id" = CAST(${planId} AS UUID)
    LIMIT 1
  `;
  return rows.length ? normalizeLegacyPlan(rows[0]) : null;
};

const mapPlanLimits = (plan) => ({
  services: plan.maxServices,
  portfolioImages: plan.maxPortfolioImages,
  portfolioPhotos: plan.maxPortfolioImages,
  packages: plan.maxPackages,
  packagesPerService: plan.maxPackages,
  storage: plan.storageGB,
  customDomain: plan.customDomain,
  analyticsTools:
    typeof plan.analyticsTools === "boolean"
      ? plan.analyticsTools
      : DEFAULT_ANALYTICS_TOOLS_BY_PLAN[normalizePlanName(plan.name)] ?? false,
});

const usageFromPhotographer = async (photographerId) => {
  const [serviceCount, packageCount, portfolioImageCount] = await Promise.all([
    prisma.service.count({
      where: {
        photographerId,
        status: { not: "ARCHIVED" },
      },
    }),
    prisma.package.count({
      where: {
        photographerId,
        status: { not: "ARCHIVED" },
      },
    }),
    prisma.portfolioItem.count({
      where: { photographerId },
    }),
  ]);

  return {
    services: serviceCount,
    packages: packageCount,
    portfolioImages: portfolioImageCount,
  };
};

export const planLimitService = {
  PLAN_LIMIT_ERROR_MESSAGE,
  ANALYTICS_TOOLS_ERROR_MESSAGE,

  mapPlanLimits,

  async supportsAnalyticsToolsColumn() {
    if (analyticsToolsColumnSupportedCache !== null) {
      return analyticsToolsColumnSupportedCache;
    }

    try {
      await prisma.$queryRaw`SELECT "analyticsTools" FROM "SubscriptionPlan" LIMIT 1`;
      analyticsToolsColumnSupportedCache = true;
      return true;
    } catch (error) {
      if (isMissingAnalyticsToolsColumnError(error)) {
        analyticsToolsColumnSupportedCache = false;
        return false;
      }
      throw error;
    }
  },

  async listAllPlans() {
    const supportsAnalyticsTools = await this.supportsAnalyticsToolsColumn();
    let plans;

    if (supportsAnalyticsTools) {
      try {
        plans = await prisma.subscriptionPlan.findMany({
          orderBy: [{ name: "asc" }],
        });
      } catch (error) {
        if (!isMissingAnalyticsToolsColumnError(error)) throw error;
        analyticsToolsColumnSupportedCache = false;
        plans = await fetchLegacyPlans();
      }
    } else {
      plans = await fetchLegacyPlans();
    }

    ensurePlansConfigured(plans);
    return plans;
  },

  async getPlanByName(name) {
    const normalizedName = normalizePlanName(name);
    if (!normalizedName) {
      throw new ApiError(400, "Invalid plan name");
    }

    const supportsAnalyticsTools = await this.supportsAnalyticsToolsColumn();
    let plan = null;
    if (supportsAnalyticsTools) {
      try {
        plan = await prisma.subscriptionPlan.findUnique({
          where: { name: normalizedName },
        });
      } catch (error) {
        if (!isMissingAnalyticsToolsColumnError(error)) throw error;
        analyticsToolsColumnSupportedCache = false;
        plan = await fetchLegacyPlanByName(normalizedName);
      }
    } else {
      plan = await fetchLegacyPlanByName(normalizedName);
    }

    if (!plan) {
      throw new ApiError(404, "Subscription plan not found");
    }
    return plan;
  },

  async getPlanById(planId) {
    const supportsAnalyticsTools = await this.supportsAnalyticsToolsColumn();
    let plan = null;
    if (supportsAnalyticsTools) {
      try {
        plan = await prisma.subscriptionPlan.findUnique({
          where: { id: planId },
        });
      } catch (error) {
        if (!isMissingAnalyticsToolsColumnError(error)) throw error;
        analyticsToolsColumnSupportedCache = false;
        plan = await fetchLegacyPlanById(planId);
      }
    } else {
      plan = await fetchLegacyPlanById(planId);
    }

    if (!plan) {
      throw new ApiError(404, "Subscription plan not found");
    }
    return plan;
  },

  async getPlanByUserId(userId) {
    const latestSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: BILLING_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      select: { plan: true },
    });

    const planName = normalizePlanName(latestSubscription?.plan || "FREE");
    return this.getPlanByName(planName);
  },

  async getPlanByPhotographerId(photographerId) {
    const photographer = await prisma.photographer.findUnique({
      where: { id: photographerId },
      select: { userId: true },
    });
    if (!photographer?.userId) {
      throw new ApiError(404, "Photographer not found");
    }

    return this.getPlanByUserId(photographer.userId);
  },

  async getUsageForPhotographer(photographerId) {
    const plan = await this.getPlanByPhotographerId(photographerId);
    const [usage, packagesPerServiceUsage] = await Promise.all([
      usageFromPhotographer(photographerId),
      this.getPackagesPerServiceUsage(photographerId, plan.maxPackages),
    ]);
    return {
      planName: plan.name,
      usage: {
        services: { used: usage.services, limit: plan.maxServices },
        // Kept for backward compatibility where older clients read a generic "packages" usage key.
        packages: { used: usage.packages, limit: plan.maxPackages },
        packagesPerService: packagesPerServiceUsage,
        portfolioImages: { used: usage.portfolioImages, limit: plan.maxPortfolioImages },
      },
      limits: mapPlanLimits(plan),
    };
  },

  assertLimit({ used, max }) {
    if (!isUnlimited(max) && Number(used) >= Number(max)) {
      throw new ApiError(403, PLAN_LIMIT_ERROR_MESSAGE);
    }
  },

  isLimitReached({ used, max }) {
    return !isUnlimited(max) && Number(used) >= Number(max);
  },

  async getUpgradeRecommendation(planName, metric) {
    const normalizedPlanName = normalizePlanName(planName || "FREE");
    const currentPlan = await this.getPlanByName(normalizedPlanName);
    const currentLimit = metricLimitValue(currentPlan, metric);
    if (currentLimit === null) return null;

    const plans = await this.listAllPlans();
    const currentRank = planRank(normalizedPlanName);
    const sortedPlans = plans.slice().sort(comparePlansByRank);

    for (const plan of sortedPlans) {
      if (planRank(plan.name) <= currentRank) continue;
      const candidateLimit = metricLimitValue(plan, metric);
      if (hasHigherLimit(candidateLimit, currentLimit)) {
        return {
          plan,
          limit: candidateLimit,
        };
      }
    }

    return null;
  },

  async throwLimitReached({ metric, used, plan, contextLabel = null }) {
    const normalizedMetric = String(metric || "").trim();
    const currentLimit = metricLimitValue(plan, normalizedMetric);
    if (currentLimit === null) {
      throw new ApiError(500, "Invalid plan limit metric");
    }
    if (!this.isLimitReached({ used, max: currentLimit })) {
      return;
    }

    const recommendation = await this.getUpgradeRecommendation(plan?.name || "FREE", normalizedMetric);
    const message = metricReachedMessage({
      metric: normalizedMetric,
      used,
      limit: currentLimit,
      planName: plan?.name || "FREE",
      contextLabel,
      recommendation,
    });

    throw new ApiError(403, message);
  },

  assertStorageLimit({ usedBytes, incomingBytes, storageGB }) {
    if (isUnlimited(storageGB)) return;
    const maxBytes = Number(storageGB) * 1024 * 1024 * 1024;
    const projectedBytes = Number(usedBytes || 0) + Number(incomingBytes || 0);
    if (projectedBytes > maxBytes) {
      throw new ApiError(403, PLAN_LIMIT_ERROR_MESSAGE);
    }
  },

  async assertAnalyticsToolsAccessByPhotographerId(photographerId) {
    const plan = await this.getPlanByPhotographerId(photographerId);
    if (!plan.analyticsTools) {
      throw new ApiError(403, ANALYTICS_TOOLS_ERROR_MESSAGE);
    }
    return plan;
  },

  async getPackagesPerServiceUsage(photographerId, limitPerService) {
    const grouped = await prisma.package.groupBy({
      by: ["serviceId"],
      where: {
        photographerId,
        status: { not: "ARCHIVED" },
      },
      _count: { _all: true },
    });

    if (!grouped.length) {
      return {
        used: 0,
        limit: Number(limitPerService),
        serviceId: null,
        serviceName: null,
        servicesAtLimit: 0,
      };
    }

    const sorted = grouped
      .map((row) => ({
        serviceId: row.serviceId,
        used: Number(row?._count?._all || 0),
      }))
      .sort((a, b) => b.used - a.used);

    const top = sorted[0];
    const service = top?.serviceId
      ? await prisma.service.findUnique({
          where: { id: top.serviceId },
          select: { name: true },
        })
      : null;

    const servicesAtLimit = isUnlimited(limitPerService)
      ? 0
      : sorted.filter((item) => item.used >= Number(limitPerService)).length;

    return {
      used: Number(top?.used || 0),
      limit: Number(limitPerService),
      serviceId: top?.serviceId || null,
      serviceName: service?.name || null,
      servicesAtLimit,
    };
  },
};
