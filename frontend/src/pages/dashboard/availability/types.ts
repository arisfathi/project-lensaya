export type DayStatus = "available" | "booked";

export type UpdateStatus = "AVAILABLE" | "BOOKED";

export type BookingLeadStatus =
  | "PENDING"
  | "CONFIRMED"
  | "DECLINED"
  | "COMPLETED"
  | "CANCELED"
  | "EXPIRED";

export type BookingLeadSource =
  | "WEBSITE"
  | "WHATSAPP"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "TIKTOK"
  | "DIRECT"
  | "OTHER";

export type LeadStatusAction = {
  label: string;
  nextStatus: Exclude<BookingLeadStatus, "PENDING">;
  variant: "primary" | "secondary" | "danger";
};

export type BookingLead = {
  id: string;
  status: string;
  source?: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  message: string | null;
  notes?: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  createdAt: string;
  leadScore?: number;
  leadTemperature?: "HOT" | "WARM" | "COLD";
  service: { id: string; name: string } | null;
  package: { id: string; name: string } | null;
};

export type BookingLeadsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type LeadTrendPoint = {
  date: string;
  leads: number;
  converted: number;
};

export type FollowUpTemplate = {
  id: string;
  label: string;
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
};

export type LeadUpgradeNudge = {
  id: string;
  type: string;
  title: string;
  body: string;
};

export type LeadInsights = {
  totals: {
    leads: number;
    pending: number;
    confirmed: number;
    completed: number;
    declined: number;
    canceled: number;
    expired: number;
    converted: number;
    responded: number;
  };
  rates: {
    conversionRate: number;
    responseRate: number;
  };
  responseTime: {
    averageMinutes: number | null;
    sampledCount: number;
    sampleLimited: boolean;
  };
  sourceBreakdown: Array<{
    source: string;
    leads: number;
    converted: number;
    conversionRate: number;
  }>;
  trends: {
    daily7d: LeadTrendPoint[];
    daily30d: LeadTrendPoint[];
  };
  locked?: {
    advancedAnalytics: boolean;
    upgradeTarget: string;
  };
};

export type LeadWindow = {
  historyDays: number;
  historyStart: string | null;
  isHistoryClamped: boolean;
  isVisibleClamped?: boolean;
  maxVisibleLeads?: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type BookingLeadPeriodPreset = "all" | "7d" | "30d" | "90d";

export type BookingLeadFilters = {
  status: "" | BookingLeadStatus;
  source: "" | BookingLeadSource;
  search: string;
  periodPreset: BookingLeadPeriodPreset;
  from: string;
  to: string;
};

export type AvailabilityLegendItem = {
  key: string;
  label: string;
  swatchClass: string;
  textClass: string;
};

export type PendingReminderSummary = {
  pending: number;
  stale24h: number;
  stale72h: number;
};
