import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Save,
  XCircle,
} from "lucide-react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useToast } from "../../contexts/ToastContext";
import { availabilityApi, bookingsApi, getApiErrorMessage } from "../../lib/api";

type DayStatus = "available" | "booked";
type UpdateStatus = "AVAILABLE" | "BOOKED";
type BookingLeadStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "COMPLETED" | "CANCELED" | "EXPIRED";
type LeadStatusAction = {
  label: string;
  nextStatus: Exclude<BookingLeadStatus, "PENDING">;
  variant: "primary" | "secondary" | "danger";
};
type BookingLead = {
  id: string;
  status: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  message: string | null;
  preferredDate: string | null;
  createdAt: string;
  service: { id: string; name: string } | null;
  package: { id: string; name: string } | null;
};
type BookingLeadsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const toDayStatus = (value: unknown): DayStatus => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "booked" || normalized === "unavailable" || normalized === "blocked"
    ? "booked"
    : "available";
};

const toUpdateStatus = (value: DayStatus): UpdateStatus => (value === "booked" ? "BOOKED" : "AVAILABLE");
const isBookedStatus = (value: DayStatus) => value === "booked";
const getStatusClasses = (status: DayStatus, options: { isLockedBooked: boolean }) => {
  if (status === "booked") {
    return `bg-red-100 border-red-400 text-red-700 ${options.isLockedBooked ? "cursor-not-allowed" : "hover:bg-red-200"}`;
  }
  return "bg-green-100 border-green-400 text-green-700 hover:bg-green-200";
};

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const toDateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

const toSafePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : fallback;
};

const defaultBookingLeadsPagination: BookingLeadsPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
};

const toBookingLeadsPagination = (
  value: Record<string, unknown> | undefined,
  fallback: BookingLeadsPagination
): BookingLeadsPagination => ({
  page: toSafePositiveInt(value?.page, fallback.page),
  limit: toSafePositiveInt(value?.limit, fallback.limit),
  total: Math.max(0, Number(value?.total || fallback.total || 0)),
  totalPages: toSafePositiveInt(value?.totalPages, fallback.totalPages),
});

const toLeadStatus = (value: string | null | undefined) =>
  String(value || "PENDING").trim().toUpperCase();

const formatLeadStatusLabel = (value: string | null | undefined) =>
  toLeadStatus(value)
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0)}${part.slice(1).toLowerCase()}`)
    .join(" ");

const getLeadStatusConfig = (status: string) => {
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

const getLeadStatusActions = (status: string): LeadStatusAction[] => {
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

export default function Availability() {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, DayStatus>>({});
  const [initialStatusMap, setInitialStatusMap] = useState<Record<string, DayStatus>>({});
  const statusMapRef = useRef<Record<string, DayStatus>>({});
  const initialStatusMapRef = useRef<Record<string, DayStatus>>({});
  const [lockedBookedDates, setLockedBookedDates] = useState<Set<string>>(new Set());
  const [bookingLeadsLoading, setBookingLeadsLoading] = useState(true);
  const [bookingLeads, setBookingLeads] = useState<BookingLead[]>([]);
  const [bookingLeadsPage, setBookingLeadsPage] = useState(1);
  const [bookingLeadsPagination, setBookingLeadsPagination] = useState<BookingLeadsPagination>(
    defaultBookingLeadsPagination
  );
  const [bookingLeadActionId, setBookingLeadActionId] = useState<string | null>(null);
  const bookingLeadsLimit = 10;

  useEffect(() => {
    statusMapRef.current = statusMap;
  }, [statusMap]);

  useEffect(() => {
    initialStatusMapRef.current = initialStatusMap;
  }, [initialStatusMap]);

  const { success, error, info } = useToast();

  const monthKey = useMemo(() => toMonthKey(currentDate), [currentDate]);
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const getDayKey = useCallback(
    (day: number) => `${monthKey}-${String(day).padStart(2, "0")}`,
    [monthKey]
  );
  const getDayStatus = useCallback(
    (day: number): DayStatus => statusMap[getDayKey(day)] || "available",
    [getDayKey, statusMap]
  );
  const getInitialDayStatus = useCallback(
    (day: number): DayStatus => initialStatusMap[getDayKey(day)] || "available",
    [getDayKey, initialStatusMap]
  );

  const isPastDay = useCallback(
    (day: number) => getDayKey(day) < todayKey,
    [getDayKey, todayKey]
  );
  const isLockedBookedDay = useCallback(
    (day: number) => lockedBookedDates.has(getDayKey(day)),
    [getDayKey, lockedBookedDates]
  );

  const calendarCells = useMemo(() => {
    const cells: Array<number | null> = Array.from({ length: firstDay }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(day);
    }
    while (cells.length < 42) {
      cells.push(null);
    }
    return cells;
  }, [daysInMonth, firstDay]);

  const changedCount = useMemo(() => {
    let count = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      if (getDayStatus(day) !== getInitialDayStatus(day)) {
        count += 1;
      }
    }
    return count;
  }, [daysInMonth, getDayStatus, getInitialDayStatus]);

  const availabilityLegend = useMemo(
    () => [
      {
        key: "available",
        label: "Available",
        swatchClass: "bg-green-100 border-green-400",
        textClass: "text-green-700",
      },
      {
        key: "booked",
        label: "Booked",
        swatchClass: "bg-red-100 border-red-400",
        textClass: "text-red-700",
      },
      {
        key: "past",
        label: "Past Dates",
        swatchClass: "bg-gray-200 border-gray-400",
        textClass: "text-slate-600",
      },
    ],
    []
  );

  const loadMonth = useCallback(
    async ({ preserveEdits = false, showLoading = true }: { preserveEdits?: boolean; showLoading?: boolean } = {}) => {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const [availability, bookingCalendar] = await Promise.all([
          availabilityApi.get(monthKey),
          bookingsApi.calendar(monthKey),
        ]);

        const baseMap: Record<string, DayStatus> = {};

        for (const day of availability.days || []) {
          const key = toDateKey(day.date);
          baseMap[key] = toDayStatus(day.status);
        }

        const locked = new Set<string>();
        for (const date of bookingCalendar.bookedDates || []) {
          const key = toDateKey(date);
          baseMap[key] = "booked";
          locked.add(key);
        }

        const nextStatusMap: Record<string, DayStatus> = { ...baseMap };

        if (preserveEdits) {
          for (const [dateKey, currentValue] of Object.entries(statusMapRef.current)) {
            const currentStatus = toDayStatus(currentValue);
            const baselineStatus = toDayStatus(initialStatusMapRef.current[dateKey] || "available");

            if (currentStatus !== baselineStatus && !locked.has(dateKey)) {
              nextStatusMap[dateKey] = currentStatus;
            }
          }
        }

        setStatusMap(nextStatusMap);
        setInitialStatusMap(baseMap);
        setLockedBookedDates(locked);
      } catch (err) {
        error(getApiErrorMessage(err, "Failed to load availability"));
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [error, monthKey]
  );

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const loadBookingLeads = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      if (showLoading) {
        setBookingLeadsLoading(true);
      }

      try {
        const bookingList = await bookingsApi.list({ page: bookingLeadsPage, limit: bookingLeadsLimit });
        const items = ((bookingList.items || []) as BookingLead[]).slice().sort((a, b) => {
          const left = new Date(a.createdAt || 0).getTime();
          const right = new Date(b.createdAt || 0).getTime();
          return right - left;
        });

        const nextPagination = toBookingLeadsPagination(
          (bookingList.pagination || undefined) as Record<string, unknown> | undefined,
          {
            ...defaultBookingLeadsPagination,
            page: bookingLeadsPage,
            limit: bookingLeadsLimit,
          }
        );

        setBookingLeads(items);
        setBookingLeadsPagination(nextPagination);
      } catch (err) {
        error(getApiErrorMessage(err, "Failed to load booking leads"));
      } finally {
        if (showLoading) {
          setBookingLeadsLoading(false);
        }
      }
    },
    [bookingLeadsLimit, bookingLeadsPage, error]
  );

  useEffect(() => {
    void loadBookingLeads();
  }, [loadBookingLeads]);

  const handleToggleDay = (day: number) => {
    if (isPastDay(day)) {
      return;
    }

    if (isLockedBookedDay(day)) {
      info("This date already has bookings and cannot be changed.");
      return;
    }

    const key = getDayKey(day);
    const status = toDayStatus(statusMap[key] || "available");
    const nextStatus: DayStatus = status === "booked" ? "available" : "booked";

    setStatusMap((current) => ({
      ...current,
      [key]: nextStatus,
    }));
  };

  const handleSave = async () => {
    if (changedCount === 0) {
      info("No changes to save.");
      return;
    }

    const changedDays = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateKey = getDayKey(day);
      const currentStatus = toDayStatus(getDayStatus(day));
      const initialStatus = toDayStatus(getInitialDayStatus(day));
      if (currentStatus === initialStatus) {
        return null;
      }

      return {
        date: new Date(`${dateKey}T00:00:00.000Z`).toISOString(),
        status: toUpdateStatus(currentStatus),
      };
    }).filter((item): item is { date: string; status: UpdateStatus } => Boolean(item));

    try {
      setSaving(true);
      await availabilityApi.patch(changedDays);
      setInitialStatusMap(statusMap);
      success("Availability updated successfully");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to update availability"));
    } finally {
      setSaving(false);
    }
  };

  const handleLeadStatusUpdate = async (lead: BookingLead, nextStatus: LeadStatusAction["nextStatus"]) => {
    try {
      setBookingLeadActionId(lead.id);
      await bookingsApi.updateStatus(lead.id, nextStatus);
      success((lead.clientName || "Booking lead") + " marked as " + formatLeadStatusLabel(nextStatus) + ".");
      await Promise.all([
        loadBookingLeads({ showLoading: false }),
        loadMonth({ preserveEdits: true, showLoading: false }),
      ]);
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to update booking status"));
    } finally {
      setBookingLeadActionId(null);
    }
  };

  const leadsRangeStart = bookingLeads.length
    ? (bookingLeadsPagination.page - 1) * bookingLeadsPagination.limit + 1
    : 0;
  const leadsRangeEnd = bookingLeads.length ? leadsRangeStart + bookingLeads.length - 1 : 0;

  return (
    <DashboardLayout>
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-6">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100">
                Availability Control
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  changedCount > 0
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-green-50 text-green-700 border-green-200"
                }`}
              >
                {changedCount > 0 ? `${changedCount} unsaved change${changedCount > 1 ? "s" : ""}` : "All changes saved"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Availability Calendar</h1>
            <p className="text-slate-600">
              Click future dates to toggle between AVAILABLE and BOOKED. Real bookings stay locked.
            </p>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2">
              {availabilityLegend.map((item) => (
                <div key={item.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded border ${item.swatchClass}`} />
                    <span className={`text-xs font-medium ${item.textClass}`}>{item.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full xl:w-auto">
            <Button
              onClick={() => void handleSave()}
              disabled={saving || changedCount === 0}
              className="w-full xl:w-auto"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : `Save Changes${changedCount ? ` (${changedCount})` : ""}`}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingCard label="Loading calendar..." />
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 max-h-[500px] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {months[month]} {year}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {daysOfWeek.map((dayLabel) => (
                <div key={dayLabel} className="text-center text-xs sm:text-sm font-semibold text-slate-600 py-1">
                  {dayLabel}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${monthKey}-${index}`} className="h-16" />;
                }

                const status = getDayStatus(day);
                const dayKey = getDayKey(day);
                const isPast = isPastDay(day);
                const isLockedBooked = isLockedBookedDay(day);
                const disabled = isPast || isLockedBooked;
                const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
                const isBooked = isBookedStatus(status);

                return (
                  <button
                    key={`${monthKey}-${day}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleToggleDay(day)}
                    title={`${dayKey}: ${statusLabel}${isPast ? " (Past date)" : ""}${isLockedBooked ? " (Locked by booking)" : ""}`}
                    className={`h-16 w-full rounded-lg border text-sm font-semibold flex items-center justify-center transition-colors ${
                      isPast
                        ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                        : getStatusClasses(status, { isLockedBooked })
                    }`}
                  >
                    <span className="flex flex-col items-center leading-tight">
                      <span>{day}</span>
                      {isBooked ? <span className="text-[10px] uppercase tracking-wide">B</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Recent Booking Leads</h2>
                <p className="text-sm text-slate-600">Latest inquiries, 10 leads per page.</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100">
                {bookingLeadsPagination.total} total
              </span>
            </div>

            {bookingLeadsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : bookingLeads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white/80 p-8 text-center">
                <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">No booking inquiries yet</p>
                <p className="text-xs text-slate-600 mt-1">New booking leads will appear here as clients submit requests.</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Phone</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Service</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Package</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Preferred Date</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Submitted</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingLeads.map((lead) => {
                        const statusConfig = getLeadStatusConfig(lead.status);
                        const StatusIcon = statusConfig.icon;
                        const actions = getLeadStatusActions(lead.status);
                        const isUpdatingLead = bookingLeadActionId === lead.id;

                        return (
                          <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-4 px-4">
                              <p className="text-sm font-medium text-slate-900">{lead.clientName || "Unknown client"}</p>
                              {lead.message ? (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{lead.message}</p>
                              ) : null}
                            </td>
                            <td className="py-4 px-4 text-sm text-slate-700">{lead.clientPhone || "N/A"}</td>
                            <td className="py-4 px-4 text-sm text-slate-700">{lead.clientEmail || "N/A"}</td>
                            <td className="py-4 px-4 text-sm text-slate-700">{lead.service?.name || "N/A"}</td>
                            <td className="py-4 px-4 text-sm text-slate-700">{lead.package?.name || "N/A"}</td>
                            <td className="py-4 px-4 text-sm text-slate-700">{formatDateTime(lead.preferredDate)}</td>
                            <td className="py-4 px-4 text-sm text-slate-700">{formatDateTime(lead.createdAt)}</td>
                            <td className="py-4 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.badgeClass}`}
                              >
                                <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.iconClass}`} />
                                {statusConfig.label}
                              </span>
                            </td>
                            <td className={"py-4 px-4" + (actions.length > 0 ? " align-top" : "")}>
                              {actions.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {actions.map((action) => (
                                    <Button
                                      key={action.nextStatus}
                                      type="button"
                                      variant={action.variant}
                                      className="px-3 py-1.5 text-xs"
                                      disabled={Boolean(bookingLeadActionId)}
                                      onClick={() => {
                                        void handleLeadStatusUpdate(lead, action.nextStatus);
                                      }}
                                    >
                                      {isUpdatingLead ? "Updating..." : action.label}
                                    </Button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">No actions</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden space-y-3">
                  {bookingLeads.map((lead) => {
                    const statusConfig = getLeadStatusConfig(lead.status);
                    const StatusIcon = statusConfig.icon;
                    const actions = getLeadStatusActions(lead.status);
                    const isUpdatingLead = bookingLeadActionId === lead.id;

                    return (
                      <div key={lead.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{lead.clientName || "Unknown client"}</p>
                            <p className="text-xs text-slate-600">{lead.clientPhone || "N/A"}</p>
                            <p className="text-xs text-slate-600 truncate">{lead.clientEmail || "N/A"}</p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.badgeClass}`}
                          >
                            <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.iconClass}`} />
                            {statusConfig.label}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-700">
                          <p>Service: {lead.service?.name || "N/A"}</p>
                          <p>Package: {lead.package?.name || "N/A"}</p>
                          <p>Preferred Date: {formatDateTime(lead.preferredDate)}</p>
                          <p>Submitted: {formatDateTime(lead.createdAt)}</p>
                          {lead.message ? <p className="text-slate-600">Message: {lead.message}</p> : null}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {actions.length > 0 ? (
                            actions.map((action) => (
                              <Button
                                key={action.nextStatus}
                                type="button"
                                variant={action.variant}
                                className="px-3 py-1.5 text-xs"
                                disabled={Boolean(bookingLeadActionId)}
                                onClick={() => {
                                  void handleLeadStatusUpdate(lead, action.nextStatus);
                                }}
                              >
                                {isUpdatingLead ? "Updating..." : action.label}
                              </Button>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500">No actions available for this lead.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {bookingLeadsPagination.totalPages > 1 ? (
                  <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-gray-200">
                    <p className="text-sm text-slate-600">
                      Showing {leadsRangeStart}-{leadsRangeEnd} of {bookingLeadsPagination.total} leads
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBookingLeadsPage((current) => Math.max(1, current - 1))}
                        disabled={bookingLeadsPage <= 1 || bookingLeadsLoading}
                        className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                      </button>
                      <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-500 text-white">
                        {bookingLeadsPage}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setBookingLeadsPage((current) =>
                            Math.min(current + 1, bookingLeadsPagination.totalPages || 1)
                          )
                        }
                        disabled={bookingLeadsPage >= (bookingLeadsPagination.totalPages || 1) || bookingLeadsLoading}
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
        </div>
      )}
    </DashboardLayout>
  );
}

