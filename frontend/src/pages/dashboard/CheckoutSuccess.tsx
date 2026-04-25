import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, ExternalLink, ReceiptText, Sparkles } from "lucide-react";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { billingApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type SubscriptionState = Awaited<ReturnType<typeof billingApi.subscription>>;

const formatDate = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);

  const { error, success } = useToast();

  const planParam = useMemo(() => String(searchParams.get("plan") || "").trim(), [searchParams]);
  const trialParam = useMemo(() => searchParams.get("trial") === "true", [searchParams]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const result = await billingApi.subscription();
        if (!mounted) return;
        setSubscription(result);
        success(trialParam ? "Trial started successfully." : "Payment completed. Your subscription is active.");
      } catch (err) {
        if (!mounted) return;
        setSubscription(null);
        error(getApiErrorMessage(err, "Payment completed, but we couldn't refresh billing details yet."));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error, success, trialParam]);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Confirming subscription..." />
      </DashboardLayout>
    );
  }

  const resolvedPlan = (subscription?.plan || planParam || "PRO").toUpperCase();
  const nextBillingDate = subscription?.trialEndsAt ? subscription.trialEndsAt : subscription?.nextRenewalAt || subscription?.renewAt;
  const statusLabel = subscription?.statusLabel || "Updated";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {trialParam ? "Trial started" : "Checkout complete"}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {trialParam ? "You're on trial." : "You're all set."}
              </h1>
              <p className="text-sm text-slate-600">
                Your plan is now <span className="font-semibold text-slate-900">Lensaya {resolvedPlan}</span>. Status:{" "}
                <span className="font-semibold text-slate-900">{statusLabel}</span>.
              </p>
            </div>

            <div className="hidden sm:block rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-500 p-4 shadow-sm">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">Lensaya {resolvedPlan}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {subscription?.trialEndsAt ? "Trial ends" : "Next billing date"}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{formatDate(nextBillingDate)}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/dashboard" className="flex-1">
              <Button className="w-full">
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/dashboard/transactions" className="flex-1">
              <Button variant="secondary" className="w-full">
                View Billing Center <ReceiptText className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-sm font-semibold text-slate-900">Manage billing</h2>
          <p className="mt-1 text-sm text-slate-600">
            Update your card, download invoices, or cancel/resume your subscription from the secure Stripe billing portal.
          </p>
          <div className="mt-4">
            <Link to="/dashboard/transactions">
              <Button variant="ghost" className="w-full justify-center">
                Manage billing <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
