export const SOURCE_COLORS = ["#06b6d4", "#3b82f6", "#10b981", "#eab308", "#ef4444", "#8b5cf6"];
export const PREVIEW_BAR_WIDTHS = ["92%", "72%", "54%"];

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.10)",
};

export const ACTIVITY_ACTION_META: Record<string, { label: string; badgeClass: string }> = {
  PAGE_VIEW: {
    label: "Page view",
    badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  PORTFOLIO_VIEW: {
    label: "Portfolio view",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  SERVICE_SELECT: {
    label: "Service interest",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
  },
  PACKAGE_SELECT: {
    label: "Package interest",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  PACKAGE_VIEW: {
    label: "Package view",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
  },
  BOOKING_INTENT: {
    label: "Inquiry",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  WHATSAPP_CLICK: {
    label: "WhatsApp click",
    badgeClass: "bg-green-50 text-green-700 border-green-200",
  },
  PORTFOLIO_SHARE: {
    label: "Portfolio share",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

export const ACTIVITY_SOURCE_META: Record<string, string> = {
  direct: "Direct visit",
  instagram: "Instagram",
  facebook: "Facebook",
  search: "Google Search",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X / Twitter",
  referral: "Referral",
};
