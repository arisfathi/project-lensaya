import { TrendingDown, TrendingUp } from "lucide-react";
import type { ChangesItem } from "../types";

type RecentSubscriptionChangesSectionProps = {
  changes: ChangesItem[];
  formatPlan: (plan: string) => string;
  formatDateTime: (value: string) => string;
  shortUser: (value: string) => string;
};

export function RecentSubscriptionChangesSection({
  changes,
  formatPlan,
  formatDateTime,
  shortUser,
}: RecentSubscriptionChangesSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-slate-900">Recent Subscription Changes</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {changes.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No subscription changes yet.</div>
        ) : (
          changes.map((change, index) => {
            const isDowngrade = change.action.toLowerCase().includes("down");

            return (
              <div key={`${change.user}-${index + 1}`} className="p-6 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${isDowngrade ? "bg-orange-50" : "bg-green-50"}`}>
                    {isDowngrade ? (
                      <TrendingDown className="w-5 h-5 text-orange-600" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{shortUser(change.user)}</p>
                    <p className="text-sm text-slate-600">
                      {isDowngrade ? "Downgraded" : "Upgraded"} from <span className="font-medium">{formatPlan(change.from)}</span> to{" "}
                      <span className="font-medium">{formatPlan(change.to)}</span>
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-500">{formatDateTime(change.at)}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
