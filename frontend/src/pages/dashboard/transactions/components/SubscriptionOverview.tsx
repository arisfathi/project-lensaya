import { Calendar, ExternalLink, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import type { SubscriptionState } from "../types";
import { formatBillingCycleLabel, getPlanBadgeClass } from "../utils";

type SubscriptionOverviewProps = {
  data: {
    subscription: SubscriptionState | null;
    currentPlan: string;
    paymentStatus: {
      label: string;
      color: string;
      icon: typeof import("lucide-react").CheckCircle;
      badgeClass: string;
      tone: "neutral" | "info" | "danger" | "warning" | "success";
    };
    nextPaymentDate: string;
  };
  actions: {
    portalLoading: boolean;
    resumeLoading: boolean;
    renewLoading: boolean;
    cancelLoading: boolean;
    onOpenBillingPortal: () => void;
    onResumeAutoRenew: () => void;
    onRenewSubscription: () => void;
    onScheduleCancellation: () => void;
  };
};

export function SubscriptionOverview({ data, actions }: SubscriptionOverviewProps) {
  const PaymentStatusIcon = data.paymentStatus.icon;

  return (
    <section className="mb-4 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 sm:mb-6 sm:rounded-xl sm:border-slate-200 sm:bg-linear-to-br sm:from-white sm:to-slate-50 sm:p-6 sm:shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-5 sm:gap-3">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Subscription Overview</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getPlanBadgeClass(data.currentPlan)}`}>{data.currentPlan}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:text-xs ${data.paymentStatus.badgeClass}`}>
          <PaymentStatusIcon className={`h-3.5 w-3.5 ${data.paymentStatus.color}`} />
          {data.paymentStatus.label}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
          <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Billing Interval</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatBillingCycleLabel(data.subscription?.billingCycle)}</p>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next Renewal Date</p>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>{data.nextPaymentDate}</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Provider</p>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{data.subscription?.provider || "manual"}</p>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Receipt / Invoice</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Placeholder available</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 sm:p-4">
          <p className="text-sm font-semibold text-slate-900">Quick Actions</p>
          <p className="mt-0.5 text-xs text-slate-600">Change plan, manage renewal, and open provider billing.</p>

          <div className="mt-3 space-y-2">
            {data.currentPlan === "FREE" ? (
              <Link
                to="/dashboard/pricing"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-600"
              >
                <TrendingUp className="h-4 w-4" />
                Upgrade Plan
              </Link>
            ) : data.subscription?.cancelAtPeriodEnd ? (
              <button
                type="button"
                onClick={actions.onResumeAutoRenew}
                disabled={actions.resumeLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TrendingUp className="h-4 w-4" />
                {actions.resumeLoading ? "Resuming..." : "Resume Subscription"}
              </button>
            ) : (
              <button
                type="button"
                onClick={actions.onRenewSubscription}
                disabled={actions.renewLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TrendingUp className="h-4 w-4" />
                {actions.renewLoading ? "Starting..." : "Renew Now"}
              </button>
            )}

            {data.currentPlan !== "FREE" && !data.subscription?.cancelAtPeriodEnd ? (
              <button
                type="button"
                onClick={actions.onScheduleCancellation}
                disabled={actions.cancelLoading}
                className="w-full rounded-lg border border-amber-300 px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actions.cancelLoading ? "Scheduling..." : "Cancel At Period End"}
              </button>
            ) : null}

            <Link
              to="/dashboard/pricing"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <TrendingUp className="h-4 w-4" />
              Change Plan
            </Link>

            <button
              type="button"
              onClick={actions.onOpenBillingPortal}
              disabled={actions.portalLoading}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                data.paymentStatus.tone === "danger"
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <ExternalLink className="h-4 w-4" />
              {actions.portalLoading ? "Opening..." : "Open Billing Center"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
