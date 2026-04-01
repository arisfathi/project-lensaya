import { AlertCircle, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import type { PaymentStatusConfig, SubscriptionState } from "./types";

const normalizeSocialSlug = (value: string, domain: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  let normalized = trimmed.replace(/^@+/, "");

  try {
    const candidate = /^[a-z]+:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === domain || host.endsWith(`.${domain}`)) {
      normalized = parsed.pathname.split("/").filter(Boolean)[0] || "";
    }
  } catch {
    // Fall back to string parsing.
  }

  const escapedDomain = domain.replace(/\./g, "\\.");
  normalized = normalized
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(new RegExp(`^(?:m\\.)?${escapedDomain}\\/?`, "i"), "")
    .split(/[?#]/)[0];

  normalized = (normalized.split("/").filter(Boolean)[0] || normalized).replace(/^@+/, "").trim();
  return normalized;
};

export const normalizeInstagramUsername = (value: string) => normalizeSocialSlug(value, "instagram.com");
export const normalizeFacebookSlug = (value: string) => normalizeSocialSlug(value, "facebook.com");
export const normalizeTiktokHandle = (value: string) => normalizeSocialSlug(value, "tiktok.com");

export const normalizeWhatsAppNumber = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

export const formatBillingCycleLabel = (value: string | null | undefined) => {
  if (value === "yearly") return "Yearly";
  if (value === "monthly") return "Monthly";
  return "Not applicable";
};

export const describePendingChange = (subscription: SubscriptionState | null) => {
  const pending = subscription?.pendingChange;
  if (!pending) return null;
  if (pending.type === "cancellation") {
    return `Free plan starts ${formatDateTime(pending.effectiveAt)}.`;
  }
  const interval = pending.billingCycle ? ` (${formatBillingCycleLabel(pending.billingCycle)})` : "";
  return `${String(pending.plan || "Plan")}${interval} starts ${formatDateTime(pending.effectiveAt)}.`;
};

export const getPlanBadgeClass = (plan: string) => {
  const normalized = String(plan || "").toUpperCase();
  if (normalized === "PRO") return "bg-cyan-100 text-cyan-700";
  if (normalized === "STUDIO") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-700";
};

export const getPaymentStatusConfig = ({
  plan,
  status,
  cancelAtPeriodEnd,
}: {
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
}): PaymentStatusConfig => {
  if (String(plan).toUpperCase() === "FREE") {
    return {
      label: "Free Plan",
      color: "text-slate-600",
      icon: CheckCircle,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      tone: "neutral",
    };
  }

  if (cancelAtPeriodEnd) {
    return {
      label: "Cancel Scheduled",
      color: "text-amber-700",
      icon: AlertTriangle,
      badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
      tone: "warning",
    };
  }

  if (["ACTIVE", "TRIALING"].includes(status)) {
    return {
      label: "Active",
      color: "text-green-600",
      icon: CheckCircle,
      badgeClass: "bg-green-100 text-green-700 border-green-200",
      tone: "success",
    };
  }

  if (["PAST_DUE", "INCOMPLETE"].includes(status)) {
    return {
      label: "Past Due",
      color: "text-red-600",
      icon: AlertCircle,
      badgeClass: "bg-red-100 text-red-700 border-red-200",
      tone: "danger",
    };
  }

  if (["CANCELED", "EXPIRED"].includes(status)) {
    return {
      label: "Canceled",
      color: "text-slate-600",
      icon: XCircle,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      tone: "neutral",
    };
  }

  return {
    label: status || "Unknown",
    color: "text-slate-600",
    icon: AlertCircle,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    tone: "neutral",
  };
};

export const toAvatarFileName = (name: string, mimeType: string) => {
  const safeBase =
    (name || "avatar")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 80) || "avatar";

  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `${safeBase}.${extension}`;
};
