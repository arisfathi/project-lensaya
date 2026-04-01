import { ArrowRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, Tooltip, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { CHART_TOOLTIP_STYLE, PREVIEW_BAR_WIDTHS } from "../constants";
import type { PreviewCategoryItem } from "../types";

type AnalyticsCategoryMomentumSectionProps = {
  data: {
    hasFullAccess: boolean;
    hasCategoryData: boolean;
    categoryData: Array<{ name: string; value: number }>;
    previewCategories: PreviewCategoryItem[];
    totalCategoriesTracked: number;
    upgradeTarget: string;
  };
  actions: {
    onUpgradeClick: (surface: string) => void;
  };
};

export function AnalyticsCategoryMomentumSection({ data, actions }: AnalyticsCategoryMomentumSectionProps) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 md:text-xl">Category Momentum</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
            {data.hasFullAccess
              ? "See which services or categories are attracting the most attention right now."
              : `${data.upgradeTarget} reveals the exact rankings and view counts behind your strongest categories.`}
          </p>
        </div>
        {!data.hasFullAccess ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <Lock className="h-3.5 w-3.5" />
            Preview
          </span>
        ) : null}
      </div>

      {data.hasFullAccess ? (
        data.hasCategoryData ? (
          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 md:mt-6 md:p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.categoryData}>
                <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: "12px" }} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="value" fill="#06b6d4" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600 md:mt-6 md:p-6">
            No category performance data yet.
            <br />
            Publish more portfolio work and let visitors explore it to see what rises to the top.
          </div>
        )
      ) : data.previewCategories.length > 0 ? (
        <>
          <div className="mt-4 space-y-2.5 md:mt-6 md:space-y-4">
            {data.previewCategories.map((category, index) => (
              <div key={`category-preview-${category.name}-${index + 1}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3.5 md:rounded-2xl md:px-4 md:py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-bold text-slate-900 shadow-sm md:h-9 md:w-9 md:rounded-2xl md:text-sm">
                      {category.rank}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{category.name}</p>
                      <p className="text-[11px] text-slate-500 md:text-xs">Exact views unlock on {data.upgradeTarget}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${index === 0 ? "bg-cyan-100 text-cyan-700" : "border border-slate-200 bg-white text-slate-600"}`}>
                    {index === 0 ? "Leading" : "Tracked"}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: PREVIEW_BAR_WIDTHS[index] || "46%" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 px-3.5 py-3.5 text-white md:mt-6 md:px-4 md:py-4">
            <p className="text-sm font-semibold">{data.totalCategoriesTracked > data.previewCategories.length ? `${data.totalCategoriesTracked - data.previewCategories.length} more tracked categories are hidden` : `Exact ranking depth is locked on ${data.upgradeTarget}`}</p>
            <p className="mt-1 text-xs text-slate-300 md:text-sm">Use {data.upgradeTarget} to see every category, exact counts, and where your portfolio momentum is strongest.</p>
            <Link
              to="/dashboard/pricing"
              onClick={() => {
                actions.onUpgradeClick("analytics_categories_cta");
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-50 md:mt-4"
            >
              Unlock Exact Category Rankings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600 md:mt-6 md:p-6">
            Your leading categories will appear once visitors start exploring your portfolio.
            <br />
            {data.upgradeTarget} will reveal exact counts and full ranking depth when that happens.
          </div>
          <Link
            to="/dashboard/pricing"
            onClick={() => {
              actions.onUpgradeClick("analytics_categories_empty_cta");
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-cyan-200 hover:bg-cyan-50 md:mt-6"
          >
            Unlock Category Insights
            <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}
