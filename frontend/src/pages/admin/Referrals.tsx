import { useEffect, useMemo, useState } from "react";
import { Gift, Users, TrendingUp, Award, ShieldAlert } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type ReferralsOverview = {
  stats: {
    totalReferrals: number;
    conversions: number;
    repeatVisitorClicks: number;
  };
  growthSeries: Array<{ month: string; referrals: number; conversions: number }>;
};

type TopReferrer = {
  userId: string;
  referrals: number;
  conversions: number;
  conversionRate: number;
  rewardEarned: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);

const shortUser = (value: string) => {
  if (!value) return "Unknown";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const monthFallback = () => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      month: date.toLocaleString(undefined, { month: "short" }),
      referrals: 0,
      conversions: 0,
    };
  });
};

export default function Referrals() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<ReferralsOverview>({
    stats: { totalReferrals: 0, conversions: 0, repeatVisitorClicks: 0 },
    growthSeries: [],
  });
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);

  const { error } = useToast();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [overviewResult, topReferrersResult] = await Promise.all([
          adminApi.referralsOverview(),
          adminApi.topReferrers({ page: 1, limit: 20 }),
        ]);
        if (!mounted) return;

        setOverview(
          (overviewResult || {
            stats: { totalReferrals: 0, conversions: 0, repeatVisitorClicks: 0 },
            growthSeries: [],
          }) as ReferralsOverview
        );
        setTopReferrers((topReferrersResult.items || []) as TopReferrer[]);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load referrals"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error]);

  const conversionRate = overview.stats.totalReferrals
    ? (overview.stats.conversions / overview.stats.totalReferrals) * 100
    : 0;

  const totalRewards = topReferrers.reduce((sum, referrer) => sum + Number(referrer.rewardEarned || 0), 0);

  const referralGrowthData = useMemo(() => {
    if (!overview.growthSeries.length) return monthFallback();
    return overview.growthSeries.map((item) => ({
      month: item.month || "",
      referrals: Number(item.referrals || 0),
      conversions: Number(item.conversions || 0),
    }));
  }, [overview.growthSeries]);

  const stats = [
    {
      name: "Total Referrals",
      value: new Intl.NumberFormat().format(Number(overview.stats.totalReferrals || 0)),
      icon: Users,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      name: "Conversion Rate",
      value: `${conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      name: "Rewards Issued",
      value: formatCurrency(totalRewards),
      icon: Gift,
      bgColor: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
    {
      name: "Active Referrers",
      value: new Intl.NumberFormat().format(topReferrers.length),
      icon: Award,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-500",
    },
    {
      name: "Repeat Click Visitors",
      value: new Intl.NumberFormat().format(Number(overview.stats.repeatVisitorClicks || 0)),
      icon: ShieldAlert,
      bgColor: "bg-amber-50",
      iconColor: "text-amber-600",
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading referrals..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Referrals</h1>
        <p className="text-slate-600">Referral program performance and top referrers</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
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

      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Referral Growth</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={referralGrowthData}>
            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="referrals" stroke="#06b6d4" strokeWidth={2} name="Total Referrals" />
            <Line type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2} name="Conversions" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Top Referrers</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Referrer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Total Referrals</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Conversions</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Conversion Rate</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Reward Earned</th>
              </tr>
            </thead>
            <tbody>
              {topReferrers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-sm text-slate-500">
                    No referral records yet.
                  </td>
                </tr>
              ) : (
                topReferrers.map((referrer) => (
                  <tr key={referrer.userId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="text-sm font-medium text-slate-900">{shortUser(referrer.userId)}</div>
                      <div className="text-sm text-slate-500">{referrer.userId}</div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-900 font-medium">{Number(referrer.referrals || 0)}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 font-medium">{Number(referrer.conversions || 0)}</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {Number(referrer.conversionRate || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-900">{formatCurrency(Number(referrer.rewardEarned || 0))}</td>
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

