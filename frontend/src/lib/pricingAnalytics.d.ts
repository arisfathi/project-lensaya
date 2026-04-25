export type PricingEventName =
  | "pricing_page_viewed"
  | "pricing_plan_cta_clicked"
  | "pricing_compare_interaction"
  | "usage_warning_shown"
  | "usage_limit_blocked"
  | "upgrade_modal_opened"
  | "upgrade_modal_confirmed"
  | "upgrade_modal_dismissed";

type Scalar = string | number | boolean | null;

export type PricingAnalyticsEventInput = {
  eventName: PricingEventName;
  pageContext: string;
  currentPlan?: string | null;
  targetPlan?: string | null;
  featureKey?: string | null;
  currentUsage?: number | null;
  allowedLimit?: number | null;
  photographerId?: string | null;
  source?: string | null;
  sessionId?: string | null;
  visitorId?: string | null;
  path?: string | null;
  pageUrl?: string | null;
  referrer?: string | null;
  metadata?: Record<string, Scalar>;
};

export declare const buildPricingAnalyticsMetadata: (input: PricingAnalyticsEventInput) => Record<string, Scalar>;
export declare const trackPricingEvent: (input: PricingAnalyticsEventInput) => Promise<void>;
export declare const trackPricingEventSafe: (input: PricingAnalyticsEventInput) => void;
