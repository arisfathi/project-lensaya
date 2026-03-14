import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Briefcase, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FormInput, FormTextArea } from "../../components/ui/FormInput";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useToast } from "../../contexts/ToastContext";
import { servicesApi, getApiErrorMessage } from "../../lib/api";

type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  thumbnailUrl: string | null;
  packageCount: number;
  order: number;
};

type ServiceForm = {
  name: string;
  description: string;
  emoji: string;
  order: string;
};

const defaultForm: ServiceForm = {
  name: "",
  description: "",
  emoji: "",
  order: "0",
};

type EmojiSelection = {
  native: string;
};

type EmojiPickerComponent = ComponentType<{
  data: unknown;
  previewPosition?: string;
  theme?: string;
  onEmojiSelect?: (emoji: EmojiSelection) => void;
}>;

export default function Services() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<ServiceForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEmojiPickerLoading, setIsEmojiPickerLoading] = useState(false);
  const [emojiData, setEmojiData] = useState<unknown>(null);
  const [EmojiPicker, setEmojiPicker] = useState<EmojiPickerComponent | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const { success, error } = useToast();

  const editingService = useMemo(
    () => (editingId ? services.find((service) => service.id === editingId) || null : null),
    [editingId, services]
  );

  useEffect(() => {
    let mounted = true;

    const loadServices = async () => {
      setLoading(true);
      try {
        const result = await servicesApi.list();
        if (!mounted) return;
        setServices((result.items || []) as ServiceItem[]);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load services"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadServices();

    return () => {
      mounted = false;
    };
  }, [error]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreateModal();
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    if (EmojiPicker && emojiData) return;

    let cancelled = false;
    setIsEmojiPickerLoading(true);

    void Promise.all([import("@emoji-mart/react"), import("@emoji-mart/data/sets/15/native.json")])
      .then(([pickerModule, dataModule]) => {
        if (cancelled) return;
        setEmojiPicker(() => pickerModule.default as EmojiPickerComponent);
        setEmojiData(dataModule.default ?? dataModule);
      })
      .catch(() => {
        if (cancelled) return;
        setEmojiPicker(null);
        setEmojiData(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsEmojiPickerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [EmojiPicker, emojiData, showEmojiPicker]);

  const refreshServices = async () => {
    const result = await servicesApi.list();
    setServices((result.items || []) as ServiceItem[]);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(defaultForm);
    setFormError(null);
    setShowEmojiPicker(false);
    setModalOpen(true);
  };

  const openEditModal = (service: ServiceItem) => {
    setEditingId(service.id);
    setForm({
      name: service.name || "",
      description: service.description || "",
      emoji: service.emoji || "",
      order: String(service.order ?? 0),
    });
    setFormError(null);
    setShowEmojiPicker(false);
    setModalOpen(true);
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      setFormError("Service name is required");
      return false;
    }

    const order = Number(form.order);
    if (!Number.isFinite(order) || order < 0) {
      setFormError("Order must be a non-negative number");
      return false;
    }

    setFormError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        emoji: form.emoji.trim() || undefined,
        order: Number(form.order),
      };

      if (editingId) {
        await servicesApi.update(editingId, payload);
        success("Service updated successfully");
      } else {
        await servicesApi.create(payload);
        success("Service created successfully");
      }

      await refreshServices();
      setModalOpen(false);
      setShowEmojiPicker(false);
      setForm(defaultForm);
      setEditingId(null);
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to save service"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await servicesApi.remove(deleteTarget.id);
      success("Service deleted");
      setDeleteTarget(null);
      await refreshServices();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to delete service"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Services</h1>
          <p className="text-slate-600">Manage your photography services and offerings</p>
        </div>
        <Button className="px-6 py-3" onClick={openCreateModal}>
          <Plus className="w-5 h-5" />
          Add Service
        </Button>
      </div>

      {loading ? (
        <LoadingCard label="Loading services..." />
      ) : services.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-10 text-center">
          <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-7 h-7 text-cyan-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No services yet</h3>
          <p className="text-sm text-slate-600 mb-6">Create your first service to start selling packages and taking bookings.</p>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            Create Service
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-cyan-300 transition-all"
            >
              <div className="w-14 h-14 bg-cyan-50 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl" role="img" aria-label="service icon">
                  {service.emoji || "??"}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-slate-900 mb-2">{service.name}</h3>
              <p className="text-sm text-slate-600 mb-4 line-clamp-3 min-h-[60px]">{service.description || "No description provided."}</p>

              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Package className="w-4 h-4" />
                <span>
                  {service.packageCount} {service.packageCount === 1 ? "package" : "packages"}
                </span>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-3 gap-2">
                <Button variant="secondary" className="text-sm px-3 py-2" onClick={() => openEditModal(service)}>
                  <Pencil className="w-4 h-4" />
                  Edit
                </Button>
                <Link
                  to={`/dashboard/packages?serviceId=${service.id}`}
                  className="inline-flex items-center justify-center gap-1 text-sm px-3 py-2 text-slate-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Manage
                </Link>
                <Button variant="danger" className="text-sm px-3 py-2" onClick={() => setDeleteTarget(service)}>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-6 hover:border-cyan-400 hover:bg-cyan-50/50 transition-all min-h-[280px] flex flex-col items-center justify-center"
            onClick={openCreateModal}
          >
            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Add New Service</h3>
            <p className="text-sm text-slate-600 text-center">Create a new photography service offering</p>
          </button>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setShowEmojiPicker(false);
        }}
        title={editingService ? "Edit Service" : "Create Service"}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setModalOpen(false);
                setShowEmojiPicker(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : editingService ? "Save Changes" : "Create Service"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Service Name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Wedding Photography"
          />
          <FormTextArea
            label="Description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Describe what this service includes"
            rows={4}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative" ref={emojiPickerRef}>
              <label className="block text-sm font-medium text-slate-700 mb-1">Emoji</label>
              <button
                type="button"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-left hover:border-cyan-400 transition-colors"
                onClick={() => setShowEmojiPicker((current) => !current)}
              >
                <span className="inline-flex items-center gap-3">
                  <span className="text-2xl leading-none">{form.emoji || "🙂"}</span>
                  <span className="text-sm text-slate-600">{form.emoji ? "Change emoji" : "Select an emoji"}</span>
                </span>
              </button>

              {showEmojiPicker ? (
                <div className="absolute z-[80] mt-2">
                  {EmojiPicker && emojiData ? (
                    <EmojiPicker
                      data={emojiData}
                      previewPosition="none"
                      theme="light"
                      onEmojiSelect={(emoji: EmojiSelection) => {
                        setForm((current) => ({ ...current, emoji: emoji.native }));
                        setShowEmojiPicker(false);
                      }}
                    />
                  ) : (
                    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-lg">
                      {isEmojiPickerLoading ? "Loading emoji picker..." : "Unable to load emoji picker."}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <FormInput
              label="Display Order"
              type="number"
              min={0}
              value={form.order}
              onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))}
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Service"
        message={`Are you sure you want to delete "${deleteTarget?.name || "this service"}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </DashboardLayout>
  );
}
