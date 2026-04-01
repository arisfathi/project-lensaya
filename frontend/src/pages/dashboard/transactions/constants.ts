import { AlertCircle, CheckCircle, Clock3, RefreshCcw, XCircle } from "lucide-react";
import type { PaginationMeta, TransactionStatusNormalized, TransactionSummary } from "./types";

export const DEFAULT_PAGINATION: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

export const DEFAULT_SUMMARY: TransactionSummary = {
  totalTransactions: 0,
  successfulPayments: 0,
  pendingPayments: 0,
  paidAmount: 0,
  currency: "USD",
};

export const TRANSACTION_STATUS_CONFIG: Record<
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
