import { X } from "lucide-react";
import { type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
};

export function Modal({ open, title, onClose, children, footer, panelClassName }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative z-[91] h-full w-full p-4 sm:p-6 flex items-center justify-center">
        <div className={`w-full ${panelClassName || "max-w-2xl"} bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
          {footer ? <div className="px-6 py-4 border-t border-gray-200 bg-slate-50">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
