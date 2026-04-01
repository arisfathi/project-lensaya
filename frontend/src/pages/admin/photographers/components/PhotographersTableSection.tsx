import { Ban, CheckCircle, Eye } from "lucide-react";
import { Avatar } from "../../../../components/ui/Avatar";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import type { PaginationMeta, PhotographerItem } from "../types";
import { formatDate, formatPlan, formatStatus, getPlanBadgeClassName, getStatusBadgeClassName } from "../utils";

type PhotographersTableData = {
  loading: boolean;
  rows: PhotographerItem[];
  pagination: PaginationMeta;
  page: number;
};

type PhotographersTableActions = {
  onOpenDetail: (id: string) => void;
  onOpenStatusToggle: (item: PhotographerItem) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

type PhotographersTableSectionProps = {
  data: PhotographersTableData;
  actions: PhotographersTableActions;
};

export function PhotographersTableSection({ data, actions }: PhotographersTableSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Avatar</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Photographer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Portfolios</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Images</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Last Active</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-8">
                  <LoadingSpinner label="Loading photographers..." />
                </td>
              </tr>
            ) : data.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-sm text-slate-500">
                  No photographers found.
                </td>
              </tr>
            ) : (
              data.rows.map((photographer) => (
                <tr key={photographer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Avatar src={photographer.avatarUrl} name={photographer.name} size={40} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-slate-900">{photographer.name}</div>
                      <div className="text-xs text-slate-500">Joined {formatDate(photographer.joinDate)}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-slate-600">@{photographer.username || "unknown"}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPlanBadgeClassName(
                        photographer.plan
                      )}`}
                    >
                      {formatPlan(photographer.plan)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{photographer.portfolioCount || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{photographer.imagesStored || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClassName(
                        photographer.status
                      )}`}
                    >
                      {formatStatus(photographer.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(photographer.lastActive)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="p-1 text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
                        title="View Details"
                        onClick={() => actions.onOpenDetail(photographer.id)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {photographer.status === "ACTIVE" ? (
                        <button
                          type="button"
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Suspend"
                          onClick={() => actions.onOpenStatusToggle(photographer)}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Activate"
                          onClick={() => actions.onOpenStatusToggle(photographer)}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Showing {data.rows.length} of {data.pagination.total} photographers
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={data.page <= 1 || data.loading}
            onClick={actions.onPrevPage}
            className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button className="px-3 py-1 bg-cyan-500 text-white rounded text-sm">{data.pagination.page}</button>
          <button
            type="button"
            disabled={data.page >= (data.pagination.totalPages || 1) || data.loading}
            onClick={actions.onNextPage}
            className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
