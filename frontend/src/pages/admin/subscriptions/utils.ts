import type {
  ChangesItem,
  LimitsShape,
  PlanDistributionItem,
  PlanName,
  PlanPricingRecord,
  PricingShape,
  PublicPricingContent,
  RevenueByPlanItem,
  UpgradeDowngradeItem,
} from "./types";
import { DEFAULT_LIMITS, PLAN_COLOR_HEX } from "./constants";
import { normalizePricingContent as resolvePricingContent } from "../../../lib/pricingContent";

export const formatPlan = (plan: string) => {
  if (plan === "FREE") return "Free";
  if (plan === "PRO") return "Pro";
  if (plan === "STUDIO") return "Studio";
  return plan || "Unknown";
};

export const formatCurrency = (value: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `$${Number(value || 0).toFixed(2)}`;
  }
};

export const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const shortUser = (value: string) => {
  if (!value) return "Unknown user";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

export const monthBuckets = () => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
      month: date.toLocaleString(undefined, { month: "short" }),
      upgrades: 0,
      downgrades: 0,
    };
  });
};

export const normalizeLimits = (limitsResult: Record<string, unknown>) => {
  const rawFree = (limitsResult.free as Record<string, unknown>) || {};
  const rawPro = (limitsResult.pro as Record<string, unknown>) || {};
  const rawStudio = (limitsResult.studio as Record<string, unknown>) || {};

  return {
    free: {
      services: Number(rawFree.services || 0),
      portfolioPhotos: Number(rawFree.portfolioPhotos || rawFree.portfolioImages || 0),
      packagesPerService: Number(rawFree.packagesPerService || rawFree.packages || 0),
      packageFeatures: Number(rawFree.packageFeatures || rawFree.maxPackageFeatures || 5),
      storageGb: Number(rawFree.storageGb || rawFree.storage || 0),
      leadHistoryDays: Number(rawFree.leadHistoryDays || 30),
      leadVisibilityLimit: Number(rawFree.leadVisibilityLimit || 60),
      leadTemplatesCount: Number(rawFree.leadTemplatesCount || 1),
      teamSeats: Number(rawFree.teamSeats || 1),
      customDomain: Boolean(rawFree.customDomain),
      analyticsTools: Boolean(rawFree.analyticsTools),
      hideBrandingEnabled: Boolean(rawFree.hideBrandingEnabled),
      leadFiltersEnabled: Boolean(rawFree.leadFiltersEnabled),
      leadExportEnabled: Boolean(rawFree.leadExportEnabled),
      leadRemindersEnabled: Boolean(rawFree.leadRemindersEnabled),
      leadAdvancedAnalyticsEnabled: Boolean(rawFree.leadAdvancedAnalyticsEnabled),
      teamSectionTools: Boolean(rawFree.teamSectionTools),
      isVisible: Boolean(rawFree.isVisible ?? true),
      isActive: Boolean(rawFree.isActive ?? true),
      isMostPopular: Boolean(rawFree.isMostPopular),
      analyticsMode: String(rawFree.analyticsMode || "NONE").toUpperCase() as "NONE" | "BASIC" | "ADVANCED",
      leadAnalyticsMode: String(rawFree.leadAnalyticsMode || "NONE").toUpperCase() as "NONE" | "BASIC" | "ADVANCED",
      supportTier: String(rawFree.supportTier || "STANDARD").toUpperCase() as "STANDARD" | "PRIORITY",
      brandingMode: String(rawFree.brandingMode || "FORCED_LENSAYA").toUpperCase() as "FORCED_LENSAYA" | "REMOVABLE",
      leadChannels: {
        whatsapp: Boolean((rawFree.leadChannels as { whatsapp?: unknown })?.whatsapp ?? true),
        email: Boolean((rawFree.leadChannels as { email?: unknown })?.email ?? true),
      },
    },
    pro: {
      services: Number(rawPro.services || 0),
      portfolioPhotos: Number(rawPro.portfolioPhotos || rawPro.portfolioImages || 0),
      packagesPerService: Number(rawPro.packagesPerService || rawPro.packages || 0),
      packageFeatures: Number(rawPro.packageFeatures || rawPro.maxPackageFeatures || 10),
      storageGb: Number(rawPro.storageGb || rawPro.storage || 0),
      leadHistoryDays: Number(rawPro.leadHistoryDays || 365),
      leadVisibilityLimit: Number(rawPro.leadVisibilityLimit || -1),
      leadTemplatesCount: Number(rawPro.leadTemplatesCount || 8),
      teamSeats: Number(rawPro.teamSeats || 3),
      customDomain: Boolean(rawPro.customDomain),
      analyticsTools: Boolean(rawPro.analyticsTools ?? true),
      hideBrandingEnabled: Boolean(rawPro.hideBrandingEnabled ?? true),
      leadFiltersEnabled: Boolean(rawPro.leadFiltersEnabled ?? true),
      leadExportEnabled: Boolean(rawPro.leadExportEnabled ?? true),
      leadRemindersEnabled: Boolean(rawPro.leadRemindersEnabled ?? true),
      leadAdvancedAnalyticsEnabled: Boolean(rawPro.leadAdvancedAnalyticsEnabled ?? true),
      teamSectionTools: Boolean(rawPro.teamSectionTools ?? false),
      isVisible: Boolean(rawPro.isVisible ?? true),
      isActive: Boolean(rawPro.isActive ?? true),
      isMostPopular: Boolean(rawPro.isMostPopular ?? true),
      analyticsMode: String(rawPro.analyticsMode || "ADVANCED").toUpperCase() as "NONE" | "BASIC" | "ADVANCED",
      leadAnalyticsMode: String(rawPro.leadAnalyticsMode || "ADVANCED").toUpperCase() as "NONE" | "BASIC" | "ADVANCED",
      supportTier: String(rawPro.supportTier || "STANDARD").toUpperCase() as "STANDARD" | "PRIORITY",
      brandingMode: String(rawPro.brandingMode || "REMOVABLE").toUpperCase() as "FORCED_LENSAYA" | "REMOVABLE",
      leadChannels: {
        whatsapp: Boolean((rawPro.leadChannels as { whatsapp?: unknown })?.whatsapp ?? true),
        email: Boolean((rawPro.leadChannels as { email?: unknown })?.email ?? true),
      },
    },
    studio: {
      services: Number(rawStudio.services || -1),
      portfolioPhotos: Number(rawStudio.portfolioPhotos || rawStudio.portfolioImages || -1),
      packagesPerService: Number(rawStudio.packagesPerService || rawStudio.packages || -1),
      packageFeatures: Number(rawStudio.packageFeatures || rawStudio.maxPackageFeatures || 20),
      storageGb: Number(rawStudio.storageGb || rawStudio.storage || -1),
      leadHistoryDays: Number(rawStudio.leadHistoryDays || -1),
      leadVisibilityLimit: Number(rawStudio.leadVisibilityLimit || -1),
      leadTemplatesCount: Number(rawStudio.leadTemplatesCount || -1),
      teamSeats: Number(rawStudio.teamSeats || 10),
      customDomain: Boolean(rawStudio.customDomain ?? true),
      analyticsTools: Boolean(rawStudio.analyticsTools ?? true),
      hideBrandingEnabled: Boolean(rawStudio.hideBrandingEnabled ?? true),
      leadFiltersEnabled: Boolean(rawStudio.leadFiltersEnabled ?? true),
      leadExportEnabled: Boolean(rawStudio.leadExportEnabled ?? true),
      leadRemindersEnabled: Boolean(rawStudio.leadRemindersEnabled ?? true),
      leadAdvancedAnalyticsEnabled: Boolean(rawStudio.leadAdvancedAnalyticsEnabled ?? true),
      teamSectionTools: Boolean(rawStudio.teamSectionTools ?? true),
      isVisible: Boolean(rawStudio.isVisible ?? true),
      isActive: Boolean(rawStudio.isActive ?? true),
      isMostPopular: Boolean(rawStudio.isMostPopular ?? false),
      analyticsMode: String(rawStudio.analyticsMode || "ADVANCED").toUpperCase() as "NONE" | "BASIC" | "ADVANCED",
      leadAnalyticsMode: String(rawStudio.leadAnalyticsMode || "ADVANCED").toUpperCase() as "NONE" | "BASIC" | "ADVANCED",
      supportTier: String(rawStudio.supportTier || "PRIORITY").toUpperCase() as "STANDARD" | "PRIORITY",
      brandingMode: String(rawStudio.brandingMode || "REMOVABLE").toUpperCase() as "FORCED_LENSAYA" | "REMOVABLE",
      leadChannels: {
        whatsapp: Boolean((rawStudio.leadChannels as { whatsapp?: unknown })?.whatsapp ?? true),
        email: Boolean((rawStudio.leadChannels as { email?: unknown })?.email ?? true),
      },
    },
  } satisfies LimitsShape;
};

export const normalizePricing = (plansResult: { items?: Array<Record<string, unknown>> }) => {
  const byPlanName = new Map(
    ((plansResult.items || []) as Array<Record<string, unknown>>).map((plan) => [
      String(plan.name || "").toUpperCase(),
      plan,
    ])
  );

  const toPricingRecord = (planName: PlanName): PlanPricingRecord => {
    const row = byPlanName.get(planName);
    return {
      id: String(row?.id || ""),
      displayName: String(row?.displayName || row?.name || planName),
      tagline: String(row?.tagline || ""),
      subtitle: String(row?.subtitle || ""),
      badgeText: String(row?.badgeText || ""),
      ctaText: String(row?.ctaText || ""),
      monthlyPriceDisplay: String(row?.monthlyPriceDisplay || ""),
      yearlyPriceDisplay: String(row?.yearlyPriceDisplay || ""),
      sortOrder: Number(row?.sortOrder || 0),
      price: Number(row?.price || 0),
      yearlyPrice: Number(row?.yearlyPrice || 0),
      currency: String(row?.currency || "USD").toUpperCase(),
      trialDays: Number(row?.trialDays || 0),
    };
  };

  return {
    free: toPricingRecord("FREE"),
    pro: toPricingRecord("PRO"),
    studio: toPricingRecord("STUDIO"),
  } satisfies PricingShape;
};

export const normalizePublicPricingContent = (publicPricingResult: Record<string, unknown>) => {
  return resolvePricingContent(publicPricingResult) satisfies PublicPricingContent;
};

export const buildPlanDistribution = (distribution: Array<{ plan: string; count: number }>): PlanDistributionItem[] => {
  if (!distribution.length) {
    return [
      { id: "free", name: "Free", value: 0, color: PLAN_COLOR_HEX.FREE },
      { id: "pro", name: "Pro", value: 0, color: PLAN_COLOR_HEX.PRO },
      { id: "studio", name: "Studio", value: 0, color: PLAN_COLOR_HEX.STUDIO },
    ];
  }

  return distribution.map((item, index) => {
    const key = (item.plan || "FREE") as PlanName;
    return {
      id: `${item.plan || "plan"}-${index + 1}`,
      name: formatPlan(item.plan || "FREE"),
      value: Number(item.count || 0),
      color: PLAN_COLOR_HEX[key] || PLAN_COLOR_HEX.FREE,
    };
  });
};

export const buildUpgradeDowngradeData = (changes: ChangesItem[]): UpgradeDowngradeItem[] => {
  const buckets = monthBuckets();
  const bucketMap = new Map(buckets.map((item) => [item.key, item]));

  changes.forEach((change) => {
    const date = new Date(change.at);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const target = bucketMap.get(key);
    if (!target) return;

    if ((change.action || "").toLowerCase().includes("down")) {
      target.downgrades += 1;
    } else {
      target.upgrades += 1;
    }
  });

  return buckets.map((item, index) => ({ ...item, id: `upgrade-${index + 1}` }));
};

export const buildRevenueByPlanMap = (rows: RevenueByPlanItem[]) => {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.plan] = Number(row.revenue || 0);
    return acc;
  }, {});
};

export const coerceOverviewPlanStats = (raw: unknown): Record<PlanName, number> => {
  const record = (raw || {}) as Record<string, unknown>;
  return {
    FREE: Number(record.FREE || 0),
    PRO: Number(record.PRO || 0),
    STUDIO: Number(record.STUDIO || 0),
  };
};

export const coerceDistribution = (raw: unknown) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    plan: String((item as Record<string, unknown>).plan || "FREE"),
    count: Number((item as Record<string, unknown>).count || 0),
  }));
};

export const coerceChanges = (raw: unknown): ChangesItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    user: String((item as Record<string, unknown>).user || ""),
    from: String((item as Record<string, unknown>).from || ""),
    to: String((item as Record<string, unknown>).to || ""),
    action: String((item as Record<string, unknown>).action || ""),
    at: String((item as Record<string, unknown>).at || ""),
  }));
};

export const coerceRevenueByPlan = (raw: unknown): RevenueByPlanItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    plan: String((item as Record<string, unknown>).plan || ""),
    revenue: Number((item as Record<string, unknown>).revenue || 0),
  }));
};

export const formatLimitValue = (value: number) => {
  if (value < 0) return "Unlimited";
  return value;
};

export const DEFAULT_PLAN_STATS: Record<PlanName, number> = {
  FREE: 0,
  PRO: 0,
  STUDIO: 0,
};

export const FALLBACK_LIMITS = DEFAULT_LIMITS;
