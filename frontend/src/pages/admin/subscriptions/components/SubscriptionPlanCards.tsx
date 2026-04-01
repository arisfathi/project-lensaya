import type { PlanCardViewModel } from "../types";

type SubscriptionPlanCardsProps = {
  plans: PlanCardViewModel[];
};

export function SubscriptionPlanCards({ plans }: SubscriptionPlanCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {plans.map((plan) => (
        <div key={plan.name} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">{plan.name} Plan</h3>
            <div className={`w-3 h-3 rounded-full ${plan.colorClassName}`} />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-600">Active Users</p>
              <p className="text-2xl font-bold text-slate-900">{plan.users.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Revenue</p>
              <p className="text-xl font-bold text-cyan-500">{plan.revenue}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
