import type { billingApi } from "../../../lib/api";

export type TransactionItem = Awaited<ReturnType<typeof billingApi.transactions>>["items"][number];
export type PaginationMeta = Awaited<ReturnType<typeof billingApi.transactions>>["pagination"];
export type TransactionSummary = NonNullable<Awaited<ReturnType<typeof billingApi.transactions>>["summary"]>;
export type SubscriptionState = Awaited<ReturnType<typeof billingApi.subscription>>;

export type StatusFilter = "ALL" | "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "CANCELED";
export type TransactionStatusNormalized = "succeeded" | "pending" | "failed" | "refunded" | "canceled";

export type PaymentStatusConfig = {
  label: string;
  color: string;
  icon: typeof import("lucide-react").CheckCircle;
  badgeClass: string;
  tone: "neutral" | "info" | "danger" | "warning" | "success";
};
