import { useEffect, useMemo, useState } from "react";
import { Search, Download, Eye, Ban, CheckCircle } from "lucide-react";
import { AdminLayout } from "../../layouts/AdminLayout";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { Avatar } from "../../components/ui/Avatar";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type PhotographerItem = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  plan: "FREE" | "PRO" | "STUDIO";
  portfolioCount: number;
  imagesStored: number;
  status: "ACTIVE" | "SUSPENDED";
  joinDate: string;
  lastActive: string | null;
};

type PhotographerDetail = {
  photographer: {
    id: string;
    fullName: string;
    email: string;
    username: string | null;
    status: string;
  };
  subscription: { plan?: string } | null;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PlanFilter = "All" | "FREE" | "PRO" | "STUDIO";
type StatusFilter = "All" | "ACTIVE" | "SUSPENDED";

const defaultPagination: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

const formatPlan = (plan: string) => {
  if (plan === "FREE") return "Free";
  if (plan === "PRO") return "Pro";
  if (plan === "STUDIO") return "Studio";
  return plan || "Unknown";
};

const formatStatus = (status: string) => (status === "ACTIVE" ? "Active" : "Suspended");

const formatDate = (value: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export default function Photographers() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PhotographerItem[]>([]);
  const [countsByPlan, setCountsByPlan] = useState<Record<string, number>>({ FREE: 0, PRO: 0, STUDIO: 0 });
  const [pagination, setPagination] = useState<PaginationMeta>(defaultPagination);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanFilter>("All");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);

  const [exporting, setExporting] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState<PhotographerItem | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<PhotographerDetail | null>(null);

  const { success, error, info } = useToast();

  const queryParams = useMemo(
    () => ({
      page,
      limit: 20,
      search: searchQuery.trim() || undefined,
      plan: selectedPlan === "All" ? undefined : selectedPlan,
      status: selectedStatus === "All" ? undefined : selectedStatus,
    }),
    [page, searchQuery, selectedPlan, selectedStatus]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const result = await adminApi.photographers(queryParams);
        if (!mounted) return;
        setRows((result.items || []) as PhotographerItem[]);
        setCountsByPlan(result.countsByPlan || { FREE: 0, PRO: 0, STUDIO: 0 });
        setPagination((result.pagination || defaultPagination) as PaginationMeta);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load photographers"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error, queryParams]);

  const refreshCurrent = async () => {
    const result = await adminApi.photographers(queryParams);
    setRows((result.items || []) as PhotographerItem[]);
    setCountsByPlan(result.countsByPlan || { FREE: 0, PRO: 0, STUDIO: 0 });
    setPagination((result.pagination || defaultPagination) as PaginationMeta);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const result = await adminApi.photographersExport({
        plan: selectedPlan === "All" ? undefined : (selectedPlan as "FREE" | "PRO" | "STUDIO"),
        status: selectedStatus === "All" ? undefined : (selectedStatus as "ACTIVE" | "SUSPENDED"),
      });

      if (result.downloadUrl) {
        window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
        success("Export started");
      } else {
        info("Export endpoint is available but no file URL was returned yet");
      }
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to export photographers"));
    } finally {
      setExporting(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const result = await adminApi.photographerDetail(id);
      setDetail(result as PhotographerDetail);
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to load photographer details"));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === "ACTIVE" ? "suspended" : "active";

    try {
      setStatusSaving(true);
      await adminApi.photographerStatus(statusTarget.id, nextStatus);
      success(`Photographer ${nextStatus === "active" ? "activated" : "suspended"}`);
      setStatusTarget(null);
      await refreshCurrent();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to update photographer status"));
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Photographers</h1>
        <p className="text-slate-600">Manage all photographers on the platform.</p>
      </div>

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or username..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <select
            value={selectedPlan}
            onChange={(e) => {
              setSelectedPlan(e.target.value as PlanFilter);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="All">All Plans</option>
            <option value="FREE">Free</option>
            <option value="PRO">Pro</option>
            <option value="STUDIO">Studio</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="All">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export"}</span>
          </button>
        </div>
      </div>

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
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8">
                    <LoadingSpinner label="Loading photographers..." />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-sm text-slate-500">
                    No photographers found.
                  </td>
                </tr>
              ) : (
                rows.map((photographer) => (
                  <tr key={photographer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Avatar
                        src={photographer.avatarUrl}
                        name={photographer.name}
                        size={40}
                      />
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
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          photographer.plan === "STUDIO"
                            ? "bg-purple-100 text-purple-700"
                            : photographer.plan === "PRO"
                              ? "bg-cyan-100 text-cyan-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {formatPlan(photographer.plan)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{photographer.portfolioCount || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{photographer.imagesStored || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          photographer.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
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
                          onClick={() => void openDetail(photographer.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {photographer.status === "ACTIVE" ? (
                          <button
                            type="button"
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Suspend"
                            onClick={() => setStatusTarget(photographer)}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Activate"
                            onClick={() => setStatusTarget(photographer)}
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
            Showing {rows.length} of {pagination.total} photographers
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button className="px-3 py-1 bg-cyan-500 text-white rounded text-sm">{pagination.page}</button>
            <button
              type="button"
              disabled={page >= (pagination.totalPages || 1) || loading}
              onClick={() => setPage((current) => Math.min(current + 1, pagination.totalPages || 1))}
              className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={detailOpen}
        title="Photographer Details"
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
      >
        {detailLoading ? (
          <LoadingSpinner label="Loading details..." />
        ) : detail ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Name</p>
              <p className="text-sm font-medium text-slate-900">{detail.photographer.fullName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="text-sm font-medium text-slate-900">{detail.photographer.email}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Username</p>
              <p className="text-sm font-medium text-slate-900">@{detail.photographer.username || "unknown"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Plan</p>
              <p className="text-sm font-medium text-slate-900">{formatPlan(detail.subscription?.plan || "FREE")}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <p className="text-sm font-medium text-slate-900">{formatStatus(detail.photographer.status)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No details available.</p>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.status === "ACTIVE" ? "Suspend Photographer" : "Activate Photographer"}
        message={
          statusTarget?.status === "ACTIVE"
            ? `Suspend ${statusTarget?.name}? They will lose access until reactivated.`
            : `Activate ${statusTarget?.name}? They will be able to access their dashboard again.`
        }
        confirmLabel={statusTarget?.status === "ACTIVE" ? "Suspend" : "Activate"}
        loading={statusSaving}
        onCancel={() => setStatusTarget(null)}
        onConfirm={() => void handleStatusToggle()}
      />
    </AdminLayout>
  );
}
