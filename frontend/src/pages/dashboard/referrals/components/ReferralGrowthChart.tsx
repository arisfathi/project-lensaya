import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GrowthPoint } from "../types";

type ReferralGrowthChartProps = {
  growthData: GrowthPoint[];
};

export function ReferralGrowthChart({ growthData }: ReferralGrowthChartProps) {
  const hasGrowth = growthData.some((point) => Number(point.referrals || 0) > 0);

  return (
    <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-8 sm:rounded-xl sm:border-gray-200 sm:p-6">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Referral Growth</h2>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal sm:text-slate-600">Last 6 months</p>
      </div>

      {hasGrowth ? (
        <ResponsiveContainer width="100%" height={280}>
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
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center sm:rounded-lg">
          <p className="text-sm font-medium text-slate-700">No growth data yet</p>
          <p className="mt-1 text-xs text-slate-500">Share your referral link to start seeing trend momentum.</p>
        </div>
      )}
    </div>
  );
}
