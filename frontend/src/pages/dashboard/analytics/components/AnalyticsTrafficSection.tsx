import { ArrowRight, LineChart as LineChartIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { LineChart, Line, Tooltip, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { usePricingContent } from "../../../../hooks/usePricingContent";
import { resolvePricingUpgradeCopy } from "../../../../lib/pricingContent";
import { CHART_TOOLTIP_STYLE } from "../constants";
import { formatNumber } from "../utils";

type AnalyticsTrafficSectionProps = {
  data: {
    hasFullAccess: boolean;
    trafficWindowDays: number;
    weeklyTrafficTotal: number;
    hasTrafficData: boolean;
    trafficData: Array<{ name: string; visits: number }>;
    upgradeTarget: string;
  };
  actions: {
    onUpgradeClick: (surface: string) => void;
  };
};

export function AnalyticsTrafficSection({ data, actions }: AnalyticsTrafficSectionProps) {
  const pricingContent = usePricingContent();
  const upgradeCopy = resolvePricingUpgradeCopy(pricingContent, data.upgradeTarget);

  return (
    <div className="mb-5 rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-sm md:mb-8 md:p-6">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 md:text-xl">Traffic Pulse</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
            {data.hasFullAccess
              ? `Live ${data.trafficWindowDays}-day traffic trend with deeper context available in the rest of the dashboard.`
              : upgradeCopy.description}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-700">
          <LineChartIcon className="h-3.5 w-3.5" />
          This week: {formatNumber(data.weeklyTrafficTotal)}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 md:mt-6 md:p-4">
        {!data.hasTrafficData ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm leading-6 text-slate-600">
            No traffic data yet.
            <br />
            Once visitors start browsing your portfolio, this chart becomes your live pulse.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.trafficData}>
              <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: "12px" }} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="visits"
                stroke="#06b6d4"
                strokeWidth={3}
                dot={{ fill: "#06b6d4", r: 4, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {!data.hasFullAccess ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-3.5 py-3.5 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Free tells you if momentum exists.</p>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">{upgradeCopy.description}</p>
          </div>
          <Link
            to="/dashboard/pricing"
            onClick={() => {
              actions.onUpgradeClick("analytics_traffic_cta");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-600"
          >
            Upgrade to {data.upgradeTarget}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
