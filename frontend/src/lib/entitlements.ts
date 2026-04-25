export type PlanName = "FREE" | "PRO" | "STUDIO";

export const normalizePlanName = (value: string | null | undefined, fallback: PlanName = "FREE"): PlanName => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "FREE" || normalized === "PRO" || normalized === "STUDIO") {
    return normalized;
  }
  return fallback;
};

export const toPlanLabel = (plan: string | null | undefined) => {
  const normalized = normalizePlanName(plan);
  if (normalized === "FREE") return "Free";
  if (normalized === "PRO") return "Pro";
  return "Studio";
};

export const getDefaultUpgradeTarget = (currentPlan: string | null | undefined): PlanName => {
  const normalized = normalizePlanName(currentPlan);
  if (normalized === "FREE") return "PRO";
  return "STUDIO";
};

export const getReferralRewardMessage = (currentPlan: string | null | undefined) => {
  const normalized = normalizePlanName(currentPlan);
  if (normalized === "PRO") {
    return "When someone signs up with your link, they'll get a 14-day free Pro trial. You'll instantly get 14 extra days on your Pro plan.";
  }
  if (normalized === "STUDIO") {
    return "When someone signs up with your link, they'll get a 14-day free Pro trial. You'll instantly get 14 extra days on your Studio plan.";
  }
  return "When someone signs up with your link, they'll get a 14-day free Pro trial. You'll instantly unlock a 7-day Pro trial.";
};

export const getBrandingUpgradeMessage = (upgradeTarget: string | null | undefined) => {
  return `Upgrade to ${toPlanLabel(upgradeTarget)} to remove branding.`;
};
