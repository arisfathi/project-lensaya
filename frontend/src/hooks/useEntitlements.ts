import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getDefaultUpgradeTarget, normalizePlanName, toPlanLabel, type PlanName } from "../lib/entitlements";

export function useEntitlements() {
  const { user } = useAuth();

  return useMemo(() => {
    const currentPlan = normalizePlanName(user?.plan);
    const fallbackUpgradeTarget = getDefaultUpgradeTarget(currentPlan);

    const leadUpgradeTarget = normalizePlanName(user?.leadFeatures?.upgradeTarget, fallbackUpgradeTarget);
    const entitlementUpgradeTarget = normalizePlanName(
      user?.entitlements?.upgradeTarget,
      fallbackUpgradeTarget
    );

    const resolveUpgradeTarget = (...targets: Array<string | null | undefined>) => {
      for (const target of targets) {
        const normalized = String(target || "").trim().toUpperCase();
        if (normalized === "FREE" || normalized === "PRO" || normalized === "STUDIO") {
          return normalized as PlanName;
        }
      }
      return fallbackUpgradeTarget;
    };

    return {
      currentPlan,
      currentPlanLabel: toPlanLabel(currentPlan),
      isFreePlan: currentPlan === "FREE",
      fallbackUpgradeTarget,
      leadUpgradeTarget,
      entitlementUpgradeTarget,
      resolveUpgradeTarget,
      features: {
        teamToolsEnabled: Boolean(user?.planFeatures?.teamSectionTools),
        hideBrandingEnabled: Boolean(user?.planFeatures?.hideBrandingEnabled),
        customDomainEnabled: Boolean(user?.planFeatures?.customDomainEnabled),
        analyticsEnabled: Boolean(user?.planFeatures?.analyticsEnabled),
      },
      leadFeatures: {
        filters: Boolean(user?.leadFeatures?.filters),
        export: Boolean(user?.leadFeatures?.export),
        reminders: Boolean(user?.leadFeatures?.reminders),
        whatsapp: Boolean(user?.leadFeatures?.channels?.whatsapp),
        email: Boolean(user?.leadFeatures?.channels?.email),
      },
      entitlements: user?.entitlements,
    };
  }, [user]);
}
