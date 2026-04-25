import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";

const PLAN_LIMIT_ERROR_MESSAGE = "Plan limit reached. Upgrade your plan.";
const ANALYTICS_TOOLS_ERROR_MESSAGE = "Insights dashboard is not available on your current plan.";
const TEAM_SECTION_TOOLS_ERROR_MESSAGE = "Team collaboration is not available on your current plan.";
const BILLING_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"];
const PLAN_FALLBACK_ORDER = ["FREE", "PRO", "STUDIO"];

const LIMIT_METRIC_CONFIG = {
  services: {
    field: "maxServices",
    noun: "service listing",
    displayName: "service listing limit",
    upgradeLabel: "service listings",
  },
  portfolioImages: {
    field: "maxPortfolioImages",
    noun: "portfolio image",
    displayName: "portfolio capacity limit",
    upgradeLabel: "portfolio images",
  },
  packagesPerService: {
    field: "maxPackagesPerService",
    noun: "package option per service",
    displayName: "package options limit",
    upgradeLabel: "package options",
  },
  packageFeatures: {
    field: "maxPackageFeaturesPerPackage",
    noun: "package feature",
    displayName: "package feature limit",
    upgradeLabel: "package features",
  },
  storage: {
    field: "storageGb",
    noun: "storage",
    displayName: "storage limit",
    upgradeLabel: "GB storage",
  },
};

const normalizePlanName = (value = "") => String(value || "").trim().toUpperCase();
const isUnlimited = (value) => Number(value) < 0;

const toNumberOr = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBooleanOr = (value, fallback) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || String(value || "").toLowerCase() === "true") return true;
  if (value === 0 || value === "0" || String(value || "").toLowerCase() === "false") return false;
  return fallback;
};

const parseLeadChannels = (value) => {
  const fallback = { whatsapp: true, email: true };
  if (!value) return fallback;
  if (typeof value === "object") {
    return {
      whatsapp: toBooleanOr(value.whatsapp, true),
      email: toBooleanOr(value.email, true),
    };
  }

  try {
    const parsed = JSON.parse(String(value));
    return {
      whatsapp: toBooleanOr(parsed?.whatsapp, true),
      email: toBooleanOr(parsed?.email, true),
    };
  } catch {
    return fallback;
  }
};

const toPlanLabel = (name = "") => {
  const normalized = normalizePlanName(name).toLowerCase();
  if (!normalized) return "Plan";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const metricLimitValue = (entitlements, metric) => {
  const config = LIMIT_METRIC_CONFIG[metric];
  if (!config || !entitlements) return null;
  return Number(entitlements?.limits?.[config.field]);
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
  const contextSuffix = contextLabel ? ` for \"${contextLabel}\"` : "";
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

const buildFeatureBlockedMessage = ({ featureLabel, planName, upgradeTarget = null }) => {
  const currentPlanLabel = toPlanLabel(planName || "FREE");
  if (upgradeTarget) {
    return `${featureLabel} is not enabled on the ${currentPlanLabel} plan. Upgrade to ${toPlanLabel(upgradeTarget)} to unlock this.`;
  }
  return `${featureLabel} is not enabled on the ${currentPlanLabel} plan.`;
};

const buildGateResult = ({
  allowed,
  metric = null,
  feature = null,
  used = null,
  limit = null,
  planName = "FREE",
  upgradeTarget = null,
  message = null,
}) => ({
  allowed: Boolean(allowed),
  metric,
  feature,
  used,
  limit,
  planName,
  upgradeTarget,
  message,
});

const defaultsByPlan = {
  FREE: {
    sortOrder: 1,
    displayName: "Free",
    tagline: "For getting started",
    subtitle: "Launch your portfolio and start collecting inquiries.",
    badgeText: null,
    ctaText: "Get Started Free",
    monthlyPriceDisplay: "$0/mo",
    yearlyPriceDisplay: "$0/yr",
    isVisible: true,
    isActive: true,
    isMostPopular: false,
    maxServices: 3,
    maxPortfolioImages: 60,
    maxPackagesPerService: 3,
    maxPackageFeaturesPerPackage: 5,
    storageGb: 1,
    leadHistoryDays: 30,
    leadVisibilityLimit: 60,
    leadTemplatesCount: 1,
    teamSeats: 1,
    analyticsEnabled: false,
    customDomainEnabled: false,
    hideBrandingEnabled: false,
    leadFiltersEnabled: false,
    leadExportEnabled: false,
    leadRemindersEnabled: false,
    leadAdvancedAnalyticsEnabled: false,
    teamToolsEnabled: false,
    analyticsMode: "NONE",
    leadAnalyticsMode: "NONE",
    supportTier: "STANDARD",
    brandingMode: "FORCED_LENSAYA",
    leadChannels: { whatsapp: true, email: true },
  },
  PRO: {
    sortOrder: 2,
    displayName: "Pro",
    tagline: "For growing photographers",
    subtitle: "Scale with higher limits, workflows, and conversion tooling.",
    badgeText: "Most Popular",
    ctaText: "Start Pro",
    monthlyPriceDisplay: null,
    yearlyPriceDisplay: null,
    isVisible: true,
    isActive: true,
    isMostPopular: true,
    maxServices: 12,
    maxPortfolioImages: 600,
    maxPackagesPerService: 10,
    maxPackageFeaturesPerPackage: 10,
    storageGb: 25,
    leadHistoryDays: 365,
    leadVisibilityLimit: -1,
    leadTemplatesCount: 8,
    teamSeats: 3,
    analyticsEnabled: true,
    customDomainEnabled: true,
    hideBrandingEnabled: true,
    leadFiltersEnabled: true,
    leadExportEnabled: true,
    leadRemindersEnabled: true,
    leadAdvancedAnalyticsEnabled: true,
    teamToolsEnabled: false,
    analyticsMode: "ADVANCED",
    leadAnalyticsMode: "ADVANCED",
    supportTier: "STANDARD",
    brandingMode: "REMOVABLE",
    leadChannels: { whatsapp: true, email: true },
  },
  STUDIO: {
    sortOrder: 3,
    displayName: "Studio",
    tagline: "For studios and teams",
    subtitle: "Run high-volume workflows with collaboration and priority support.",
    badgeText: null,
    ctaText: "Talk to Sales",
    monthlyPriceDisplay: null,
    yearlyPriceDisplay: null,
    isVisible: true,
    isActive: true,
    isMostPopular: false,
    maxServices: -1,
    maxPortfolioImages: -1,
    maxPackagesPerService: -1,
    maxPackageFeaturesPerPackage: 20,
    storageGb: -1,
    leadHistoryDays: -1,
    leadVisibilityLimit: -1,
    leadTemplatesCount: -1,
    teamSeats: 10,
    analyticsEnabled: true,
    customDomainEnabled: true,
    hideBrandingEnabled: true,
    leadFiltersEnabled: true,
    leadExportEnabled: true,
    leadRemindersEnabled: true,
    leadAdvancedAnalyticsEnabled: true,
    teamToolsEnabled: true,
    analyticsMode: "ADVANCED",
    leadAnalyticsMode: "ADVANCED",
    supportTier: "PRIORITY",
    brandingMode: "REMOVABLE",
    leadChannels: { whatsapp: true, email: true },
  },
};

const buildFallbackPlanRow = (name) => {
  const normalized = normalizePlanName(name || "FREE");
  const defaults = defaultsByPlan[normalized] || defaultsByPlan.FREE;
  const now = new Date();

  return {
    id: `fallback-${normalized.toLowerCase()}`,
    name: normalized,
    price: normalized === "FREE" ? 0 : normalized === "PRO" ? 19.99 : 49.99,
    yearlyPrice: normalized === "FREE" ? 0 : normalized === "PRO" ? 199.9 : 499.9,
    currency: "USD",
    trialDays: normalized === "FREE" ? 0 : normalized === "PRO" ? 7 : 14,
    referralReward: normalized === "FREE" ? 0 : normalized === "PRO" ? 5 : 10,
    storageCostPerGB: normalized === "STUDIO" ? 0.25 : normalized === "PRO" ? 0.5 : 0,
    maxServices: defaults.maxServices,
    maxPortfolioImages: defaults.maxPortfolioImages,
    maxPackages: defaults.maxPackagesPerService,
    maxPackageFeatures: defaults.maxPackageFeaturesPerPackage,
    storageGB: defaults.storageGb,
    customDomain: defaults.customDomainEnabled,
    analyticsTools: defaults.analyticsEnabled,
    teamSectionTools: defaults.teamToolsEnabled,
    createdAt: now,
    updatedAt: now,
  };
};

const normalizePlanRow = (row, allRows = []) => {
  const name = normalizePlanName(row?.name || "FREE");
  const defaults = defaultsByPlan[name] || defaultsByPlan.FREE;

  const maxPackagesPerService = toNumberOr(
    row?.maxPackagesPerService,
    toNumberOr(row?.maxPackages, defaults.maxPackagesPerService)
  );
  const maxPackageFeaturesPerPackage = toNumberOr(
    row?.maxPackageFeaturesPerPackage,
    toNumberOr(row?.maxPackageFeatures, defaults.maxPackageFeaturesPerPackage)
  );
  const storageGb = toNumberOr(row?.storageGb, toNumberOr(row?.storageGB, defaults.storageGb));

  const analyticsEnabled = toBooleanOr(
    row?.analyticsEnabled,
    toBooleanOr(row?.analyticsTools, defaults.analyticsEnabled)
  );
  const customDomainEnabled = toBooleanOr(
    row?.customDomainEnabled,
    toBooleanOr(row?.customDomain, defaults.customDomainEnabled)
  );
  const teamToolsEnabled = toBooleanOr(
    row?.teamToolsEnabled,
    toBooleanOr(row?.teamSectionTools, defaults.teamToolsEnabled)
  );

  const brandingMode = String(row?.brandingMode || defaults.brandingMode).toUpperCase();
  const hideBrandingEnabled = toBooleanOr(
    row?.hideBrandingEnabled,
    brandingMode === "REMOVABLE" ? true : defaults.hideBrandingEnabled
  );

  const normalized = {
    ...row,
    id: String(row?.id || `fallback-${name.toLowerCase()}`),
    name,
    displayName: String(row?.displayName || defaults.displayName || toPlanLabel(name)),
    tagline: row?.tagline || defaults.tagline,
    subtitle: row?.subtitle || defaults.subtitle,
    badgeText: row?.badgeText ?? defaults.badgeText,
    ctaText: row?.ctaText || defaults.ctaText,
    monthlyPriceDisplay:
      row?.monthlyPriceDisplay ||
      defaults.monthlyPriceDisplay ||
      `$${toNumberOr(row?.price, 0).toFixed(2)}/mo`,
    yearlyPriceDisplay:
      row?.yearlyPriceDisplay ||
      defaults.yearlyPriceDisplay ||
      `$${toNumberOr(row?.yearlyPrice, toNumberOr(row?.price, 0) * 10).toFixed(2)}/yr`,
    sortOrder: toNumberOr(row?.sortOrder, defaults.sortOrder),
    isVisible: toBooleanOr(row?.isVisible, defaults.isVisible),
    isActive: toBooleanOr(row?.isActive, defaults.isActive),
    isMostPopular: toBooleanOr(row?.isMostPopular, defaults.isMostPopular),
    price: toNumberOr(row?.price, 0),
    yearlyPrice: toNumberOr(row?.yearlyPrice, toNumberOr(row?.price, 0) * 10),
    currency: String(row?.currency || "USD").toUpperCase(),
    trialDays: toNumberOr(row?.trialDays, 0),
    referralReward: toNumberOr(row?.referralReward, 0),
    storageCostPerGB: toNumberOr(row?.storageCostPerGB, 0),
    maxServices: toNumberOr(row?.maxServices, defaults.maxServices),
    maxPortfolioImages: toNumberOr(row?.maxPortfolioImages, defaults.maxPortfolioImages),
    maxPackages: toNumberOr(row?.maxPackages, maxPackagesPerService),
    maxPackagesPerService,
    maxPackageFeatures: toNumberOr(row?.maxPackageFeatures, maxPackageFeaturesPerPackage),
    maxPackageFeaturesPerPackage,
    storageGB: toNumberOr(row?.storageGB, storageGb),
    storageGb,
    leadHistoryDays: toNumberOr(row?.leadHistoryDays, defaults.leadHistoryDays),
    leadVisibilityLimit: toNumberOr(row?.leadVisibilityLimit, defaults.leadVisibilityLimit),
    leadTemplatesCount: toNumberOr(row?.leadTemplatesCount, defaults.leadTemplatesCount),
    teamSeats: toNumberOr(row?.teamSeats, defaults.teamSeats),
    analyticsEnabled,
    analyticsTools: analyticsEnabled,
    customDomainEnabled,
    customDomain: customDomainEnabled,
    hideBrandingEnabled,
    leadFiltersEnabled: toBooleanOr(row?.leadFiltersEnabled, defaults.leadFiltersEnabled),
    leadExportEnabled: toBooleanOr(row?.leadExportEnabled, defaults.leadExportEnabled),
    leadRemindersEnabled: toBooleanOr(row?.leadRemindersEnabled, defaults.leadRemindersEnabled),
    leadAdvancedAnalyticsEnabled: toBooleanOr(
      row?.leadAdvancedAnalyticsEnabled,
      defaults.leadAdvancedAnalyticsEnabled
    ),
    teamToolsEnabled,
    teamSectionTools: teamToolsEnabled,
    analyticsMode: String(row?.analyticsMode || defaults.analyticsMode).toUpperCase(),
    leadAnalyticsMode: String(row?.leadAnalyticsMode || defaults.leadAnalyticsMode).toUpperCase(),
    supportTier: String(row?.supportTier || defaults.supportTier).toUpperCase(),
    brandingMode,
    leadChannels: parseLeadChannels(row?.leadChannels || defaults.leadChannels),
  };

  const sorted = allRows
    .map((item) => normalizePlanName(item?.name))
    .filter(Boolean)
    .sort((a, b) => {
      const aOrder = toNumberOr(allRows.find((item) => normalizePlanName(item?.name) === a)?.sortOrder, 9999);
      const bOrder = toNumberOr(allRows.find((item) => normalizePlanName(item?.name) === b)?.sortOrder, 9999);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return PLAN_FALLBACK_ORDER.indexOf(a) - PLAN_FALLBACK_ORDER.indexOf(b);
    });

  const activeVisible = sorted.filter((planName) => {
    const item = allRows.find((rowItem) => normalizePlanName(rowItem?.name) === planName);
    const n = normalizePlanRow(item || buildFallbackPlanRow(planName), []);
    return n.isActive && n.isVisible;
  });

  const index = activeVisible.indexOf(name);
  normalized.upgradeTarget = index >= 0 && index < activeVisible.length - 1 ? activeVisible[index + 1] : null;

  return normalized;
};

const ensurePlansConfigured = (rows) => {
  const required = ["FREE", "PRO", "STUDIO"];
  const names = new Set(rows.map((row) => normalizePlanName(row?.name)));
  const missing = required.filter((name) => !names.has(name));
  if (missing.length > 0) {
    throw new ApiError(500, "Subscription plans are not configured");
  }
};

const fallbackPlansWithoutDb = () => PLAN_FALLBACK_ORDER.map((name) => buildFallbackPlanRow(name));

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
    prisma.portfolioItem.count({ where: { photographerId } }),
  ]);

  return {
    services: serviceCount,
    packages: packageCount,
    portfolioImages: portfolioImageCount,
  };
};

const toEntitlements = (plan, allPlans = null) => {
  const contextPlans = Array.isArray(allPlans) && allPlans.length > 0 ? allPlans : [plan || buildFallbackPlanRow("FREE")];
  const normalized = normalizePlanRow(plan || buildFallbackPlanRow("FREE"), contextPlans);

  return {
    planId: normalized.id,
    slug: normalized.name.toLowerCase(),
    name: normalized.name,
    displayName: normalized.displayName,
    sortOrder: normalized.sortOrder,
    isVisible: normalized.isVisible,
    isActive: normalized.isActive,
    isMostPopular: normalized.isMostPopular,
    marketing: {
      displayName: normalized.displayName,
      tagline: normalized.tagline,
      subtitle: normalized.subtitle,
      badgeText: normalized.badgeText,
      ctaText: normalized.ctaText,
      monthlyPriceDisplay: normalized.monthlyPriceDisplay,
      yearlyPriceDisplay: normalized.yearlyPriceDisplay,
      sortOrder: normalized.sortOrder,
      isVisible: normalized.isVisible,
      isMostPopular: normalized.isMostPopular,
    },
    pricing: {
      monthly: normalized.price,
      yearly: normalized.yearlyPrice,
      currency: normalized.currency,
    },
    limits: {
      maxServices: normalized.maxServices,
      maxPortfolioImages: normalized.maxPortfolioImages,
      maxPackagesPerService: normalized.maxPackagesPerService,
      maxPackageFeaturesPerPackage: normalized.maxPackageFeaturesPerPackage,
      storageGb: normalized.storageGb,
      leadHistoryDays: normalized.leadHistoryDays,
      leadVisibilityLimit: normalized.leadVisibilityLimit,
      leadTemplatesCount: normalized.leadTemplatesCount,
      teamSeats: normalized.teamSeats,
    },
    features: {
      analyticsEnabled: normalized.analyticsEnabled,
      customDomainEnabled: normalized.customDomainEnabled,
      hideBrandingEnabled: normalized.hideBrandingEnabled,
      leadFiltersEnabled: normalized.leadFiltersEnabled,
      leadExportEnabled: normalized.leadExportEnabled,
      leadRemindersEnabled: normalized.leadRemindersEnabled,
      leadAdvancedAnalyticsEnabled: normalized.leadAdvancedAnalyticsEnabled,
      teamToolsEnabled: normalized.teamToolsEnabled,
      isVisible: normalized.isVisible,
      isActive: normalized.isActive,
      isMostPopular: normalized.isMostPopular,
    },
    modes: {
      analyticsMode: normalized.analyticsMode,
      leadAnalyticsMode: normalized.leadAnalyticsMode,
      supportTier: normalized.supportTier,
      brandingMode: normalized.brandingMode,
    },
    leadChannels: normalized.leadChannels,
    upgradeTarget: normalized.upgradeTarget,
  };
};

const mapPlanLimits = (plan) => {
  const entitlements = toEntitlements(plan);
  return {
    services: entitlements.limits.maxServices,
    portfolioImages: entitlements.limits.maxPortfolioImages,
    portfolioPhotos: entitlements.limits.maxPortfolioImages,
    packages: entitlements.limits.maxPackagesPerService,
    packagesPerService: entitlements.limits.maxPackagesPerService,
    packageFeatures: entitlements.limits.maxPackageFeaturesPerPackage,
    maxPackageFeatures: entitlements.limits.maxPackageFeaturesPerPackage,
    storage: entitlements.limits.storageGb,
    customDomain: entitlements.features.customDomainEnabled,
    analyticsTools: entitlements.features.analyticsEnabled,
    teamSectionTools: entitlements.features.teamToolsEnabled,
  };
};

const getLeadFeatureAccess = (planLike) => {
  const sourcePlan = typeof planLike === "string" ? { name: planLike } : planLike;
  const entitlements = toEntitlements(sourcePlan);

  return {
    plan: entitlements.name,
    filters: entitlements.features.leadFiltersEnabled,
    export: entitlements.features.leadExportEnabled,
    reminders: entitlements.features.leadRemindersEnabled,
    historyDays: entitlements.limits.leadHistoryDays,
    maxVisibleLeads: entitlements.limits.leadVisibilityLimit,
    advancedAnalytics: entitlements.features.leadAdvancedAnalyticsEnabled,
    templatePack:
      entitlements.limits.leadTemplatesCount < 0
        ? "studio"
        : entitlements.limits.leadTemplatesCount > 1
          ? "pro"
          : "basic",
    templateLimit: entitlements.limits.leadTemplatesCount,
    channels: entitlements.leadChannels,
    upgradeTarget: entitlements.upgradeTarget,
  };
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

const getLeadFollowUpTemplates = (planLike) => {
  const features = getLeadFeatureAccess(planLike);
  const pack = LEAD_FOLLOW_UP_TEMPLATE_PACKS[features.templatePack] || LEAD_FOLLOW_UP_TEMPLATE_PACKS.basic;
  const limit = Number(features.templateLimit);
  if (Number.isFinite(limit) && limit >= 0) {
    return pack.slice(0, limit);
  }
  return pack;
};

export const planLimitService = {
  PLAN_LIMIT_ERROR_MESSAGE,
  ANALYTICS_TOOLS_ERROR_MESSAGE,
  TEAM_SECTION_TOOLS_ERROR_MESSAGE,

  mapPlanLimits,
  getLeadFeatureAccess,
  getLeadFollowUpTemplates,
  normalizePlanRow,
  toEntitlements,

  async invalidatePlanCache() {
    return true;
  },

  async supportsAnalyticsToolsColumn() {
    try {
      await prisma.$queryRaw`SELECT "analyticsTools" FROM "SubscriptionPlan" LIMIT 1`;
      return true;
    } catch {
      return false;
    }
  },

  async supportsTeamSectionToolsColumn() {
    try {
      await prisma.$queryRaw`SELECT "teamSectionTools" FROM "SubscriptionPlan" LIMIT 1`;
      return true;
    } catch {
      return false;
    }
  },

  async supportsMaxPackageFeaturesColumn() {
    try {
      await prisma.$queryRaw`SELECT "maxPackageFeatures" FROM "SubscriptionPlan" LIMIT 1`;
      return true;
    } catch {
      return false;
    }
  },

  async listAllPlans() {
    let rows = [];
    try {
      rows = await prisma.$queryRaw`SELECT * FROM "SubscriptionPlan" ORDER BY "name" ASC`;
    } catch (error) {
      const code = String(error?.code || "");
      if (code === "42P01" || code === "ECONNREFUSED") {
        rows = fallbackPlansWithoutDb();
      } else {
        throw error;
      }
    }

    if (!rows?.length) {
      rows = fallbackPlansWithoutDb();
    }

    const normalized = rows
      .map((row) => normalizePlanRow(row, rows))
      .sort((a, b) => Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999));
    ensurePlansConfigured(normalized);
    return normalized;
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

  async getPlanEntitlements(identifier) {
    const plans = await this.listAllPlans();

    if (!identifier) {
      const plan = plans.find((item) => normalizePlanName(item?.name) === "FREE") || plans[0];
      return toEntitlements(plan, plans);
    }

    if (typeof identifier === "object") {
      if (identifier.id) {
        const plan = plans.find((item) => String(item?.id || "") === String(identifier.id)) || plans[0];
        return toEntitlements(plan, plans);
      }
      if (identifier.slug || identifier.name) {
        const lookup = normalizePlanName(identifier.slug || identifier.name);
        const plan = plans.find((item) => normalizePlanName(item?.name) === lookup) || plans[0];
        return toEntitlements(plan, plans);
      }
      if (identifier.plan) {
        const lookup = normalizePlanName(identifier.plan);
        const plan = plans.find((item) => normalizePlanName(item?.name) === lookup) || plans[0];
        return toEntitlements(plan, plans);
      }
    }

    if (typeof identifier === "string") {
      const candidate = String(identifier || "").trim();
      if (!candidate) {
        const plan = plans.find((item) => normalizePlanName(item?.name) === "FREE") || plans[0];
        return toEntitlements(plan, plans);
      }
      const byId = plans.find((item) => String(item?.id || "") === candidate);
      if (byId) return toEntitlements(byId, plans);

      const byName = plans.find((item) => normalizePlanName(item?.name) === normalizePlanName(candidate));
      if (byName) return toEntitlements(byName, plans);
    }

    const fallback = plans.find((item) => normalizePlanName(item?.name) === "FREE") || plans[0];
    return toEntitlements(fallback, plans);
  },

  async getPlanEntitlementsByUserId(userId) {
    const [plan, plans] = await Promise.all([this.getPlanByUserId(userId), this.listAllPlans()]);
    return toEntitlements(plan, plans);
  },

  async getPlanEntitlementsByPhotographerId(photographerId) {
    const [plan, plans] = await Promise.all([this.getPlanByPhotographerId(photographerId), this.listAllPlans()]);
    return toEntitlements(plan, plans);
  },

  async getUsageForPhotographer(photographerId) {
    const plan = await this.getPlanByPhotographerId(photographerId);
    const entitlements = toEntitlements(plan);
    const [usage, packagesPerServiceUsage] = await Promise.all([
      usageFromPhotographer(photographerId),
      this.getPackagesPerServiceUsage(photographerId, entitlements.limits.maxPackagesPerService),
    ]);

    return {
      planName: plan.name,
      usage: {
        services: { used: usage.services, limit: entitlements.limits.maxServices },
        packages: { used: usage.packages, limit: entitlements.limits.maxPackagesPerService },
        packagesPerService: packagesPerServiceUsage,
        portfolioImages: { used: usage.portfolioImages, limit: entitlements.limits.maxPortfolioImages },
      },
      limits: mapPlanLimits(plan),
      entitlements,
    };
  },

  async evaluateLimitGate({ metric, used, plan, contextLabel = null }) {
    const normalizedMetric = String(metric || "").trim();
    const entitlements = toEntitlements(plan);
    const limit = metricLimitValue(entitlements, normalizedMetric);
    if (limit === null) {
      throw new ApiError(500, "Invalid entitlement metric");
    }

    if (!this.isLimitReached({ used, max: limit })) {
      return buildGateResult({
        allowed: true,
        metric: normalizedMetric,
        used: Number(used),
        limit,
        planName: entitlements.name,
      });
    }

    const recommendation = await this.getUpgradeRecommendation(entitlements.name || "FREE", normalizedMetric);
    const message = metricReachedMessage({
      metric: normalizedMetric,
      used,
      limit,
      planName: entitlements.name || "FREE",
      contextLabel,
      recommendation,
    });

    return buildGateResult({
      allowed: false,
      metric: normalizedMetric,
      used: Number(used),
      limit,
      planName: entitlements.name,
      upgradeTarget: recommendation?.plan?.name || entitlements.upgradeTarget || null,
      message,
    });
  },

  async evaluateFeatureGate({ feature, featureLabel, entitlements }) {
    const enabled = Boolean(entitlements?.features?.[feature]);
    if (enabled) {
      return buildGateResult({
        allowed: true,
        feature,
        planName: entitlements?.name || "FREE",
      });
    }

    const message = buildFeatureBlockedMessage({
      featureLabel,
      planName: entitlements?.name || "FREE",
      upgradeTarget: entitlements?.upgradeTarget || null,
    });

    return buildGateResult({
      allowed: false,
      feature,
      planName: entitlements?.name || "FREE",
      upgradeTarget: entitlements?.upgradeTarget || null,
      message,
    });
  },

  async canAddService({ photographerId, used = null }) {
    const [plan, usage] = await Promise.all([
      this.getPlanByPhotographerId(photographerId),
      used === null ? prisma.service.count({ where: { photographerId, status: { not: "ARCHIVED" } } }) : used,
    ]);
    return this.evaluateLimitGate({ metric: "services", used: Number(usage), plan });
  },

  async canUploadPortfolioImage({ photographerId, used = null }) {
    const [plan, usage] = await Promise.all([
      this.getPlanByPhotographerId(photographerId),
      used === null ? prisma.portfolioItem.count({ where: { photographerId } }) : used,
    ]);
    return this.evaluateLimitGate({ metric: "portfolioImages", used: Number(usage), plan });
  },

  async canCreatePackage({ photographerId, serviceId = null, serviceName = null, used = null }) {
    const resolvedServiceName =
      serviceName ||
      (serviceId
        ? (await prisma.service.findUnique({ where: { id: serviceId }, select: { name: true } }))?.name || "this service"
        : "this service");

    const [plan, usage] = await Promise.all([
      this.getPlanByPhotographerId(photographerId),
      used === null
        ? prisma.package.count({ where: { photographerId, serviceId, status: { not: "ARCHIVED" } } })
        : used,
    ]);
    return this.evaluateLimitGate({
      metric: "packagesPerService",
      used: Number(usage),
      plan,
      contextLabel: resolvedServiceName,
    });
  },

  async canUseCustomDomain({ photographerId }) {
    const entitlements = await this.getPlanEntitlementsByPhotographerId(photographerId);
    return this.evaluateFeatureGate({
      feature: "customDomainEnabled",
      featureLabel: "Custom domains",
      entitlements,
    });
  },

  async canHideBranding({ userId }) {
    const entitlements = await this.getPlanEntitlementsByUserId(userId);
    const enabled =
      Boolean(entitlements?.features?.hideBrandingEnabled) &&
      String(entitlements?.modes?.brandingMode || "FORCED_LENSAYA") === "REMOVABLE";

    if (enabled) {
      return buildGateResult({
        allowed: true,
        feature: "hideBrandingEnabled",
        planName: entitlements?.name || "FREE",
      });
    }

    return buildGateResult({
      allowed: false,
      feature: "hideBrandingEnabled",
      planName: entitlements?.name || "FREE",
      upgradeTarget: entitlements?.upgradeTarget || null,
      message: buildFeatureBlockedMessage({
        featureLabel: "Branding removal",
        planName: entitlements?.name || "FREE",
        upgradeTarget: entitlements?.upgradeTarget || null,
      }),
    });
  },

  async canExportLeads({ photographerId }) {
    const entitlements = await this.getPlanEntitlementsByPhotographerId(photographerId);
    return this.evaluateFeatureGate({
      feature: "leadExportEnabled",
      featureLabel: "Lead export",
      entitlements,
    });
  },

  async canUseLeadReminders({ photographerId }) {
    const entitlements = await this.getPlanEntitlementsByPhotographerId(photographerId);
    return this.evaluateFeatureGate({
      feature: "leadRemindersEnabled",
      featureLabel: "Lead reminders",
      entitlements,
    });
  },

  async canUseTeamTools({ photographerId }) {
    const entitlements = await this.getPlanEntitlementsByPhotographerId(photographerId);
    return this.evaluateFeatureGate({
      feature: "teamToolsEnabled",
      featureLabel: "Team collaboration",
      entitlements,
    });
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
    const currentEntitlements = toEntitlements(currentPlan);
    const currentLimit = metricLimitValue(currentEntitlements, metric);
    if (currentLimit === null) return null;

    const plans = await this.listAllPlans();
    const sorted = plans
      .filter((plan) => toBooleanOr(plan?.isActive, true) && toBooleanOr(plan?.isVisible, true))
      .sort((a, b) => toNumberOr(a?.sortOrder, 9999) - toNumberOr(b?.sortOrder, 9999));
    const currentRank = sorted.findIndex((plan) => normalizePlanName(plan?.name) === normalizedPlanName);

    for (const [index, plan] of sorted.entries()) {
      if (index <= currentRank) continue;
      const candidateEntitlements = toEntitlements(plan);
      const candidateLimit = metricLimitValue(candidateEntitlements, metric);
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
    const result = await this.evaluateLimitGate({ metric, used, plan, contextLabel });
    if (result.allowed) {
      return;
    }

    throw new ApiError(403, result.message || PLAN_LIMIT_ERROR_MESSAGE);
  },

  async assertTeamSectionToolsAccessByPhotographerId(photographerId) {
    const entitlements = await this.getPlanEntitlementsByPhotographerId(photographerId);
    if (!Boolean(entitlements.features.teamToolsEnabled)) {
      throw new ApiError(403, TEAM_SECTION_TOOLS_ERROR_MESSAGE);
    }
    return this.getPlanByName(entitlements.name);
  },

  async assertAnalyticsToolsAccessByPhotographerId(photographerId) {
    const entitlements = await this.getPlanEntitlementsByPhotographerId(photographerId);
    if (!Boolean(entitlements.features.analyticsEnabled)) {
      throw new ApiError(403, ANALYTICS_TOOLS_ERROR_MESSAGE);
    }
    return this.getPlanByName(entitlements.name);
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
