import { ArrowRight, Lock, Percent } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { MetricCardConfig } from "../types";

type AnalyticsMetricsGridProps = {
  data: {
    metrics: MetricCardConfig[];
    hasFullAccess: boolean;
    upgradeTarget: string;
  };
  actions: {
    onUpgradeClick: (surface: string) => void;
  };
};

type MetricCardProps = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconWrapClass: string;
  iconClass: string;
};

function MetricCard({ title, value, description, icon: Icon, iconWrapClass, iconClass }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{value}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconWrapClass} sm:h-12 sm:w-12 sm:rounded-2xl`}>
          <Icon className={`h-4 w-4 ${iconClass} sm:h-5 sm:w-5`} />
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500 sm:mt-4 sm:text-sm">{description}</p>
    </div>
  );
}

function LockedMetricCard({ upgradeTarget, onUpgradeClick }: { upgradeTarget: string; onUpgradeClick: () => void }) {
  return (
    <div className="relative col-span-full overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 p-4 text-white shadow-sm sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.25),_transparent_38%)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              <Lock className="h-3.5 w-3.5" />
              {upgradeTarget} Insight
            </span>
            <p className="mt-3 text-xl font-bold tracking-tight sm:mt-4 sm:text-2xl">See what actually converts</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 sm:h-12 sm:w-12 sm:rounded-2xl">
            <Percent className="h-4 w-4 text-cyan-200 sm:h-5 sm:w-5" />
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-300 sm:mt-4 sm:text-sm sm:leading-6">
          Unlock conversion rate, unique visitors, source quality, and deeper trend context to know what deserves more attention.
        </p>
        <Link
          to="/dashboard/pricing"
          onClick={onUpgradeClick}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-50 sm:mt-5"
        >
          Unlock {upgradeTarget} Analytics
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function AnalyticsMetricsGrid({ data, actions }: AnalyticsMetricsGridProps) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-2.5 sm:mb-8 sm:gap-4 xl:grid-cols-4 xl:gap-5">
      {data.metrics.map((metric) => (
        <MetricCard key={metric.title} {...metric} />
      ))}
      {data.hasFullAccess ? null : (
        <LockedMetricCard
          upgradeTarget={data.upgradeTarget}
          onUpgradeClick={() => {
            actions.onUpgradeClick("analytics_metric_lock");
          }}
        />
      )}
    </div>
  );
}
