import type { LimitsShape, PlanName, PricingShape, PublicPricingContent } from "./types";

export const DEFAULT_LIMITS: LimitsShape = {
  free: {
    services: 0,
    portfolioPhotos: 0,
    packagesPerService: 0,
    packageFeatures: 5,
    customDomain: false,
    analyticsTools: false,
    teamSectionTools: false,
  },
  pro: {
    services: 0,
    portfolioPhotos: 0,
    packagesPerService: 0,
    packageFeatures: 10,
    customDomain: true,
    analyticsTools: true,
    teamSectionTools: false,
  },
  studio: {
    services: -1,
    portfolioPhotos: -1,
    packagesPerService: 10,
    packageFeatures: 20,
    customDomain: true,
    analyticsTools: true,
    teamSectionTools: true,
  },
};

export const DEFAULT_PRICING: PricingShape = {
  free: { id: "", price: 0, yearlyPrice: 0, currency: "USD", trialDays: 0 },
  pro: { id: "", price: 0, yearlyPrice: 0, currency: "USD", trialDays: 0 },
  studio: { id: "", price: 0, yearlyPrice: 0, currency: "USD", trialDays: 0 },
};

export const DEFAULT_PUBLIC_PRICING_CONTENT: PublicPricingContent = {
  bullets: {
    FREE: ["No credit card required", "Publish your portfolio fast", "Best for trying Lensaya"],
    PRO: ["Most popular for active photographers", "Higher limits for growth", "Priority support included"],
    STUDIO: ["For high-volume studios", "Large catalogs and team workflows", "Maximum flexibility and scale"],
  },
  compareRows: [
    {
      id: "portfolio-photos",
      label: "Portfolio Photos",
      sortOrder: 0,
      values: { FREE: "100", PRO: "1000", STUDIO: "Unlimited" },
    },
    {
      id: "services",
      label: "Services",
      sortOrder: 1,
      values: { FREE: "3", PRO: "15", STUDIO: "Unlimited" },
    },
    {
      id: "custom-domain",
      label: "Custom Domain",
      sortOrder: 2,
      values: { FREE: "Not included", PRO: "Included", STUDIO: "Included" },
    },
  ],
  updatedAt: null,
};

export const PLAN_COLOR_HEX: Record<PlanName, string> = {
  FREE: "#64748b",
  PRO: "#06b6d4",
  STUDIO: "#a855f7",
};

export const PRICING_PLAN_ENTRIES: Array<{ key: "free" | "pro" | "studio"; label: PlanName }> = [
  { key: "free", label: "FREE" },
  { key: "pro", label: "PRO" },
  { key: "studio", label: "STUDIO" },
];
