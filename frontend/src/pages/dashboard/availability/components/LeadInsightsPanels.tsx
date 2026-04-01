import { Button } from "../../../../components/ui/Button";
import type { LeadInsights, LeadTrendPoint } from "../types";
import { formatLeadSourceLabel, formatMinutesToLabel, formatTrendDayLabel, toPercentLabel } from "../utils";

type LeadInsightsPanelsProps = {
  bookingLeadInsights: LeadInsights | null;
  leadNudgeUpgradeTarget: string;
  leadTrendWindow: "7d" | "30d";
  selectedLeadTrend: LeadTrendPoint[];
  leadTrendMax: number;
  onLeadTrendWindowChange: (value: "7d" | "30d") => void;
  onUpgradeFromLeads: (context: string) => void;
};

export function LeadInsightsPanels({
  bookingLeadInsights,
  leadNudgeUpgradeTarget,
  leadTrendWindow,
  selectedLeadTrend,
  leadTrendMax,
  onLeadTrendWindowChange,
  onUpgradeFromLeads,
}: LeadInsightsPanelsProps) {
  return (
    <>
      {bookingLeadInsights?.locked?.advancedAnalytics ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-900">Advanced analytics locked</p>
            <p className="text-xs text-amber-800">
              Upgrade to {leadNudgeUpgradeTarget} to unlock source ROI, trends, and response-time benchmarks for better close rate.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => onUpgradeFromLeads("analytics_lock_banner")}>
            View Plans
          </Button>
        </div>
      ) : null}

      <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white sm:hidden">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Conversion</p>
          <p className="text-sm font-semibold text-slate-900">{toPercentLabel(bookingLeadInsights?.rates.conversionRate)}</p>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Response</p>
          <p className="text-sm font-semibold text-slate-900">{toPercentLabel(bookingLeadInsights?.rates.responseRate)}</p>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Avg Response Time</p>
          <p className="text-sm font-semibold text-slate-900">{formatMinutesToLabel(bookingLeadInsights?.responseTime.averageMinutes)}</p>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Converted Leads</p>
          <p className="text-sm font-semibold text-slate-900">{bookingLeadInsights?.totals.converted ?? 0}</p>
        </div>
      </div>

      <div className="mb-3 hidden grid-cols-2 gap-2.5 sm:grid sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Conversion Rate</p>
          <p className="text-base font-semibold text-cyan-900 sm:text-lg">{toPercentLabel(bookingLeadInsights?.rates.conversionRate)}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Response Rate</p>
          <p className="text-base font-semibold text-emerald-900 sm:text-lg">{toPercentLabel(bookingLeadInsights?.rates.responseRate)}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Avg Response Time</p>
          <p className="text-base font-semibold text-blue-900 sm:text-lg">{formatMinutesToLabel(bookingLeadInsights?.responseTime.averageMinutes)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Converted Leads</p>
          <p className="text-base font-semibold text-slate-900 sm:text-lg">{bookingLeadInsights?.totals.converted ?? 0}</p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-3 sm:rounded-lg sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead Trend (7d/30d)</p>
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => onLeadTrendWindowChange("7d")}
              className={`px-2.5 py-1 text-[11px] font-semibold ${leadTrendWindow === "7d" ? "bg-cyan-500 text-white" : "bg-white text-slate-600"}`}
            >
              7D
            </button>
            <button
              type="button"
              onClick={() => onLeadTrendWindowChange("30d")}
              className={`px-2.5 py-1 text-[11px] font-semibold ${leadTrendWindow === "30d" ? "bg-cyan-500 text-white" : "bg-white text-slate-600"}`}
            >
              30D
            </button>
          </div>
        </div>

        {selectedLeadTrend.length ? (
          <div className="flex h-28 items-end gap-1 overflow-x-auto rounded-md border border-slate-100 bg-slate-50 p-2 sm:h-40 sm:p-3">
            {selectedLeadTrend.map((row) => {
              const leadHeight = Math.max(6, Math.round((row.leads / leadTrendMax) * 100));
              const convertedHeight = Math.max(4, Math.round((row.converted / leadTrendMax) * 100));
              return (
                <div key={row.date} className="flex min-w-4.5 flex-col items-center justify-end gap-1 sm:min-w-5.5">
                  <div className="flex h-19.5 w-full items-end gap-0.5 sm:h-27.5">
                    <div
                      title={`${formatTrendDayLabel(row.date)} leads: ${row.leads}`}
                      className="flex-1 rounded-t bg-cyan-500"
                      style={{ height: `${leadHeight}%` }}
                    />
                    <div
                      title={`${formatTrendDayLabel(row.date)} converted: ${row.converted}`}
                      className="flex-1 rounded-t bg-emerald-500"
                      style={{ height: `${convertedHeight}%` }}
                    />
                  </div>
                  <span className="whitespace-nowrap text-[10px] text-slate-500">{formatTrendDayLabel(row.date)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No trend data yet.</p>
        )}

        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded bg-cyan-500" />Leads</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" />Converted</span>
        </div>
      </div>

      {bookingLeadInsights?.sourceBreakdown?.length ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-3 sm:rounded-lg sm:px-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Source ROI</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bookingLeadInsights.sourceBreakdown.slice(0, 6).map((row) => (
              <div key={formatLeadSourceLabel(row.source)} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <p className="font-semibold text-slate-800">{formatLeadSourceLabel(row.source)}</p>
                <p>{row.leads} leads - {row.converted} converted - {toPercentLabel(row.conversionRate)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
