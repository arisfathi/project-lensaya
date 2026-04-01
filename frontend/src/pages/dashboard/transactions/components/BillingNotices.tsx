import { AlertCircle, AlertTriangle } from "lucide-react";

type BillingNoticesProps = {
  pendingChange: string | null;
  pastDueGraceEndsAt: string | null | undefined;
  formattedGraceEndsAt: string;
};

export function BillingNotices({ pendingChange, pastDueGraceEndsAt, formattedGraceEndsAt }: BillingNoticesProps) {
  return (
    <>
      {pendingChange ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-3 sm:mb-5 sm:px-4 sm:py-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Pending billing change</p>
              <p className="mt-0.5 text-xs text-amber-800 sm:text-sm">{pendingChange}</p>
            </div>
          </div>
        </div>
      ) : null}

      {pastDueGraceEndsAt ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-3 sm:mb-5 sm:px-4 sm:py-3.5">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-700" />
            <div>
              <p className="text-sm font-semibold text-red-900">Payment issue detected</p>
              <p className="mt-0.5 text-xs text-red-800 sm:text-sm">
                Grace period ends on {formattedGraceEndsAt}. After that, the account downgrades to Free automatically.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
