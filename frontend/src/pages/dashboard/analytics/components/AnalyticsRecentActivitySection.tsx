import { ArrowRight, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { ActivityItem } from "../types";
import { formatActivityAction, formatActivityDetails, formatActivitySource, formatDateTime, formatNumber } from "../utils";

type AnalyticsRecentActivitySectionProps = {
  data: {
    hasFullAccess: boolean;
    upgradeTarget: string;
    activityError: string | null;
    activityItems: ActivityItem[];
    hiddenActivityCount: number;
  };
  actions: {
    onUpgradeClick: (surface: string) => void;
  };
};

export function AnalyticsRecentActivitySection({ data, actions }: AnalyticsRecentActivitySectionProps) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 md:text-xl">Recent Activity</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
            {data.hasFullAccess
              ? "Latest tracked visitor actions across your portfolio."
              : `You are seeing a real preview of the latest visitor actions. ${data.upgradeTarget} unlocks the full timeline.`}
          </p>
        </div>
        {!data.hasFullAccess ? (
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <Users className="h-3.5 w-3.5" />
            Showing latest {data.activityItems.length || 0}
          </span>
        ) : null}
      </div>

      <div className="mt-4 md:mt-6">
        {data.activityError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900 md:p-6">
            Activity timeline is temporarily unavailable.
            <br />
            {data.activityError}
          </div>
        ) : data.activityItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600 md:p-6">
            No analytics activity yet.
            <br />
            As visitors browse, click, and inquire, the timeline will start filling in here.
          </div>
        ) : (
          <div className="space-y-2.5 md:space-y-3">
            {data.activityItems.map((item, index) => {
              const actionDisplay = formatActivityAction(item.action);
              return (
                <div key={`activity-${index + 1}`} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 md:rounded-2xl md:px-4 md:py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${actionDisplay.badgeClass}`}>
                        {actionDisplay.label}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {formatActivitySource(item.source)}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-slate-500">{formatDateTime(item.at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">{formatActivityDetails(item)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!data.hasFullAccess ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-3.5 py-3.5 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {data.hiddenActivityCount > 0 ? `${formatNumber(data.hiddenActivityCount)} more tracked actions are hidden on Free.` : `${data.upgradeTarget} unlocks a longer action timeline as your traffic grows.`}
            </p>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">See deeper visitor behavior before they message, click, or inquire.</p>
          </div>
          <Link
            to="/dashboard/pricing"
            onClick={() => {
              actions.onUpgradeClick("analytics_activity_cta");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Reveal Full Timeline
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
