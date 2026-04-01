import { ArrowRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_TOOLTIP_STYLE } from "../constants";
import type { SourcePreviewRow } from "../types";
import { formatNumber } from "../utils";

type AnalyticsVisitorSourcesSectionProps = {
  data: {
    hasFullAccess: boolean;
    hasSourceData: boolean;
    visitorSourcesData: Array<{ name: string; value: number; color: string }>;
    upgradeTarget: string;
    topSource: string | null;
    sourceCount: number;
    sourcePreviewRows: SourcePreviewRow[];
  };
  actions: {
    onUpgradeClick: (surface: string) => void;
  };
};

export function AnalyticsVisitorSourcesSection({ data, actions }: AnalyticsVisitorSourcesSectionProps) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 md:text-xl">Visitor Sources</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
            {data.hasFullAccess
              ? "See exactly where visitors are coming from so you know which channels deserve more energy."
              : `Free shows the strongest source signal. ${data.upgradeTarget} unlocks the full traffic mix.`}
          </p>
        </div>
        {!data.hasFullAccess ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <Lock className="h-3.5 w-3.5" />
            Pro Insight
          </span>
        ) : null}
      </div>

      {data.hasFullAccess ? (
        data.hasSourceData ? (
          <>
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 md:mt-6 md:p-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data.visitorSourcesData} cx="50%" cy="50%" outerRadius={95} dataKey="value" stroke="none">
                    {data.visitorSourcesData.map((entry, index) => (
                      <Cell key={`source-${entry.name}-${index + 1}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              {data.visitorSourcesData.map((source) => (
                <div key={`legend-${source.name}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: source.color }} />
                  <span className="text-xs text-slate-600 sm:text-sm">{source.name}</span>
                  <span className="ml-auto text-sm font-semibold text-slate-950">{formatNumber(source.value)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600 md:mt-6 md:p-6">
            No visitor source data yet.
            <br />
            Once traffic starts arriving from social, search, or referrals, the breakdown appears here.
          </div>
        )
      ) : (
        <>
          <div className="mt-4 rounded-[20px] border border-cyan-100 bg-[linear-gradient(145deg,_#ecfeff_0%,_#ffffff_58%,_#f8fafc_100%)] p-4 md:mt-6 md:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-700">Top Source So Far</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 md:mt-3 md:text-3xl">{data.topSource || "Waiting for your first traffic source"}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600 md:mt-3 md:text-sm md:leading-6">
              {data.topSource
                ? data.sourceCount > 1
                  ? `${data.sourceCount} tracked channels have already sent visitors. Unlock ${data.upgradeTarget} to see the full percentage split and how each one performs over time.`
                  : `This is your strongest traffic source so far. Unlock ${data.upgradeTarget} to compare it against the rest as more channels appear.`
                : `As soon as visitors arrive from social, search, or referral traffic, you will see the first signal here.`}
            </p>
          </div>

          <div className="mt-4 space-y-2.5 md:mt-6 md:space-y-4">
            {data.sourcePreviewRows.map((item, index) => (
              <div key={`source-preview-${index + 1}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3 text-xs md:text-sm">
                  <span className={`font-medium ${item.visible ? "text-slate-900" : "text-slate-500"}`}>{item.label}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.visible ? "bg-cyan-100 text-cyan-700" : "border border-slate-200 bg-white text-slate-500"}`}>
                    {item.visible ? "Visible" : `Locked on ${data.upgradeTarget}`}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${item.visible ? "bg-gradient-to-r from-cyan-500 to-blue-500" : "bg-gradient-to-r from-slate-300 via-slate-200 to-slate-100"}`}
                    style={{ width: item.width }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/dashboard/pricing"
            onClick={() => {
              actions.onUpgradeClick("analytics_sources_cta");
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-cyan-200 hover:bg-cyan-50 md:mt-6"
          >
            See Full Source Breakdown
            <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}
