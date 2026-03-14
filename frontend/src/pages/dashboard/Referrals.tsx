import { useEffect, useMemo, useState } from "react";
import { Copy, Gift, MessageCircle, TrendingUp, UserCheck, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { getApiErrorMessage, referralApi } from "../../lib/api";
import { buildAppUrl } from "../../lib/platform";
import { useToast } from "../../contexts/ToastContext";

type ReferralSummary = {
  referralCode: string | null;
  totalReferrals: number;
  clicks: number;
  signups: number;
  conversions: number;
  conversionRate: number;
  rewardsEarned: number;
  activeReferrals: number;
};

type ReferralEvent = {
  visitorEmail: string | null;
  status: string;
  reward: number;
  date: string;
};

type GrowthPoint = {
  month: string;
  referrals: number;
};

const fallbackSummary: ReferralSummary = {
  referralCode: null,
  totalReferrals: 0,
  clicks: 0,
  signups: 0,
  conversions: 0,
  conversionRate: 0,
  rewardsEarned: 0,
  activeReferrals: 0,
};

const REFERRAL_EVENTS_PAGE = 1;
const REFERRAL_EVENTS_LIMIT = 20;

const statusClassMap: Record<string, string> = {
  CLICKED: "bg-blue-100 text-blue-700",
  SIGNED_UP: "bg-cyan-100 text-cyan-700",
  CONVERTED: "bg-green-100 text-green-700",
  REWARDED: "bg-emerald-100 text-emerald-700",
};

const formatNumber = (value: number) => Number(value || 0).toLocaleString();

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatStatus = (status: string) => {
  if (!status) return "Unknown";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
};

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const copyWithExecCommand = (value: string) => {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Failed to copy");
  }
};

export default function Referrals() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReferralSummary>(fallbackSummary);
  const [events, setEvents] = useState<ReferralEvent[]>([]);

  const { error, success } = useToast();

  useEffect(() => {
    let mounted = true;

    const loadReferrals = async () => {
      setLoading(true);
      try {
        const [summaryResult, eventsResult] = await Promise.all([
          referralApi.me(),
          referralApi.events({ page: REFERRAL_EVENTS_PAGE, limit: REFERRAL_EVENTS_LIMIT }),
        ]);

        if (!mounted) return;
        setSummary((summaryResult || fallbackSummary) as ReferralSummary);
        setEvents((eventsResult.items || []) as ReferralEvent[]);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load referrals"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadReferrals();

    return () => {
      mounted = false;
    };
  }, [error]);

  const referralCode = summary.referralCode || "";
  const referralLink = referralCode ? `${buildAppUrl("/signup")}?ref=${encodeURIComponent(referralCode)}` : "";
  const hasNoReferrals = summary.totalReferrals === 0 && events.length === 0;

  const clicksCount =
    Number(summary.clicks || 0) ||
    events.filter((item) => String(item.status || "").toUpperCase() === "CLICKED").length;
  const signupsCount =
    Number(summary.signups || 0) ||
    events.filter((item) => String(item.status || "").toUpperCase() === "SIGNED_UP").length;
  const conversionsCount =
    Number(summary.conversions || 0) ||
    events.filter((item) => {
      const status = String(item.status || "").toUpperCase();
      return status === "CONVERTED" || status === "REWARDED";
    }).length;

  const growthData = useMemo<GrowthPoint[]>(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        month: monthDate.toLocaleString(undefined, { month: "short" }),
        referrals: 0,
      };
    });

    const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    events.forEach((item) => {
      const eventDate = new Date(item.date);
      if (Number.isNaN(eventDate.getTime())) return;

      const bucketKey = `${eventDate.getFullYear()}-${eventDate.getMonth()}`;
      const bucket = bucketByKey.get(bucketKey);
      if (bucket) {
        bucket.referrals += 1;
      }
    });

    return buckets.map(({ month, referrals }) => ({ month, referrals }));
  }, [events]);

  const stats = [
    {
      name: "Clicks",
      value: formatNumber(clicksCount),
      icon: Users,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      name: "Signups",
      value: formatNumber(signupsCount),
      icon: UserCheck,
      bgColor: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
    {
      name: "Conversions",
      value: formatNumber(conversionsCount),
      icon: TrendingUp,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      name: "Rewards Earned",
      value: formatCurrency(summary.rewardsEarned),
      icon: Gift,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-500",
    },
  ];

  const handleCopyLink = async () => {
    if (!referralLink) {
      error("Referral code is not available yet");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else {
        copyWithExecCommand(referralLink);
      }
      success("Referral link copied.");
    } catch {
      error("Unable to copy referral link");
    }
  };

  const handleShareWhatsApp = () => {
    if (!referralLink) {
      error("Referral code is not available yet");
      return;
    }

    const text = encodeURIComponent(`Join Lensaya using my referral link: ${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading referrals..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Referrals</h1>
        <p className="text-slate-600">Track your referral performance and earned rewards</p>
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
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Your Referral Code</h2>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-slate-600 mb-1">Code</p>
          <p className="text-2xl font-bold text-slate-900 tracking-wide">{referralCode || "N/A"}</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-slate-600 mb-1">Referral Link</p>
          <p className="text-sm font-medium text-cyan-600 break-all">{referralLink || "Referral link unavailable"}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              void handleCopyLink();
            }}
          >
            <Copy className="w-4 h-4" />
            Copy Link
          </Button>
          <Button variant="secondary" onClick={handleShareWhatsApp}>
            <MessageCircle className="w-4 h-4" />
            Share WhatsApp
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Referral Growth</h2>
          <p className="text-sm text-slate-600">Last 6 months</p>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={growthData}>
            <XAxis dataKey="month" stroke="#94a3b8" style={{ fontSize: "12px" }} tickLine={false} />
            <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} tickLine={false} allowDecimals={false} />
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
              dataKey="referrals"
              stroke="#06b6d4"
              strokeWidth={3}
              dot={{ fill: "#06b6d4", r: 5, strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Referral History</h2>

        {hasNoReferrals ? (
          <div className="text-sm text-slate-600">You haven't referred anyone yet.</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">User</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Reward</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((item, index) => (
                    <tr key={`referral-event-${index + 1}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-700">{item.visitorEmail || "Anonymous user"}</td>
                      <td className="py-3 px-4 text-sm text-slate-700">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            statusClassMap[item.status] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {formatStatus(item.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-700">{formatCurrency(item.reward || 0)}</td>
                      <td className="py-3 px-4 text-sm text-slate-700">{formatDateTime(item.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-4">
              {events.map((item, index) => (
                <div key={`referral-event-mobile-${index + 1}`} className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-900">{item.visitorEmail || "Anonymous user"}</p>
                  <p className="text-sm text-slate-700 mt-1">{formatStatus(item.status)}</p>
                  <p className="text-sm text-slate-700 mt-1">Reward: {formatCurrency(item.reward || 0)}</p>
                  <p className="text-xs text-slate-500 mt-2">{formatDateTime(item.date)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
