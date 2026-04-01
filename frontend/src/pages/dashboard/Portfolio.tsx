import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { PortfolioUploader } from "../../components/upload/PortfolioUploader";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useToast } from "../../contexts/ToastContext";
import { isApiAccessError, portfolioApi, servicesApi, getApiErrorMessage } from "../../lib/api";
import { EDIT_FORM_DEFAULTS } from "./portfolio/constants";
import { EditPortfolioModal } from "./portfolio/components/EditPortfolioModal";
import { PortfolioCategoryFilter } from "./portfolio/components/PortfolioCategoryFilter";
import { PortfolioGallery } from "./portfolio/components/PortfolioGallery";
import { PortfolioHeader } from "./portfolio/components/PortfolioHeader";
import type { EditForm, PortfolioItem, ServiceItem } from "./portfolio/types";

export default function Portfolio() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("All");

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [toggleId, setToggleId] = useState<string | null>(null);

  const [editForm, setEditForm] = useState<EditForm>(EDIT_FORM_DEFAULTS);
  const [editTarget, setEditTarget] = useState<PortfolioItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioItem | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const { success, error } = useToast();

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [portfolioResult, servicesResult] = await Promise.all([portfolioApi.list(), servicesApi.list()]);
        if (!mounted) return;

        setItems((portfolioResult.items || []) as PortfolioItem[]);
        setServices((servicesResult.items || []) as ServiceItem[]);
      } catch (err) {
        if (!mounted || isApiAccessError(err)) return;
        error(getApiErrorMessage(err, "Failed to load portfolio"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [error]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setUploadModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(
        items
          .map((item) => item.category)
          .filter((category): category is string => Boolean(category && category.trim()))
          .map((category) => category.trim())
      )
    ).sort();

    return ["All", ...values];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "All") {
      return items;
    }
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  const featuredCount = useMemo(() => items.filter((item) => item.featured).length, [items]);

  const fetchPortfolioItems = async () => {
    const portfolioResult = await portfolioApi.list();
    setItems((portfolioResult.items || []) as PortfolioItem[]);
  };

  const openEditModal = (item: PortfolioItem) => {
    setEditTarget(item);
    setEditForm({
      serviceId: item.serviceId || "",
      category: item.category || "",
      featured: item.featured,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;

    try {
      setSavingEdit(true);
      await portfolioApi.update(editTarget.id, {
        serviceId: editForm.serviceId || undefined,
        category: editForm.category.trim() || undefined,
        featured: editForm.featured,
      });
      success("Portfolio item updated");
      setEditModalOpen(false);
      setEditTarget(null);
      await fetchPortfolioItems();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to update portfolio item"));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleFeatured = async (item: PortfolioItem) => {
    try {
      setToggleId(item.id);
      await portfolioApi.feature(item.id, !item.featured);
      success(item.featured ? "Removed from featured" : "Marked as featured");
      await fetchPortfolioItems();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to update featured status"));
    } finally {
      setToggleId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await portfolioApi.remove(deleteTarget.id);
      success("Portfolio item deleted");
      setDeleteTarget(null);
      await fetchPortfolioItems();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to delete portfolio item"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-6 sm:rounded-xl sm:border-slate-200 sm:bg-linear-to-br sm:from-white sm:to-slate-50 sm:p-6 sm:shadow-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Creator Gallery Manager</p>
          <h1 className="mt-2 text-lg font-semibold text-slate-900 sm:text-3xl sm:font-bold">Portfolio</h1>
          <p className="mt-1 text-sm text-slate-600">Tip: At least 12 photos usually improves inquiry quality.</p>
        </div>
      </div>

      <PortfolioHeader
        totalItems={items.length}
        featuredCount={featuredCount}
        onUploadClick={() => setUploadModalOpen(true)}
      />

      {loading ? (
        <LoadingCard label="Loading portfolio..." />
      ) : (
        <>
          <PortfolioCategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          <PortfolioGallery
            data={{
              items,
              filteredItems,
              services,
              selectedCategory,
              featuredCount,
              toggleId,
            }}
            handlers={{
              onToggleFeatured: (item) => {
                void handleToggleFeatured(item);
              },
              onEdit: openEditModal,
              onDelete: setDeleteTarget,
            }}
          />
        </>
      )}

      <Modal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload Portfolio Images"
        panelClassName="max-w-3xl"
      >
        <PortfolioUploader
          services={services}
          onClose={() => setUploadModalOpen(false)}
          onUploadSuccess={fetchPortfolioItems}
        />
      </Modal>

      <EditPortfolioModal
        modal={{
          open: editModalOpen,
          saving: savingEdit,
        }}
        formState={{
          form: editForm,
          services,
        }}
        handlers={{
          onClose: () => {
            setEditModalOpen(false);
            setEditTarget(null);
          },
          onSave: () => {
            void handleSaveEdit();
          },
          onServiceIdChange: (value) => setEditForm((current) => ({ ...current, serviceId: value })),
          onCategoryChange: (value) => setEditForm((current) => ({ ...current, category: value })),
          onFeaturedChange: (value) => setEditForm((current) => ({ ...current, featured: value })),
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Portfolio Item"
        message="Are you sure you want to delete this portfolio image? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </DashboardLayout>
  );
}

