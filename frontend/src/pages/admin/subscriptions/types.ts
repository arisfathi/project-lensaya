import type { PricingContent } from "../../../lib/pricingContent";

export type PlanName = "FREE" | "PRO" | "STUDIO";
export type PlanKey = "free" | "pro" | "studio";

export type LimitsPlan = {
  services: number;
  portfolioPhotos: number;
  packagesPerService: number;
  packageFeatures: number;
  storageGb: number;
  leadHistoryDays: number;
  leadVisibilityLimit: number;
  leadTemplatesCount: number;
  teamSeats: number;
  customDomain: boolean;
  analyticsTools: boolean;
  hideBrandingEnabled: boolean;
  leadFiltersEnabled: boolean;
  leadExportEnabled: boolean;
  leadRemindersEnabled: boolean;
  leadAdvancedAnalyticsEnabled: boolean;
  teamSectionTools: boolean;
  isVisible: boolean;
  isActive: boolean;
  isMostPopular: boolean;
  analyticsMode: "NONE" | "BASIC" | "ADVANCED";
  leadAnalyticsMode: "NONE" | "BASIC" | "ADVANCED";
  supportTier: "STANDARD" | "PRIORITY";
  brandingMode: "FORCED_LENSAYA" | "REMOVABLE";
  leadChannels: {
    whatsapp: boolean;
    email: boolean;
  };
};

export type LimitsShape = {
  free: LimitsPlan;
  pro: LimitsPlan;
  studio: LimitsPlan;
};

export type ChangesItem = {
  user: string;
  from: string;
  to: string;
  action: string;
  at: string;
};

export type RevenueByPlanItem = {
  plan: string;
  revenue: number;
};

export type PlanPricingRecord = {
  id: string;
  displayName: string;
  tagline: string;
  subtitle: string;
  badgeText: string;
  ctaText: string;
  monthlyPriceDisplay: string;
  yearlyPriceDisplay: string;
  sortOrder: number;
  price: number;
  yearlyPrice: number;
  currency: string;
  trialDays: number;
};

export type PricingShape = {
  free: PlanPricingRecord;
  pro: PlanPricingRecord;
  studio: PlanPricingRecord;
};

export type PublicPricingContent = PricingContent;

export type PlanCardViewModel = {
  code: PlanName;
  name: string;
  users: number;
  revenue: string;
  colorClassName: string;
};

export type PlanDistributionItem = {
  id: string;
  name: string;
  value: number;
  color: string;
};

export type UpgradeDowngradeItem = {
  id: string;
  month: string;
  upgrades: number;
  downgrades: number;
};
