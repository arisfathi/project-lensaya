import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useToast } from "../../contexts/ToastContext";
import { isApiAccessError, packagesApi, servicesApi, getApiErrorMessage } from "../../lib/api";
import { DEFAULT_PACKAGE_FORM } from "./packages/constants";
import { PackageEditorModal } from "./packages/components/PackageEditorModal";
import { PackagesCollection } from "./packages/components/PackagesCollection";
import { PackagesHeader } from "./packages/components/PackagesHeader";
import { PackageServiceFilter } from "./packages/components/PackageServiceFilter";
import type { PackageForm, PackageItem, ServiceItem } from "./packages/types";
import { getPackageFormError, parseFeatures } from "./packages/utils";

export default function Packages() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PackageItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<PackageForm>(DEFAULT_PACKAGE_FORM);
  const [packageFeatureLimit, setPackageFeatureLimit] = useState<number>(5);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedServiceId = searchParams.get("serviceId") || "";

  const { success, error } = useToast();

  const editingPackage = useMemo(
    () => (editingId ? packages.find((item) => item.id === editingId) || null : null),
    [editingId, packages]
  );

  const serviceOptions = useMemo(
    () => [{ value: "", label: "All Services" }, ...services.map((service) => ({ value: service.id, label: service.name }))],
    [services]
  );

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [servicesResult, packagesResult] = await Promise.all([
          servicesApi.list(),
          packagesApi.list(selectedServiceId ? { serviceId: selectedServiceId } : undefined),
        ]);

        if (!mounted) return;
        setServices((servicesResult.items || []) as ServiceItem[]);
        setPackages((packagesResult.items || []) as PackageItem[]);
        const nextLimit = Number(packagesResult.limits?.packageFeatures ?? packagesResult.limits?.maxPackageFeatures ?? 5);
        setPackageFeatureLimit(Number.isFinite(nextLimit) ? nextLimit : 5);
      } catch (err) {
        if (!mounted || isApiAccessError(err)) return;
        error(getApiErrorMessage(err, "Failed to load packages"));
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
  }, [error, selectedServiceId]);

  const openCreateModal = useCallback(() => {
    if (services.length === 0) {
      error("Create a service before creating packages");
      return;
    }

    setEditingId(null);
    setForm({
      ...DEFAULT_PACKAGE_FORM,
      serviceId: selectedServiceId || services[0].id,
    });
    setFormError(null);
    setModalOpen(true);
  }, [error, selectedServiceId, services]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreateModal();
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [openCreateModal, searchParams, setSearchParams]);

  const refreshPackages = async () => {
    const result = await packagesApi.list(selectedServiceId ? { serviceId: selectedServiceId } : undefined);
    setPackages((result.items || []) as PackageItem[]);
    const nextLimit = Number(result.limits?.packageFeatures ?? result.limits?.maxPackageFeatures ?? 5);
    setPackageFeatureLimit(Number.isFinite(nextLimit) ? nextLimit : 5);
  };

  const openEditModal = (item: PackageItem) => {
    setEditingId(item.id);
    setForm({
      serviceId: item.serviceId,
      name: item.name,
      price: (item.priceCents / 100).toString(),
      duration: item.durationLabel,
      featuresText: (item.features || []).join("\n"),
      popular: Boolean(item.isPopular),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const validateForm = () => {
    const nextError = getPackageFormError(form, packageFeatureLimit);
    setFormError(nextError);
    return !nextError;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const features = parseFeatures(form.featuresText);

    const payload = {
      serviceId: form.serviceId,
      name: form.name.trim(),
      price: Number(form.price),
      duration: form.duration.trim(),
      features,
      popular: form.popular,
    };

    try {
      setSaving(true);
      if (editingId) {
        await packagesApi.update(editingId, payload);
        success("Package updated successfully");
      } else {
        await packagesApi.create(payload);
        success("Package created successfully");
      }

      await refreshPackages();
      setModalOpen(false);
      setEditingId(null);
      setForm(DEFAULT_PACKAGE_FORM);
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to save package"));
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (item: PackageItem) => {
    try {
      setDuplicatingId(item.id);
      await packagesApi.duplicate(item.id);
      success("Package duplicated");
      await refreshPackages();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to duplicate package"));
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await packagesApi.remove(deleteTarget.id);
      success("Package deleted");
      setDeleteTarget(null);
      await refreshPackages();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to delete package"));
    } finally {
      setDeleting(false);
    }
  };

  const updateServiceFilter = (serviceId: string) => {
    const next = new URLSearchParams(searchParams);
    if (!serviceId) {
      next.delete("serviceId");
    } else {
      next.set("serviceId", serviceId);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-6 sm:rounded-xl sm:border-slate-200 sm:bg-linear-to-br sm:from-white sm:to-slate-50 sm:p-6 sm:shadow-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Pricing & Offers</p>
          <h1 className="mt-2 text-lg font-semibold text-slate-900 sm:text-3xl sm:font-bold">Packages</h1>
          <p className="mt-1 text-sm text-slate-600">Manage your pricing packages and offerings</p>
        </div>
      </div>

      <PackagesHeader canCreate={services.length > 0} onCreate={openCreateModal} />

      <PackageServiceFilter
        selectedServiceId={selectedServiceId}
        serviceOptions={serviceOptions}
        onChange={updateServiceFilter}
      />

      {loading ? (
        <LoadingCard label="Loading packages..." />
      ) : (
        <PackagesCollection
          data={{
            services,
            packages,
            duplicatingId,
          }}
          capabilities={{
            canCreate: services.length > 0,
          }}
          handlers={{
            onCreate: openCreateModal,
            onEdit: openEditModal,
            onDuplicate: (pkg) => {
              void handleDuplicate(pkg);
            },
            onDelete: setDeleteTarget,
          }}
        />
      )}
      <PackageEditorModal
        modal={{
          open: modalOpen,
          title: editingPackage ? "Edit Package" : "Create Package",
          saving,
        }}
        formState={{
          form,
          formError,
          featureHint: `Limit: ${packageFeatureLimit < 0 ? "Unlimited" : `${packageFeatureLimit} features per package`} (${parseFeatures(form.featuresText).length}${packageFeatureLimit < 0 ? "" : `/${packageFeatureLimit}`})`,
          serviceOptions: services.map((service) => ({ value: service.id, label: service.name })),
        }}
        handlers={{
          onClose: () => setModalOpen(false),
          onSave: () => {
            void handleSave();
          },
          onServiceIdChange: (value) => setForm((current) => ({ ...current, serviceId: value })),
          onNameChange: (value) => setForm((current) => ({ ...current, name: value })),
          onPriceChange: (value) => setForm((current) => ({ ...current, price: value })),
          onDurationChange: (value) => setForm((current) => ({ ...current, duration: value })),
          onFeaturesTextChange: (value) => setForm((current) => ({ ...current, featuresText: value })),
          onPopularChange: (value) => setForm((current) => ({ ...current, popular: value })),
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Package"
        message={`Are you sure you want to delete "${deleteTarget?.name || "this package"}"? This cannot be undone.`}
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





