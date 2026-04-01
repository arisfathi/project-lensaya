import { ArrowRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { formatNumber, formatPercent } from "../utils";

type ComparisonItem = {
  current: number;
  previous: number;
  changePercent: number;
  trend: "up" | "down";
};

type SourceFunnelRow = {
  source: string;
  pageViews: number;
  portfolioViews: number;
  packageViews: number;
  packageSelections: number;
  inquiries: number;
  whatsappClicks: number;
  viewToInquiryRate: number;
};

type AnalyticsRangeAndAttributionSectionProps = {
  data: {
    hasFullAccess: boolean;
    upgradeTarget: string;
    selectedWindowDays: number;
    comparison: {
      portfolioViews: ComparisonItem;
      packageViews: ComparisonItem;
      packageSelections: ComparisonItem;
      inquiries: ComparisonItem;
      whatsappClicks: ComparisonItem;
    } | null;
    sourceFunnelBreakdown: SourceFunnelRow[];
    sourceFilter: string;
    sourceFilterOptions: string[];
  };
  actions: {
    onWindowChange: (windowDays: number) => void;
    onSourceFilterChange: (source: string) => void;
    onExportCsv: () => void;
    onUpgradeClick: (surface: string) => void;
  };
};

const WINDOW_OPTIONS = [7, 30, 90];

const ComparisonSparkline = ({ value }: { value: ComparisonItem }) => {
  const points = [
    { step: "previous", amount: value.previous },
    { step: "current", amount: value.current },
  ];

  return (
    <div className="h-8 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line
            type="monotone"
            dataKey="amount"
            stroke={value.trend === "up" ? "#10b981" : "#ef4444"}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const ComparisonCard = ({ label, value }: { label: string; value: ComparisonItem }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-bold text-slate-950">{formatNumber(value.current)}</p>
        <p className={`mt-1 text-xs ${value.trend === "up" ? "text-emerald-700" : "text-rose-700"}`}>
          {value.changePercent >= 0 ? "+" : ""}
          {formatPercent(value.changePercent)} vs previous period
        </p>
      </div>
      <ComparisonSparkline value={value} />
    </div>
  </div>
);

export function AnalyticsRangeAndAttributionSection({ data, actions }: AnalyticsRangeAndAttributionSectionProps) {
  return (
    <div className="mb-6 grid gap-4 md:mb-8 md:gap-6 xl:grid-cols-2">
      <section className="rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 md:text-xl">Date Range & Trend Comparison</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
              Compare your selected window against the previous equivalent period.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.hasFullAccess ? (
              <button
                type="button"
                onClick={actions.onExportCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-cyan-200 hover:bg-cyan-50"
              >
                Export CSV
              </button>
            ) : null}
            {!data.hasFullAccess ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                <Lock className="h-3.5 w-3.5" />
                Pro Insight
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 md:mt-6">
          {WINDOW_OPTIONS.map((windowDays) => (
            <button
              key={windowDays}
              type="button"
              onClick={() => {
                actions.onWindowChange(windowDays);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors md:text-sm ${
                data.selectedWindowDays === windowDays
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              {windowDays}d
            </button>
          ))}
        </div>

        {data.hasFullAccess && data.comparison ? (
          <div className="mt-4 grid grid-cols-1 gap-2.5 md:mt-6 md:grid-cols-2 md:gap-3">
            <ComparisonCard label="Portfolio Views" value={data.comparison.portfolioViews} />
            <ComparisonCard label="Package Views" value={data.comparison.packageViews} />
            <ComparisonCard label="Package Selections" value={data.comparison.packageSelections} />
            <ComparisonCard label="Inquiries" value={data.comparison.inquiries} />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 md:mt-6">
            <p className="text-sm font-semibold text-slate-900">Comparison trends are locked on Free.</p>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              Upgrade to {data.upgradeTarget} to compare growth and decline across your chosen windows.
            </p>
            <Link
              to="/dashboard/pricing"
              onClick={() => {
                actions.onUpgradeClick("analytics_window_compare_cta");
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Unlock Trend Comparison
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 md:text-xl">Source-to-Funnel Attribution</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
              See which visitor sources actually produce inquiries.
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
          <div className="mt-4 flex flex-wrap gap-2 md:mt-6">
            {data.sourceFilterOptions.map((option) => {
              const active = data.sourceFilter === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    actions.onSourceFilterChange(option);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "border-cyan-400 bg-cyan-50 text-cyan-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : null}

        {data.hasFullAccess ? (
          data.sourceFunnelBreakdown.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600 md:mt-6 md:p-6">
              No attribution funnel data yet for this period.
            </div>
          ) : (
            <div className="mt-4 space-y-2.5 md:mt-6">
              {data.sourceFunnelBreakdown.slice(0, 5).map((row) => (
                <div key={row.source} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{row.source}</p>
                    <p className="text-xs font-medium text-slate-600">{formatPercent(row.viewToInquiryRate)} view-&gt;inquiry</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatNumber(row.portfolioViews)} views, {formatNumber(row.packageViews)} package views, {formatNumber(row.inquiries)} inquiries
                  </p>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 md:mt-6">
            <p className="text-sm font-semibold text-slate-900">Source-to-funnel attribution is locked on Free.</p>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              Upgrade to {data.upgradeTarget} to find which channels drive qualified inquiries, not just traffic.
            </p>
            <Link
              to="/dashboard/pricing"
              onClick={() => {
                actions.onUpgradeClick("analytics_source_funnel_cta");
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-cyan-200 hover:bg-cyan-50"
            >
              Unlock Attribution Funnel
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
