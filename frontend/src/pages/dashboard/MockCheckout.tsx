import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, CircleAlert, CircleX, CreditCard, FlaskConical, LoaderCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useToast } from "../../contexts/ToastContext";
import { billingApi, getApiErrorMessage } from "../../lib/api";

type MockSession = Awaited<ReturnType<typeof billingApi.mockCheckoutSession>>;
type Outcome = "succeeded" | "failed" | "canceled" | "trial";

const formatCurrency = (amount: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency || "USD"}`;
  }
};

const formatBillingCycle = (billingCycle: MockSession["billingCycle"]) =>
  billingCycle === "yearly" ? "Yearly" : "Monthly";

export default function MockCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { error } = useToast();
  const [session, setSession] = useState<MockSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Outcome | null>(null);

  const sessionId = searchParams.get("session") || "";

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!sessionId) {
        error("Mock checkout session is missing.");
        navigate("/dashboard/pricing", { replace: true });
        return;
      }

      setLoading(true);
      try {
        const result = await billingApi.mockCheckoutSession(sessionId);
        if (!mounted) return;
        setSession(result);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Unable to load mock checkout session"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [error, navigate, sessionId]);

  const complete = async (outcome: Outcome) => {
    if (!sessionId) return;

    try {
      setProcessing(outcome);
      const result = await billingApi.completeMockCheckout(sessionId, { outcome });
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      navigate("/dashboard/transactions", { replace: true });
    } catch (err) {
      error(getApiErrorMessage(err, "Unable to complete mock checkout"));
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading mock checkout..." />
      </DashboardLayout>
    );
  }

  if (!session) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-semibold">Mock checkout session not found.</p>
          <Link to="/dashboard/pricing" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-red-700">
            <ArrowLeft className="h-4 w-4" />
            Return to pricing
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-600">Mock Billing</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Test the checkout flow safely</h1>
            <p className="mt-2 text-sm text-slate-600">
              This screen simulates provider checkout without live CHIP credentials. Use it to validate upgrades,
              trials, failures, and cancellations end to end.
            </p>
          </div>
          <Link
            to="/dashboard/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to pricing
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-600">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Checkout details</p>
                <p className="text-lg font-semibold text-slate-900">{session.planName}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Current plan</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{session.currentPlan}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Target plan</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{session.targetPlan || "Unknown"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Billing interval</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatBillingCycle(session.billingCycle)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Amount due</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(session.amount, session.currency)}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-4 text-sm text-cyan-900">
              <p className="font-semibold">What this validates</p>
              <ul className="mt-2 space-y-2 text-cyan-900/90">
                <li>Immediate paid upgrades</li>
                <li>Configured trial handling for eligible upgrades from Free</li>
                <li>Failed-payment and canceled-checkout UX paths</li>
                <li>Subscription state, transaction history, and entitlement sync</li>
              </ul>
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-200">
              <FlaskConical className="h-4 w-4" />
              Provider: {session.provider.toUpperCase()}
            </div>
            <h2 className="mt-4 text-xl font-semibold">Choose a simulated outcome</h2>
            <p className="mt-2 text-sm text-slate-300">
              Each action updates subscription state and transaction records as if a provider callback had completed.
            </p>

            <div className="mt-6 space-y-3">
              <Button
                className="w-full justify-center bg-emerald-500 text-white hover:bg-emerald-600"
                onClick={() => {
                  void complete("succeeded");
                }}
                disabled={Boolean(processing)}
              >
                {processing === "succeeded" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
                Simulate successful payment
              </Button>
              {session.trialAvailable ? (
                <Button
                  className="w-full justify-center bg-cyan-500 text-white hover:bg-cyan-600"
                  onClick={() => {
                    void complete("trial");
                  }}
                  disabled={Boolean(processing)}
                >
                  {processing === "trial" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
                  Start configured trial ({session.trialDays} days)
                </Button>
              ) : null}
              <Button
                variant="secondary"
                className="w-full justify-center border border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => {
                  void complete("failed");
                }}
                disabled={Boolean(processing)}
              >
                {processing === "failed" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CircleAlert className="mr-2 h-4 w-4" />}
                Simulate failed payment
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center border border-slate-200 text-slate-100 hover:bg-white/10"
                onClick={() => {
                  void complete("canceled");
                }}
                disabled={Boolean(processing)}
              >
                {processing === "canceled" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CircleX className="mr-2 h-4 w-4" />}
                Simulate checkout canceled
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
