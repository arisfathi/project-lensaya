import { STATUS_CLASS_MAP } from "../constants";
import type { ReferralEvent } from "../types";
import { formatCurrency, formatDateTime, formatStatus } from "../utils";

type ReferralHistorySectionProps = {
  data: {
    events: ReferralEvent[];
    hasNoReferrals: boolean;
  };
};

export function ReferralHistorySection({ data }: ReferralHistorySectionProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:rounded-xl sm:border-gray-200 sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-900 sm:mb-6 sm:text-lg">Referral History</h2>

      {data.hasNoReferrals ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center sm:rounded-lg">
          <p className="text-sm font-medium text-slate-700">No referrals yet</p>
          <p className="mt-1 text-xs text-slate-500">Share your link today and track your first conversion here.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">User</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Reward</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((item, index) => (
                  <tr key={`referral-event-${index + 1}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-slate-700">{item.visitorEmail || "Anonymous user"}</td>
                    <td className="py-3 px-4 text-sm text-slate-700">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_CLASS_MAP[item.status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatStatus(item.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700">{formatCurrency(item.reward || 0)}</td>
                    <td className="py-3 px-4 text-sm text-slate-700">{formatDateTime(item.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2.5 md:hidden">
            {data.events.map((item, index) => (
              <div key={`referral-event-mobile-${index + 1}`} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{item.visitorEmail || "Anonymous user"}</p>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      STATUS_CLASS_MAP[item.status] || "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {formatStatus(item.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-700">Reward: {formatCurrency(item.reward || 0)}</p>
                <p className="mt-1 text-[11px] text-slate-500">{formatDateTime(item.date)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
