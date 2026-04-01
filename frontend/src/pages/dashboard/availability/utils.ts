import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import type {
  BookingLead,
  BookingLeadsPagination,
  BookingLeadPeriodPreset,
  BookingLeadStatus,
  DayStatus,
  LeadStatusAction,
  UpdateStatus,
} from "./types";

const TIME_24H_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const toDayStatus = (value: unknown): DayStatus => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "booked" || normalized === "unavailable" || normalized === "blocked"
    ? "booked"
    : "available";
};

export const toUpdateStatus = (value: DayStatus): UpdateStatus =>
  value === "booked" ? "BOOKED" : "AVAILABLE";

export const isBookedStatus = (value: DayStatus) => value === "booked";

export const getStatusClasses = (status: DayStatus, options: { isLockedBooked: boolean }) => {
  if (status === "booked") {
    return `bg-red-100 border-red-400 text-red-700 ${options.isLockedBooked ? "cursor-not-allowed" : "hover:bg-red-200"}`;
  }
  return "bg-green-100 border-green-400 text-green-700 hover:bg-green-200";
};

export const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const toDateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

export const formatDateUtc = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
};

export const formatPreferredDateTime = (dateValue: string | null | undefined, timeValue: string | null | undefined) => {
  const dateLabel = formatDateUtc(dateValue);
  if (dateLabel === "N/A") return dateLabel;

  const rawTime = String(timeValue || "").trim();
  if (!TIME_24H_PATTERN.test(rawTime)) {
    return dateLabel;
  }

  const [hoursToken, minutesToken] = rawTime.split(":");
  const timeDate = new Date();
  timeDate.setHours(Number(hoursToken), Number(minutesToken), 0, 0);
  const timeLabel = timeDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel}, ${timeLabel}`;
};

export const formatMinutesToLabel = (value: number | null | undefined) => {
  if (!Number.isFinite(Number(value))) return "N/A";
  const minutes = Number(value);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
};

export const toPercentLabel = (value: number | null | undefined) => {
  if (!Number.isFinite(Number(value))) return "0%";
  return `${Math.round(Number(value) * 100)}%`;
};

export const formatTrendDayLabel = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
};

export const normalizePhoneForWhatsApp = (phone: string | null | undefined) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
};

const safeTemplateValue = (value: string | null | undefined, fallback: string) => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

export const fillFollowUpTemplate = (
  template: string,
  lead: BookingLead,
  options: {
    studioName: string;
  }
) =>
  template.replace(/\{clientName\}|\{studioName\}|\{preferredDate\}/g, (token) => {
    if (token === "{clientName}") return safeTemplateValue(lead.clientName, "there");
    if (token === "{studioName}") return safeTemplateValue(options.studioName, "our studio");
    if (token === "{preferredDate}") return formatPreferredDateTime(lead.preferredDate, lead.preferredTime);
    return "";
  });

export const buildPresetDateRange = (preset: BookingLeadPeriodPreset) => {
  if (preset === "all") return { from: "", to: "" };

  const now = new Date();
  const end = new Date(now);
  end.setMilliseconds(999);

  const start = new Date(now);
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
};

const toSafePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : fallback;
};

export const toBookingLeadsPagination = (
  value: Record<string, unknown> | undefined,
  fallback: BookingLeadsPagination
): BookingLeadsPagination => ({
  page: toSafePositiveInt(value?.page, fallback.page),
  limit: toSafePositiveInt(value?.limit, fallback.limit),
  total: Math.max(0, Number(value?.total || fallback.total || 0)),
  totalPages: toSafePositiveInt(value?.totalPages, fallback.totalPages),
});

export const toLeadStatus = (value: string | null | undefined) =>
  String(value || "PENDING").trim().toUpperCase();

export const formatLeadStatusLabel = (value: string | null | undefined) =>
  toLeadStatus(value)
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0)}${part.slice(1).toLowerCase()}`)
    .join(" ");

export const formatLeadSourceLabel = (value: string | null | undefined) => {
  const normalized = String(value || "OTHER").trim().toUpperCase();
  if (normalized === "WEBSITE") return "lensaya.com";
  if (normalized === "WHATSAPP") return "WhatsApp";
  if (normalized === "INSTAGRAM") return "Instagram";
  if (normalized === "FACEBOOK") return "Facebook";
  if (normalized === "TIKTOK") return "TikTok";
  if (normalized === "DIRECT") return "Direct";
  return "Other";
};

export const getLeadStatusConfig = (status: string) => {
  const normalized = toLeadStatus(status);
  if (normalized === "CONFIRMED" || normalized === "COMPLETED") {
    return {
      label: formatLeadStatusLabel(normalized),
      badgeClass: "bg-green-50 text-green-700 border-green-200",
      iconClass: "text-green-600",
      icon: CheckCircle2,
    };
  }

  if (normalized === "DECLINED" || normalized === "CANCELED") {
    return {
      label: formatLeadStatusLabel(normalized),
      badgeClass: "bg-red-50 text-red-700 border-red-200",
      iconClass: "text-red-600",
      icon: XCircle,
    };
  }

  if (normalized === "EXPIRED") {
    return {
      label: formatLeadStatusLabel(normalized),
      badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
      iconClass: "text-slate-600",
      icon: XCircle,
    };
  }

  return {
    label: formatLeadStatusLabel(normalized),
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    iconClass: "text-amber-600",
    icon: Clock3,
  };
};

export const getLeadStatusActions = (status: string): LeadStatusAction[] => {
  const normalized = toLeadStatus(status) as BookingLeadStatus;
  if (normalized === "PENDING") {
    return [
      { label: "Confirm", nextStatus: "CONFIRMED", variant: "primary" },
      { label: "Decline", nextStatus: "DECLINED", variant: "danger" },
    ];
  }

  if (normalized === "CONFIRMED") {
    return [
      { label: "Complete", nextStatus: "COMPLETED", variant: "primary" },
      { label: "Cancel", nextStatus: "CANCELED", variant: "secondary" },
    ];
  }

  return [];
};

const getLeadAgeHours = (createdAt: string | null | undefined) => {
  const createdTime = createdAt ? new Date(createdAt).getTime() : Number.NaN;
  if (!Number.isFinite(createdTime)) return 0;
  const diffMs = Date.now() - createdTime;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
};

export const getLeadAgingConfig = (lead: BookingLead) => {
  const normalizedStatus = toLeadStatus(lead.status);
  if (normalizedStatus !== "PENDING") {
    return {
      label: "Handled",
      badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
      urgent: false,
      level: "handled",
      hours: getLeadAgeHours(lead.createdAt),
    } as const;
  }

  const hours = getLeadAgeHours(lead.createdAt);
  if (hours >= 72) {
    return {
      label: "3d+",
      badgeClass: "bg-red-50 text-red-700 border-red-200",
      urgent: true,
      level: "critical",
      hours,
    } as const;
  }
  if (hours >= 24) {
    return {
      label: "24h+",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      urgent: true,
      level: "warning",
      hours,
    } as const;
  }

  return {
    label: "New",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    urgent: false,
    level: "fresh",
    hours,
  } as const;
};

export const getLeadTemperatureConfig = (temperature: string | null | undefined) => {
  const normalized = String(temperature || "COLD").toUpperCase();
  if (normalized === "HOT") {
    return {
      label: "Hot",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }
  if (normalized === "WARM") {
    return {
      label: "Warm",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: "Cold",
    className: "bg-slate-50 text-slate-700 border-slate-200",
  };
};
