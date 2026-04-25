import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { billingApi, getApiErrorMessage, isApiAccessError } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { useEntitlements } from "../../hooks/useEntitlements";
import { DEFAULT_PAGINATION, DEFAULT_SUMMARY } from "./transactions/constants";
import { BillingNotices } from "./transactions/components/BillingNotices";
import { SubscriptionOverview } from "./transactions/components/SubscriptionOverview";
import { TransactionsHeader } from "./transactions/components/TransactionsHeader";
import { TransactionsHistory } from "./transactions/components/TransactionsHistory";
import { TransactionsKpiGrid } from "./transactions/components/TransactionsKpiGrid";
import type { PaginationMeta, StatusFilter, SubscriptionState, TransactionItem, TransactionSummary } from "./transactions/types";
import { describePendingChange, formatDateTime, getPaymentStatusConfig } from "./transactions/utils";

export default function Transactions() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TransactionItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(DEFAULT_PAGINATION);
  const [summary, setSummary] = useState<TransactionSummary>(DEFAULT_SUMMARY);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [renewLoading, setRenewLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const { error, success } = useToast();
  const { entitlementUpgradeTarget } = useEntitlements();

  useEffect(() => {
    const billingLanding = searchParams.get("billing");

    if (billingLanding === "1") {
      success("You are viewing the in-app billing center.");
    } else {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("billing");
    setSearchParams(nextParams, { replace: true });
  }, [error, searchParams, setSearchParams, success]);

  useEffect(() => {
    let mounted = true;

    const loadBillingActivity = async () => {
      setLoading(true);
      try {
        const [transactionsResult, subscriptionResult] = await Promise.all([
          billingApi.transactions({
            page,
            limit: 20,
            status: statusFilter === "ALL" ? undefined : statusFilter,
          }),
          billingApi.subscription(),
        ]);
        if (!mounted) return;
        setRows((transactionsResult.items || []) as TransactionItem[]);
        setPagination((transactionsResult.pagination || DEFAULT_PAGINATION) as PaginationMeta);
        setSummary((transactionsResult.summary || DEFAULT_SUMMARY) as TransactionSummary);
        setSubscription(subscriptionResult);
      } catch (err) {
        if (!mounted || isApiAccessError(err)) return;
        error(getApiErrorMessage(err, "Failed to load payment activity"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadBillingActivity();
    return () => {
      mounted = false;
    };
  }, [error, page, statusFilter]);

  const handleOpenBillingPortal = async () => {
    try {
      setPortalLoading(true);
      const origin = window.location.origin;
      const result = await billingApi.portalSession({ returnUrl: `${origin}/dashboard/transactions?billing=1` });
      if (result.portalUrl) {
        window.location.assign(result.portalUrl);
        return;
      }
      error("Billing center URL is unavailable");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to open billing center"));
    } finally {
      setPortalLoading(false);
    }
  };

  const handleResumeAutoRenew = async () => {
    try {
      setResumeLoading(true);
      const result = await billingApi.resumeSubscription();
      setSubscription(result);
      success("Subscription auto-renew has been resumed.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to resume auto-renew"));
    } finally {
      setResumeLoading(false);
    }
  };

  const handleRenewSubscription = async () => {
    const currentPlan = String(subscription?.plan || "FREE").toUpperCase();
    if (currentPlan === "FREE") {
      return;
    }

    try {
      setRenewLoading(true);
      const origin = window.location.origin;
      const result = await billingApi.changePlan({
        targetPlanId: currentPlan as "PRO" | "STUDIO",
        billingCycle: ((subscription?.billingCycle as "monthly" | "yearly" | null) || "monthly"),
        successUrl: `${origin}/checkout/success?plan=${encodeURIComponent(currentPlan)}`,
        cancelUrl: `${origin}/checkout/canceled?plan=${encodeURIComponent(currentPlan)}`,
        forceCheckout: true,
      });

      if (result.action === "checkout_required" && result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      const refreshedSubscription = await billingApi.subscription();
      setSubscription(refreshedSubscription);
      success("Subscription details refreshed.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to start renewal"));
    } finally {
      setRenewLoading(false);
    }
  };

  const handleScheduleCancellation = async () => {
    try {
      setCancelLoading(true);
      const result = await billingApi.cancelSubscription({ atPeriodEnd: true });
      setSubscription(result);
      success("Subscription cancellation has been scheduled.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to schedule cancellation"));
    } finally {
      setCancelLoading(false);
    }
  };

  const currentPlan = String(subscription?.plan || "FREE").toUpperCase();
  const portalAvailable = String(subscription?.provider || "").toLowerCase() === "stripe";
  const paymentStatus = useMemo(() => getPaymentStatusConfig(subscription), [subscription]);
  const nextPaymentDate =
    currentPlan === "FREE"
      ? "No active paid cycle"
      : formatDateTime(subscription?.nextRenewalAt || subscription?.renewAt);
  const pendingChange = describePendingChange(subscription);
  const rangeStart = rows.length ? (page - 1) * pagination.limit + 1 : 0;
  const rangeEnd = rows.length ? (page - 1) * pagination.limit + rows.length : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading transactions..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-0.5 overflow-x-hidden">
        <TransactionsHeader />

        <BillingNotices
          pendingChange={pendingChange}
          pastDueGraceEndsAt={subscription?.billingState === "past_due" ? subscription.graceEndsAt : null}
          formattedGraceEndsAt={formatDateTime(subscription?.graceEndsAt)}
        />

        <section className="mb-4 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 sm:mb-6 sm:rounded-xl sm:border-slate-200 sm:p-4 sm:shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <CreditCard className="h-3.5 w-3.5 text-slate-400" />
            Payment Method
          </div>
          <p className="mb-1 text-xs text-slate-600">Payments are handled by Stripe.</p>
          <p className="text-xs text-slate-500">
            {portalAvailable
              ? 'Use "Manage billing" to update your payment method and invoices.'
              : "Billing portal becomes available after your first successful Stripe checkout."}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Need help?{" "}
            <Link to="/help/billing" className="font-semibold text-cyan-700 hover:text-cyan-800">
              Billing FAQ
            </Link>
            .
          </p>
        </section>

        <SubscriptionOverview
          data={{ subscription, currentPlan, paymentStatus, nextPaymentDate }}
          actions={{
            portalLoading,
            resumeLoading,
            renewLoading,
            cancelLoading,
            onOpenBillingPortal: () => {
              void handleOpenBillingPortal();
            },
            onResumeAutoRenew: () => {
              void handleResumeAutoRenew();
            },
            onRenewSubscription: () => {
              void handleRenewSubscription();
            },
            onScheduleCancellation: () => {
              void handleScheduleCancellation();
            },
          }}
        />

        <TransactionsKpiGrid summary={summary} />

        <TransactionsHistory
          data={{
            rows,
            pagination,
            page,
            statusFilter,
            currentPlan,
            upgradeTarget: entitlementUpgradeTarget,
            rangeStart,
            rangeEnd,
          }}
          handlers={{
            onStatusFilterChange: (value) => {
              setStatusFilter(value);
              setPage(1);
            },
            onPreviousPage: () => {
              setPage((current) => Math.max(1, current - 1));
            },
            onNextPage: () => {
              setPage((current) => Math.min(current + 1, pagination.totalPages || 1));
            },
          }}
        />
      </div>
    </DashboardLayout>
  );
}
