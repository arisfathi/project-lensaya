import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileText,
  RefreshCcw,
  Settings as SettingsIcon,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { billingApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type TransactionItem = Awaited<ReturnType<typeof billingApi.transactions>>["items"][number];
type PaginationMeta = Awaited<ReturnType<typeof billingApi.transactions>>["pagination"];
type TransactionSummary = NonNullable<Awaited<ReturnType<typeof billingApi.transactions>>["summary"]>;
type SubscriptionState = Awaited<ReturnType<typeof billingApi.subscription>>;

type StatusFilter = "ALL" | "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "CANCELED";
type TransactionStatusNormalized = "succeeded" | "pending" | "failed" | "refunded" | "canceled";

const defaultPagination: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

const defaultSummary: TransactionSummary = {
  totalTransactions: 0,
  successfulPayments: 0,
  pendingPayments: 0,
  paidAmount: 0,
  currency: "USD",
};

const toLower = (value: string) => String(value || "").trim().toLowerCase();
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
const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};
const shortId = (value: string) => {
  if (!value) return "Unknown";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
};
const normalizeTransactionStatus = (status: string): TransactionStatusNormalized => {
  const normalized = toLower(status);
  if (normalized === "succeeded") return "succeeded";
  if (normalized === "pending") return "pending";
  if (normalized === "refunded") return "refunded";
  if (normalized === "canceled") return "canceled";
  return "failed";
};
const formatBillingCycleLabel = (value: string | null | undefined) => {
  if (value === "yearly") return "Yearly";
  if (value === "monthly") return "Monthly";
  return "Not applicable";
};
const getPlanBadgeClass = (plan: string) => {
  const normalized = String(plan || "").toUpperCase();
  if (normalized === "PRO") return "bg-cyan-100 text-cyan-700";
  if (normalized === "STUDIO") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-700";
};
const describePendingChange = (subscription: SubscriptionState | null) => {
  const pending = subscription?.pendingChange;
  if (!pending) return null;

  if (pending.type === "cancellation") {
    return `Free plan starts ${formatDateTime(pending.effectiveAt)}.`;
  }

  const interval = pending.billingCycle ? ` (${formatBillingCycleLabel(pending.billingCycle)})` : "";
  return `${pending.plan}${interval} starts ${formatDateTime(pending.effectiveAt)}.`;
};

const transactionStatusConfig: Record<
  TransactionStatusNormalized,
  {
    label: string;
    color: string;
    iconColor: string;
    icon: typeof CheckCircle;
  }
> = {
  succeeded: {
    label: "Succeeded",
    color: "bg-green-50 text-green-700 border-green-200",
    iconColor: "text-green-600",
    icon: CheckCircle,
  },
  pending: {
    label: "Pending",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    iconColor: "text-amber-600",
    icon: Clock3,
  },
  failed: {
    label: "Failed",
    color: "bg-red-50 text-red-700 border-red-200",
    iconColor: "text-red-600",
    icon: AlertCircle,
  },
  refunded: {
    label: "Refunded",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    iconColor: "text-blue-600",
    icon: RefreshCcw,
  },
  canceled: {
    label: "Canceled",
    color: "bg-slate-50 text-slate-700 border-slate-200",
    iconColor: "text-slate-600",
    icon: XCircle,
  },
};
const getPaymentStatusConfig = (subscription: SubscriptionState | null) => {
  const billingState = String(subscription?.billingState || (subscription?.plan === "FREE" ? "free" : "active")).toLowerCase();

  if (billingState === "free") {
    return {
      label: "Free Plan",
      color: "text-slate-600",
      icon: CheckCircle,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      tone: "neutral" as const,
    };
  }
  if (billingState === "trialing") {
    return {
      label: "Trialing",
      color: "text-cyan-700",
      icon: Clock3,
      badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
      tone: "info" as const,
    };
  }
  if (billingState === "past_due") {
    return {
      label: "Past Due",
      color: "text-red-700",
      icon: AlertCircle,
      badgeClass: "bg-red-50 text-red-700 border-red-200",
      tone: "danger" as const,
    };
  }
  if (billingState === "cancelled") {
    return {
      label: "Cancel Scheduled",
      color: "text-amber-700",
      icon: AlertTriangle,
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      tone: "warning" as const,
    };
  }
  if (billingState === "downgraded") {
    return {
      label: "Downgraded",
      color: "text-slate-700",
      icon: RefreshCcw,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      tone: "neutral" as const,
    };
  }
  if (billingState === "expired") {
    return {
      label: "Expired",
      color: "text-slate-700",
      icon: XCircle,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      tone: "neutral" as const,
    };
  }

  return {
    label: subscription?.statusLabel || "Active",
    color: "text-green-700",
    icon: CheckCircle,
    badgeClass: "bg-green-50 text-green-700 border-green-200",
    tone: "success" as const,
  };
};

export default function Transactions() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TransactionItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(defaultPagination);
  const [summary, setSummary] = useState<TransactionSummary>(defaultSummary);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const { error, success } = useToast();

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    const billingLanding = searchParams.get("billing");

    if (checkoutStatus === "success") {
      success("Payment completed. Your subscription is active.");
    } else if (checkoutStatus === "trial") {
      success("Trial started successfully.");
    } else if (checkoutStatus === "failed") {
      error("Payment failed. Your subscription was not changed.");
    } else if (checkoutStatus === "canceled") {
      error("Checkout was canceled. You can try again anytime.");
    } else if (billingLanding === "1") {
      success("You are viewing the in-app billing center.");
    } else {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("checkout");
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
        setPagination((transactionsResult.pagination || defaultPagination) as PaginationMeta);
        setSummary((transactionsResult.summary || defaultSummary) as TransactionSummary);
        setSubscription(subscriptionResult);
      } catch (err) {
        if (!mounted) return;
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
      const result = await billingApi.portalSession({ returnUrl: window.location.href });
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

  const currentPlan = String(subscription?.plan || "FREE").toUpperCase();
  const paymentStatus = useMemo(() => getPaymentStatusConfig(subscription), [subscription]);
  const PaymentStatusIcon = paymentStatus.icon;
  const nextPaymentDate = currentPlan === "FREE" ? "No active paid cycle" : formatDateTime(subscription?.nextRenewalAt || subscription?.renewAt);
  const pendingChange = describePendingChange(subscription);
  const rangeStart = rows.length ? (page - 1) * pagination.limit + 1 : 0;
  const rangeEnd = rows.length ? (page - 1) * pagination.limit + rows.length : 0;

  const kpiCards = [
    {
      name: "Total Transactions",
      value: new Intl.NumberFormat().format(summary.totalTransactions),
      icon: CreditCard,
      bgColor: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
    {
      name: "Successful Payments",
      value: new Intl.NumberFormat().format(summary.successfulPayments),
      icon: CheckCircle,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      name: "Pending Payments",
      value: new Intl.NumberFormat().format(summary.pendingPayments),
      icon: Clock3,
      bgColor: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      name: "Paid Amount",
      value: formatCurrency(summary.paidAmount, summary.currency),
      icon: DollarSign,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-500",
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading transactions..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Billing Center</h1>
        <p className="text-slate-600">Manage your subscription, status transitions, and transaction history.</p>
      </div>

      {pendingChange ? (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Pending billing change</p>
            <p className="text-sm text-amber-800">{pendingChange}</p>
          </div>
        </div>
      ) : null}

      {subscription?.billingState === "past_due" && subscription.graceEndsAt ? (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Payment issue detected</p>
            <p className="text-sm text-red-800">
              Grace period ends on {formatDateTime(subscription.graceEndsAt)}. After that, the account downgrades to
              Free automatically.
            </p>
          </div>
        </div>
      ) : null}

      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-gray-200 p-6 sm:p-8 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Subscription Overview</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">Current Plan</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-4 py-2 rounded-lg font-bold text-lg ${getPlanBadgeClass(currentPlan)}`}>{currentPlan}</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${paymentStatus.badgeClass}`}>
                  <PaymentStatusIcon className={`w-4 h-4 ${paymentStatus.color}`} />
                  {paymentStatus.label}
                </span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Billing Interval</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatBillingCycleLabel(subscription?.billingCycle)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Next Renewal Date</p>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{nextPaymentDate}</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Provider</p>
                <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{subscription?.provider || "manual"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Receipt / Invoice</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Placeholder available</p>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="mb-4">
                <p className="text-sm font-medium text-slate-900 mb-1">Quick Actions</p>
                <p className="text-xs text-slate-600">Change plan, resume billing, or review billing settings.</p>
              </div>

              <div className="space-y-2">
                {currentPlan === "FREE" ? (
                  <Link
                    to="/dashboard/pricing"
                    className="w-full px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-cyan-500 text-white hover:bg-cyan-600"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Upgrade Plan
                  </Link>
                ) : subscription?.cancelAtPeriodEnd ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleResumeAutoRenew();
                    }}
                    disabled={resumeLoading}
                    className="w-full px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <TrendingUp className="w-4 h-4" />
                    {resumeLoading ? "Resuming..." : "Resume Subscription"}
                  </button>
                ) : (
                  <Link
                    to="/dashboard/pricing"
                    className="w-full px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Change Plan
                  </Link>
                )}

                <Link
                  to="/dashboard/settings"
                  className="w-full px-4 py-2.5 border border-gray-200 text-slate-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <SettingsIcon className="w-4 h-4" />
                  Billing Settings
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    void handleOpenBillingPortal();
                  }}
                  disabled={portalLoading}
                  className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                    paymentStatus.tone === "danger"
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "border border-gray-200 text-slate-700 hover:bg-gray-50"
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  {portalLoading ? "Opening..." : "Open Billing Center"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.name} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 ${card.bgColor} rounded-lg`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">{card.value}</p>
              <p className="text-sm text-slate-600">{card.name}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Transaction History</h2>
            <p className="text-sm text-slate-600">View payments, plan changes, and receipt placeholders.</p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Filter by:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCEEDED">Succeeded</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Transactions Found</h3>
            <p className="text-slate-600 mb-6">
              {statusFilter === "ALL"
                ? "You don't have any payment transactions yet."
                : `No ${toLower(statusFilter)} transactions found.`}
            </p>
            {currentPlan === "FREE" ? (
              <Link
                to="/dashboard/pricing"
                className="inline-flex px-6 py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors"
              >
                Upgrade to Pro
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Transaction</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Plan</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Receipt</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((transaction) => {
                    const status = normalizeTransactionStatus(transaction.status);
                    const config = transactionStatusConfig[status];
                    const StatusIcon = config.icon;
                    return (
                      <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <CreditCard className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900 capitalize">{transaction.description || "Subscription payment"}</p>
                              <p className="text-xs text-slate-500">
                                {shortId(transaction.id)} � {String(transaction.provider || "manual").toUpperCase()}
                              </p>
                              {transaction.failureReason ? <p className="mt-1 text-xs text-red-600">{transaction.failureReason}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-slate-700">
                          <div className="font-medium text-slate-900">{transaction.plan || "N/A"}</div>
                          <div className="text-xs text-slate-500">{formatBillingCycleLabel(transaction.billingCycle || "monthly")}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(Number(transaction.amount || 0), transaction.currency || "USD")}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {config.label}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-slate-700">
                          {transaction.receiptAvailable && transaction.receiptUrl ? (
                            <a href={transaction.receiptUrl} target="_blank" rel="noreferrer" className="font-medium text-cyan-700 hover:text-cyan-800">
                              Download
                            </a>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <FileText className="w-4 h-4" />
                              <span>{transaction.receiptLabel || "Receipt available after live provider integration."}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-slate-700">{formatDate(transaction.createdAt)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden space-y-3">
              {rows.map((transaction) => {
                const status = normalizeTransactionStatus(transaction.status);
                const config = transactionStatusConfig[status];
                const StatusIcon = config.icon;
                return (
                  <div key={transaction.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 capitalize truncate">{transaction.description || "Subscription payment"}</p>
                        <p className="text-xs text-slate-500">{shortId(transaction.id)}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(Number(transaction.amount || 0), transaction.currency || "USD")}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {config.label}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {(transaction.plan || "N/A") + " � " + formatBillingCycleLabel(transaction.billingCycle || "monthly")}
                      </span>
                    </div>

                    {transaction.failureReason ? <p className="mb-2 text-xs text-red-600">{transaction.failureReason}</p> : null}
                    <div className="flex items-center justify-between text-xs text-slate-600 gap-3">
                      <span>{formatDate(transaction.createdAt)}</span>
                      <span>{transaction.receiptLabel || "Receipt placeholder"}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {pagination.totalPages > 1 ? (
              <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-gray-200">
                <p className="text-sm text-slate-600">
                  Showing {rangeStart}-{rangeEnd} of {pagination.total} transactions
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-500 text-white">{pagination.page}</span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(current + 1, pagination.totalPages || 1))}
                    disabled={page >= (pagination.totalPages || 1)}
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
