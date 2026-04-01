import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlanDistributionItem, UpgradeDowngradeItem } from "../types";

type SubscriptionChartsSectionProps = {
  distribution: PlanDistributionItem[];
  trend: UpgradeDowngradeItem[];
};

export function SubscriptionChartsSection({ distribution, trend }: SubscriptionChartsSectionProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Plan Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={distribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {distribution.map((entry) => (
                <Cell key={entry.id || entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Upgrades vs Downgrades</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trend}>
            <XAxis dataKey="month" stroke="#94a3b8" style={{ fontSize: "12px" }} />
            <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
            />
            <Line type="monotone" dataKey="upgrades" stroke="#10b981" strokeWidth={2} name="Upgrades" />
            <Line type="monotone" dataKey="downgrades" stroke="#ef4444" strokeWidth={2} name="Downgrades" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
