import { ACTIVITY_ACTION_META, ACTIVITY_SOURCE_META } from "./constants";
import type { ActivityItem } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const formatActivityAction = (action: string) => {
  const mapped = ACTIVITY_ACTION_META[action];
  if (mapped) return mapped;

  const normalized = String(action || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    label: normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Tracked activity",
    badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
  };
};

export const formatActivitySource = (source: string | null) => {
  const normalized = String(source || "direct")
    .toLowerCase()
    .trim();
  if (!normalized) return "Direct visit";
  if (ACTIVITY_SOURCE_META[normalized]) return ACTIVITY_SOURCE_META[normalized];

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const formatActivityDetails = (item: ActivityItem) => {
  const rawPortfolio = String(item.portfolio || "").trim();
  const hasReadablePortfolio = Boolean(rawPortfolio) && !UUID_PATTERN.test(rawPortfolio);

  if (hasReadablePortfolio) {
    return rawPortfolio;
  }

  switch (item.action) {
    case "PORTFOLIO_VIEW":
      return "A portfolio photo drew attention";
    case "PAGE_VIEW":
      return "Visitor landed on your portfolio homepage";
    case "SERVICE_SELECT":
      return "Someone explored your services section";
    case "PACKAGE_SELECT":
      return "Someone compared a package option";
    case "PACKAGE_VIEW":
      return "A package card was opened";
    case "BOOKING_INTENT":
      return "Inquiry form interaction detected";
    case "WHATSAPP_CLICK":
      return "Visitor tapped your WhatsApp contact";
    case "PORTFOLIO_SHARE":
      return "Portfolio share action tracked";
    default:
      return rawPortfolio ? "Portfolio activity detected" : "Tracked visitor activity";
  }
};

export const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

export const formatNumber = (value: number | null | undefined) => Number(value || 0).toLocaleString();
export const formatPercent = (value: number | null | undefined) => `${Number(value || 0).toFixed(2)}%`;
