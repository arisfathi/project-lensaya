export type PlanName = "FREE" | "PRO" | "STUDIO";
export type PlanKey = "free" | "pro" | "studio";

export type LimitsPlan = {
  services: number;
  portfolioPhotos: number;
  packagesPerService: number;
  packageFeatures: number;
  customDomain: boolean;
  analyticsTools: boolean;
  teamSectionTools: boolean;
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

export type PublicPricingBullets = {
  FREE: string[];
  PRO: string[];
  STUDIO: string[];
};

export type PublicPricingCompareRow = {
  id: string;
  label: string;
  sortOrder: number;
  values: {
    FREE: string;
    PRO: string;
    STUDIO: string;
  };
};

export type PublicPricingContent = {
  bullets: PublicPricingBullets;
  compareRows: PublicPricingCompareRow[];
  updatedAt: string | null;
};

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
