import { Check, Clock, CopyPlus, Plus, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import type { PackageItem, ServiceItem } from "../types";
import { formatPrice } from "../utils";

type PackagesCollectionProps = {
  data: {
    services: ServiceItem[];
    packages: PackageItem[];
    duplicatingId: string | null;
  };
  capabilities: {
    canCreate: boolean;
  };
  handlers: {
    onCreate: () => void;
    onEdit: (pkg: PackageItem) => void;
    onDuplicate: (pkg: PackageItem) => void;
    onDelete: (pkg: PackageItem) => void;
  };
};

export function PackagesCollection({ data, capabilities, handlers }: PackagesCollectionProps) {
  if (data.packages.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-10 text-center">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No packages found</h3>
        <p className="text-sm text-slate-600 mb-6">Create a package for your selected service to show pricing to clients.</p>
        <Button onClick={handlers.onCreate} disabled={!capabilities.canCreate}>
          <Plus className="w-4 h-4" />
          Create Package
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.packages.map((pkg) => {
        const serviceName = data.services.find((service) => service.id === pkg.serviceId)?.name || "Service";
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
              <Button variant="secondary" className="text-xs px-2 py-2" onClick={() => handlers.onEdit(pkg)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                className="text-xs px-2 py-2 border border-gray-300"
                onClick={() => handlers.onDuplicate(pkg)}
                disabled={data.duplicatingId === pkg.id}
              >
                <CopyPlus className="w-3.5 h-3.5" />
                {data.duplicatingId === pkg.id ? "..." : "Duplicate"}
              </Button>
              <Button variant="danger" className="text-xs px-2 py-2" onClick={() => handlers.onDelete(pkg)}>
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
        onClick={handlers.onCreate}
        disabled={!capabilities.canCreate}
      >
        <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
          <Plus className="w-8 h-8 text-cyan-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Add New Package</h3>
        <p className="text-sm text-slate-600 text-center">Create a pricing package for your services</p>
      </button>
    </div>
  );
}
