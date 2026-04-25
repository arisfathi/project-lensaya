import { Link } from "react-router-dom";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePricingContent } from "../../../../hooks/usePricingContent";
import { resolvePricingUpgradeCopy } from "../../../../lib/pricingContent";
import { PREVIEW_BAR_WIDTHS } from "../constants";
import type { PreviewCategoryItem } from "../types";

type TrafficAndCategorySectionProps = {
  data: {
    trafficData: Array<{ name: string; views: number }>;
    categoryData: Array<{ name: string; value: number }>;
    hasFullAnalyticsAccess: boolean;
    analyticsUpgradeTarget: string;
    previewCategories: PreviewCategoryItem[];
    totalCategoriesTracked: number;
    hasCategoryData: boolean;
  };
  actions: {
    onTrackUpgradeIntent: (surface: string) => void;
  };
};

export function TrafficAndCategorySection({ data, actions }: TrafficAndCategorySectionProps) {
  const pricingContent = usePricingContent();
  const upgradeCopy = resolvePricingUpgradeCopy(pricingContent, data.analyticsUpgradeTarget);

  return (
    <div className="mb-5 grid gap-4 sm:mb-8 sm:gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:rounded-xl sm:border-gray-200 sm:p-6 sm:shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-slate-900 sm:mb-4 sm:text-lg">Weekly Traffic</h3>
        {data.trafficData.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600 sm:p-6 sm:text-sm">
            No traffic data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.trafficData}>
              <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Line type="monotone" dataKey="views" stroke="#06b6d4" strokeWidth={2} dot={{ fill: "#06b6d4", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:rounded-xl sm:border-gray-200 sm:p-6 sm:shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Portfolio Views by Category</h3>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              {data.hasFullAnalyticsAccess
                ? "See which services or categories are attracting the most attention right now."
                : upgradeCopy.description}
            </p>
          </div>
          {!data.hasFullAnalyticsAccess ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              Free Preview
            </span>
          ) : null}
        </div>

        {data.hasFullAnalyticsAccess ? (
          data.hasCategoryData ? (
            <div className="mt-4 sm:mt-6">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.categoryData}>
                  <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: "12px" }} tickLine={false} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600 sm:mt-6 sm:p-6 sm:text-sm">
              No portfolio views yet.
              <br />
              Create service listings and add portfolio capacity to start tracking analytics.
            </div>
          )
        ) : data.previewCategories.length > 0 ? (
          <>
            <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-4">
              {data.previewCategories.map((category, index) => (
                <div key={`overview-category-preview-${category.name}-${index + 1}`} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-bold text-slate-900 shadow-sm sm:h-9 sm:w-9 sm:rounded-2xl sm:text-sm">
                        {category.rank}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 sm:text-sm">{category.name}</p>
                        <p className="text-[11px] text-slate-500">Exact views unlock on {data.analyticsUpgradeTarget}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs ${index === 0 ? "bg-cyan-100 text-cyan-700" : "border border-slate-200 bg-white text-slate-600"}`}>
                      {index === 0 ? "Leading" : "Tracked"}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 sm:mt-3 sm:h-2">
                    <div className="h-full rounded-full bg-linear-to-r from-cyan-500 to-blue-500" style={{ width: PREVIEW_BAR_WIDTHS[index] || "46%" }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-slate-950 bg-slate-950 px-3.5 py-3.5 text-white sm:mt-6 sm:rounded-2xl sm:px-4 sm:py-4">
              <p className="text-xs font-semibold sm:text-sm">
                {data.totalCategoriesTracked > data.previewCategories.length
                  ? `${data.totalCategoriesTracked - data.previewCategories.length} more tracked categories are hidden.`
                  : `Exact ranking depth is locked on ${data.analyticsUpgradeTarget}.`}
              </p>
              <p className="mt-1 text-xs text-slate-300 sm:text-sm">
                You already have signals. Upgrade to {data.analyticsUpgradeTarget} to see the exact numbers and know which category deserves your next push.
              </p>
              <Link
                to="/dashboard/pricing"
                onClick={() => {
                  actions.onTrackUpgradeIntent("dashboard_overview_category_teaser");
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-cyan-50 sm:mt-4 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
              >
                Unlock {data.analyticsUpgradeTarget} Category Insights
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs leading-5 text-slate-600 sm:mt-6 sm:rounded-[22px] sm:p-6 sm:text-sm sm:leading-6">
              Visitors will start revealing your strongest categories here.
              <br />
              Free highlights the leaders. {data.analyticsUpgradeTarget} unlocks the exact counts and full ranking depth.
            </div>
            <Link
              to="/dashboard/pricing"
              onClick={() => {
                actions.onTrackUpgradeIntent("dashboard_overview_category_empty");
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:border-cyan-200 hover:bg-cyan-50 sm:mt-6 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
            >
              See {data.analyticsUpgradeTarget} Analytics
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
