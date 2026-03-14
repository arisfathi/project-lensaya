import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, MousePointerClick, MessageCircle, Percent } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { ApiClientError, analyticsApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type OverviewPayload = {
  stats: {
    portfolioViews: number;
    whatsappClicks: number;
    inquiries: number;
    conversionRate: number;
    profileClicks?: number;
    monthlyVisitors?: number;
  };
  trafficSeries: Array<Record<string, unknown>>;
  sourceBreakdown: Array<Record<string, unknown>>;
};

type ActivityItem = {
  at: string;
  action: string;
  portfolio: string | null;
  source: string | null;
};

type CategoryItem = {
  name: string;
  views: number;
};

const sourceColors = ["#06b6d4", "#3b82f6", "#10b981", "#eab308", "#ef4444", "#8b5cf6"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const activityActionMeta: Record<string, { label: string; icon: string }> = {
  PAGE_VIEW: {
    label: "Someone visited your page",
    icon: "👀",
  },
  PORTFOLIO_VIEW: {
    label: "Someone viewed one of your photos",
    icon: "📷",
  },
  SERVICE_SELECT: {
    label: "Someone explored one of your services",
    icon: "📂",
  },
  PACKAGE_SELECT: {
    label: "Someone looked at one of your packages",
    icon: "📦",
  },
  PACKAGE_VIEW: {
    label: "Someone viewed a package",
    icon: "🧾",
  },
  BOOKING_INTENT: {
    label: "Someone submitted an inquiry",
    icon: "📝",
  },
  WHATSAPP_CLICK: {
    label: "Someone clicked your WhatsApp contact",
    icon: "💬",
  },
  PORTFOLIO_SHARE: {
    label: "Someone shared your portfolio",
    icon: "🔗",
  },
};
const activitySourceMeta: Record<string, string> = {
  direct: "Direct visit",
  instagram: "Instagram",
  facebook: "Facebook",
  search: "Google Search",
};

const formatActivityAction = (action: string) => {
  const mapped = activityActionMeta[action];
  if (mapped) return mapped;

  const normalized = String(action || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const label = normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Unknown activity";
  return { label, icon: "•" };
};

const formatActivitySource = (source: string | null) => {
  const normalized = String(source || "direct")
    .toLowerCase()
    .trim();
  if (!normalized) return "Direct visit";
  if (activitySourceMeta[normalized]) return activitySourceMeta[normalized];

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const formatActivityDetails = (item: ActivityItem) => {
  const rawPortfolio = String(item.portfolio || "").trim();
  const hasReadablePortfolio = Boolean(rawPortfolio) && !uuidPattern.test(rawPortfolio);

  if (hasReadablePortfolio) {
    return rawPortfolio;
  }

  switch (item.action) {
    case "PORTFOLIO_VIEW":
      return "One of your photos";
    case "PAGE_VIEW":
      return "Your portfolio homepage";
    case "SERVICE_SELECT":
      return "Your services section";
    case "PACKAGE_SELECT":
      return "Your packages section";
    case "PACKAGE_VIEW":
      return "A package card";
    case "BOOKING_INTENT":
      return "Inquiry form";
    case "WHATSAPP_CLICK":
      return "Your contact section";
    case "PORTFOLIO_SHARE":
      return "Public portfolio share";
    default:
      return rawPortfolio ? "Portfolio item" : "-";
  }
};

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

const formatNumber = (value: number) => Number(value || 0).toLocaleString();

export default function Analytics() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { error } = useToast();

  useEffect(() => {
    let mounted = true;

    const loadAnalytics = async () => {
      setLoading(true);
      setAccessDeniedMessage(null);
      try {
        const [overviewResult, activityResult, categoriesResult] = await Promise.all([
          analyticsApi.overview(),
          analyticsApi.activity({ page: 1, limit: 12 }),
          analyticsApi.categories(),
        ]);

        if (!mounted) return;
        setOverview(overviewResult as OverviewPayload);
        setActivity((activityResult.items || []) as ActivityItem[]);
        setCategories((categoriesResult.categories || []) as CategoryItem[]);
      } catch (err) {
        if (!mounted) return;
        if (err instanceof ApiClientError && err.status === 403) {
          setAccessDeniedMessage(
            getApiErrorMessage(err, "Analytics tools are available on Pro and Studio plans.")
          );
          return;
        }
        error(getApiErrorMessage(err, "Failed to load analytics"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadAnalytics();

    return () => {
      mounted = false;
    };
  }, [error]);

  const trafficData = useMemo(() => {
    const series = overview?.trafficSeries || [];
    return series.map((entry, index) => ({
      name: String(entry.name ?? entry.day ?? `Day ${index + 1}`),
      visits: Number(entry.visits ?? entry.views ?? entry.value ?? 0),
    }));
  }, [overview?.trafficSeries]);

  const categoryData = useMemo(
    () =>
      categories.map((category) => ({
        name: category.name,
        value: Number(category.views || 0),
      })),
    [categories]
  );

  const visitorSourcesData = useMemo(() => {
    const series = overview?.sourceBreakdown || [];
    return series.map((entry, index) => ({
      name: String(entry.name ?? entry.source ?? `Source ${index + 1}`),
      value: Number(entry.value ?? entry.count ?? 0),
      color: sourceColors[index % sourceColors.length],
    }));
  }, [overview?.sourceBreakdown]);

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

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading analytics..." />
      </DashboardLayout>
    );
  }

  if (accessDeniedMessage) {
    return (
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Analytics</h1>
          <p className="text-slate-600">Track your website performance and visitor engagement</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Analytics tools are not available on your current plan</h2>
          <p className="text-sm text-slate-700 mb-4">{accessDeniedMessage}</p>
          <Link
            to="/dashboard/pricing"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors"
          >
            Upgrade Plan
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Analytics</h1>
        <p className="text-slate-600">Track your website performance and visitor engagement</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 ${stat.bgColor} rounded-lg`}>
                  <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">{stat.value}</p>
              <p className="text-sm text-slate-600">{stat.name}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Website Traffic</h2>
          <p className="text-sm text-slate-600">Recent period</p>
        </div>
        {trafficData.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No traffic data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trafficData}>
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
              <Line
                type="monotone"
                dataKey="visits"
                stroke="#06b6d4"
                strokeWidth={3}
                dot={{ fill: "#06b6d4", r: 5, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Portfolio Views by Category</h2>
          {categoryData.length === 0 ? (
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

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Visitor Sources</h2>
          {visitorSourcesData.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No visitor source data yet.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={visitorSourcesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {visitorSourcesData.map((entry, index) => (
                      <Cell key={`source-${entry.name}-${index + 1}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {visitorSourcesData.map((source) => (
                  <div key={`legend-${source.name}`} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                    <span className="text-sm text-slate-600">{source.name}</span>
                    <span className="text-sm font-semibold text-slate-900 ml-auto">{source.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Recent Activity</h2>

        {activity.length === 0 ? (
          <div className="text-sm text-slate-600">No analytics activity yet.</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Action</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Details</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((item, index) => {
                    const actionDisplay = formatActivityAction(item.action);
                    return (
                      <tr
                        key={`activity-${index + 1}`}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-slate-700">{formatDateTime(item.at)}</td>
                        <td className="py-3 px-4 text-sm text-slate-700">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true">{actionDisplay.icon}</span>
                            <span>{actionDisplay.label}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-700">{formatActivityDetails(item)}</td>
                        <td className="py-3 px-4 text-sm text-slate-700">{formatActivitySource(item.source)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-4">
              {activity.map((item, index) => {
                const actionDisplay = formatActivityAction(item.action);
                return (
                  <div key={`activity-mobile-${index + 1}`} className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
                    <span aria-hidden="true">{actionDisplay.icon}</span>
                    <span>{actionDisplay.label}</span>
                  </p>
                  <p className="text-sm text-slate-700 mt-1">{formatActivityDetails(item)}</p>
                  <p className="text-xs text-slate-500 mt-2">{formatDateTime(item.at)}</p>
                  <p className="text-xs text-slate-500">Source: {formatActivitySource(item.source)}</p>
                </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
