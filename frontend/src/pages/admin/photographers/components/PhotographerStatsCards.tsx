import type { PlanCounts, PaginationMeta } from "../types";

type PhotographerStatsCardsProps = {
  countsByPlan: PlanCounts;
  pagination: PaginationMeta;
};

export function PhotographerStatsCards({ countsByPlan, pagination }: PhotographerStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <p className="text-sm text-slate-600 mb-1">Total</p>
        <p className="text-2xl font-bold text-slate-900">{pagination.total || 0}</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <p className="text-sm text-slate-600 mb-1">Free Plan</p>
        <p className="text-2xl font-bold text-slate-900">{countsByPlan.FREE || 0}</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <p className="text-sm text-slate-600 mb-1">Pro Plan</p>
        <p className="text-2xl font-bold text-cyan-500">{countsByPlan.PRO || 0}</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <p className="text-sm text-slate-600 mb-1">Studio Plan</p>
        <p className="text-2xl font-bold text-purple-500">{countsByPlan.STUDIO || 0}</p>
      </div>
    </div>
  );
}
