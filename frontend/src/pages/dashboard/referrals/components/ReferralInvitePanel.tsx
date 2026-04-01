import { Copy, MessageCircle } from "lucide-react";
import { Button } from "../../../../components/ui/Button";

type ReferralInvitePanelProps = {
  data: {
    referralCode: string;
    referralLink: string;
  };
  actions: {
    onCopyLink: () => void;
    onCopyCode: () => void;
    onShareWhatsApp: () => void;
  };
};

export function ReferralInvitePanel({ data, actions }: ReferralInvitePanelProps) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-8 sm:rounded-xl sm:border-gray-200 sm:p-6">
      <h2 className="mb-3 text-base font-semibold text-slate-900 sm:mb-4 sm:text-lg">Share and Earn</h2>

      <div className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-3 sm:mb-4 sm:rounded-lg sm:border-gray-200 sm:bg-gray-50 sm:p-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal sm:text-slate-600">Referral Code</p>
        <p className="text-xl font-bold tracking-wide text-slate-900 sm:text-2xl">{data.referralCode || "N/A"}</p>
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white px-3 py-3 sm:rounded-lg sm:bg-gray-50 sm:p-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal sm:text-slate-600">Referral Link</p>
        <p className="break-all text-xs font-semibold text-cyan-700 sm:text-sm sm:font-medium sm:text-cyan-600">{data.referralLink || "Referral link unavailable"}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
        <Button className="col-span-2 text-sm" onClick={actions.onShareWhatsApp}>
          <MessageCircle className="w-4 h-4" />
          Share on WhatsApp
        </Button>
        <Button variant="secondary" className="text-xs sm:text-sm" onClick={actions.onCopyLink}>
          <Copy className="w-4 h-4" />
          Copy Link
        </Button>
        <Button variant="secondary" className="text-xs sm:text-sm" onClick={actions.onCopyCode}>
          <Copy className="w-4 h-4" />
          Copy Code
        </Button>
      </div>
    </div>
  );
}
