import { useEffect, useMemo, useState } from "react";
import { Eye, MessageCircle, MousePointerClick, Percent } from "lucide-react";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { analyticsApi, getApiErrorMessage, isApiAccessError } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { PREVIEW_BAR_WIDTHS, SOURCE_COLORS } from "./analytics/constants";
import { AnalyticsCategoryMomentumSection } from "./analytics/components/AnalyticsCategoryMomentumSection";
import { AnalyticsFunnelPerformanceSection } from "./analytics/components/AnalyticsFunnelPerformanceSection";
import { AnalyticsGoalTrackerSection } from "./analytics/components/AnalyticsGoalTrackerSection";
import { AnalyticsHeroSection } from "./analytics/components/AnalyticsHeroSection";
import { AnalyticsMetricsGrid } from "./analytics/components/AnalyticsMetricsGrid";
import { AnalyticsRecentActivitySection } from "./analytics/components/AnalyticsRecentActivitySection";
import { AnalyticsRangeAndAttributionSection } from "./analytics/components/AnalyticsRangeAndAttributionSection";
import { AnalyticsTrafficSection } from "./analytics/components/AnalyticsTrafficSection";
import { AnalyticsUnavailableState } from "./analytics/components/AnalyticsUnavailableState";
import { AnalyticsVisitorSourcesSection } from "./analytics/components/AnalyticsVisitorSourcesSection";
import type { ActivityPayload, MetricCardConfig, OverviewPayload, PreviewCategoryItem, SourcePreviewRow } from "./analytics/types";
import { formatNumber, formatPercent } from "./analytics/utils";

export default function Analytics() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [activitySnapshot, setActivitySnapshot] = useState<ActivityPayload | null>(null);
  const [windowDays, setWindowDays] = useState(30);
  const [sourceFilter, setSourceFilter] = useState("All");
  const [inquiryGoalTarget, setInquiryGoalTarget] = useState<number | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { error, success } = useToast();

  useEffect(() => {
    let mounted = true;

    const loadAnalytics = async () => {
      setLoading(true);
      setPageError(null);
      setActivityError(null);

      const [overviewResult, activityResult] = await Promise.allSettled([
        analyticsApi.overview({ windowDays }),
        analyticsApi.activity({ page: 1, limit: 12 }),
      ]);

      if (!mounted) return;

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value as OverviewPayload);
      } else {
        setOverview(null);
        if (!isApiAccessError(overviewResult.reason)) {
          setPageError(getApiErrorMessage(overviewResult.reason, "Failed to load analytics overview"));
        }
      }

      if (activityResult.status === "fulfilled") {
        setActivitySnapshot(activityResult.value as ActivityPayload);
      } else {
        setActivitySnapshot(null);
        if (!isApiAccessError(activityResult.reason)) {
          const nextActivityError = getApiErrorMessage(activityResult.reason, "Failed to load activity timeline");
          setActivityError(nextActivityError);
          error(nextActivityError);
        }
      }

      setLoading(false);
    };

    void loadAnalytics();

    return () => {
      mounted = false;
    };
  }, [error, windowDays]);

  const trafficData = useMemo(() => {
    const series = overview?.trafficSeries || [];
    return series.map((entry, index) => ({
      name: String(entry.name ?? entry.day ?? `Day ${index + 1}`),
      visits: Number(entry.visits ?? entry.views ?? entry.value ?? 0),
    }));
  }, [overview?.trafficSeries]);

  const visitorSourcesData = useMemo(() => {
    const series = overview?.sourceBreakdown || [];
    return series.map((entry, index) => ({
      name: String(entry.name ?? entry.source ?? `Source ${index + 1}`),
      value: Number(entry.value ?? entry.count ?? 0),
      color: SOURCE_COLORS[index % SOURCE_COLORS.length],
    }));
  }, [overview?.sourceBreakdown]);

  const categoryData = useMemo(
    () =>
      (overview?.categorySeries || []).map((category) => ({
        name: category.name,
        value: Number(category.views || 0),
      })),
    [overview?.categorySeries]
  );

  const weeklyTrafficTotal = useMemo(
    () => trafficData.reduce((total, item) => total + Number(item.visits || 0), 0),
    [trafficData]
  );

  const sourceFunnelBreakdown = useMemo(() => overview?.sourceFunnelBreakdown ?? [], [overview?.sourceFunnelBreakdown]);

  const sourceFilterOptions = useMemo(
    () => ["All", ...Array.from(new Set(sourceFunnelBreakdown.map((item) => item.source)))],
    [sourceFunnelBreakdown]
  );

  const activeSourceFilter = sourceFilterOptions.includes(sourceFilter) ? sourceFilter : "All";

  const filteredSourceFunnelBreakdown = useMemo(() => {
    if (activeSourceFilter === "All") return sourceFunnelBreakdown;
    return sourceFunnelBreakdown.filter((item) => item.source === activeSourceFilter);
  }, [activeSourceFilter, sourceFunnelBreakdown]);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading analytics..." />
      </DashboardLayout>
    );
  }

  if (!overview) {
    return (
      <DashboardLayout>
        <AnalyticsUnavailableState message={pageError || "Please try again shortly."} />
      </DashboardLayout>
    );
  }

  const hasFullAccess = Boolean(overview.access?.hasFullAccess);
  const upgradeTarget = overview.access?.upgradeTarget || "PRO";
  const trafficWindowDays = Number(overview.preview?.trafficWindowDays || 7);
  const metricsWindowDays = Number(overview.preview?.metricsWindowDays || 30);
  const contactActions = Number(overview.preview?.contactActions || 0);
  const topSource = overview.preview?.topSource || null;
  const sourceCount = Number(overview.preview?.sourceCount || 0);
  const previewCategories = (overview.preview?.topCategories || []) as PreviewCategoryItem[];
  const totalCategoriesTracked = Number(overview.preview?.totalCategoriesTracked || previewCategories.length);
  const hasTrafficData = trafficData.some((item) => item.visits > 0);
  const hasSourceData = visitorSourcesData.some((item) => item.value > 0);
  const hasCategoryData = categoryData.some((item) => item.value > 0);
  const activityItems = activitySnapshot?.items || [];
  const hiddenActivityCount = Number(activitySnapshot?.preview?.hiddenCount || 0);
  const funnel = {
    portfolioViews: Number(overview.funnel?.portfolioViews || overview.stats.portfolioViews || 0),
    packageViews: Number(overview.funnel?.packageViews || overview.stats.packageViews || 0),
    packageSelections: Number(overview.funnel?.packageSelections || overview.stats.packageSelections || 0),
    inquiries: Number(overview.funnel?.inquiries || overview.stats.inquiries || 0),
    whatsappClicks: Number(overview.funnel?.whatsappClicks || overview.stats.whatsappClicks || 0),
    viewToInquiryRate: overview.funnel?.viewToInquiryRate ?? overview.stats.conversionRate ?? null,
    selectionToInquiryRate: overview.funnel?.selectionToInquiryRate ?? overview.stats.inquiryRateFromSelections ?? null,
  };
  const servicePerformance = overview.servicePerformance || [];
  const packagePerformance = overview.packagePerformance || [];
  const comparison = overview.comparison || null;
  const goalTracker = overview.goalTracker || null;
  const activeInquiryGoal = Math.max(1, Math.floor(inquiryGoalTarget || goalTracker?.savedGoalTarget || goalTracker?.suggestedGoal || 1));

  const handleExportAnalyticsCsv = () => {
    if (!hasFullAccess) return;

    const escapeCsvCell = (value: string | number | null | undefined) => {
      const normalized = String(value ?? "");
      return `"${normalized.replace(/"/g, '""')}"`;
    };

    const addCsvRow = (section: string, metric: string, value: string | number | null | undefined) => {
      rows.push([section, metric, value].map((cell) => escapeCsvCell(cell)).join(","));
    };

    const rows: string[] = [];
    rows.push("Section,Metric,Value");
    addCsvRow("Funnel", "Portfolio Views", funnel.portfolioViews);
    addCsvRow("Funnel", "Package Views", funnel.packageViews);
    addCsvRow("Funnel", "Package Selections", funnel.packageSelections);
    addCsvRow("Funnel", "Inquiries", funnel.inquiries);
    addCsvRow("Funnel", "WhatsApp Clicks", funnel.whatsappClicks);
    addCsvRow("Funnel", "View to Inquiry Rate", funnel.viewToInquiryRate ?? 0);
    addCsvRow("Funnel", "Selection to Inquiry Rate", funnel.selectionToInquiryRate ?? 0);

    if (comparison) {
      addCsvRow("Comparison", "Portfolio Views Change %", comparison.portfolioViews.changePercent);
      addCsvRow("Comparison", "Package Views Change %", comparison.packageViews.changePercent);
      addCsvRow("Comparison", "Package Selections Change %", comparison.packageSelections.changePercent);
      addCsvRow("Comparison", "Inquiries Change %", comparison.inquiries.changePercent);
      addCsvRow("Comparison", "WhatsApp Clicks Change %", comparison.whatsappClicks.changePercent);
    }

    servicePerformance.forEach((item) => {
      addCsvRow("Service Performance", `${item.name} - Inquiries`, item.inquiries);
      addCsvRow("Service Performance", `${item.name} - Conversion Rate`, item.conversionRate);
    });

    packagePerformance.forEach((item) => {
      addCsvRow("Package Performance", `${item.name} - Package Views`, item.packageViews);
      addCsvRow("Package Performance", `${item.name} - Selections`, item.packageSelections);
      addCsvRow("Package Performance", `${item.name} - Inquiry Rate`, item.inquiryRate);
    });

    filteredSourceFunnelBreakdown.forEach((item) => {
      addCsvRow("Source Funnel", `${item.source} - Portfolio Views`, item.portfolioViews);
      addCsvRow("Source Funnel", `${item.source} - Inquiries`, item.inquiries);
      addCsvRow("Source Funnel", `${item.source} - View to Inquiry Rate`, item.viewToInquiryRate);
    });

    if (goalTracker) {
      const remaining = Math.max(activeInquiryGoal - goalTracker.inquiriesMonthToDate, 0);
      const requiredDailyRate = remaining > 0
        ? Number((remaining / Math.max(goalTracker.daysRemainingInMonth, 1)).toFixed(2))
        : 0;

      addCsvRow("Goal Tracker", "Month", goalTracker.monthLabel);
      addCsvRow("Goal Tracker", "Inquiries MTD", goalTracker.inquiriesMonthToDate);
      addCsvRow("Goal Tracker", "Goal Target", activeInquiryGoal);
      addCsvRow("Goal Tracker", "Projected Inquiries", goalTracker.projectedInquiries);
      addCsvRow("Goal Tracker", "Current Daily Pace", goalTracker.currentDailyPace);
      addCsvRow("Goal Tracker", "Required Daily Pace", requiredDailyRate);
      addCsvRow("Goal Tracker", "Current Streak (months)", goalTracker.streak.current);
      addCsvRow("Goal Tracker", "Best Streak (months)", goalTracker.streak.best);
      addCsvRow("Goal Tracker", "Months Achieved", goalTracker.streak.totalMonthsAchieved);

      goalTracker.badges.forEach((badge) => {
        addCsvRow("Goal Badges", badge.label, badge.earned ? "earned" : "locked");
      });

      goalTracker.history.forEach((item) => {
        addCsvRow("Goal History", `${item.monthLabel} - Inquiries`, item.inquiries);
        addCsvRow("Goal History", `${item.monthLabel} - Target`, item.target);
        addCsvRow("Goal History", `${item.monthLabel} - Attainment %`, item.attainmentPercent);
      });
    }

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lensaya-analytics-${windowDays}d.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const trackUpgradeIntent = async (surface: string) => {
    if (!overview.photographerId) return;

    try {
      await analyticsApi.track({
        eventType: "OTHER",
        photographerId: overview.photographerId,
        source: "dashboard",
        metadata: {
          kind: "analytics_upgrade_cta",
          surface,
          targetPlan: upgradeTarget,
          tier: overview.access?.tier || "FREE",
        },
      });
    } catch {
      // Upgrade tracking should never block navigation.
    }
  };

  const trackInsightAction = async (action: "improve_portfolio_experience" | "refine_service_setup" | "optimize_packages") => {
    if (!overview.photographerId) return;

    try {
      await analyticsApi.track({
        eventType: "OTHER",
        photographerId: overview.photographerId,
        source: "dashboard",
        metadata: {
          kind: "analytics_insight_action_click",
          action,
          windowDays,
          sourceFilter: activeSourceFilter,
          tier: overview.access?.tier || "FREE",
        },
      });
    } catch {
      // Insight click tracking should never block navigation.
    }
  };

  const handleSaveInquiryGoal = async (nextGoal: number) => {
    if (!hasFullAccess || !goalTracker) return;

    const normalizedGoal = Math.max(1, Math.floor(Number(nextGoal || 1)));
    setGoalSaving(true);
    try {
      const result = await analyticsApi.setGoal({ inquiryGoalTarget: normalizedGoal });
      const savedTarget = Math.max(1, Math.floor(Number(result?.inquiryGoalTarget || normalizedGoal)));
      setInquiryGoalTarget(savedTarget);
      setOverview((current) => {
        if (!current || !current.goalTracker) return current;
        return {
          ...current,
          goalTracker: {
            ...current.goalTracker,
            savedGoalTarget: savedTarget,
          },
        };
      });
      success("Inquiry goal saved");
    } catch (saveError) {
      error(getApiErrorMessage(saveError, "Failed to save inquiry goal"));
    } finally {
      setGoalSaving(false);
    }
  };

  const heroTitle = hasFullAccess
    ? "Know what turns portfolio traffic into inquiries"
    : weeklyTrafficTotal > 0 || contactActions > 0
      ? "People are already discovering your work"
      : "Your traffic pulse starts here";

  const heroDescription = hasFullAccess
    ? `Track the last ${metricsWindowDays} days across traffic, visitor quality, source performance, category momentum, and inquiry conversion.`
    : weeklyTrafficTotal > 0 || contactActions > 0
      ? `In the last ${metricsWindowDays} days, your portfolio generated ${formatNumber(overview.stats.portfolioViews)} portfolio views and ${formatNumber(contactActions)} contact actions. Upgrade to ${upgradeTarget} to see which sources and categories are creating that momentum.`
      : `Free already shows your live ${trafficWindowDays}-day traffic pulse. Upgrade to ${upgradeTarget} to see which channels, categories, and actions are most likely to turn attention into conversations.`;

  const sourcePreviewRows: SourcePreviewRow[] = topSource
    ? [
        { label: topSource, width: PREVIEW_BAR_WIDTHS[0], visible: true },
        { label: sourceCount > 1 ? `${sourceCount - 1} more channels hidden` : `More source detail on ${upgradeTarget}`, width: PREVIEW_BAR_WIDTHS[1], visible: false },
        { label: "Exact percentages locked", width: PREVIEW_BAR_WIDTHS[2], visible: false },
      ]
    : [
        { label: "Traffic source will appear here", width: PREVIEW_BAR_WIDTHS[0], visible: false },
        { label: `${upgradeTarget} unlocks full source reporting`, width: PREVIEW_BAR_WIDTHS[1], visible: false },
      ];

  const metrics: MetricCardConfig[] = [
    {
      title: "Portfolio Views",
      value: formatNumber(overview.stats.portfolioViews),
      description: `Photo-level attention captured in the last ${metricsWindowDays} days.`,
      icon: Eye,
      iconWrapClass: "bg-cyan-50",
      iconClass: "text-cyan-600",
    },
    {
      title: "WhatsApp Clicks",
      value: formatNumber(overview.stats.whatsappClicks),
      description: "Visitors who moved from browsing into direct conversation.",
      icon: MessageCircle,
      iconWrapClass: "bg-blue-50",
      iconClass: "text-blue-600",
    },
    {
      title: "Inquiries",
      value: formatNumber(overview.stats.inquiries),
      description: "High-intent actions captured from your inquiry flow.",
      icon: MousePointerClick,
      iconWrapClass: "bg-emerald-50",
      iconClass: "text-emerald-600",
    },
  ];

  if (hasFullAccess) {
    metrics.push({
      title: "Conversion Rate",
      value: formatPercent(overview.stats.conversionRate),
      description: "How efficiently portfolio interest turns into inquiries.",
      icon: Percent,
      iconWrapClass: "bg-violet-50",
      iconClass: "text-violet-600",
    });
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl">
      <AnalyticsHeroSection
        data={{
          hasFullAccess,
          tier: overview.access?.tier || "FREE",
          upgradeTarget,
          heroTitle,
          heroDescription,
          trafficWindowDays,
          metricsWindowDays,
          weeklyTrafficTotal,
          contactActions,
          monthlyVisitors: overview.stats.monthlyVisitors,
        }}
        actions={{
          onUpgradeClick: (surface) => {
            void trackUpgradeIntent(surface);
          },
        }}
      />

      <AnalyticsMetricsGrid
        data={{
          metrics,
          hasFullAccess,
          upgradeTarget,
        }}
        actions={{
          onUpgradeClick: (surface) => {
            void trackUpgradeIntent(surface);
          },
        }}
      />

      <AnalyticsTrafficSection
        data={{
          hasFullAccess,
          trafficWindowDays,
          weeklyTrafficTotal,
          hasTrafficData,
          trafficData,
          upgradeTarget,
        }}
        actions={{
          onUpgradeClick: (surface) => {
            void trackUpgradeIntent(surface);
          },
        }}
      />

      <div className="mb-6 grid gap-4 md:mb-8 md:gap-6 xl:grid-cols-2">
        <AnalyticsVisitorSourcesSection
          data={{
            hasFullAccess,
            hasSourceData,
            visitorSourcesData,
            upgradeTarget,
            topSource,
            sourceCount,
            sourcePreviewRows,
          }}
          actions={{
            onUpgradeClick: (surface) => {
              void trackUpgradeIntent(surface);
            },
          }}
        />

        <AnalyticsCategoryMomentumSection
          data={{
            hasFullAccess,
            hasCategoryData,
            categoryData,
            previewCategories,
            totalCategoriesTracked,
            upgradeTarget,
          }}
          actions={{
            onUpgradeClick: (surface) => {
              void trackUpgradeIntent(surface);
            },
          }}
        />
      </div>

      <AnalyticsFunnelPerformanceSection
        data={{
          hasFullAccess,
          upgradeTarget,
          funnel,
          servicePerformance,
          packagePerformance,
          comparison,
        }}
        actions={{
          onUpgradeClick: (surface) => {
            void trackUpgradeIntent(surface);
          },
          onInsightActionClick: (action) => {
            void trackInsightAction(action);
          },
        }}
      />

      <AnalyticsGoalTrackerSection
        data={{
          hasFullAccess,
          upgradeTarget,
          goalTracker,
          activeGoal: activeInquiryGoal,
        }}
        actions={{
          onGoalChange: (nextGoal) => {
            setInquiryGoalTarget(nextGoal);
          },
          onGoalSave: (nextGoal) => {
            void handleSaveInquiryGoal(nextGoal);
          },
          saving: goalSaving,
          onUpgradeClick: (surface) => {
            void trackUpgradeIntent(surface);
          },
        }}
      />

      <AnalyticsRangeAndAttributionSection
        data={{
          hasFullAccess,
          upgradeTarget,
          selectedWindowDays: windowDays,
          comparison,
          sourceFunnelBreakdown: filteredSourceFunnelBreakdown,
          sourceFilter: activeSourceFilter,
          sourceFilterOptions,
        }}
        actions={{
          onWindowChange: (nextWindowDays) => {
            setWindowDays(nextWindowDays);
            setSourceFilter("All");
          },
          onSourceFilterChange: (source) => {
            setSourceFilter(source);
          },
          onExportCsv: handleExportAnalyticsCsv,
          onUpgradeClick: (surface) => {
            void trackUpgradeIntent(surface);
          },
        }}
      />

      <AnalyticsRecentActivitySection
        data={{
          hasFullAccess,
          upgradeTarget,
          activityError,
          activityItems,
          hiddenActivityCount,
        }}
        actions={{
          onUpgradeClick: (surface) => {
            void trackUpgradeIntent(surface);
          },
        }}
      />
      </div>
    </DashboardLayout>
  );
}
