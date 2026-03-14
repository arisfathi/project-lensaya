import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Clock, CopyPlus, Plus, Trash2 } from "lucide-react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FormInput, FormTextArea } from "../../components/ui/FormInput";
import { Dropdown } from "../../components/ui/Dropdown";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useToast } from "../../contexts/ToastContext";
import { packagesApi, servicesApi, getApiErrorMessage } from "../../lib/api";

type ServiceItem = {
  id: string;
  name: string;
};

type PackageItem = {
  id: string;
  serviceId: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationLabel: string;
  features: string[];
  isPopular: boolean;
};

type PackageForm = {
  serviceId: string;
  name: string;
  price: string;
  duration: string;
  featuresText: string;
  popular: boolean;
};

const defaultForm: PackageForm = {
  serviceId: "",
  name: "",
  price: "",
  duration: "",
  featuresText: "",
  popular: false,
};

const formatPrice = (cents: number) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

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
  const [form, setForm] = useState<PackageForm>(defaultForm);

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
      } catch (err) {
        if (!mounted) return;
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
      ...defaultForm,
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
    if (!form.serviceId) {
      setFormError("Service is required");
      return false;
    }

    if (!form.name.trim()) {
      setFormError("Package name is required");
      return false;
    }

    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setFormError("Price must be a valid non-negative number");
      return false;
    }

    if (!form.duration.trim()) {
      setFormError("Duration is required");
      return false;
    }

    setFormError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const features = form.featuresText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

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
      setForm(defaultForm);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Packages</h1>
          <p className="text-slate-600">Manage your pricing packages and offerings</p>
        </div>
        <Button className="px-6 py-3" onClick={openCreateModal} disabled={services.length === 0}>
          <Plus className="w-5 h-5" />
          Add Package
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mb-6">
        <Dropdown
          label="Filter by service"
          value={selectedServiceId}
          options={serviceOptions}
          onChange={(event) => updateServiceFilter(event.target.value)}
        />
      </div>

      {loading ? (
        <LoadingCard label="Loading packages..." />
      ) : packages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-10 text-center">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No packages found</h3>
          <p className="text-sm text-slate-600 mb-6">Create a package for your selected service to show pricing to clients.</p>
          <Button onClick={openCreateModal} disabled={services.length === 0}>
            <Plus className="w-4 h-4" />
            Create Package
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => {
            const serviceName = services.find((service) => service.id === pkg.serviceId)?.name || "Service";
            return (
              <div
                key={pkg.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-6 hover:shadow-lg transition-all relative ${
                  pkg.isPopular ? "border-cyan-400" : "border-gray-200"
                }`}
              >
                {pkg.isPopular ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-cyan-500 text-white text-xs font-semibold rounded-full">Most Popular</span>
                  </div>
                ) : null}

                <div className="mb-4">
                  <span className="inline-block px-3 py-1 bg-cyan-50 text-cyan-600 text-xs font-medium rounded-full">{serviceName}</span>
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2">{pkg.name}</h3>

                <div className="mb-4">
                  <div className="text-3xl font-bold text-slate-900 mb-1">{formatPrice(pkg.priceCents)}</div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock className="w-4 h-4" />
                    <span>{pkg.durationLabel}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6 min-h-[110px]">
                  {(pkg.features || []).slice(0, 4).map((feature) => (
                    <div key={`${pkg.id}-${feature}`} className="flex items-start gap-2">
                      <div className="mt-0.5">
                        <Check className="w-4 h-4 text-cyan-500" />
                      </div>
                      <span className="text-sm text-slate-600">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-6 border-t border-gray-200">
                  <Button variant="secondary" className="text-xs px-2 py-2" onClick={() => openEditModal(pkg)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-2 border border-gray-300"
                    onClick={() => {
                      void handleDuplicate(pkg);
                    }}
                    disabled={duplicatingId === pkg.id}
                  >
                    <CopyPlus className="w-3.5 h-3.5" />
                    {duplicatingId === pkg.id ? "..." : "Duplicate"}
                  </Button>
                  <Button variant="danger" className="text-xs px-2 py-2" onClick={() => setDeleteTarget(pkg)}>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-6 hover:border-cyan-400 hover:bg-cyan-50/50 transition-all min-h-[400px] flex flex-col items-center justify-center"
            onClick={openCreateModal}
            disabled={services.length === 0}
          >
            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Add New Package</h3>
            <p className="text-sm text-slate-600 text-center">Create a pricing package for your services</p>
          </button>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editingPackage ? "Edit Package" : "Create Package"}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : editingPackage ? "Save Changes" : "Create Package"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Dropdown
            label="Service"
            value={form.serviceId}
            onChange={(event) => setForm((current) => ({ ...current, serviceId: event.target.value }))}
            options={services.map((service) => ({ value: service.id, label: service.name }))}
          />

          <FormInput
            label="Package Name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Premium Wedding Package"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Price"
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              placeholder="1500"
            />
            <FormInput
              label="Duration"
              value={form.duration}
              onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))}
              placeholder="6 hours"
              hint="Example: 2 hours, 4 hours, half day, full day"
            />
          </div>

          <FormTextArea
            label="Features (one per line)"
            value={form.featuresText}
            onChange={(event) => setForm((current) => ({ ...current, featuresText: event.target.value }))}
            rows={5}
            placeholder={"6 hours coverage\n300 edited photos\nOnline gallery"}
          />

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.popular}
              onChange={(event) => setForm((current) => ({ ...current, popular: event.target.checked }))}
              className="rounded border-gray-300"
            />
            Mark as popular package
          </label>

          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </Modal>

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
