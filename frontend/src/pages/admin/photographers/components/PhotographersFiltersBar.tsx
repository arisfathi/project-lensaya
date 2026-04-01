import { Download, Search } from "lucide-react";
import type { PlanFilter, StatusFilter } from "../types";

type PhotographersFiltersData = {
  searchQuery: string;
  selectedPlan: PlanFilter;
  selectedStatus: StatusFilter;
  exporting: boolean;
};

type PhotographersFiltersActions = {
  onSearchChange: (value: string) => void;
  onPlanChange: (value: PlanFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
  onExport: () => void;
};

type PhotographersFiltersBarProps = {
  data: PhotographersFiltersData;
  actions: PhotographersFiltersActions;
};

export function PhotographersFiltersBar({ data, actions }: PhotographersFiltersBarProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or username..."
            value={data.searchQuery}
            onChange={(event) => actions.onSearchChange(event.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>

        <select
          value={data.selectedPlan}
          onChange={(event) => actions.onPlanChange(event.target.value as PlanFilter)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        >
          <option value="All">All Plans</option>
          <option value="FREE">Free</option>
          <option value="PRO">Pro</option>
          <option value="STUDIO">Studio</option>
        </select>

        <select
          value={data.selectedStatus}
          onChange={(event) => actions.onStatusChange(event.target.value as StatusFilter)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        >
          <option value="All">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>

        <button
          type="button"
          onClick={actions.onExport}
          disabled={data.exporting}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">{data.exporting ? "Exporting..." : "Export"}</span>
        </button>
      </div>
    </div>
  );
}
