import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useToast } from "../../contexts/ToastContext";
import { isApiAccessError, servicesApi, getApiErrorMessage } from "../../lib/api";
import { DEFAULT_SERVICE_FORM } from "./services/constants";
import { ServiceEditorModal } from "./services/components/ServiceEditorModal";
import { ServicesCollection } from "./services/components/ServicesCollection";
import { ServicesHeader } from "./services/components/ServicesHeader";
import type { EmojiPickerComponent, EmojiSelection, ServiceForm, ServiceItem } from "./services/types";
import { getServiceFormError } from "./services/utils";

export default function Services() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<ServiceForm>(DEFAULT_SERVICE_FORM);
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
        if (!mounted || isApiAccessError(err)) return;
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
    setForm(DEFAULT_SERVICE_FORM);
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
    const nextError = getServiceFormError(form);
    setFormError(nextError);
    return !nextError;
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
      setForm(DEFAULT_SERVICE_FORM);
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
      <ServicesHeader onCreate={openCreateModal} />

      {loading ? (
        <LoadingCard label="Loading services..." />
      ) : (
        <ServicesCollection
          services={services}
          onCreate={openCreateModal}
          onEdit={openEditModal}
          onDelete={setDeleteTarget}
        />
      )}

      <ServiceEditorModal
        modal={{
          open: modalOpen,
          saving,
          title: editingService ? "Edit Service" : "Create Service",
        }}
        formState={{
          form,
          formError,
        }}
        emojiState={{
          showEmojiPicker,
          isEmojiPickerLoading,
          emojiData,
          EmojiPicker,
        }}
        emojiPickerRef={emojiPickerRef}
        handlers={{
          onClose: () => {
            setModalOpen(false);
            setShowEmojiPicker(false);
          },
          onSave: () => {
            void handleSave();
          },
          onNameChange: (value) => setForm((current) => ({ ...current, name: value })),
          onDescriptionChange: (value) => setForm((current) => ({ ...current, description: value })),
          onOrderChange: (value) => setForm((current) => ({ ...current, order: value })),
          onToggleEmojiPicker: () => setShowEmojiPicker((current) => !current),
          onEmojiSelect: (emoji: EmojiSelection) => {
            setForm((current) => ({ ...current, emoji: emoji.native }));
            setShowEmojiPicker(false);
          },
        }}
      />
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


