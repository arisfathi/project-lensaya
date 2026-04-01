import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";

const PLAN_LIMIT_ERROR_MESSAGE = "Plan limit reached. Upgrade your plan.";
const ANALYTICS_TOOLS_ERROR_MESSAGE = "Analytics tools are available on Pro and Studio plans.";
const TEAM_SECTION_TOOLS_ERROR_MESSAGE = "Our Team is not available on your current plan.";
const BILLING_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"];

const DEFAULT_ANALYTICS_TOOLS_BY_PLAN = {
  FREE: false,
  PRO: true,
  STUDIO: true,
};

const DEFAULT_TEAM_SECTION_TOOLS_BY_PLAN = {
  FREE: false,
  PRO: false,
  STUDIO: true,
};

const DEFAULT_PACKAGE_FEATURES_BY_PLAN = {
  FREE: 5,
  PRO: 10,
  STUDIO: 20,
};

const PLAN_ORDER = ["FREE", "PRO", "STUDIO"];

const LEAD_FEATURES_BY_PLAN = {
  FREE: {
    filters: false,
    historyDays: 30,
    maxVisibleLeads: 60,
    export: false,
    reminders: false,
    advancedAnalytics: false,
    templatePack: "basic",
    templateLimit: 1,
    channels: { whatsapp: true, email: true },
    upgradeTarget: "PRO",
  },
  PRO: {
    filters: true,
    historyDays: 365,
    maxVisibleLeads: -1,
    export: true,
    reminders: true,
    advancedAnalytics: true,
    templatePack: "pro",
    templateLimit: 8,
    channels: { whatsapp: true, email: true },
    upgradeTarget: "STUDIO",
  },
  STUDIO: {
    filters: true,
    historyDays: -1,
    maxVisibleLeads: -1,
    export: true,
    reminders: true,
    advancedAnalytics: true,
    templatePack: "studio",
    templateLimit: -1,
    channels: { whatsapp: true, email: true },
    upgradeTarget: null,
  },
};

const LEAD_FOLLOW_UP_TEMPLATE_PACKS = {
  basic: [
    {
      id: "basic-check-in",
      label: "Quick check-in",
      whatsapp:
        "Hi {clientName}, thanks for your inquiry with {studioName}. Are you still looking for this booking slot?",
      emailSubject: "Following up on your booking inquiry",
      emailBody:
        "Hi {clientName},\n\nThanks for reaching out to {studioName}. Just checking if you are still looking for the {preferredDate} slot.\n\nBest regards,\n{studioName}",
    },
  ],
  pro: [
    {
      id: "basic-check-in",
      label: "Quick check-in",
      whatsapp:
        "Hi {clientName}, thanks for your inquiry with {studioName}. Are you still looking for this booking slot?",
      emailSubject: "Following up on your booking inquiry",
      emailBody:
        "Hi {clientName},\n\nThanks for reaching out to {studioName}. Just checking if you are still looking for the {preferredDate} slot.\n\nBest regards,\n{studioName}",
    },
    {
      id: "pro-availability-push",
      label: "Availability reminder",
      whatsapp:
        "Hi {clientName}, {studioName} here. I still have availability around {preferredDate}. Want me to lock your slot?",
      emailSubject: "Availability update for your preferred date",
      emailBody:
        "Hi {clientName},\n\nI still have availability around {preferredDate}. Reply to this email and I can lock in your slot.\n\nBest regards,\n{studioName}",
    },
  ],
  studio: [
    {
      id: "basic-check-in",
      label: "Quick check-in",
      whatsapp:
        "Hi {clientName}, thanks for your inquiry with {studioName}. Are you still looking for this booking slot?",
      emailSubject: "Following up on your booking inquiry",
      emailBody:
        "Hi {clientName},\n\nThanks for reaching out to {studioName}. Just checking if you are still looking for the {preferredDate} slot.\n\nBest regards,\n{studioName}",
    },
    {
      id: "pro-availability-push",
      label: "Availability reminder",
      whatsapp:
        "Hi {clientName}, {studioName} here. I still have availability around {preferredDate}. Want me to lock your slot?",
      emailSubject: "Availability update for your preferred date",
      emailBody:
        "Hi {clientName},\n\nI still have availability around {preferredDate}. Reply to this email and I can lock in your slot.\n\nBest regards,\n{studioName}",
    },
    {
      id: "studio-pricing-nudge",
      label: "Pricing nudge",
      whatsapp:
        "Hi {clientName}, I can prepare a package recommendation that fits your budget and timeline. Want me to send options?",
      emailSubject: "Package recommendations for your inquiry",
      emailBody:
        "Hi {clientName},\n\nI can prepare package recommendations that fit your budget and timeline. Reply and I will send options today.\n\nBest regards,\n{studioName}",
    },
  ],
};

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
  packageFeatures: {
    field: "maxPackageFeatures",
    noun: "package feature",
    displayName: "package feature limit",
    upgradeLabel: "package features",
  },
  storage: {
    field: "storageGB",
    noun: "storage",
    displayName: "storage safety limit",
    upgradeLabel: "GB storage",
  },
};

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

const isMissingTeamSectionToolsColumnError = (error) => {
  const message = error instanceof Error ? error.message : String(error || "");
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : "";
  if (String(code) === "P2022" && /teamSectionTools/i.test(message)) return true;
  return /column .*teamSectionTools.* does not exist/i.test(message);
};

const isMissingPackageFeaturesColumnError = (error) => {
  const message = error instanceof Error ? error.message : String(error || "");
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : "";
  if (String(code) === "P2022" && /maxPackageFeatures/i.test(message)) return true;
  return /column .*maxPackageFeatures.* does not exist/i.test(message);
};

const isMissingSubscriptionPlanDelegateError = (error) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    /Cannot read properties of undefined \(reading 'findMany'\)/i.test(message) ||
    /subscriptionPlan/i.test(message)
  );
};

const normalizeLegacyPlan = (row) => {
  const normalizedName = normalizePlanName(row?.name || "FREE");
  const analyticsDefault =
    DEFAULT_ANALYTICS_TOOLS_BY_PLAN[normalizedName] ?? DEFAULT_ANALYTICS_TOOLS_BY_PLAN.FREE;
  const teamSectionDefault =
    DEFAULT_TEAM_SECTION_TOOLS_BY_PLAN[normalizedName] ?? DEFAULT_TEAM_SECTION_TOOLS_BY_PLAN.FREE;
  const packageFeaturesDefault =
    DEFAULT_PACKAGE_FEATURES_BY_PLAN[normalizedName] ?? DEFAULT_PACKAGE_FEATURES_BY_PLAN.FREE;

  return {
    ...row,
    analyticsTools: analyticsDefault,
    teamSectionTools: teamSectionDefault,
    maxPackageFeatures: Number(row?.maxPackageFeatures ?? packageFeaturesDefault),
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

const fallbackPlansWithoutDb = () => {
  const now = new Date();
  const defaultsByPlan = {
    FREE: { maxServices: 3, maxPortfolioImages: 60, maxPackages: 3, maxPackageFeatures: 5, storageGB: 1, customDomain: false },
    PRO: { maxServices: 12, maxPortfolioImages: 600, maxPackages: 10, maxPackageFeatures: 10, storageGB: 25, customDomain: true },
    STUDIO: { maxServices: -1, maxPortfolioImages: -1, maxPackages: -1, maxPackageFeatures: 20, storageGB: -1, customDomain: true },
  };

  return PLAN_ORDER.map((name, index) => {
    const row = defaultsByPlan[name] || defaultsByPlan.FREE;
    return normalizeLegacyPlan({
      id: `fallback-plan-${index + 1}`,
      name,
      ...row,
      price: 0,
      currency: "USD",
      trialDays: 0,
      referralReward: 0,
      storageCostPerGB: 0,
      createdAt: now,
      updatedAt: now,
    });
  });
};

const mapPlanLimits = (plan) => ({
  services: plan.maxServices,
  portfolioImages: plan.maxPortfolioImages,
  portfolioPhotos: plan.maxPortfolioImages,
  packages: plan.maxPackages,
  packagesPerService: plan.maxPackages,
  packageFeatures: Number(
    plan.maxPackageFeatures ?? DEFAULT_PACKAGE_FEATURES_BY_PLAN[normalizePlanName(plan.name)] ?? 5
  ),
  maxPackageFeatures: Number(
    plan.maxPackageFeatures ?? DEFAULT_PACKAGE_FEATURES_BY_PLAN[normalizePlanName(plan.name)] ?? 5
  ),
  storage: plan.storageGB,
  customDomain: plan.customDomain,
  analyticsTools:
    typeof plan.analyticsTools === "boolean"
      ? plan.analyticsTools
      : DEFAULT_ANALYTICS_TOOLS_BY_PLAN[normalizePlanName(plan.name)] ?? false,
  teamSectionTools:
    typeof plan.teamSectionTools === "boolean"
      ? plan.teamSectionTools
      : DEFAULT_TEAM_SECTION_TOOLS_BY_PLAN[normalizePlanName(plan.name)] ?? false,
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
  TEAM_SECTION_TOOLS_ERROR_MESSAGE,

  mapPlanLimits,

  async invalidatePlanCache() {
    return true;
  },

  async supportsAnalyticsToolsColumn() {
    try {
      await prisma.$queryRaw`SELECT "analyticsTools" FROM "SubscriptionPlan" LIMIT 1`;
      return true;
    } catch (error) {
      if (isMissingAnalyticsToolsColumnError(error)) {
        return false;
      }
      throw error;
    }
  },

  async supportsTeamSectionToolsColumn() {
    try {
      await prisma.$queryRaw`SELECT "teamSectionTools" FROM "SubscriptionPlan" LIMIT 1`;
      return true;
    } catch (error) {
      if (isMissingTeamSectionToolsColumnError(error)) {
        return false;
      }
      throw error;
    }
  },

  async supportsMaxPackageFeaturesColumn() {
    try {
      await prisma.$queryRaw`SELECT "maxPackageFeatures" FROM "SubscriptionPlan" LIMIT 1`;
      return true;
    } catch (error) {
      if (isMissingPackageFeaturesColumnError(error)) {
        return false;
      }
      throw error;
    }
  },

  async listAllPlans() {
    let plans;

    try {
      if (!prisma.subscriptionPlan || typeof prisma.subscriptionPlan.findMany !== "function") {
        plans = await fetchLegacyPlans();
        ensurePlansConfigured(plans);
        return plans;
      }
      plans = await prisma.subscriptionPlan.findMany({
        orderBy: [{ name: "asc" }],
      });
    } catch (error) {
      const isConnectionUnavailable = String(error?.code || "") === "ECONNREFUSED";
      if (isConnectionUnavailable) {
        plans = fallbackPlansWithoutDb();
      } else if (
        isMissingAnalyticsToolsColumnError(error) ||
        isMissingTeamSectionToolsColumnError(error) ||
        isMissingPackageFeaturesColumnError(error)
      ) {
        plans = await fetchLegacyPlans();
      } else if (isMissingSubscriptionPlanDelegateError(error)) {
        plans = await fetchLegacyPlans();
      } else {
        throw error;
      }
    }

    ensurePlansConfigured(plans);
    return plans;
  },

  async getPlanByName(name) {
    const normalizedName = normalizePlanName(name);
    if (!normalizedName) {
      throw new ApiError(400, "Invalid plan name");
    }

    const plans = await this.listAllPlans();
    const plan = plans.find((item) => normalizePlanName(item?.name) === normalizedName);

    if (!plan) {
      throw new ApiError(404, "Subscription plan not found");
    }
    return plan;
  },

  async getPlanById(planId) {
    const plans = await this.listAllPlans();
    const plan = plans.find((item) => String(item?.id || "") === String(planId || ""));

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

  getLeadFeatureAccess(planLike) {
    const normalized = normalizePlanName(planLike?.name || planLike || "FREE") || "FREE";
    const defaults = LEAD_FEATURES_BY_PLAN.FREE;
    const selected = LEAD_FEATURES_BY_PLAN[normalized] || defaults;

    return {
      plan: normalized,
      filters: Boolean(selected.filters),
      export: Boolean(selected.export),
      reminders: Boolean(selected.reminders),
      historyDays: Number(selected.historyDays),
      maxVisibleLeads: Number(selected.maxVisibleLeads),
      advancedAnalytics: Boolean(selected.advancedAnalytics),
      templatePack: selected.templatePack || "basic",
      templateLimit: Number(selected.templateLimit),
      channels: {
        whatsapp: Boolean(selected?.channels?.whatsapp),
        email: Boolean(selected?.channels?.email),
      },
      upgradeTarget: selected.upgradeTarget || null,
    };
  },

  getLeadFollowUpTemplates(planLike) {
    const features = this.getLeadFeatureAccess(planLike);
    const packName = features.templatePack || "basic";
    const pack = LEAD_FOLLOW_UP_TEMPLATE_PACKS[packName] || LEAD_FOLLOW_UP_TEMPLATE_PACKS.basic || [];

    const limit = Number(features.templateLimit);
    if (Number.isFinite(limit) && limit >= 0) {
      return pack.slice(0, limit);
    }

    return pack;
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

  async assertTeamSectionToolsAccessByPhotographerId(photographerId) {
    const plan = await this.getPlanByPhotographerId(photographerId);
    if (!Boolean(this.mapPlanLimits(plan).teamSectionTools)) {
      throw new ApiError(403, TEAM_SECTION_TOOLS_ERROR_MESSAGE);
    }
    return plan;
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




