import type { billingApi } from "../../../lib/api";

export type OverviewResponse = {
  photographerId: string;
  stats: {
    portfolioViews: number;
    whatsappClicks: number;
    inquiries: number;
    conversionRate: number;
    profileClicks?: number;
    monthlyTraffic?: number;
  };
  trafficSeries: Array<{ name: string; views: number }>;
  categorySeries: Array<{ name: string; views: number }>;
  analyticsAccess: {
    tier: string;
    hasFullAccess: boolean;
    upgradeTarget: string | null;
    lockedSections: string[];
  };
  analyticsPreview: {
    topCategories: Array<{
      name: string;
      rank: number;
    }>;
    totalCategoriesTracked: number;
  };
  quickCounts: {
    portfolioCount: number;
    serviceCount: number;
    packageCount: number;
    bookingCount: number;
  };
  plan?: {
    name: string;
    price: number;
    currency: string;
    trialDays: number;
  };
  usage?: {
    services: { used: number; limit: number };
    packages: { used: number; limit: number };
    packagesPerService?: {
      used: number;
      limit: number;
      serviceId?: string | null;
      serviceName?: string | null;
      servicesAtLimit?: number;
    };
    portfolioImages: { used: number; limit: number };
    storage?: { used: number; usedBytes?: number; limit: number };
    leads?: { used: number; limit: number };
  };
};

export type WebsiteSummary = {
  websiteUrl: string;
  portfolioCount: number;
  serviceCount: number;
  packageCount: number;
  lastUpdated: string;
};

export type PlanCatalogItem = Awaited<ReturnType<typeof billingApi.plans>>["plans"][number];
export type PreviewCategoryItem = OverviewResponse["analyticsPreview"]["topCategories"][number];

export type QuickActionItem = {
  name: string;
  description: string;
  color: string;
  icon: "service" | "package" | "portfolio" | "profile" | "upgrade";
  path: string;
};

export type UsageCard = {
  id: string;
  label: string;
  used: number;
  limit: number;
  unit?: string;
  remaining: number | null;
  remainingLabel: string;
  nearLimit: boolean;
  context: string | null;
  percent: number;
  status: "unlimited" | "critical" | "warning" | "normal";
  suggestionText: string | null;
  upgradeTarget: string | null;
  unlockValueLabel: string | null;
  comparisonBenefits: string[];
};
