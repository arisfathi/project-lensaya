import { Gift, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../../contexts/AuthContext";
import { getReferralRewardMessage } from "../../../../lib/entitlements";

type ReferralPromptCardProps = {
  onDismiss: () => void;
};

export function ReferralPromptCard({ onDismiss }: ReferralPromptCardProps) {
  const { user } = useAuth();

  return (
    <div className="mb-5 rounded-2xl border border-cyan-100 bg-linear-to-br from-white to-cyan-50/60 px-3.5 py-3.5 sm:mb-6 sm:rounded-xl sm:p-5 sm:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <div className="rounded-full bg-cyan-100 p-1.5 text-cyan-700 sm:p-2">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Referral rewards are ready</p>
            <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
              {getReferralRewardMessage(user?.plan)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
          aria-label="Dismiss referral prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2.5 sm:mt-4 sm:gap-3">
        <Link
          to="/dashboard/referrals"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 sm:px-4 sm:py-2 sm:text-sm"
        >
          View referrals
        </Link>
        <Link
          to="/dashboard/pricing"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:px-4 sm:py-2 sm:text-sm"
        >
          Compare plans
        </Link>
      </div>
    </div>
  );
}
