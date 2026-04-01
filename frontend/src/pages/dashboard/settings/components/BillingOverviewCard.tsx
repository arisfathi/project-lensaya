import { Calendar, CheckCircle, ExternalLink, TrendingUp, XCircle } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import type { BillingActionLoading, PaymentStatusConfig, ProfileForm, SubscriptionState } from "../types";
import { formatDateTime, getPlanBadgeClass } from "../utils";

type BillingOverviewCardProps = {
  data: {
    currentPlan: string;
    currentBillingCycle: string;
    nextPaymentDate: string;
    autoRenewEnabled: boolean;
    cancelAtPeriodEnd: boolean;
    pendingChange: string | null;
    subscription: SubscriptionState | null;
    paymentStatus: PaymentStatusConfig;
    profile: ProfileForm;
  };
  state: {
    billingActionLoading: BillingActionLoading;
  };
  actions: {
    setProfile: Dispatch<SetStateAction<ProfileForm>>;
    onOpenBillingPortal: () => void;
    onRenewSubscription: () => void;
    onResumeSubscription: () => void;
    onScheduleCancellation: () => void;
  };
};

export function BillingOverviewCard({ data, state, actions }: BillingOverviewCardProps) {
  const PaymentStatusIcon = data.paymentStatus.icon;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(150deg,_#ffffff_0%,_#f8fafc_70%)] p-4 shadow-sm md:p-6">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">Current Plan</h3>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100">
          Subscription & Payments
        </span>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${data.paymentStatus.badgeClass}`}
        >
          {data.cancelAtPeriodEnd ? "CANCEL SCHEDULED" : data.paymentStatus.label.toUpperCase()}
        </span>
      </div>
      <p className="mb-4 text-xs text-slate-600 md:text-sm">
        Keep track of your plan, payment status, and next payment date.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2.5 md:gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Plan</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${getPlanBadgeClass(data.currentPlan)}`}>
              {data.currentPlan}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Payment Status</p>
          <div className="mt-1 flex items-center gap-2">
            <PaymentStatusIcon className={`w-4 h-4 ${data.paymentStatus.color}`} />
            <p className={`text-xs font-semibold ${data.paymentStatus.color} md:text-sm`}>{data.paymentStatus.label}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Billing Interval</p>
          <p className="mt-1 text-xs font-semibold text-slate-900 md:text-sm">{data.currentBillingCycle}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Next Payment Date</p>
          <div className="mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-semibold text-slate-900 md:text-sm">{data.nextPaymentDate}</p>
          </div>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Auto-Renewal</p>
          <div className="mt-1 flex items-center gap-2">
            {data.autoRenewEnabled ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-slate-500" />
            )}
            <p className={`text-xs font-semibold ${data.autoRenewEnabled ? "text-green-600" : "text-slate-600"} md:text-sm`}>
              {data.currentPlan === "FREE" ? "Not applicable" : data.autoRenewEnabled ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>
      </div>

      {data.subscription?.provider ? (
        <p className="mb-3 text-xs text-slate-500">Provider: {String(data.subscription.provider).toUpperCase()}</p>
      ) : null}

      {data.cancelAtPeriodEnd ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your subscription is set to cancel at period end
          {data.subscription?.renewAt ? ` (${formatDateTime(data.subscription.renewAt)}).` : "."}
        </div>
      ) : null}

      {data.pendingChange ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Pending change: {data.pendingChange}
        </div>
      ) : null}

      {data.subscription?.billingState === "past_due" && data.subscription?.graceEndsAt ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Payment issue detected. Grace period ends {formatDateTime(data.subscription.graceEndsAt)}.
        </div>
      ) : null}

      <div className="mb-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={data.profile.hideBranding}
            disabled={!data.profile.canHideBranding}
            onChange={(event) =>
              actions.setProfile((current) => ({
                ...current,
                hideBranding: event.target.checked,
              }))
            }
            className="mt-0.5 rounded border-gray-300"
          />
          <span>
            Hide Lensaya branding on public pages
            <span className="block text-xs text-slate-500">
              {data.profile.canHideBranding
                ? "Available on your current plan."
                : "Upgrade to Pro or Studio to remove branding."}
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3.5 md:p-4">
        <p className="mb-1 text-sm font-medium text-slate-900">Quick Actions</p>
        <p className="mb-3 text-xs text-slate-600">Manage your subscription lifecycle, billing status, and payment settings.</p>

        <div className="space-y-2">
          {data.currentPlan !== "FREE" ? (
            <>
              {!data.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={actions.onRenewSubscription}
                  disabled={state.billingActionLoading === "renew"}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-cyan-300 px-4 py-2 text-cyan-700 transition-colors hover:bg-cyan-50 disabled:opacity-60"
                >
                  {state.billingActionLoading === "renew" ? "Starting..." : "Renew Now"}
                </button>
              ) : null}

              {data.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={actions.onResumeSubscription}
                  disabled={state.billingActionLoading === "resume"}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-green-300 px-4 py-2 text-green-700 transition-colors hover:bg-green-50 disabled:opacity-60"
                >
                  {state.billingActionLoading === "resume" ? "Resuming..." : "Resume Auto-Renew"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={actions.onScheduleCancellation}
                  disabled={state.billingActionLoading === "cancel"}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-amber-300 px-4 py-2 text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-60"
                >
                  {state.billingActionLoading === "cancel" ? "Scheduling..." : "Cancel At Period End"}
                </button>
              )}
            </>
          ) : null}

          <Link
            to="/dashboard/pricing"
            className={`inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              data.currentPlan === "FREE"
                ? "bg-cyan-500 text-white hover:bg-cyan-600"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            {data.currentPlan === "FREE" ? "Upgrade Plan" : "Change Plan"}
          </Link>

          <Link
            to="/dashboard/transactions"
            className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-slate-700 hover:bg-gray-50 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            View Transactions
          </Link>

          <button
            type="button"
            onClick={actions.onOpenBillingPortal}
            disabled={state.billingActionLoading === "portal"}
            className={`inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              data.paymentStatus.tone === "danger"
                ? "bg-red-500 text-white hover:bg-red-600"
                : "border border-cyan-300 text-cyan-700 hover:bg-cyan-50"
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            {state.billingActionLoading === "portal" ? "Opening..." : "Open Billing Center"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Upgrades apply immediately after successful payment. Downgrades and cancellations remain active until the current billing period ends.
      </p>
    </div>
  );
}
