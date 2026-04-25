import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { analyticsApi, billingApi, dashboardApi, getApiErrorMessage, isApiAccessError } from "../../lib/api";
import { buildPublicStudioHost, toAbsoluteWebsiteUrl } from "../../lib/platform";
import { buildPortfolioShareMessage } from "../../lib/share";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { useEntitlements } from "../../hooks/useEntitlements";
import { usePricingContent } from "../../hooks/usePricingContent";
import { PLAN_ORDER, QUICK_ACTIONS, REFERRAL_PROMPT_DISMISS_KEY } from "./dashboard-overview/constants";
import { OverviewPageHeader } from "./dashboard-overview/components/OverviewPageHeader";
import { OverviewStatsGrid } from "./dashboard-overview/components/OverviewStatsGrid";
import { PlanUsageSection } from "./dashboard-overview/components/PlanUsageSection";
import { QuickActionsSection } from "./dashboard-overview/components/QuickActionsSection";
import { ReferralPromptCard } from "./dashboard-overview/components/ReferralPromptCard";
import { TrafficAndCategorySection } from "./dashboard-overview/components/TrafficAndCategorySection";
import { WebsiteSection } from "./dashboard-overview/components/WebsiteSection";
import type { OverviewResponse, PlanCatalogItem, PreviewCategoryItem, UsageCard, WebsiteSummary } from "./dashboard-overview/types";
import { formatUsageLimit, isUnlimited, normalizePlanId, toUsagePercent } from "./dashboard-overview/utils";
import { resolveUsagePrompt } from "../../lib/pricingContent";

export default function DashboardOverview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [planCatalog, setPlanCatalog] = useState<PlanCatalogItem[]>([]);
  const [sectionErrors, setSectionErrors] = useState<{
    overview: string | null;
    website: string | null;
  }>({
    overview: null,
    website: null,
  });
  const [showReferralPrompt, setShowReferralPrompt] = useState(true);
  const [loading, setLoading] = useState(true);

  const { success, error } = useToast();
  const { user } = useAuth();
  const { entitlementUpgradeTarget } = useEntitlements();
  const pricingContent = usePricingContent();
  const username = user?.username || "";
  const websiteUrl = website?.websiteUrl || buildPublicStudioHost(username);
  const websiteLink = toAbsoluteWebsiteUrl(websiteUrl);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setShowReferralPrompt(window.localStorage.getItem(REFERRAL_PROMPT_DISMISS_KEY) !== "1");
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      setLoading(true);
      try {
        const [overviewResult, websiteResult] = await Promise.allSettled([
          dashboardApi.overview(),
          dashboardApi.websiteSummary(),
        ]);

        if (!mounted) return;

        const nextErrors: {
          overview: string | null;
          website: string | null;
        } = {
          overview: null,
          website: null,
        };

        if (overviewResult.status === "fulfilled") {
          setOverview(overviewResult.value as OverviewResponse);
        } else {
          setOverview(null);
          nextErrors.overview = getApiErrorMessage(overviewResult.reason, "Failed to load overview");
        }

        if (websiteResult.status === "fulfilled") {
          setWebsite(websiteResult.value as WebsiteSummary);
        } else {
          setWebsite(null);
          nextErrors.website = getApiErrorMessage(websiteResult.reason, "Failed to load website summary");
        }

        setSectionErrors(nextErrors);

        const failedSections = [nextErrors.overview ? "overview" : null, nextErrors.website ? "website" : null].filter(Boolean);
        const hasAccessError =
          (overviewResult.status === "rejected" && isApiAccessError(overviewResult.reason)) ||
          (websiteResult.status === "rejected" && isApiAccessError(websiteResult.reason));

        if (failedSections.length > 0 && !hasAccessError) {
          error(`Some dashboard sections could not be loaded: ${failedSections.join(", ")}`);
        }
      } catch (err) {
        if (!mounted) return;
        setOverview(null);
        setWebsite(null);
        setSectionErrors({
          overview: "Failed to load overview",
          website: "Failed to load website summary",
        });
        if (!isApiAccessError(err)) {
          error(getApiErrorMessage(err, "Failed to load dashboard data"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOverview();

    return () => {
      mounted = false;
    };
  }, [error]);

  useEffect(() => {
    let mounted = true;

    const loadPlanCatalog = async () => {
      try {
        const result = await billingApi.plans();
        if (!mounted) return;
        const plans = ((result as { plans?: PlanCatalogItem[] }).plans || []) as PlanCatalogItem[];
        setPlanCatalog(plans);
      } catch {
        if (mounted) {
          setPlanCatalog([]);
        }
      }
    };

    void loadPlanCatalog();

    return () => {
      mounted = false;
    };
  }, []);

  const trafficData = useMemo(() => overview?.trafficSeries || [], [overview]);

  const categoryData = useMemo(
    () =>
      (overview?.categorySeries || []).map((category) => ({
        name: category.name,
        value: Number(category.views || 0),
      })),
    [overview?.categorySeries]
  );

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(websiteLink);
      success("Website link copied");
    } catch {
      error("Failed to copy website link");
    }
  };

  const handleShareLink = async () => {
    const shareMessage = buildPortfolioShareMessage(websiteLink);

    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Lensaya Website",
          text: shareMessage,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareMessage);
      success("Share message copied.");
    } catch {
      error("Failed to share website link");
    }
  };

  const hasFullAnalyticsAccess = Boolean(overview?.analyticsAccess?.hasFullAccess);
  const analyticsUpgradeTarget = overview?.analyticsAccess?.upgradeTarget || entitlementUpgradeTarget;
  const previewCategories = (overview?.analyticsPreview?.topCategories || []) as PreviewCategoryItem[];
  const totalCategoriesTracked = Number(overview?.analyticsPreview?.totalCategoriesTracked || previewCategories.length);
  const hasCategoryData = categoryData.some((category) => category.value > 0);

  const trackAnalyticsUpgradeIntent = async (surface: string) => {
    if (!overview?.photographerId) return;

    try {
      await analyticsApi.track({
        eventType: "OTHER",
        photographerId: overview.photographerId,
        source: "dashboard",
        metadata: {
          kind: "analytics_upgrade_cta",
          surface,
          targetPlan: analyticsUpgradeTarget,
          tier: overview.analyticsAccess?.tier || overview.plan?.name || "FREE",
        },
      });
    } catch {
      // Upgrade tracking should never block navigation.
    }
  };

  const planById = useMemo(
    () =>
      new Map(
        planCatalog
          .filter((plan) => Boolean(plan.id))
          .map((plan) => [normalizePlanId(plan.id), plan])
      ),
    [planCatalog]
  );

  const usageCards = useMemo<UsageCard[]>(() => {
    const usage = overview?.usage;
    if (!usage) return [];

    const currentPlanId = normalizePlanId(overview?.plan?.name);
    const currentPlanRank = PLAN_ORDER.indexOf(currentPlanId as (typeof PLAN_ORDER)[number]);

    const resolvePlanLimit = (planId: string, keys: string[]) => {
      const plan = planById.get(normalizePlanId(planId));
      if (!plan) return null;
      for (const key of keys) {
        const value = plan.limits?.[key];
        if (typeof value === "number") {
          return value;
        }
      }
      return null;
    };

    const findUpgradeTarget = (keys: string[], currentLimit: number) => {
      if (isUnlimited(currentLimit)) return null;
      for (const planId of PLAN_ORDER) {
        const rank = PLAN_ORDER.indexOf(planId);
        if (rank <= currentPlanRank) continue;
        const nextLimit = resolvePlanLimit(planId, keys);
        if (nextLimit === null) continue;
        if (isUnlimited(nextLimit) || nextLimit > currentLimit) {
          return { planId, limit: nextLimit };
        }
      }
      return null;
    };

    const toPlanBenefitRows = (targetPlanId: string, metricLabel: string, nextLimitLabel: string) => {
      const currentPlan = planById.get(currentPlanId);
      const targetPlan = planById.get(normalizePlanId(targetPlanId));
      if (!targetPlan) return [];

      const benefitRows: string[] = [`${metricLabel}: ${nextLimitLabel}`];
      const featureDiffs: Array<{ key: string; label: string }> = [
        { key: "analyticsTools", label: "Insights dashboard" },
        { key: "leadFiltersEnabled", label: "Inquiry filters" },
        { key: "leadRemindersEnabled", label: "Follow-up reminders" },
        { key: "teamSectionTools", label: "Team collaboration" },
        { key: "hideBrandingEnabled", label: "Remove Lensaya branding" },
      ];

      for (const feature of featureDiffs) {
        const currentValue = Boolean(currentPlan?.limits?.[feature.key] ?? currentPlan?.features?.[feature.key]);
        const nextValue = Boolean(targetPlan?.limits?.[feature.key] ?? targetPlan?.features?.[feature.key]);
        if (!currentValue && nextValue) {
          benefitRows.push(`${feature.label}: Included`);
        }
      }

      return benefitRows;
    };

    const packagePerServiceUsage = usage.packagesPerService || usage.packages;
    const metrics = [
      {
        id: "photos",
        label: "Portfolio capacity",
        used: Number(usage.portfolioImages?.used || 0),
        limit: Number(usage.portfolioImages?.limit || 0),
        unit: "images",
        planLimitKeys: ["portfolioPhotos", "portfolioImages"],
        suggestionNoun: "images",
        context: null as string | null,
      },
      {
        id: "services",
        label: "Service listings",
        used: Number(usage.services?.used || 0),
        limit: Number(usage.services?.limit || 0),
        unit: "listings",
        planLimitKeys: ["services"],
        suggestionNoun: "service listings",
        context: null as string | null,
      },
      {
        id: "packages-per-service",
        label: "Package options",
        used: Number(packagePerServiceUsage?.used || 0),
        limit: Number(packagePerServiceUsage?.limit || 0),
        unit: "options",
        planLimitKeys: ["packagesPerService", "packages"],
        suggestionNoun: "package options",
        context: usage.packagesPerService?.serviceName
          ? `Most loaded service: ${usage.packagesPerService.serviceName}`
          : null,
      },
      {
        id: "storage",
        label: "Storage",
        used: Number(usage.storage?.used || 0),
        limit: Number(usage.storage?.limit || 0),
        unit: "GB",
        planLimitKeys: ["storage", "storageGb"],
        suggestionNoun: "GB",
        context: null as string | null,
      },
      {
        id: "stored-inquiries",
        label: "Stored inquiries",
        used: Number(usage.leads?.used || 0),
        limit: Number(usage.leads?.limit || 0),
        unit: "inquiries",
        planLimitKeys: ["leadVisibilityLimit"],
        suggestionNoun: "stored inquiries",
        context: null as string | null,
      },
    ];

    return metrics.map((metric) => {
      const percent = toUsagePercent(metric.used, metric.limit);
      const ratio = isUnlimited(metric.limit) || metric.limit <= 0 ? 0 : metric.used / metric.limit;
      const remaining = isUnlimited(metric.limit) ? null : Math.max(0, Number((metric.limit - metric.used).toFixed(3)));
      const status = isUnlimited(metric.limit)
        ? "unlimited"
        : ratio >= 1
          ? "critical"
          : ratio >= 0.9
            ? "warning"
            : "normal";
      const suggestion = findUpgradeTarget(metric.planLimitKeys, metric.limit);

      const nearLimit = !isUnlimited(metric.limit) && (ratio >= 0.7 || remaining === 0);
      const remainingLabel =
        remaining === null
          ? "Unlimited"
          : metric.unit === "GB"
            ? `${remaining.toFixed(2)} GB`
            : `${Math.floor(remaining)} ${metric.suggestionNoun}`;

      let suggestionText: string | null = null;
      let unlockValueLabel: string | null = null;
      let comparisonBenefits: string[] = [];
      if ((status === "critical" || status === "warning" || nearLimit) && suggestion) {
        const nextLimitLabel = formatUsageLimit(suggestion.limit, metric.unit);
        suggestionText = resolveUsagePrompt(pricingContent, status === "critical" ? "blocked" : "warning", {
          plan: suggestion.planId,
          nextPlan: suggestion.planId,
          limit: nextLimitLabel,
          metric: metric.label,
        });
        unlockValueLabel = `${metric.label}: ${nextLimitLabel}`;
        comparisonBenefits = toPlanBenefitRows(suggestion.planId, metric.label, nextLimitLabel);
      }

      return {
        ...metric,
        remaining,
        remainingLabel,
        nearLimit,
        percent,
        status,
        suggestionText,
        upgradeTarget: suggestion?.planId || null,
        unlockValueLabel,
        comparisonBenefits,
      };
    });
  }, [overview, planById, pricingContent]);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading dashboard..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <OverviewPageHeader />

      {sectionErrors.overview ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Overview metrics are temporarily unavailable.
        </div>
      ) : null}

      {showReferralPrompt ? (
        <ReferralPromptCard
          onDismiss={() => {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(REFERRAL_PROMPT_DISMISS_KEY, "1");
            }
            setShowReferralPrompt(false);
          }}
        />
      ) : null}

      <OverviewStatsGrid stats={overview?.stats} />

      <PlanUsageSection
        usageCards={usageCards}
        currentPlan={overview?.plan?.name || user?.plan || "FREE"}
        photographerId={overview?.photographerId || null}
      />

      <TrafficAndCategorySection
        data={{
          trafficData,
          categoryData,
          hasFullAnalyticsAccess,
          analyticsUpgradeTarget,
          previewCategories,
          totalCategoriesTracked,
          hasCategoryData,
        }}
        actions={{
          onTrackUpgradeIntent: (surface) => {
            void trackAnalyticsUpgradeIntent(surface);
          },
        }}
      />

      <WebsiteSection
        data={{
          websiteLink,
          websiteError: sectionErrors.website,
        }}
        actions={{
          onCopyLink: () => {
            void handleCopyLink();
          },
          onShareLink: () => {
            void handleShareLink();
          },
        }}
      />

      <QuickActionsSection quickActions={QUICK_ACTIONS} />
    </DashboardLayout>
  );
}
