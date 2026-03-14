import { useEffect, useMemo, useState } from "react";
import { Eye, MessageCircle, Percent, MousePointerClick, Plus, ExternalLink, Copy, Share2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { ApiClientError, analyticsApi, billingApi, dashboardApi, getApiErrorMessage } from "../../lib/api";
import { buildPublicStudioHost, toAbsoluteWebsiteUrl } from "../../lib/platform";
import { buildPortfolioShareMessage } from "../../lib/share";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";

type OverviewResponse = {
  stats: {
    portfolioViews: number;
    whatsappClicks: number;
    inquiries: number;
    conversionRate: number;
    profileClicks?: number;
    monthlyTraffic?: number;
  };
  trafficSeries: Array<{ name: string; views: number }>;
  categorySeries: Array<{ name: string; views: number }>;
  quickCounts: {
    portfolioCount: number;
    serviceCount: number;
    packageCount: number;
    bookingCount: number;
  };
  plan?: {
    name: string;
    price: number;
    currency: string;
    trialDays: number;
  };
  usage?: {
    services: { used: number; limit: number };
    packages: { used: number; limit: number };
    packagesPerService?: {
      used: number;
      limit: number;
      serviceId?: string | null;
      serviceName?: string | null;
      servicesAtLimit?: number;
    };
    portfolioImages: { used: number; limit: number };
  };
};

type WebsiteSummary = {
  websiteUrl: string;
  portfolioCount: number;
  serviceCount: number;
  packageCount: number;
  lastUpdated: string;
};

type CategoryItem = {
  name: string;
  views: number;
};

type PlanCatalogItem = {
  id: string;
  limits: Record<string, number | boolean>;
};

const formatNumber = (value: number) => Number(value || 0).toLocaleString();
const PLAN_ORDER = ["FREE", "PRO", "STUDIO"] as const;
const normalizePlanId = (value: string | null | undefined) => String(value || "FREE").trim().toUpperCase();
const isUnlimited = (value: number) => Number(value) < 0;
const toUsagePercent = (used: number, limit: number) => {
  if (isUnlimited(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
};
const formatUsageLimit = (limit: number, unit?: string) => {
  if (isUnlimited(limit)) return "Unlimited";
  return unit ? `${limit} ${unit}` : `${limit}`;
};

const quickActions = [
  {
    name: "Add Service",
    description: "Create new service",
    color: "bg-blue-500",
    path: "/dashboard/services?new=1",
  },
  {
    name: "Add Package",
    description: "Define pricing package",
    color: "bg-purple-500",
    path: "/dashboard/packages?new=1",
  },
  {
    name: "Upload Portfolio Image",
    description: "Add new portfolio photo",
    color: "bg-cyan-500",
    path: "/dashboard/portfolio?new=1",
  },
  {
    name: "Edit Profile",
    description: "Update studio profile",
    color: "bg-green-500",
    path: "/dashboard/settings",
  },
  {
    name: "Upgrade Plan",
    description: "Unlock advanced limits",
    color: "bg-slate-900",
    path: "/dashboard/pricing",
  },
];

export default function DashboardOverview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [planCatalog, setPlanCatalog] = useState<PlanCatalogItem[]>([]);
  const [sectionErrors, setSectionErrors] = useState<{
    overview: string | null;
    website: string | null;
    categories: string | null;
  }>({
    overview: null,
    website: null,
    categories: null,
  });
  const [categoriesAccessMessage, setCategoriesAccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { success, error } = useToast();
  const { user } = useAuth();
  const username = user?.username || "";
  const websiteUrl = website?.websiteUrl || buildPublicStudioHost(username);
  const websiteLink = toAbsoluteWebsiteUrl(websiteUrl);

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      setLoading(true);
      try {
        const [overviewResult, websiteResult, categoriesResult, plansResult] = await Promise.allSettled([
          dashboardApi.overview(),
          dashboardApi.websiteSummary(),
          analyticsApi.categories(),
          billingApi.plans(),
        ]);

        if (!mounted) return;

        const nextErrors: {
          overview: string | null;
          website: string | null;
          categories: string | null;
        } = {
          overview: null,
          website: null,
          categories: null,
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

        if (categoriesResult.status === "fulfilled") {
          setCategories(((categoriesResult.value as { categories?: CategoryItem[] }).categories || []) as CategoryItem[]);
          setCategoriesAccessMessage(null);
        } else {
          setCategories([]);
          if (categoriesResult.reason instanceof ApiClientError && categoriesResult.reason.status === 403) {
            setCategoriesAccessMessage(
              getApiErrorMessage(categoriesResult.reason, "Category analytics are available on Pro and Studio plans.")
            );
            nextErrors.categories = null;
          } else {
            setCategoriesAccessMessage(null);
            nextErrors.categories = getApiErrorMessage(categoriesResult.reason, "Failed to load categories");
          }
        }

        if (plansResult && plansResult.status === "fulfilled") {
          const plans = ((plansResult.value as { plans?: PlanCatalogItem[] }).plans || []) as PlanCatalogItem[];
          setPlanCatalog(plans);
        } else {
          setPlanCatalog([]);
        }

        setSectionErrors(nextErrors);

        const failedSections = [
          nextErrors.overview ? "overview" : null,
          nextErrors.website ? "website" : null,
          nextErrors.categories ? "categories" : null,
        ].filter(Boolean);

        if (failedSections.length > 0) {
          error(`Some dashboard sections could not be loaded: ${failedSections.join(", ")}`);
        }
      } catch (err) {
        if (!mounted) return;
        setOverview(null);
        setWebsite(null);
        setCategories([]);
        setCategoriesAccessMessage(null);
        setSectionErrors({
          overview: "Failed to load overview",
          website: "Failed to load website summary",
          categories: "Failed to load categories",
        });
        error(getApiErrorMessage(err, "Failed to load dashboard data"));
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

  const trafficData = useMemo(
    () => overview?.trafficSeries || [],
    [overview]
  );

  const categoryData = useMemo(
    () =>
      categories.map((category) => ({
        name: category.name,
        value: Number(category.views || 0),
      })),
    [categories]
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

  const stats = [
    {
      name: "Portfolio Views",
      value: formatNumber(overview?.stats.portfolioViews || 0),
      icon: Eye,
      bgColor: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
    {
      name: "WhatsApp Clicks",
      value: formatNumber(overview?.stats.whatsappClicks || 0),
      icon: MessageCircle,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      name: "Inquiries",
      value: formatNumber(overview?.stats.inquiries || 0),
      icon: MousePointerClick,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      name: "Conversion Rate",
      value: `${Number(overview?.stats.conversionRate || 0).toFixed(2)}%`,
      icon: Percent,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-500",
    },
  ];

  const planById = useMemo(
    () =>
      new Map(
        planCatalog
          .filter((plan) => Boolean(plan.id))
          .map((plan) => [normalizePlanId(plan.id), plan])
      ),
    [planCatalog]
  );

  const usageCards = useMemo(() => {
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

    const packagePerServiceUsage = usage.packagesPerService || usage.packages;
    const metrics = [
      {
        id: "photos",
        label: "Portfolio photos",
        used: Number(usage.portfolioImages?.used || 0),
        limit: Number(usage.portfolioImages?.limit || 0),
        planLimitKeys: ["portfolioPhotos", "portfolioImages"],
        suggestionNoun: "photos",
        context: null as string | null,
      },
      {
        id: "services",
        label: "Services",
        used: Number(usage.services?.used || 0),
        limit: Number(usage.services?.limit || 0),
        planLimitKeys: ["services"],
        suggestionNoun: "services",
        context: null as string | null,
      },
      {
        id: "packages-per-service",
        label: "Packages per service",
        used: Number(packagePerServiceUsage?.used || 0),
        limit: Number(packagePerServiceUsage?.limit || 0),
        planLimitKeys: ["packagesPerService", "packages"],
        suggestionNoun: "packages per service",
        context: usage.packagesPerService?.serviceName
          ? `Most loaded service: ${usage.packagesPerService.serviceName}`
          : null,
      },
    ];

    return metrics.map((metric) => {
      const percent = toUsagePercent(metric.used, metric.limit);
      const ratio = isUnlimited(metric.limit) || metric.limit <= 0 ? 0 : metric.used / metric.limit;
      const status = isUnlimited(metric.limit)
        ? "unlimited"
        : ratio >= 1
          ? "critical"
          : ratio >= 0.8
            ? "warning"
            : "normal";
      const suggestion = findUpgradeTarget(metric.planLimitKeys, metric.limit);

      let suggestionText: string | null = null;
      if ((status === "critical" || status === "warning") && suggestion) {
        const nextLimitLabel = formatUsageLimit(suggestion.limit);
        const prefix = status === "critical" ? "Limit reached." : "You are close to your limit.";
        suggestionText = `${prefix} Upgrade to ${suggestion.planId} for up to ${nextLimitLabel} ${metric.suggestionNoun}.`;
      }

      return {
        ...metric,
        percent,
        status,
        suggestionText,
      };
    });
  }, [overview, planById]);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading dashboard..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-600">Welcome back! Here is what is happening with your portfolio.</p>
      </div>

      {sectionErrors.overview ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Overview metrics are temporarily unavailable.
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 ${stat.bgColor} rounded-lg`}>
                  <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
                <span className="text-xs text-slate-500">Live</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</p>
              <p className="text-sm text-slate-600">{stat.name}</p>
            </div>
          );
        })}
      </div>

      {usageCards.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Plan Usage</h3>
              <p className="text-sm text-slate-600">Track your plan limits and upgrade before you hit hard stops.</p>
            </div>
            <Link
              to="/dashboard/pricing"
              className="inline-flex items-center px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Compare Plans
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {usageCards.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.used} / {formatUsageLimit(item.limit)}
                </p>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-2 transition-all ${
                      item.status === "critical"
                        ? "bg-red-500"
                        : item.status === "warning"
                          ? "bg-amber-500"
                          : "bg-cyan-500"
                    }`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                {item.context ? <p className="mt-2 text-xs text-slate-500">{item.context}</p> : null}
                {item.suggestionText ? (
                  <p className="mt-2 text-xs text-cyan-700 font-medium">{item.suggestionText}</p>
                ) : item.status === "unlimited" ? (
                  <p className="mt-2 text-xs text-slate-500">Unlimited on your current plan.</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Weekly Traffic</h3>
          {trafficData.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No traffic data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trafficData}>
                <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: "12px" }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                />
                <Line type="monotone" dataKey="views" stroke="#06b6d4" strokeWidth={2} dot={{ fill: "#06b6d4", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Portfolio Views by Category</h3>
          {categoriesAccessMessage ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
              <p className="font-medium text-slate-900 mb-2">Category analytics are not available on your current plan.</p>
              <p className="mb-4">{categoriesAccessMessage}</p>
              <Link
                to="/dashboard/pricing"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors"
              >
                Upgrade Plan
              </Link>
            </div>
          ) : sectionErrors.categories ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
              Category analytics are temporarily unavailable.
              <br />
              {sectionErrors.categories}
            </div>
          ) : categoryData.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No portfolio views yet.
              <br />
              Create services and upload portfolio images to start tracking analytics.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: "12px" }} tickLine={false} />
                <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-slate-900">Website</h3>
        <p className="mt-1 text-sm text-slate-600">Share your public website with clients.</p>
        {sectionErrors.website ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Website summary is unavailable right now. Showing fallback URL.
          </div>
        ) : null}

        <div className="mt-4 p-4 rounded-lg border border-cyan-100 bg-cyan-50">
          <p className="text-xs uppercase tracking-wide text-slate-500">Website URL</p>
          <p className="mt-2 text-sm sm:text-base font-medium text-cyan-700 break-all">{websiteLink}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={websiteLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>View Website</span>
          </a>
          <button
            type="button"
            onClick={() => {
              void handleCopyLink();
            }}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>Copy Link</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void handleShareLink();
            }}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              to={action.path}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-cyan-300 hover:shadow-md transition-all"
            >
              <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-3`}>
                {action.name === "Upgrade Plan" ? (
                  <Sparkles className="w-5 h-5 text-white" />
                ) : (
                  <Plus className="w-5 h-5 text-white" />
                )}
              </div>
              <h4 className="font-semibold text-slate-900 mb-1">{action.name}</h4>
              <p className="text-sm text-slate-600">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
