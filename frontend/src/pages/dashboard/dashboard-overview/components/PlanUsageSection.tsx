import { Link } from "react-router-dom";
import type { UsageCard } from "../types";
import { formatUsageLimit } from "../utils";

type PlanUsageSectionProps = {
  usageCards: UsageCard[];
};

export function PlanUsageSection({ usageCards }: PlanUsageSectionProps) {
  if (usageCards.length === 0) return null;

  return (
    <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-8 sm:rounded-xl sm:border-gray-200 sm:p-6 sm:shadow-sm">
      <div className="mb-3.5 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Plan Usage</h3>
          <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">Track limits before hard stops.</p>
        </div>
        <Link
          to="/dashboard/pricing"
          className="inline-flex items-center rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 sm:px-3 sm:py-2 sm:text-sm"
        >
          Compare Plans
        </Link>
      </div>

      <div className="space-y-2.5 sm:grid sm:grid-cols-1 sm:gap-3 md:grid-cols-3 md:gap-4 md:space-y-0">
        {usageCards.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 sm:rounded-lg sm:border-gray-200 sm:bg-white sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{item.label}</p>
              <p className="text-xs font-semibold text-slate-700">
                {item.used} / {formatUsageLimit(item.limit)}
              </p>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 sm:mt-3 sm:h-2 sm:bg-slate-100">
              <div
                className={`h-1.5 transition-all sm:h-2 ${
                  item.status === "critical"
                    ? "bg-red-500"
                    : item.status === "warning"
                      ? "bg-amber-500"
                      : "bg-cyan-500"
                }`}
                style={{ width: `${item.percent}%` }}
              />
            </div>
            {item.context ? <p className="mt-2 text-[11px] text-slate-500 sm:text-xs">{item.context}</p> : null}
            {item.suggestionText ? (
              <p className="mt-2 text-[11px] font-medium text-cyan-700 sm:text-xs">{item.suggestionText}</p>
            ) : item.status === "unlimited" ? (
              <p className="mt-2 text-[11px] text-slate-500 sm:text-xs">Unlimited on your current plan.</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
