import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { useToast } from "../../contexts/ToastContext";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { DEFAULT_COUNTS_BY_PLAN, DEFAULT_PAGINATION, PAGE_SIZE } from "./photographers/constants";
import { PhotographerDetailModal } from "./photographers/components/PhotographerDetailModal";
import { PhotographerStatsCards } from "./photographers/components/PhotographerStatsCards";
import { PhotographersFiltersBar } from "./photographers/components/PhotographersFiltersBar";
import { PhotographersHeader } from "./photographers/components/PhotographersHeader";
import { PhotographersTableSection } from "./photographers/components/PhotographersTableSection";
import { PhotographerStatusConfirmDialog } from "./photographers/components/PhotographerStatusConfirmDialog";
import type { PaginationMeta, PhotographerDetail, PhotographerItem, PlanFilter, StatusFilter } from "./photographers/types";
import {
  coerceCountsByPlan,
  coercePagination,
  coercePhotographerDetail,
  coercePhotographerItems,
} from "./photographers/utils";

export default function Photographers() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PhotographerItem[]>([]);
  const [countsByPlan, setCountsByPlan] = useState(DEFAULT_COUNTS_BY_PLAN);
  const [pagination, setPagination] = useState<PaginationMeta>(DEFAULT_PAGINATION);

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
      limit: PAGE_SIZE,
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
        setRows(coercePhotographerItems(result.items));
        setCountsByPlan(coerceCountsByPlan(result.countsByPlan));
        setPagination(coercePagination(result.pagination));
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
    setRows(coercePhotographerItems(result.items));
    setCountsByPlan(coerceCountsByPlan(result.countsByPlan));
    setPagination(coercePagination(result.pagination));
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const result = await adminApi.photographersExport({
        plan: selectedPlan === "All" ? undefined : selectedPlan,
        status: selectedStatus === "All" ? undefined : selectedStatus,
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
      setDetail(coercePhotographerDetail(result));
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to load photographer details"));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!statusTarget) return;
    const nextStatus: "active" | "suspended" = statusTarget.status === "ACTIVE" ? "suspended" : "active";

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
      <PhotographersHeader
        title="Photographers"
        description="Manage all photographers on the platform."
      />

      <PhotographerStatsCards countsByPlan={countsByPlan} pagination={pagination} />

      <PhotographersFiltersBar
        data={{
          searchQuery,
          selectedPlan,
          selectedStatus,
          exporting,
        }}
        actions={{
          onSearchChange: (value) => {
            setSearchQuery(value);
            setPage(1);
          },
          onPlanChange: (value) => {
            setSelectedPlan(value);
            setPage(1);
          },
          onStatusChange: (value) => {
            setSelectedStatus(value);
            setPage(1);
          },
          onExport: () => {
            void handleExport();
          },
        }}
      />

      <PhotographersTableSection
        data={{
          loading,
          rows,
          pagination,
          page,
        }}
        actions={{
          onOpenDetail: (id) => {
            void openDetail(id);
          },
          onOpenStatusToggle: (item) => {
            setStatusTarget(item);
          },
          onPrevPage: () => {
            setPage((current) => Math.max(current - 1, 1));
          },
          onNextPage: () => {
            setPage((current) => Math.min(current + 1, pagination.totalPages || 1));
          },
        }}
      />

      <PhotographerDetailModal
        open={detailOpen}
        detailLoading={detailLoading}
        detail={detail}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
      />

      <PhotographerStatusConfirmDialog
        statusTarget={statusTarget}
        loading={statusSaving}
        onCancel={() => {
          setStatusTarget(null);
        }}
        onConfirm={() => {
          void handleStatusToggle();
        }}
      />
    </AdminLayout>
  );
}
