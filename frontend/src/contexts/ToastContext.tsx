/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Toast, type ToastItem, type ToastType } from "../components/ui/Toast";

type ToastContextValue = {
  showToast: (input: { type?: ToastType; title?: string; message: string }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_TIMEOUT_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (input: { type?: ToastType; title?: string; message: string }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const toast: ToastItem = {
        id,
        type: input.type || "info",
        title: input.title,
        message: input.message,
      };

      setToasts((current) => [toast, ...current].slice(0, 5));
      window.setTimeout(() => removeToast(id), TOAST_TIMEOUT_MS);
    },
    [removeToast]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message, title) => showToast({ type: "success", message, title }),
      error: (message, title) => showToast({ type: "error", message, title }),
      info: (message, title) => showToast({ type: "info", message, title }),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
