import { ArrowRight, Lightbulb, Lock, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../../../routes.paths";
import { formatNumber, formatPercent } from "../utils";

type FunnelData = {
  portfolioViews: number;
  packageViews: number;
  packageSelections: number;
  inquiries: number;
  whatsappClicks: number;
  viewToInquiryRate: number | null;
  selectionToInquiryRate: number | null;
};

type ServicePerformanceRow = {
  serviceId: string;
  name: string;
  portfolioViews: number;
  packageViews: number;
  serviceSelections: number;
  packageSelections: number;
  inquiries: number;
  conversionRate: number;
};

type PackagePerformanceRow = {
  packageId: string;
  name: string;
  serviceId: string | null;
  packageViews: number;
  packageSelections: number;
  inquiries: number;
  selectionRate: number;
  inquiryRate: number;
};

type AnalyticsFunnelPerformanceSectionProps = {
  data: {
    hasFullAccess: boolean;
    upgradeTarget: string;
    funnel: FunnelData;
    servicePerformance: ServicePerformanceRow[];
    packagePerformance: PackagePerformanceRow[];
    comparison: {
      portfolioViews: { changePercent: number };
      packageSelections: { changePercent: number };
      inquiries: { changePercent: number };
    } | null;
  };
  actions: {
    onUpgradeClick: (surface: string) => void;
    onInsightActionClick: (action: "improve_portfolio_experience" | "refine_service_setup" | "optimize_packages") => void;
  };
};

const FunnelMetric = ({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
    <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
    {sublabel ? <p className="mt-1 text-xs text-slate-500">{sublabel}</p> : null}
  </div>
);

const ConfidenceBadge = ({ sampleSize }: { sampleSize: number }) => {
  const confidence = sampleSize >= 200 ? "High" : sampleSize >= 75 ? "Medium" : "Low";
  const toneClass =
    confidence === "High"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : confidence === "Medium"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${toneClass}`}>
      {confidence} confidence
    </span>
  );
};

const TrendPill = ({ label, changePercent }: { label: string; changePercent: number | null | undefined }) => {
  if (changePercent === null || changePercent === undefined || Number.isNaN(changePercent)) {
    return <span className="text-[11px] font-medium text-slate-500">{label}: n/a</span>;
  }

  const positive = changePercent >= 0;
  const toneClass = positive ? "text-emerald-700" : "text-rose-700";
  const direction = positive ? "+" : "";

  return <span className={`text-[11px] font-medium ${toneClass}`}>{label}: {direction}{changePercent.toFixed(1)}%</span>;
};

export function AnalyticsFunnelPerformanceSection({ data, actions }: AnalyticsFunnelPerformanceSectionProps) {
  const stepRates = [
    {
      label: "Portfolio -> Package View",
      rate: data.funnel.portfolioViews > 0 ? data.funnel.packageViews / data.funnel.portfolioViews : 0,
      hint: "Improve package visibility near your strongest portfolio items.",
    },
    {
      label: "Package View -> Selection",
      rate: data.funnel.packageViews > 0 ? data.funnel.packageSelections / data.funnel.packageViews : 0,
      hint: "Clarify package differences and add stronger package thumbnails.",
    },
    {
      label: "Selection -> Inquiry",
      rate: data.funnel.packageSelections > 0 ? data.funnel.inquiries / data.funnel.packageSelections : 0,
      hint: "Simplify inquiry form fields and highlight response time.",
    },
  ];

  const weakestStep = stepRates.reduce((lowest, current) => (current.rate < lowest.rate ? current : lowest), stepRates[0]);

  const bestService = data.servicePerformance.length > 0
    ? data.servicePerformance.reduce((best, current) => (current.conversionRate > best.conversionRate ? current : best), data.servicePerformance[0])
    : null;

  const bestPackage = data.packagePerformance.length > 0
    ? data.packagePerformance.reduce((best, current) => (current.inquiryRate > best.inquiryRate ? current : best), data.packagePerformance[0])
    : null;

  const dropOffSampleSize = weakestStep.label === "Portfolio -> Package View"
    ? data.funnel.portfolioViews
    : weakestStep.label === "Package View -> Selection"
      ? data.funnel.packageViews
      : data.funnel.packageSelections;

  return (
    <div className="mb-6 grid gap-4 md:mb-8 md:gap-6 xl:grid-cols-2">
      <section className="rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 md:text-xl">Booking Funnel</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
              Follow demand from portfolio views to package interest and inquiry actions.
            </p>
          </div>
          {!data.hasFullAccess ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              <Lock className="h-3.5 w-3.5" />
              Preview
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 md:mt-6 md:grid-cols-3 md:gap-3">
          <FunnelMetric label="Portfolio Views" value={formatNumber(data.funnel.portfolioViews)} />
          <FunnelMetric label="Package Views" value={formatNumber(data.funnel.packageViews)} />
          <FunnelMetric label="Selections" value={formatNumber(data.funnel.packageSelections)} />
          <FunnelMetric label="Inquiries" value={formatNumber(data.funnel.inquiries)} />
          <FunnelMetric label="WhatsApp" value={formatNumber(data.funnel.whatsappClicks)} />
          <FunnelMetric
            label="View -> Inquiry"
            value={data.hasFullAccess ? formatPercent(data.funnel.viewToInquiryRate) : "Locked"}
            sublabel={data.hasFullAccess ? "Portfolio conversion" : `Unlock on ${data.upgradeTarget}`}
          />
        </div>

        {!data.hasFullAccess ? (
          <Link
            to="/dashboard/pricing"
            onClick={() => {
              actions.onUpgradeClick("analytics_funnel_cta");
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-cyan-200 hover:bg-cyan-50 md:mt-6"
          >
            Unlock Funnel Conversion Rates
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <div className="mt-4 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-4 md:mt-6">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-cyan-700" />
              <p className="text-sm font-semibold text-slate-900">Actionable Insights</p>
            </div>
            <div className="mt-3 grid gap-2.5 md:grid-cols-3">
              <div className="rounded-xl border border-cyan-100 bg-white/80 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">
                  <Target className="h-3.5 w-3.5" />
                  Biggest Drop-Off
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <ConfidenceBadge sampleSize={dropOffSampleSize} />
                  <TrendPill label="Inquiries" changePercent={data.comparison?.inquiries.changePercent} />
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{weakestStep.label}</p>
                <p className="mt-1 text-xs text-slate-600">Rate: {formatPercent(weakestStep.rate)}</p>
                <p className="mt-1.5 text-xs text-slate-500">{weakestStep.hint}</p>
                <Link
                  to={ROUTES.dashboardPreview}
                  onClick={() => {
                    actions.onInsightActionClick("improve_portfolio_experience");
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800"
                >
                  Improve Portfolio Experience
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="rounded-xl border border-cyan-100 bg-white/80 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Best Service
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <ConfidenceBadge sampleSize={bestService?.portfolioViews || 0} />
                  <TrendPill label="Views" changePercent={data.comparison?.portfolioViews.changePercent} />
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{bestService?.name || "Not enough data"}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {bestService ? `${formatPercent(bestService.conversionRate)} CVR • ${formatNumber(bestService.inquiries)} inquiries` : "Capture more activity to rank services."}
                </p>
                <Link
                  to={ROUTES.dashboardServices}
                  onClick={() => {
                    actions.onInsightActionClick("refine_service_setup");
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800"
                >
                  Refine Service Setup
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="rounded-xl border border-cyan-100 bg-white/80 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Best Package
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <ConfidenceBadge sampleSize={bestPackage?.packageViews || 0} />
                  <TrendPill label="Selections" changePercent={data.comparison?.packageSelections.changePercent} />
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{bestPackage?.name || "Not enough data"}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {bestPackage ? `${formatPercent(bestPackage.inquiryRate)} inquiry rate • ${formatNumber(bestPackage.packageSelections)} selections` : "Capture more package traffic to rank offers."}
                </p>
                <Link
                  to={ROUTES.dashboardPackages}
                  onClick={() => {
                    actions.onInsightActionClick("optimize_packages");
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800"
                >
                  Optimize Packages
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 md:text-xl">Top Service & Package Performance</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
            Identify which offerings drive the strongest inquiry outcomes.
          </p>
        </div>

        {data.hasFullAccess ? (
          <div className="mt-4 space-y-4 md:mt-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Top Services</p>
              {data.servicePerformance.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No service-level analytics yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.servicePerformance.slice(0, 3).map((row) => (
                    <div key={row.serviceId} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                        <p className="text-xs font-medium text-slate-600">{formatPercent(row.conversionRate)} CVR</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatNumber(row.inquiries)} inquiries from {formatNumber(row.portfolioViews)} views
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Top Packages</p>
              {data.packagePerformance.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No package-level analytics yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.packagePerformance.slice(0, 3).map((row) => (
                    <div key={row.packageId} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                        <p className="text-xs font-medium text-slate-600">{formatPercent(row.selectionRate)} selection</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatNumber(row.packageSelections)} selections / {formatNumber(row.packageViews)} views
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 md:mt-6">
            <p className="text-sm font-semibold text-slate-900">Service and package rankings are locked on Free.</p>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              Upgrade to {data.upgradeTarget} to see top performers, package selection rates, and inquiry outcomes per offer.
            </p>
            <Link
              to="/dashboard/pricing"
              onClick={() => {
                actions.onUpgradeClick("analytics_performance_cta");
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Unlock Performance Breakdown
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
