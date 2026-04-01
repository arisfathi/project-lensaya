import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { publicApi } from "../lib/api";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/Button";
import { LoadingCard } from "../components/ui/LoadingSpinner";

type BillingCycle = "monthly" | "yearly";
type PlanId = "FREE" | "PRO" | "STUDIO";
type BillingPlan = Omit<Awaited<ReturnType<typeof publicApi.plans>>["plans"][number], "id"> & { id: PlanId };
type PublicPricingContent = Awaited<ReturnType<typeof publicApi.pricingContent>>;

const planOrder: PlanId[] = ["FREE", "PRO", "STUDIO"];

const defaultPublicPricingContent: PublicPricingContent = {
  bullets: {
    FREE: ["No credit card required", "Publish your portfolio fast", "Best for trying Lensaya"],
    PRO: ["Most popular for active photographers", "Higher limits for growth", "Priority support included"],
    STUDIO: ["For high-volume studios", "Large catalogs and team workflows", "Maximum flexibility and scale"],
  },
  compareRows: [
    {
      id: "portfolio-photos",
      label: "Portfolio Photos",
      sortOrder: 0,
      values: { FREE: "100", PRO: "1000", STUDIO: "Unlimited" },
    },
    {
      id: "services",
      label: "Services",
      sortOrder: 1,
      values: { FREE: "3", PRO: "15", STUDIO: "Unlimited" },
    },
    {
      id: "custom-domain",
      label: "Custom Domain",
      sortOrder: 2,
      values: { FREE: "Not included", PRO: "Included", STUDIO: "Included" },
    },
  ],
  updatedAt: null,
};

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

const formatBillingCycleLabel = (value: BillingCycle | null | undefined) => {
  if (value === "yearly") return "Yearly";
  if (value === "monthly") return "Monthly";
  return "Not applicable";
};

export default function Pricing() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [pricingContent, setPricingContent] = useState<PublicPricingContent>(defaultPublicPricingContent);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      setLoading(true);
      try {
        const [plansResult, contentResult] = await Promise.all([publicApi.plans(), publicApi.pricingContent()]);
        if (!mounted) return;

        const ordered = plansResult.plans
          .slice()
          .map((plan) => ({ ...plan, id: plan.id as PlanId }))
          .sort((a, b) => planOrder.indexOf(a.id) - planOrder.indexOf(b.id));
        setPlans(ordered);
        setPricingContent(contentResult);
        setErrorMessage(null);
      } catch {
        if (!mounted) return;
        setPlans([]);
        setPricingContent(defaultPublicPricingContent);
        setErrorMessage("Unable to load pricing right now.");
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
  }, []);

  const previewPlans = plans.length >= 3 ? plans : null;

  const handlePublicPlanCta = useCallback(
    (targetPlanId: BillingPlan["id"]) => {
      if (!isAuthenticated) {
        const redirectPath = targetPlanId === "FREE" ? "/dashboard" : "/dashboard/pricing";
        navigate(`/signup?redirect=${encodeURIComponent(redirectPath)}`);
        return;
      }

      navigate(targetPlanId === "FREE" ? "/dashboard" : "/dashboard/pricing");
    },
    [isAuthenticated, navigate]
  );

  const cards = useMemo(() => {
    return plans.map((plan) => {
      const isPopular = plan.id === "PRO";
      const cyclePrice = resolveCyclePrice(plan, billingCycle);
      const cycleLabel = resolveCycleLabel(billingCycle);
      const bullets = pricingContent.bullets?.[plan.id] || [];
      const ctaLabel =
        plan.id === "FREE" ? "Start Free" : `Start ${plan.name} ${formatBillingCycleLabel(billingCycle)}`;

      return (
        <div
          key={plan.id}
          className={`relative rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur ${
            isPopular ? "ring-2 ring-cyan-200" : ""
          }`}
        >
          {isPopular ? (
            <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-cyan-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
              <Sparkles className="h-3 w-3" />
              Most Popular
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">{plan.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{planCopy[plan.id].summary}</p>
            </div>
          </div>

          <div className="mt-4 flex items-end gap-1">
            <span className="text-4xl font-bold text-slate-950">{formatPrice(cyclePrice, plan.currency)}</span>
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
                : "Create your account to get started."}
          </p>

          <ul className="mt-6 space-y-3">
            {bullets.map((item, index) => (
              <li key={`${plan.id}-bullet-${index + 1}`} className="flex items-center gap-2 text-sm text-slate-700">
                <Check className="h-4 w-4 text-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <Button
            className="mt-8 w-full"
            variant={plan.id === "FREE" ? "secondary" : "primary"}
            onClick={() => {
              handlePublicPlanCta(plan.id);
            }}
          >
            {ctaLabel}
          </Button>
        </div>
      );
    });
  }, [billingCycle, handlePublicPlanCta, plans, pricingContent.bullets]);

  const compareRows = useMemo(
    () =>
      (pricingContent.compareRows || [])
        .slice()
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [pricingContent.compareRows]
  );

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="brand-shell">
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16 lg:px-8">
          <div className="brand-panel relative overflow-hidden rounded-[32px] border border-white/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10 lg:p-12">
            <div className="absolute right-[-8%] top-[-18%] h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute bottom-[-20%] left-[-10%] h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

            <div className="relative grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  <CreditCard className="h-3.5 w-3.5" />
                  Pricing plans
                </div>
                <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Choose the plan that fits your studio
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                  Public messaging and comparison rows are managed from admin, while displayed prices always mirror your
                  real billing plan configuration.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 shadow-sm">Free to start</span>
                  <span className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 shadow-sm">
                    {previewPlans ? `${previewPlans[1].trialDays}-day Pro trial` : "Pro trial available"}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 shadow-sm">Instant upgrades</span>
                </div>
              </div>

              <div className="relative">
                <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">Plan snapshot</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Free</p>
                        <p className="text-xs text-slate-500">Start publishing immediately</p>
                      </div>
                      {previewPlans ? (
                        <span className="text-sm font-semibold text-slate-700">
                          {formatPrice(resolveCyclePrice(previewPlans[0], "monthly"), previewPlans[0].currency)}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-slate-500">From admin config</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Pro</p>
                        <p className="text-xs text-slate-500">Best value for active photographers</p>
                      </div>
                      {previewPlans ? (
                        <span className="text-sm font-semibold text-slate-700">
                          {formatPrice(resolveCyclePrice(previewPlans[1], "monthly"), previewPlans[1].currency)}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-slate-500">From admin config</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Studio</p>
                        <p className="text-xs text-slate-500">For higher volume operations</p>
                      </div>
                      {previewPlans ? (
                        <span className="text-sm font-semibold text-slate-700">
                          {formatPrice(resolveCyclePrice(previewPlans[2], "monthly"), previewPlans[2].currency)}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-slate-500">From admin config</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {!loading && errorMessage ? <p className="mt-6 text-center text-sm text-red-600">{errorMessage}</p> : null}
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="mb-10 flex w-full justify-center">
            <div className="flex w-full max-w-[420px] items-center rounded-full border border-slate-200/80 bg-white/90 p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur">
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

              <div className="mt-10 overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
                <div className="border-b border-slate-200/80 px-6 py-6 sm:px-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">Compare plan features</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-950">Simple side-by-side comparison</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    This table is managed from admin for marketing, while plan pricing still comes from real billing configuration.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Feature
                        </th>
                        {plans.map((plan) => (
                          <th
                            key={`head-${plan.id}`}
                            className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                          >
                            {plan.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80">
                      {compareRows.map((row) => (
                        <tr key={`row-${row.id}`} className="transition-colors hover:bg-cyan-50/30">
                          <td className="px-6 py-4 text-sm font-medium text-slate-950">{row.label}</td>
                          {plans.map((plan) => (
                            <td key={`${row.id}-${plan.id}`} className="px-6 py-4 text-center text-sm text-slate-700">
                              {row.values[plan.id]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-10 rounded-[28px] border border-slate-200/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white shadow-[0_20px_60px_rgba(15,23,42,0.2)] sm:px-8">
                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Need more control?</p>
                    <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                      Keep the public portfolio premium and the upgrade path clear.
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                      Pro and Studio should feel like obvious growth steps. Free should still be usable, but the page
                      should make the upgrade value easy to understand in one glance.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 lg:justify-end">
                    <Link
                      to="/signup"
                      className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cyan-400"
                    >
                      Start Free
                    </Link>
                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Sign in
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
          {!loading && errorMessage ? <p className="mt-6 text-center text-sm text-red-600">{errorMessage}</p> : null}
        </section>
      </main>
      <Footer />
    </div>
  );
}
