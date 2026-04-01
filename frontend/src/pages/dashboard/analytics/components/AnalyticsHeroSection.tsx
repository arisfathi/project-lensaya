import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardPageHero } from "../../../../components/dashboard/DashboardPageHero";

type AnalyticsHeroSectionProps = {
  data: {
    hasFullAccess: boolean;
    tier: string;
    upgradeTarget: string;
    heroTitle: string;
    heroDescription: string;
    trafficWindowDays: number;
    metricsWindowDays: number;
    weeklyTrafficTotal: number;
    contactActions: number;
    monthlyVisitors: number | null | undefined;
  };
  actions: {
    onUpgradeClick: (surface: string) => void;
  };
};

export function AnalyticsHeroSection({ data, actions }: AnalyticsHeroSectionProps) {
  return (
    <DashboardPageHero
      eyebrow={data.hasFullAccess ? `${data.tier} Analytics Suite` : "Free Analytics Preview"}
      title="Analytics"
      badge={
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${data.hasFullAccess ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
          {data.hasFullAccess ? data.tier : data.upgradeTarget}
        </span>
      }
      action={
        !data.hasFullAccess ? (
          <Link
            to="/dashboard/pricing"
            onClick={() => {
              actions.onUpgradeClick("analytics_hero_unlock");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Unlock {data.upgradeTarget}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : undefined
      }
    >
      <p className="text-sm text-slate-600">{data.heroDescription}</p>
    </DashboardPageHero>
  );
}
