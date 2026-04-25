type LimitValue = number | boolean;

export type PricingLimits = Record<string, LimitValue>;
export type PlanWithLimits = {
  id: string;
  limits: PricingLimits;
  features?: Record<string, unknown>;
  entitlements?: Record<string, unknown>;
};

const resolveLimitValue = (limits: PricingLimits, keys: readonly string[]) => {
  for (const key of keys) {
    if (key in limits) return limits[key];
  }
  return null;
};

const formatLimitValue = (value: LimitValue | null, fallback: string) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value ? "Included" : "Not included";
  if (value < 0) return "Unlimited";
  return `${value}`;
};

const canRemoveBranding = (plan: PlanWithLimits) => {
  const entitlements = plan.entitlements && typeof plan.entitlements === "object" ? (plan.entitlements as Record<string, unknown>) : null;
  const entitlementsFeatures =
    entitlements?.features && typeof entitlements.features === "object"
      ? (entitlements.features as Record<string, unknown>)
      : null;
  const entitlementsModes =
    entitlements?.modes && typeof entitlements.modes === "object" ? (entitlements.modes as Record<string, unknown>) : null;

  const hideBrandingEnabled = entitlementsFeatures?.hideBrandingEnabled;
  const brandingMode = entitlementsModes?.brandingMode;

  if (typeof hideBrandingEnabled === "boolean") {
    return hideBrandingEnabled && String(brandingMode || "").toUpperCase() === "REMOVABLE";
  }

  const removeBrandingFlag =
    plan.features && typeof plan.features === "object" ? (plan.features as Record<string, unknown>).removeLensayaBranding : undefined;
  if (typeof removeBrandingFlag === "boolean") {
    return removeBrandingFlag;
  }

  const legacyHideBranding = resolveLimitValue(plan.limits, ["hideBrandingEnabled"]);
  if (typeof legacyHideBranding === "boolean") {
    return legacyHideBranding;
  }

  return false;
};

export const buildPlanHighlightsFromLimits = (plan: PlanWithLimits) => [
  `${formatLimitValue(resolveLimitValue(plan.limits, ["services"]), "Core")} service listings`,
  `${formatLimitValue(resolveLimitValue(plan.limits, ["portfolioPhotos", "portfolioImages"]), "Standard")} portfolio capacity`,
  `${formatLimitValue(resolveLimitValue(plan.limits, ["packagesPerService", "packages"]), "Flexible")} package options`,
  `${formatLimitValue(resolveLimitValue(plan.limits, ["packageFeatures", "maxPackageFeatures"]), "Core")} package highlights`,
  `${formatLimitValue(resolveLimitValue(plan.limits, ["leadHistoryDays"]), "Standard")} inquiry history`,
  `${formatLimitValue(resolveLimitValue(plan.limits, ["leadVisibilityLimit"]), "Standard")} stored inquiries`,
  `${formatLimitValue(resolveLimitValue(plan.limits, ["leadTemplatesCount"]), "Core")} quick reply templates`,
  formatLimitValue(resolveLimitValue(plan.limits, ["analyticsTools"]), "Not included") === "Included"
    ? "Insights dashboard"
    : "Insights dashboard (upgrade)",
  formatLimitValue(resolveLimitValue(plan.limits, ["leadFiltersEnabled"]), "Not included") === "Included"
    ? "Inquiry filters"
    : "Inquiry filters (upgrade)",
  formatLimitValue(resolveLimitValue(plan.limits, ["leadRemindersEnabled"]), "Not included") === "Included"
    ? "Follow-up reminders"
    : "Follow-up reminders (upgrade)",
  formatLimitValue(resolveLimitValue(plan.limits, ["leadExportEnabled"]), "Not included") === "Included"
    ? "Inquiry export"
    : "Inquiry export (upgrade)",
  formatLimitValue(resolveLimitValue(plan.limits, ["leadAdvancedAnalyticsEnabled"]), "Not included") === "Included"
    ? "Inquiry analytics"
    : "Inquiry analytics (upgrade)",
  formatLimitValue(resolveLimitValue(plan.limits, ["leadChannels"]), "Included") === "Included"
    ? "Inquiry channels"
    : "Inquiry channels (upgrade)",
  formatLimitValue(resolveLimitValue(plan.limits, ["teamSectionTools", "teamToolsEnabled"]), "Not included") === "Included"
    ? "Team collaboration"
    : "Team collaboration (upgrade)",
  formatLimitValue(resolveLimitValue(plan.limits, ["customDomain"]), "Not included") === "Included"
    ? "Custom domain"
    : "Lensaya subdomain included",
  canRemoveBranding(plan) ? "Remove Lensaya branding" : "Lensaya branding shown",
];

const formatCompareValue = (planId: string, key: string, value: LimitValue | null) => {
  if (key === "customDomain") {
    if (value === true) return "Included";
    if (planId.toUpperCase() === "FREE") return "Lensaya subdomain";
    return "Not included";
  }
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Included" : "Not included";
  if (value < 0) return "Unlimited";
  return `${value}`;
};

const PUBLIC_COMPARE_ROWS: Array<{
  id: string;
  label: string;
  keys: readonly string[];
  primaryKey: string;
  formatter?: (plan: PlanWithLimits) => string;
}> = [
  { id: "services", label: "Service listings", keys: ["services"], primaryKey: "services" },
  {
    id: "portfolio-photos",
    label: "Portfolio photos",
    keys: ["portfolioPhotos", "portfolioImages"],
    primaryKey: "portfolioPhotos",
  },
  { id: "packages", label: "Package options", keys: ["packagesPerService", "packages"], primaryKey: "packagesPerService" },
  { id: "package-features", label: "Package highlights", keys: ["packageFeatures", "maxPackageFeatures"], primaryKey: "packageFeatures" },
  { id: "lead-history", label: "Inquiry history (days)", keys: ["leadHistoryDays"], primaryKey: "leadHistoryDays" },
  { id: "stored-inquiries", label: "Stored inquiries", keys: ["leadVisibilityLimit"], primaryKey: "leadVisibilityLimit" },
  { id: "quick-replies", label: "Quick reply templates", keys: ["leadTemplatesCount"], primaryKey: "leadTemplatesCount" },
  { id: "custom-domain", label: "Custom domain", keys: ["customDomain"], primaryKey: "customDomain" },
  {
    id: "branding",
    label: "Branding",
    keys: ["hideBrandingEnabled"],
    primaryKey: "branding",
    formatter: (plan) => (canRemoveBranding(plan) ? "Removable" : "Shown"),
  },
];

export const buildPublicComparisonRowsFromLimits = (plans: readonly PlanWithLimits[]) => {
  return PUBLIC_COMPARE_ROWS.map((row) => {
    const values: Record<string, string> = {};

    for (const plan of plans) {
      if (row.formatter) {
        values[plan.id] = row.formatter(plan);
        continue;
      }

      const rawValue = resolveLimitValue(plan.limits, row.keys);
      values[plan.id] = formatCompareValue(plan.id, row.primaryKey, rawValue);
    }

    return { id: row.id, label: row.label, values };
  });
};
