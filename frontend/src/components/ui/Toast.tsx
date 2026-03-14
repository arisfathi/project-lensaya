import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { type ComponentType } from "react";

export type ToastType = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
};

const toastStyles: Record<ToastType, { icon: ComponentType<{ className?: string }>; accent: string; bg: string }> = {
  success: {
    icon: CheckCircle2,
    accent: "text-emerald-600",
    bg: "border-emerald-200",
  },
  error: {
    icon: TriangleAlert,
    accent: "text-red-600",
    bg: "border-red-200",
  },
  info: {
    icon: Info,
    accent: "text-cyan-600",
    bg: "border-cyan-200",
  },
};

export function Toast({ toast, onClose }: { toast: ToastItem; onClose: (id: string) => void }) {
  const config = toastStyles[toast.type];
  const Icon = config.icon;

  return (
    <div className={`w-full max-w-sm bg-white border ${config.bg} shadow-lg rounded-xl p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 ${config.accent}`} />
        <div className="flex-1">
          {toast.title ? <p className="text-sm font-semibold text-slate-900">{toast.title}</p> : null}
          <p className="text-sm text-slate-700">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={() => onClose(toast.id)}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
