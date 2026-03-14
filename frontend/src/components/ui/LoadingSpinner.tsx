import { Loader2 } from "lucide-react";

export function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-slate-600">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function LoadingCard({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <LoadingSpinner label={label} />
    </div>
  );
}
