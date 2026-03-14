import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Check, CreditCard, Sparkles } from "lucide-react";
import { billingApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { DashboardLayout } from "../../layouts/DashboardLayout";

type BillingCycle = "monthly" | "yearly";
type PlanId = "FREE" | "PRO" | "STUDIO";
type BillingPlan = Omit<Awaited<ReturnType<typeof billingApi.plans>>["plans"][number], "id"> & { id: PlanId };
type BillingSubscription = Awaited<ReturnType<typeof billingApi.subscription>>;

const planOrder: PlanId[] = ["FREE", "PRO", "STUDIO"];
const visibleLimitRows = [
  { id: "portfolioPhotos", label: "Portfolio Photos", keys: ["portfolioPhotos", "portfolioImages"] },
  { id: "services", label: "Services", keys: ["services"] },
  { id: "packagesPerService", label: "Packages Per Service", keys: ["packagesPerService", "packages"] },
  { id: "customDomain", label: "Custom Domain", keys: ["customDomain"] },
  { id: "analyticsTools", label: "Advanced Analytics", keys: ["analyticsTools"] },
] as const;
const planCopy: Record<BillingPlan["id"], { summary: string }> = {
  FREE: {
    summary: "Best for getting started and publishing a clean portfolio fast.",
  },
  PRO: {
    summary: "Best for active photographers who need room to scale and convert.",
  },
  STUDIO: {
    summary: "Best for high-volume studios with larger teams and catalogs.",
  },
};

const resolveLimitValue = (plan: BillingPlan, keys: readonly string[]) => {
  for (const key of keys) {
    if (key in plan.limits) {
      return plan.limits[key];
    }
  }
  return null;
};
const formatLimitValue = (value: number | boolean | null) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") {
    return value ? "Included" : "Not included";
  }
  if (value < 0) {
    return "Unlimited";
  }
  return value.toString();
};
const formatPlanRowValue = (
  plan: BillingPlan,
  rowId: (typeof visibleLimitRows)[number]["id"],
  value: number | boolean | null
) => {
  if (rowId === "customDomain" && value === false && plan.id === "FREE") {
    return "Lensaya subdomain only";
  }
  return formatLimitValue(value);
};

const formatPrice = (price: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `$${price}`;
  }
};
const resolveCyclePrice = (plan: BillingPlan, billingCycle: BillingCycle) => {
  const monthly = Number(plan.pricing?.monthly ?? plan.monthlyPrice ?? plan.price ?? 0);
  const yearlyFallback = monthly > 0 ? Number((monthly * 10).toFixed(2)) : 0;
  const yearly = Number(plan.pricing?.yearly ?? plan.yearlyPrice ?? yearlyFallback);
  return billingCycle === "yearly" ? yearly : monthly;
};
const resolveCycleLabel = (billingCycle: BillingCycle) => (billingCycle === "yearly" ? "year" : "month");
const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};
const formatBillingCycleLabel = (value: BillingCycle | null | undefined) => {
  if (value === "yearly") return "Yearly";
  if (value === "monthly") return "Monthly";
  return "Not applicable";
};
const describePendingChange = (subscription: BillingSubscription | null) => {
  const pending = subscription?.pendingChange;
  if (!pending) return null;

  if (pending.type === "cancellation") {
    return `Free plan starts ${formatDateTime(pending.effectiveAt)}.`;
  }

  const interval = pending.billingCycle ? ` (${formatBillingCycleLabel(pending.billingCycle as BillingCycle)})` : "";
  return `${pending.plan}${interval} starts ${formatDateTime(pending.effectiveAt)}.`;
};

export default function DashboardPricing() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<BillingPlan["id"] | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const navigate = useNavigate();
  const { success, error } = useToast();
  const { isAuthenticated } = useAuth();

  const refreshSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setSubscription(null);
      return null;
    }

    try {
      const result = await billingApi.subscription();
      setSubscription(result);
      if (result.billingCycle) {
        setBillingCycle(result.billingCycle as BillingCycle);
      }
      return result;
    } catch {
      setSubscription(null);
      return null;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      setLoading(true);
      try {
        const result = await billingApi.plans();
        if (!mounted) return;
        const ordered = result.plans
          .slice()
          .map((plan) => ({ ...plan, id: plan.id as PlanId }))
          .sort((a, b) => planOrder.indexOf(a.id) - planOrder.indexOf(b.id));
        setPlans(ordered);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load pricing plans"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      mounted = false;
    };
  }, [error]);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (!checkoutStatus) return;

    if (checkoutStatus === "success") {
      success("Payment completed. Your subscription is active.");
      void refreshSubscription();
    } else if (checkoutStatus === "trial") {
      success("Trial started successfully.");
      void refreshSubscription();
    } else if (checkoutStatus === "failed") {
      error("Payment failed. Your subscription was not changed.");
    } else if (checkoutStatus === "canceled") {
      error("Checkout was canceled. You can try again anytime.");
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("checkout");
    setSearchParams(nextParams, { replace: true });
  }, [error, refreshSubscription, searchParams, setSearchParams, success]);

  const currentPlan = (subscription?.plan || "FREE") as BillingPlan["id"];
  const currentBillingCycle = (subscription?.billingCycle || "monthly") as BillingCycle;
  const pendingChangeCopy = describePendingChange(subscription);

  const handleCheckout = useCallback(
    async (targetPlanId: BillingPlan["id"]) => {
      if (!isAuthenticated) {
        navigate(`/login?redirect=${encodeURIComponent("/dashboard/pricing")}`);
        return;
      }

      try {
        setCheckingOut(targetPlanId);
        const origin = window.location.origin;
        const selectedCycle: BillingCycle = targetPlanId === "FREE" ? "monthly" : billingCycle;
        const result = await billingApi.changePlan({
          targetPlanId,
          billingCycle: selectedCycle,
          successUrl: `${origin}/dashboard/pricing?checkout=success`,
          cancelUrl: `${origin}/dashboard/pricing?checkout=canceled`,
        });

        if (result.action === "checkout_required" && result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }

        if (result.plan) {
          setSubscription(result as BillingSubscription);
        }

        if (result.action === "changed") {
          if (targetPlanId === "FREE" && result.plan !== "FREE") {
            success("Downgrade scheduled. Your account stays paid until the current period ends.");
          } else if (result.pendingChange?.type === "plan_change") {
            success("Plan change scheduled for the next billing cycle.");
          } else {
            success("Subscription updated successfully.");
          }
          return;
        }

        success("You are already on this plan and billing interval.");
      } catch (err) {
        error(getApiErrorMessage(err, "Unable to start checkout"));
      } finally {
        setCheckingOut(null);
      }
    },
    [billingCycle, error, isAuthenticated, navigate, success]
  );

  const cards = useMemo(() => {
    return plans.map((plan) => {
      const isCurrentPlan = currentPlan === plan.id;
      const isCurrentSelection = isCurrentPlan && (plan.id === "FREE" || currentBillingCycle === billingCycle);
      const isPopular = plan.id === "PRO";
      const cyclePrice = resolveCyclePrice(plan, billingCycle);
      const cycleLabel = resolveCycleLabel(billingCycle);
      const visibleLimits = visibleLimitRows.map((row) => ({
        id: row.id,
        label: row.label,
        value: resolveLimitValue(plan, row.keys),
      }));

      let ctaLabel = "Choose plan";
      if (checkingOut === plan.id) {
        ctaLabel = "Redirecting...";
      } else if (isCurrentSelection) {
        ctaLabel = "Current Plan";
      } else if (plan.id === "FREE") {
        ctaLabel = currentPlan === "FREE" ? "Choose Free" : "Downgrade to Free";
      } else if (isCurrentPlan) {
        ctaLabel = `Switch to ${plan.name} ${formatBillingCycleLabel(billingCycle)}`;
      } else if (currentPlan === "FREE") {
        ctaLabel = `Start ${plan.name} ${formatBillingCycleLabel(billingCycle)}`;
      } else {
        ctaLabel = `Switch to ${plan.name} ${formatBillingCycleLabel(billingCycle)}`;
      }

      return (
        <div
          key={plan.id}
          className={`relative rounded-2xl border bg-white p-6 shadow-sm ${
            isPopular ? "border-cyan-400 ring-2 ring-cyan-100" : "border-gray-200"
          }`}
        >
          {isPopular ? (
            <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-cyan-500 px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="h-3 w-3" />
              Most Popular
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{plan.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{planCopy[plan.id].summary}</p>
            </div>
            {isCurrentSelection ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Current
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex items-end gap-1">
            <span className="text-4xl font-bold text-slate-900">{formatPrice(cyclePrice, plan.currency)}</span>
            <span className="mb-1 text-slate-500">/{cycleLabel}</span>
          </div>
          {billingCycle === "yearly" && plan.id !== "FREE" ? (
            <p className="mt-1 text-xs text-emerald-600">
              Billed annually
              {Number(plan.yearlyDiscountPercent || 0) > 0 ? `, save ${Number(plan.yearlyDiscountPercent)}%.` : "."}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-slate-600">
            {plan.id === "FREE"
              ? "No credit card required."
              : plan.trialDays > 0
                ? `${plan.trialDays}-day trial available.`
                : "Billed securely after checkout."}
          </p>

          <ul className="mt-6 space-y-3">
            {visibleLimits.map((row) => (
              <li key={`${plan.id}-${row.id}`} className="flex items-center gap-2 text-sm text-slate-700">
                <Check className="h-4 w-4 text-emerald-500" />
                <span>
                  <span className="font-semibold">{formatPlanRowValue(plan, row.id, row.value)}</span> {row.label}
                </span>
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm text-slate-700">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>
                <span className="font-semibold">{plan.id === "FREE" ? "Visible" : "Removed"}</span> Lensaya Branding
              </span>
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-700">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>
                <span className="font-semibold">{plan.id === "FREE" ? "Not included" : "Included"}</span> Priority Support
              </span>
            </li>
          </ul>

          <Button
            className="mt-8 w-full"
            variant={isCurrentSelection ? "secondary" : "primary"}
            disabled={checkingOut === plan.id || isCurrentSelection}
            onClick={() => {
              void handleCheckout(plan.id);
            }}
          >
            {ctaLabel}
          </Button>
        </div>
      );
    });
  }, [billingCycle, checkingOut, currentBillingCycle, currentPlan, handleCheckout, plans]);

  return (
    <DashboardLayout>
      <div className="mb-6 max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
          <CreditCard className="h-3.5 w-3.5" />
          Pricing Plans
        </div>
        <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Choose the plan that fits your studio</h1>
        <p className="mt-3 text-slate-600">
          Pricing, trials, and plan limits come directly from your admin billing configuration. Upgrades apply
          immediately after successful payment. Downgrades apply at the next billing cycle.
        </p>
      </div>

      {subscription ? (
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Current plan</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{subscription.plan}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Billing status</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{subscription.statusLabel || subscription.status}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Billing interval</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatBillingCycleLabel(subscription.billingCycle as BillingCycle | null | undefined)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Next renewal</p>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>{subscription.plan === "FREE" ? "No active paid cycle" : formatDateTime(subscription.nextRenewalAt || subscription.renewAt)}</span>
              </div>
            </div>
          </div>
          {pendingChangeCopy ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="font-semibold">Pending change:</span> {pendingChangeCopy}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mb-10 flex w-full justify-center">
        <div className="flex w-full max-w-[360px] items-center rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`flex-1 rounded-full px-5 py-1.5 text-center text-sm transition-colors ${
              billingCycle === "monthly"
                ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={`flex-1 rounded-full px-5 py-1.5 text-center text-sm transition-colors ${
              billingCycle === "yearly"
                ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <LoadingCard label="Loading plans..." />
          <LoadingCard label="Loading plans..." />
          <LoadingCard label="Loading plans..." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{cards}</div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Compare Plan Features</h2>
              <p className="text-sm text-slate-600">Simple side-by-side comparison of what changes by plan.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Feature</th>
                    {plans.map((plan) => (
                      <th key={`head-${plan.id}`} className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visibleLimitRows.map((row) => (
                    <tr key={`row-${row.id}`}>
                      <td className="px-6 py-3 text-sm font-medium text-slate-900">{row.label}</td>
                      {plans.map((plan) => (
                        <td key={`${row.id}-${plan.id}`} className="px-6 py-3 text-center text-sm text-slate-700">
                          {formatPlanRowValue(plan, row.id, resolveLimitValue(plan, row.keys))}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="px-6 py-3 text-sm font-medium text-slate-900">Lensaya Branding</td>
                    {plans.map((plan) => (
                      <td key={`branding-${plan.id}`} className="px-6 py-3 text-center text-sm text-slate-700">
                        {plan.id === "FREE" ? "Visible" : "Removed"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-3 text-sm font-medium text-slate-900">Priority Support</td>
                    {plans.map((plan) => (
                      <td key={`support-${plan.id}`} className="px-6 py-3 text-center text-sm text-slate-700">
                        {plan.id === "FREE" ? "Not included" : "Included"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
