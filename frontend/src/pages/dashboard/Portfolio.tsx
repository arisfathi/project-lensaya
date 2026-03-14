import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, Star, Trash2, Upload } from "lucide-react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { PortfolioUploader } from "../../components/upload/PortfolioUploader";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FormInput } from "../../components/ui/FormInput";
import { Dropdown } from "../../components/ui/Dropdown";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useToast } from "../../contexts/ToastContext";
import { portfolioApi, servicesApi, getApiErrorMessage } from "../../lib/api";

type ServiceItem = {
  id: string;
  name: string;
};

type PortfolioItem = {
  id: string;
  imageUrl: string | null;
  serviceId: string | null;
  category: string | null;
  featured: boolean;
  views: number;
  createdAt: string;
};

type EditForm = {
  serviceId: string;
  category: string;
  featured: boolean;
};

const editDefaults: EditForm = {
  serviceId: "",
  category: "",
  featured: false,
};

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

  const [editForm, setEditForm] = useState<EditForm>(editDefaults);
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
        if (!mounted) return;
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

  const getCategoryLabel = (item: PortfolioItem) => {
    if (item.category) return item.category;
    if (!item.serviceId) return "Uncategorized";
    return services.find((service) => service.id === item.serviceId)?.name || "Service";
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Portfolio</h1>
          <p className="text-slate-600">
            Manage your photography portfolio - {items.length} photos - {featuredCount} featured
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tip: Photographers with at least 12 photos receive more inquiries.
          </p>
        </div>
        <Button className="px-6 py-3" onClick={() => setUploadModalOpen(true)}>
          <Upload className="w-5 h-5" />
          Upload Photos
        </Button>
      </div>

      {loading ? (
        <LoadingCard label="Loading portfolio..." />
      ) : (
        <>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-slate-600" />
              <span className="font-medium text-slate-900">Filter by category:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedCategory === category
                      ? "bg-cyan-500 text-white"
                      : "bg-white text-slate-600 border border-gray-300 hover:border-cyan-300"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {selectedCategory === "All" && featuredCount > 0 ? (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                Featured Portfolio
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {items
                  .filter((item) => item.featured)
                  .map((item) => (
                    <div
                      key={`featured-${item.id}`}
                      className="group relative bg-white rounded-xl overflow-hidden shadow-sm border-2 border-yellow-200 hover:shadow-lg transition-all"
                    >
                      <div className="aspect-square overflow-hidden bg-gray-100">
                        <ImageWithFallback
                          src={item.imageUrl || ""}
                          alt="Portfolio"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>

                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{getCategoryLabel(item)}</span>
                            <span className="text-xs">{item.views} views</span>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 flex gap-2">
                          <button
                            type="button"
                            className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                            onClick={() => {
                              void handleToggleFeatured(item);
                            }}
                            disabled={toggleId === item.id}
                          >
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          </button>
                          <button
                            type="button"
                            className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {selectedCategory === "All" ? "All Photos" : `${selectedCategory} Photos`}
            </h3>

            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 py-12 text-center">
                <p className="text-slate-600">No photos in this category yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-lg transition-all"
                  >
                    <div className="aspect-square overflow-hidden bg-gray-100">
                      <ImageWithFallback
                        src={item.imageUrl || ""}
                        alt="Portfolio"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{getCategoryLabel(item)}</span>
                          <span className="text-xs">{item.views} views</span>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button
                          type="button"
                          className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                          onClick={() => {
                            void handleToggleFeatured(item);
                          }}
                          disabled={toggleId === item.id}
                        >
                          <Star
                            className={`w-4 h-4 ${item.featured ? "text-yellow-500 fill-yellow-500" : "text-slate-400"}`}
                          />
                        </button>
                        <button
                          type="button"
                          className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                          onClick={() => openEditModal(item)}
                        >
                          <span className="text-xs font-semibold text-slate-600">Edit</span>
                        </button>
                        <button
                          type="button"
                          className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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

      <Modal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditTarget(null);
        }}
        title="Edit Portfolio Item"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setEditModalOpen(false);
                setEditTarget(null);
              }}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Dropdown
            label="Service"
            value={editForm.serviceId}
            onChange={(event) => setEditForm((current) => ({ ...current, serviceId: event.target.value }))}
            options={[{ value: "", label: "No service" }, ...services.map((service) => ({ value: service.id, label: service.name }))]}
          />

          <FormInput
            label="Category"
            value={editForm.category}
            onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}
            placeholder="Portrait"
          />

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={editForm.featured}
              onChange={(event) => setEditForm((current) => ({ ...current, featured: event.target.checked }))}
            />
            Mark as featured
          </label>
        </div>
      </Modal>

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
