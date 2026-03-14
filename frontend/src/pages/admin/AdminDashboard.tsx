import { useEffect, useMemo, useState } from "react";
import { Users, UserCheck, CreditCard, DollarSign, HardDrive, TrendingUp } from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AdminLayout } from "../../layouts/AdminLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type OverviewPayload = {
  stats: {
    totalPhotographers: number;
    activePhotographers: number;
    monthlyRevenue: number;
    totalImagesStored: number;
  };
  growthSeries: Array<{ month?: string; photographers?: number }>;
  planDistribution: Array<{ plan?: string; count?: number }>;
  uploadsSeries: Array<{ month?: string; uploads?: number }>;
  revenueSeries: Array<{ month?: string; revenue?: number }>;
  recentPhotographers: Array<{
    id: string;
    name: string;
    username: string | null;
    plan: string;
    status: string;
    imagesStored?: number;
  }>;
};

const colors = {
  FREE: "#94a3b8",
  PRO: "#06b6d4",
  STUDIO: "#a855f7",
};

const monthSeriesFallback = (key: string) => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      month: date.toLocaleString(undefined, { month: "short" }),
      [key]: 0,
    };
  });
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);

const formatCompact = (value: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);

const formatPlan = (plan: string) => {
  if (plan === "FREE") return "Free";
  if (plan === "PRO") return "Pro";
  if (plan === "STUDIO") return "Studio";
  return plan || "Unknown";
};

const formatStatus = (status: string) => {
  if (status === "ACTIVE") return "Active";
  if (status === "SUSPENDED") return "Suspended";
  return status || "Unknown";
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const { error } = useToast();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const result = await adminApi.dashboardOverview();
        if (!mounted) return;
        setOverview(result as OverviewPayload);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load admin dashboard"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error]);

  const growthData = useMemo(() => {
    const series = overview?.growthSeries || [];
    if (series.length === 0) return monthSeriesFallback("photographers");
    return series.map((item) => ({
      month: item.month || "",
      photographers: Number(item.photographers || 0),
    }));
  }, [overview?.growthSeries]);

  const uploadsData = useMemo(() => {
    const series = overview?.uploadsSeries || [];
    if (series.length === 0) return monthSeriesFallback("uploads");
    return series.map((item) => ({
      month: item.month || "",
      uploads: Number(item.uploads || 0),
    }));
  }, [overview?.uploadsSeries]);

  const revenueData = useMemo(() => {
    const series = overview?.revenueSeries || [];
    if (series.length === 0) return monthSeriesFallback("revenue");
    return series.map((item) => ({
      month: item.month || "",
      revenue: Number(item.revenue || 0),
    }));
  }, [overview?.revenueSeries]);

  const planDistribution = useMemo(() => {
    const source = overview?.planDistribution || [];
    if (source.length === 0) {
      return [
        { name: "Free", value: 0, color: colors.FREE },
        { name: "Pro", value: 0, color: colors.PRO },
        { name: "Studio", value: 0, color: colors.STUDIO },
      ];
    }

    return source.map((plan) => {
      const planName = plan.plan || "FREE";
      return {
        name: formatPlan(planName),
        value: Number(plan.count || 0),
        color: colors[(planName as keyof typeof colors) || "FREE"] || colors.FREE,
      };
    });
  }, [overview?.planDistribution]);

  const proSubscribers = planDistribution.find((item) => item.name === "Pro")?.value || 0;
  const platformTraffic = growthData.reduce((sum, item) => sum + Number(item.photographers || 0), 0);

  const stats = [
    {
      name: "Total Photographers",
      value: formatCompact(overview?.stats.totalPhotographers || 0),
      icon: Users,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      name: "Active Photographers",
      value: formatCompact(overview?.stats.activePhotographers || 0),
      icon: UserCheck,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      name: "Monthly Revenue",
      value: formatCurrency(overview?.stats.monthlyRevenue || 0),
      icon: DollarSign,
      bgColor: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
    {
      name: "Total Images Stored",
      value: formatCompact(overview?.stats.totalImagesStored || 0),
      icon: HardDrive,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-500",
    },
    {
      name: "Pro Subscribers",
      value: formatCompact(proSubscribers),
      icon: CreditCard,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-500",
    },
    {
      name: "Platform Traffic",
      value: formatCompact(platformTraffic),
      icon: TrendingUp,
      bgColor: "bg-pink-50",
      iconColor: "text-pink-500",
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading dashboard..." />
      </AdminLayout>
    );
  }

  const recentPhotographers = overview?.recentPhotographers || [];

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Platform Dashboard</h1>
        <p className="text-slate-600">Monitor and manage your photography platform.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 ${stat.bgColor} rounded-lg`}>
                  <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</p>
              <p className="text-sm text-slate-600">{stat.name}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Platform Growth</h3>
          <p className="text-sm text-slate-600 mb-4">New photographers per month</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={growthData}>
              <XAxis dataKey="month" stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Line type="monotone" dataKey="photographers" stroke="#06b6d4" strokeWidth={3} dot={{ fill: "#06b6d4", r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Plan Distribution</h3>
          <p className="text-sm text-slate-600 mb-4">Free / Pro / Studio breakdown</p>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={planDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {planDistribution.map((entry, index) => (
                  <Cell key={`${entry.name}-${index + 1}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4">
            {planDistribution.map((plan) => (
              <div key={plan.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }} />
                <span className="text-sm text-slate-600">
                  {plan.name}: {plan.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Image Uploads</h3>
          <p className="text-sm text-slate-600 mb-4">Monthly upload trends</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={uploadsData}>
              <XAxis dataKey="month" stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="uploads" fill="#a855f7" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Monthly Revenue</h3>
          <p className="text-sm text-slate-600 mb-4">Revenue growth over time</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueData}>
              <XAxis dataKey="month" stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
                formatter={(value) => formatCurrency(Number(value || 0))}
              />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981", r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-slate-900">Recent Photographers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Images</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentPhotographers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-sm text-slate-500">
                    No recent photographers to display.
                  </td>
                </tr>
              ) : (
                recentPhotographers.map((photographer) => (
                  <tr key={photographer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{photographer.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">@{photographer.username || "unknown"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          photographer.plan === "STUDIO"
                            ? "bg-purple-100 text-purple-700"
                            : photographer.plan === "PRO"
                              ? "bg-cyan-100 text-cyan-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {formatPlan(photographer.plan)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{photographer.imagesStored || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          photographer.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {formatStatus(photographer.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
