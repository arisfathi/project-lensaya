import { useEffect, useMemo, useState } from "react";
import { Gift, TrendingUp, UserCheck, Users } from "lucide-react";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { getApiErrorMessage, isApiAccessError, referralApi } from "../../lib/api";
import { buildAppUrl } from "../../lib/platform";
import { buildReferralShareMessage } from "../../lib/share";
import { useToast } from "../../contexts/ToastContext";
import {
  FALLBACK_SUMMARY,
  REFERRAL_EVENTS_LIMIT,
  REFERRAL_EVENTS_PAGE,
} from "./referrals/constants";
import { ReferralGrowthChart } from "./referrals/components/ReferralGrowthChart";
import { ReferralHistorySection } from "./referrals/components/ReferralHistorySection";
import { ReferralInvitePanel } from "./referrals/components/ReferralInvitePanel";
import { ReferralOfferBanner } from "./referrals/components/ReferralOfferBanner";
import { ReferralsPageHeader } from "./referrals/components/ReferralsPageHeader";
import { ReferralStatsGrid } from "./referrals/components/ReferralStatsGrid";
import type { GrowthPoint, ReferralEvent, ReferralStatCard, ReferralSummary } from "./referrals/types";
import { copyWithExecCommand, formatCurrency, formatNumber } from "./referrals/utils";

export default function Referrals() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReferralSummary>(FALLBACK_SUMMARY);
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
        setSummary((summaryResult || FALLBACK_SUMMARY) as ReferralSummary);
        setEvents((eventsResult.items || []) as ReferralEvent[]);
      } catch (err) {
        if (!mounted || isApiAccessError(err)) return;
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

  const stats: ReferralStatCard[] = [
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

  const copyReferralValue = async (value: string, successMessage: string, failureMessage: string) => {
    if (!value) {
      error("Referral code is not available yet");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        copyWithExecCommand(value);
      }
      success(successMessage);
    } catch {
      error(failureMessage);
    }
  };

  const handleCopyLink = async () => {
    await copyReferralValue(referralLink, "Referral link copied.", "Unable to copy referral link");
  };

  const handleCopyCode = async () => {
    await copyReferralValue(referralCode, "Referral code copied.", "Unable to copy referral code");
  };

  const handleShareWhatsApp = () => {
    if (!referralLink) {
      error("Referral code is not available yet");
      return;
    }

    const text = encodeURIComponent(buildReferralShareMessage(referralLink));
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
      <ReferralsPageHeader />

      <ReferralOfferBanner />

      <ReferralStatsGrid stats={stats} />

      <ReferralInvitePanel
        data={{
          referralCode,
          referralLink,
        }}
        actions={{
          onCopyLink: () => {
            void handleCopyLink();
          },
          onCopyCode: () => {
            void handleCopyCode();
          },
          onShareWhatsApp: handleShareWhatsApp,
        }}
      />

      <ReferralGrowthChart growthData={growthData} />

      <ReferralHistorySection
        data={{
          events,
          hasNoReferrals,
        }}
      />
    </DashboardLayout>
  );
}
