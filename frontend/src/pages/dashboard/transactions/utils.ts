import { AlertCircle, AlertTriangle, CheckCircle, Clock3, RefreshCcw, XCircle } from "lucide-react";
import type { PaymentStatusConfig, SubscriptionState, TransactionStatusNormalized } from "./types";

export const toLower = (value: string) => String(value || "").trim().toLowerCase();

export const formatCurrency = (amount: number, currency = "USD") => {
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

export const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

export const shortId = (value: string) => {
  if (!value) return "Unknown";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
};

export const normalizeTransactionStatus = (status: string): TransactionStatusNormalized => {
  const normalized = toLower(status);
  if (normalized === "succeeded") return "succeeded";
  if (normalized === "pending") return "pending";
  if (normalized === "refunded") return "refunded";
  if (normalized === "canceled") return "canceled";
  return "failed";
};

export const formatBillingCycleLabel = (value: string | null | undefined) => {
  if (value === "yearly") return "Yearly";
  if (value === "monthly") return "Monthly";
  return "Not applicable";
};

export const getPlanBadgeClass = (plan: string) => {
  const normalized = String(plan || "").toUpperCase();
  if (normalized === "PRO") return "bg-cyan-100 text-cyan-700";
  if (normalized === "STUDIO") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-700";
};

export const describePendingChange = (subscription: SubscriptionState | null) => {
  const pending = subscription?.pendingChange;
  if (!pending) return null;

  if (pending.type === "cancellation") {
    return `Free plan starts ${formatDateTime(pending.effectiveAt)}.`;
  }

  const interval = pending.billingCycle ? ` (${formatBillingCycleLabel(pending.billingCycle)})` : "";
  return `${pending.plan}${interval} starts ${formatDateTime(pending.effectiveAt)}.`;
};

export const getPaymentStatusConfig = (subscription: SubscriptionState | null): PaymentStatusConfig => {
  const billingState = String(subscription?.billingState || (subscription?.plan === "FREE" ? "free" : "active")).toLowerCase();

  if (billingState === "free") {
    return {
      label: "Free Plan",
      color: "text-slate-600",
      icon: CheckCircle,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      tone: "neutral",
    };
  }
  if (billingState === "trialing") {
    return {
      label: "Trialing",
      color: "text-cyan-700",
      icon: Clock3,
      badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
      tone: "info",
    };
  }
  if (billingState === "past_due") {
    return {
      label: "Past Due",
      color: "text-red-700",
      icon: AlertCircle,
      badgeClass: "bg-red-50 text-red-700 border-red-200",
      tone: "danger",
    };
  }
  if (billingState === "cancelled") {
    return {
      label: "Cancel Scheduled",
      color: "text-amber-700",
      icon: AlertTriangle,
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      tone: "warning",
    };
  }
  if (billingState === "downgraded") {
    return {
      label: "Downgraded",
      color: "text-slate-700",
      icon: RefreshCcw,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      tone: "neutral",
    };
  }
  if (billingState === "expired") {
    return {
      label: "Expired",
      color: "text-slate-700",
      icon: XCircle,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      tone: "neutral",
    };
  }

  return {
    label: subscription?.statusLabel || "Active",
    color: "text-green-700",
    icon: CheckCircle,
    badgeClass: "bg-green-50 text-green-700 border-green-200",
    tone: "success",
  };
};
