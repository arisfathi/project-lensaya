export type PricingPlanId = "FREE" | "PRO" | "STUDIO";

export type PricingPlanCopy = {
  tagline: string;
  description: string;
  badge: string;
  cta: string;
};

export type PricingFaqItem = {
  question: string;
  answer: string;
};

export type PricingUpgradeTransitionCopy = {
  title: string;
  description: string;
};

export type PricingContent = {
  section: {
    title: string;
    subtitle: string;
  };
  faq: PricingFaqItem[];
  upgradeCopy: {
    transitions: Record<Exclude<PricingPlanId, "FREE">, PricingUpgradeTransitionCopy>;
    warning: string;
    blocked: string;
    empty: string;
  };
  bullets: Record<PricingPlanId, string[]>;
  compareRows: Array<{
    id: string;
    label: string;
    sortOrder: number;
    values: Record<PricingPlanId, string>;
  }>;
  updatedAt: string | null;
};

export type PricingPlanLike = {
  id?: string;
  name?: string;
  displayName?: string | null;
  tagline?: string | null;
  subtitle?: string | null;
  badgeText?: string | null;
  ctaText?: string | null;
};

export declare const PLAN_COPY_DEFAULTS: Record<PricingPlanId, PricingPlanCopy>;
export declare const PRICING_SECTION_DEFAULTS: {
  title: string;
  subtitle: string;
};
export declare const PRICING_FAQ_DEFAULTS: PricingFaqItem[];
export declare const PRICING_UPGRADE_COPY_DEFAULTS: {
  transitions: Record<Exclude<PricingPlanId, "FREE">, PricingUpgradeTransitionCopy>;
  warning: string;
  blocked: string;
  empty: string;
};

export declare function normalizePricingContent(content: unknown): PricingContent;
export declare function resolvePlanCopy(plan: PricingPlanLike): PricingPlanCopy;
export declare function resolvePlanDisplayName(plan: PricingPlanLike): string;
export declare function resolvePricingSectionCopy(content: unknown): PricingContent["section"];
export declare function resolvePricingFaq(content: unknown): PricingFaqItem[];
export declare function resolvePricingUpgradeCopy(content: unknown, targetPlan?: string | null): PricingUpgradeTransitionCopy;
export declare function formatPricingTemplate(template: string, values?: Record<string, unknown>): string;
export declare function resolveUsagePrompt(content: unknown, kind: "warning" | "blocked" | "empty", values?: Record<string, unknown>): string;
export declare function resolvePricingCardBullets(content: unknown, planId: PricingPlanId): string[];
export declare function resolvePricingComparisonRows(content: unknown): PricingContent["compareRows"];
