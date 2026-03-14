import { useEffect, useMemo, useState } from "react";
import { DollarSign, TrendingUp, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AdminLayout } from "../../layouts/AdminLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type RevenueOverview = {
  mrr: number;
  successRate: number;
  ytdRevenue: number;
  activeSubscriptions: number;
};

type MonthlyPoint = {
  month: string;
  revenue: number;
};

type PlanRevenue = {
  plan: string;
  revenue: number;
};

type TransactionItem = {
  id: string;
  photographer: string;
  plan: string | null;
  amount: number;
  status: string;
  date: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);

const formatCompact = (value: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const monthFallback = () => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      month: date.toLocaleString(undefined, { month: "short" }),
      revenue: 0,
    };
  });
};

const planFallback = [
  { plan: "FREE", revenue: 0 },
  { plan: "PRO", revenue: 0 },
  { plan: "STUDIO", revenue: 0 },
];

const formatPlan = (plan: string | null) => {
  if (!plan) return "Unknown";
  if (plan === "FREE") return "Free";
  if (plan === "PRO") return "Pro";
  if (plan === "STUDIO") return "Studio";
  return plan;
};

const shortUser = (value: string) => {
  if (!value) return "Unknown";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

export default function Revenue() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<RevenueOverview>({ mrr: 0, successRate: 0, ytdRevenue: 0, activeSubscriptions: 0 });
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [byPlan, setByPlan] = useState<PlanRevenue[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  const { error } = useToast();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [overviewResult, monthlyResult, byPlanResult, txResult] = await Promise.all([
          adminApi.revenueOverview(),
          adminApi.revenueMonthly(),
          adminApi.revenueByPlan(),
          adminApi.revenueTransactions({ page: 1, limit: 20 }),
        ]);
        if (!mounted) return;
        setOverview((overviewResult || { mrr: 0, successRate: 0, ytdRevenue: 0, activeSubscriptions: 0 }) as RevenueOverview);
        setMonthly((monthlyResult.series || []) as MonthlyPoint[]);
        setByPlan((byPlanResult.items || []) as PlanRevenue[]);
        setTransactions((txResult.items || []) as TransactionItem[]);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load revenue"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error]);

  const monthlyRevenueData = useMemo(() => {
    if (!monthly.length) return monthFallback();
    return monthly.map((item) => ({ month: item.month, revenue: Number(item.revenue || 0) }));
  }, [monthly]);

  const revenueByPlanData = useMemo(() => {
    const source = byPlan.length ? byPlan : planFallback;
    return source.map((item) => ({
      plan: formatPlan(item.plan),
      revenue: Number(item.revenue || 0),
    }));
  }, [byPlan]);

  const stats = [
    {
      name: "Monthly Recurring Revenue",
      value: formatCurrency(overview.mrr || 0),
      icon: DollarSign,
      bgColor: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
    {
      name: "Payment Success Rate",
      value: `${Number(overview.successRate || 0).toFixed(1)}%`,
      icon: CheckCircle,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      name: "Total Revenue (YTD)",
      value: formatCurrency(overview.ytdRevenue || 0),
      icon: TrendingUp,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-500",
    },
    {
      name: "Active Subscriptions",
      value: formatCompact(overview.activeSubscriptions || 0),
      icon: CreditCard,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading revenue..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Revenue</h1>
        <p className="text-slate-600">Financial performance and payment analytics</p>
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
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Monthly Revenue</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyRevenueData}>
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2} name="Revenue ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Revenue by Plan</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByPlanData}>
              <XAxis dataKey="plan" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
              <Legend />
              <Bar dataKey="revenue" fill="#06b6d4" name="Revenue ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Transaction ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Photographer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Plan</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-sm text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 text-sm text-slate-600">{transaction.id}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 font-medium">{shortUser(transaction.photographer)}</td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          formatPlan(transaction.plan).toLowerCase() === "studio"
                            ? "bg-purple-100 text-purple-700"
                            : formatPlan(transaction.plan).toLowerCase() === "pro"
                              ? "bg-cyan-100 text-cyan-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {formatPlan(transaction.plan)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-900">{formatCurrency(Number(transaction.amount || 0))}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        {(transaction.status || "").toLowerCase() === "succeeded" ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-700">Success</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-red-700">{transaction.status || "Failed"}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600">{formatDate(transaction.date)}</td>
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
