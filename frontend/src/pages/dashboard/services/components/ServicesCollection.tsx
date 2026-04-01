import { Link } from "react-router-dom";
import { Briefcase, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import type { ServiceItem } from "../types";

type ServicesCollectionProps = {
  services: ServiceItem[];
  onCreate: () => void;
  onEdit: (service: ServiceItem) => void;
  onDelete: (service: ServiceItem) => void;
};

export function ServicesCollection({ services, onCreate, onEdit, onDelete }: ServicesCollectionProps) {
  if (services.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-10 text-center">
        <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Briefcase className="w-7 h-7 text-cyan-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No services yet</h3>
        <p className="text-sm text-slate-600 mb-6">Create your first service to start selling packages and taking bookings.</p>
        <Button onClick={onCreate}>
          <Plus className="w-4 h-4" />
          Create Service
        </Button>
      </div>
    );
  }

  return (
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
            <Button variant="secondary" className="text-sm px-3 py-2" onClick={() => onEdit(service)}>
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            <Link
              to={`/dashboard/packages?serviceId=${service.id}`}
              className="inline-flex items-center justify-center gap-1 text-sm px-3 py-2 text-slate-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Manage
            </Link>
            <Button variant="danger" className="text-sm px-3 py-2" onClick={() => onDelete(service)}>
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-6 hover:border-cyan-400 hover:bg-cyan-50/50 transition-all min-h-[280px] flex flex-col items-center justify-center"
        onClick={onCreate}
      >
        <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
          <Plus className="w-8 h-8 text-cyan-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Add New Service</h3>
        <p className="text-sm text-slate-600 text-center">Create a new photography service offering</p>
      </button>
    </div>
  );
}
