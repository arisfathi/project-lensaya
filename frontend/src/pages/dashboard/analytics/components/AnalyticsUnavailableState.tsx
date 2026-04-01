import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

type AnalyticsUnavailableStateProps = {
  message: string;
};

export function AnalyticsUnavailableState({ message }: AnalyticsUnavailableStateProps) {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Analytics</h1>
        <p className="mt-2 text-slate-600">Track your website performance and visitor engagement.</p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Analytics overview is temporarily unavailable</h2>
        <p className="mt-2 text-sm text-amber-900/90">{message}</p>
        <Link
          to="/dashboard/pricing"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-600"
        >
          View Plans
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
