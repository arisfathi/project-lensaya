import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle, XCircle } from "lucide-react";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { Button } from "../../components/ui/Button";

export default function CheckoutCanceled() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
            <XCircle className="h-4 w-4 text-slate-500" />
            Checkout canceled
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">No worries — nothing was charged.</h1>
          <p className="mt-3 text-sm text-slate-600">
            You can try again anytime, or review the plan details before subscribing.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Common reasons</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>Needed more time to compare plans</li>
                <li>Wanted to confirm payment details</li>
                <li>Closed the window during checkout</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Need help?</p>
              <p className="mt-2 text-sm text-slate-700">
                If you ran into an issue, contact support and we’ll help you get subscribed.
              </p>
              <div className="mt-3">
                <a href="mailto:support@lensaya.com" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-800">
                  <HelpCircle className="h-4 w-4" />
                  Email support
                </a>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/dashboard/pricing" className="flex-1">
              <Button className="w-full">Try again</Button>
            </Link>
            <Link to="/dashboard" className="flex-1">
              <Button variant="secondary" className="w-full">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

