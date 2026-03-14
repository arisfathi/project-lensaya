import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Users, Eye, MessageCircle, Activity } from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AdminLayout } from "../../layouts/AdminLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type AnalyticsOverview = {
  trafficSeries: Array<Record<string, unknown>>;
  sourceBreakdown: Array<Record<string, unknown>>;
  portfolioViewsSeries: Array<Record<string, unknown>>;
  engagementMetrics: Array<Record<string, unknown>>;
};

const sourceColors = ["#06b6d4", "#10b981", "#a855f7", "#f59e0b", "#ef4444", "#3b82f6"];

const monthFallback = (key: string) => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      month: date.toLocaleString(undefined, { month: "short" }),
      [key]: 0,
    };
  });
};

const formatCompact = (value: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AnalyticsOverview>({
    trafficSeries: [],
    sourceBreakdown: [],
    portfolioViewsSeries: [],
    engagementMetrics: [],
  });

  const { error } = useToast();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const result = await adminApi.analyticsOverview();
        if (!mounted) return;
        setOverview(
          (result || {
            trafficSeries: [],
            sourceBreakdown: [],
            portfolioViewsSeries: [],
            engagementMetrics: [],
          }) as AnalyticsOverview
        );
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load analytics"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error]);

  const trafficData = useMemo(() => {
    if (!overview.trafficSeries.length) return monthFallback("visitors");
    return overview.trafficSeries.map((entry, index) => ({
      month: String(entry.month ?? entry.name ?? `Month ${index + 1}`),
      visitors: Number(entry.visitors ?? entry.views ?? entry.value ?? 0),
    }));
  }, [overview.trafficSeries]);

  const visitorSourcesData = useMemo(() => {
    if (!overview.sourceBreakdown.length) {
      return [{ id: "source-direct", name: "Direct", value: 100, color: sourceColors[0] }];
    }

    return overview.sourceBreakdown.map((entry, index) => ({
      id: String(entry.id ?? `source-${index + 1}`),
      name: String(entry.name ?? entry.source ?? `Source ${index + 1}`),
      value: Number(entry.value ?? entry.count ?? 0),
      color: sourceColors[index % sourceColors.length],
    }));
  }, [overview.sourceBreakdown]);

  const portfolioViewsData = useMemo(() => {
    if (!overview.portfolioViewsSeries.length) return monthFallback("views");
    return overview.portfolioViewsSeries.map((entry, index) => ({
      month: String(entry.month ?? entry.name ?? `Month ${index + 1}`),
      views: Number(entry.views ?? entry.value ?? 0),
    }));
  }, [overview.portfolioViewsSeries]);

  const engagementMetrics = useMemo(() => {
    if (!overview.engagementMetrics.length) return [];
    return overview.engagementMetrics.map((metric, index) => ({
      id: String(metric.id ?? `metric-${index + 1}`),
      metric: String(metric.metric ?? metric.name ?? `Metric ${index + 1}`),
      value: String(metric.value ?? "0"),
      change: String(metric.change ?? "0%"),
      trend: String(metric.trend ?? "up"),
    }));
  }, [overview.engagementMetrics]);

  const totalTraffic = trafficData.reduce((sum, item) => sum + Number(item.visitors || 0), 0);
  const totalPortfolioViews = portfolioViewsData.reduce((sum, item) => sum + Number(item.views || 0), 0);
  const whatsappMetric = engagementMetrics.find((item) => item.metric.toLowerCase().includes("whatsapp"));
  const activeUsersMetric = engagementMetrics.find((item) => item.metric.toLowerCase().includes("active"));

  const stats = [
    {
      name: "Platform Traffic",
      value: formatCompact(totalTraffic),
      icon: TrendingUp,
      bgColor: "bg-pink-50",
      iconColor: "text-pink-500",
    },
    {
      name: "Portfolio Views",
      value: formatCompact(totalPortfolioViews),
      icon: Eye,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      name: "WhatsApp Clicks",
      value: whatsappMetric?.value || "0",
      icon: MessageCircle,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      name: "Active Users",
      value: activeUsersMetric?.value || "0",
      icon: Users,
      bgColor: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading analytics..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Analytics</h1>
        <p className="text-slate-600">Platform usage and engagement metrics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className={`${stat.bgColor} ${stat.iconColor} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</h3>
              <p className="text-sm text-slate-600">{stat.name}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Platform Traffic</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trafficData}>
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="visitors" stroke="#ec4899" strokeWidth={2} name="Visitors" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Visitor Sources</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={visitorSourcesData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {visitorSourcesData.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Portfolio Views</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={portfolioViewsData}>
            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <Bar dataKey="views" fill="#06b6d4" name="Views" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Engagement Metrics</h2>
        {engagementMetrics.length === 0 ? (
          <p className="text-sm text-slate-500">No engagement metrics available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {engagementMetrics.map((item) => (
              <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-slate-600">{item.metric}</p>
                  <Activity className={`w-4 h-4 ${item.trend === "up" ? "text-green-500" : "text-red-500"}`} />
                </div>
                <div className="flex items-end justify-between">
                  <h3 className="text-xl font-bold text-slate-900">{item.value}</h3>
                  <span className={`text-sm font-medium ${item.change.startsWith("-") ? "text-red-600" : "text-green-600"}`}>{item.change}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
