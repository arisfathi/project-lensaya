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
      customDomain: Boolean(rawFree.customDomain),
      analyticsTools: Boolean(rawFree.analyticsTools),
      teamSectionTools: Boolean(rawFree.teamSectionTools),
    },
    pro: {
      services: Number(rawPro.services || 0),
      portfolioPhotos: Number(rawPro.portfolioPhotos || rawPro.portfolioImages || 0),
      packagesPerService: Number(rawPro.packagesPerService || rawPro.packages || 0),
      packageFeatures: Number(rawPro.packageFeatures || rawPro.maxPackageFeatures || 10),
      customDomain: Boolean(rawPro.customDomain),
      analyticsTools: Boolean(rawPro.analyticsTools ?? true),
      teamSectionTools: Boolean(rawPro.teamSectionTools ?? false),
    },
    studio: {
      services: Number(rawStudio.services || -1),
      portfolioPhotos: Number(rawStudio.portfolioPhotos || rawStudio.portfolioImages || -1),
      packagesPerService: Number(rawStudio.packagesPerService || rawStudio.packages || -1),
      packageFeatures: Number(rawStudio.packageFeatures || rawStudio.maxPackageFeatures || 20),
      customDomain: Boolean(rawStudio.customDomain ?? true),
      analyticsTools: Boolean(rawStudio.analyticsTools ?? true),
      teamSectionTools: Boolean(rawStudio.teamSectionTools ?? true),
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
  const rawBullets = (publicPricingResult.bullets as Record<string, string[]>) || {};
  const rawRows = (publicPricingResult.compareRows as Array<Record<string, unknown>>) || [];

  return {
    bullets: {
      FREE: [...(rawBullets.FREE || [])],
      PRO: [...(rawBullets.PRO || [])],
      STUDIO: [...(rawBullets.STUDIO || [])],
    },
    compareRows: rawRows.map((row) => ({
      id: String(row.id || ""),
      label: String(row.label || ""),
      sortOrder: Number(row.sortOrder || 0),
      values: {
        FREE: String((row.values as Record<string, unknown>)?.FREE || "-"),
        PRO: String((row.values as Record<string, unknown>)?.PRO || "-"),
        STUDIO: String((row.values as Record<string, unknown>)?.STUDIO || "-"),
      },
    })),
    updatedAt: String(publicPricingResult.updatedAt || "") || null,
  } satisfies PublicPricingContent;
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
