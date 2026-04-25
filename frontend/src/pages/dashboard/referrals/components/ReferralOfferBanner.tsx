import { Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../../contexts/AuthContext";
import { getReferralRewardMessage } from "../../../../lib/entitlements";

export function ReferralOfferBanner() {
  const { user } = useAuth();

  return (
    <div className="mb-5 rounded-2xl border border-cyan-100 bg-linear-to-br from-cyan-50/90 to-white px-3.5 py-3.5 sm:mb-8 sm:rounded-xl sm:p-6">
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-cyan-700">
            <Gift className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-wide sm:text-sm">Referral offer</span>
          </div>
          <p className="text-xs font-medium leading-5 text-slate-900 sm:text-base">
            {getReferralRewardMessage(user?.plan)}
          </p>
        </div>
        <Link
          to="/dashboard/pricing"
          className="inline-flex items-center justify-center rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-50 sm:px-4 sm:text-sm sm:font-medium"
        >
          Compare plans
        </Link>
      </div>
    </div>
  );
}
