import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Check, CreditCard, Sparkles } from "lucide-react";
import { billingApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { DashboardPageHero } from "../../components/dashboard/DashboardPageHero";

type BillingCycle = "monthly" | "yearly";
type PlanId = "FREE" | "PRO" | "STUDIO";
type PaymentProviderChoice = "auto" | "chip" | "stripe";
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
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderChoice>("auto");
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
          ...(paymentProvider !== "auto" ? { paymentProvider } : {}),
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
    [billingCycle, error, isAuthenticated, navigate, paymentProvider, success]
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
      const featuredLimits = visibleLimits.slice(0, 4);

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
        <article
          key={plan.id}
          className={`relative rounded-2xl border bg-white/95 p-4 shadow-sm sm:p-6 ${
            isPopular ? "border-cyan-300 ring-2 ring-cyan-100/80" : "border-slate-200/80"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {isPopular ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                <Sparkles className="h-3 w-3" />
                Most Popular
              </span>
            ) : null}
            {isCurrentSelection ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                Current Plan
              </span>
            ) : null}
          </div>

          <div className="mt-3">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{plan.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{planCopy[plan.id].summary}</p>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-3">
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-slate-900 sm:text-4xl">{formatPrice(cyclePrice, plan.currency)}</span>
              <span className="mb-1 text-slate-500">/{cycleLabel}</span>
            </div>
            {billingCycle === "yearly" && plan.id !== "FREE" ? (
              <p className="mt-1 text-xs text-emerald-600">
                Billed annually
                {Number(plan.yearlyDiscountPercent || 0) > 0 ? `, save ${Number(plan.yearlyDiscountPercent)}%.` : "."}
              </p>
            ) : null}
            <p className="mt-1.5 text-xs text-slate-600 sm:text-sm">
              {plan.id === "FREE"
                ? "No credit card required."
                : plan.trialDays > 0
                  ? `${plan.trialDays}-day trial available.`
                  : "Billed securely after checkout."}
            </p>
          </div>

          <ul className="mt-4 space-y-2.5">
            {featuredLimits.map((row) => (
              <li key={`${plan.id}-${row.id}`} className="flex items-center gap-2 text-sm text-slate-700">
                <Check className="h-4 w-4 text-emerald-500" />
                <span>
                  <span className="font-semibold">{formatPlanRowValue(plan, row.id, row.value)}</span> {row.label}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] sm:text-xs">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
              Branding: {plan.id === "FREE" ? "Visible" : "Removed"}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
              Support: {plan.id === "FREE" ? "Standard" : "Priority"}
            </span>
          </div>

          <p className="mt-3 text-xs text-slate-500">Full feature matrix below.</p>

          <Button
            className="mt-5 w-full"
            variant={isCurrentSelection ? "secondary" : "primary"}
            disabled={checkingOut === plan.id || isCurrentSelection}
            onClick={() => {
              void handleCheckout(plan.id);
            }}
          >
            {ctaLabel}
          </Button>
        </article>
      );
    });
  }, [billingCycle, checkingOut, currentBillingCycle, currentPlan, handleCheckout, plans]);

  const comparisonRows = useMemo<{ id: string; label: string; values: string[] }[]>(() => {
    const rows: { id: string; label: string; values: string[] }[] = visibleLimitRows.map((row) => ({
      id: row.id,
      label: row.label,
      values: plans.map((plan) => formatPlanRowValue(plan, row.id, resolveLimitValue(plan, row.keys))),
    }));

    rows.push({
      id: "branding",
      label: "Lensaya Branding",
      values: plans.map((plan) => (plan.id === "FREE" ? "Visible" : "Removed")),
    });

    rows.push({
      id: "prioritySupport",
      label: "Priority Support",
      values: plans.map((plan) => (plan.id === "FREE" ? "Not included" : "Included")),
    });

    return rows;
  }, [plans]);

  return (
    <DashboardLayout>
      <DashboardPageHero
        eyebrow="Pricing Plans"
        title="Choose the plan that fits your studio"
        description="Compare plans, switch billing interval, and manage renewals in one place."
      />

      {subscription ? (
        <section className="mb-5 rounded-2xl border border-slate-200/80 bg-[linear-gradient(165deg,#ffffff_0%,#f0f9ff_56%,#f8fafc_100%)] px-3.5 py-3.5 sm:mb-7 sm:rounded-xl sm:border-slate-200 sm:px-6 sm:py-5 sm:shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Current Subscription</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{subscription.plan}</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {subscription.statusLabel || subscription.status}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Billing Interval</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatBillingCycleLabel(subscription.billingCycle as BillingCycle | null | undefined)}
              </p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5 sm:col-span-1 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next Renewal</p>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>
                  {subscription.plan === "FREE"
                    ? "No active paid cycle"
                    : formatDateTime(subscription.nextRenewalAt || subscription.renewAt)}
                </span>
              </div>
            </div>
          </div>

          {pendingChangeCopy ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-900 sm:text-sm">
              <span className="font-semibold">Pending change:</span> {pendingChangeCopy}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mb-5 sm:mb-6">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <CreditCard className="h-3.5 w-3.5 text-slate-400" />
          Payment Method
        </div>
        <p className="mb-3 text-xs text-slate-600">Auto uses CHIP for Malaysia and Stripe for global markets.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPaymentProvider("auto")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              paymentProvider === "auto"
                ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Auto (Recommended)
          </button>
          <button
            type="button"
            onClick={() => setPaymentProvider("chip")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              paymentProvider === "chip"
                ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            CHIP
          </button>
          <button
            type="button"
            onClick={() => setPaymentProvider("stripe")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              paymentProvider === "stripe"
                ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Stripe
          </button>
        </div>
      </section>

      <section className="mb-6 sm:mb-8">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <CreditCard className="h-3.5 w-3.5 text-slate-400" />
          Billing Interval
        </div>
        <div className="mx-auto flex w-full max-w-105 items-center rounded-full border border-slate-200/80 bg-slate-100/80 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-medium transition-colors ${
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
            className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-medium transition-colors ${
              billingCycle === "yearly"
                ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              Yearly
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Save</span>
            </span>
          </button>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <LoadingCard label="Loading plans..." />
          <LoadingCard label="Loading plans..." />
          <LoadingCard label="Loading plans..." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">{cards}</div>

          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white sm:mt-10">
            <div className="border-b border-slate-200 px-3.5 py-3.5 sm:px-6 sm:py-4">
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Compare Plan Features</h2>
              <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                Mobile-friendly breakdown of what changes between Free, Pro, and Studio.
              </p>
            </div>

            <div className="space-y-2.5 p-3.5 md:hidden">
              {comparisonRows.map((row) => (
                <article key={`mobile-row-${row.id}`} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{row.label}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {plans.map((plan, index) => (
                      <div key={`${row.id}-${plan.id}-mobile`} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{plan.name}</p>
                        <p className="mt-1 wrap-break-word text-[11px] font-semibold leading-4 text-slate-800">{row.values[index]}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-170">
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
                <tbody className="divide-y divide-slate-200">
                  {comparisonRows.map((row) => (
                    <tr key={`desktop-row-${row.id}`}>
                      <td className="px-6 py-3 text-sm font-medium text-slate-900">{row.label}</td>
                      {row.values.map((value, index) => (
                        <td key={`${row.id}-desktop-value-${plans[index]?.id || index}`} className="px-6 py-3 text-center text-sm text-slate-700">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
