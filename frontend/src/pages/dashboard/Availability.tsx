import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { analyticsApi, availabilityApi, bookingsApi, getApiErrorMessage, isApiAccessError } from "../../lib/api";
import {
  AVAILABILITY_LEGEND,
  DEFAULT_BOOKING_LEADS_PAGINATION,
} from "./availability/constants";
import { AvailabilityCalendarCard } from "./availability/components/AvailabilityCalendarCard";
import { BookingLeadsFilterHeader } from "./availability/components/BookingLeadsFilterHeader";
import { AvailabilitySummaryCard } from "./availability/components/AvailabilitySummaryCard";
import { BookingLeadsList } from "./availability/components/BookingLeadsList";
import { LeadInsightsPanels } from "./availability/components/LeadInsightsPanels";
import { useLeadTrendData } from "./availability/hooks/useLeadTrendData";
import { usePendingReminderSummary } from "./availability/hooks/usePendingReminderSummary";
import type {
  BookingLead,
  BookingLeadFilters,
  BookingLeadPeriodPreset,
  BookingLeadsPagination,
  DayStatus,
  FollowUpTemplate,
  LeadInsights,
  LeadStatusAction,
  LeadUpgradeNudge,
  LeadWindow,
  UpdateStatus,
} from "./availability/types";
import {
  buildPresetDateRange,
  fillFollowUpTemplate,
  formatLeadStatusLabel,
  normalizePhoneForWhatsApp,
  toBookingLeadsPagination,
  toDateKey,
  toDayStatus,
  toLocalDateKey,
  toMonthKey,
  toUpdateStatus,
} from "./availability/utils";

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
  const [bookingLeadsLoading, setBookingLeadsLoading] = useState(true);
  const [bookingLeads, setBookingLeads] = useState<BookingLead[]>([]);
  const [bookingLeadsPage, setBookingLeadsPage] = useState(1);
  const [bookingLeadsPagination, setBookingLeadsPagination] = useState<BookingLeadsPagination>(
    DEFAULT_BOOKING_LEADS_PAGINATION
  );
  const [bookingLeadActionId, setBookingLeadActionId] = useState<string | null>(null);
  const [bookingLeadNotesDrafts, setBookingLeadNotesDrafts] = useState<Record<string, string>>({});
  const [bookingLeadNotesSavingId, setBookingLeadNotesSavingId] = useState<string | null>(null);
  const [bookingLeadFilters, setBookingLeadFilters] = useState<BookingLeadFilters>({
    status: "",
    source: "",
    search: "",
    periodPreset: "all",
    from: "",
    to: "",
  });
  const [showLeadFiltersUpgrade, setShowLeadFiltersUpgrade] = useState(false);
  const [showLeadExportUpgrade, setShowLeadExportUpgrade] = useState(false);
  const [bookingLeadInsights, setBookingLeadInsights] = useState<LeadInsights | null>(null);
  const [bookingLeadWindow, setBookingLeadWindow] = useState<LeadWindow | null>(null);
  const [followUpTemplates, setFollowUpTemplates] = useState<FollowUpTemplate[]>([]);
  const [selectedFollowUpTemplateId, setSelectedFollowUpTemplateId] = useState<string>("");
  const [leadUpgradeNudges, setLeadUpgradeNudges] = useState<LeadUpgradeNudge[]>([]);
  const [exportingLeads, setExportingLeads] = useState(false);
  const [leadTrendWindow, setLeadTrendWindow] = useState<"7d" | "30d">("7d");
  const trackedLeadNudgesRef = useRef<string>("");
  const bookingLeadsLimit = 10;

  useEffect(() => {
    statusMapRef.current = statusMap;
  }, [statusMap]);

  useEffect(() => {
    initialStatusMapRef.current = initialStatusMap;
  }, [initialStatusMap]);

  const { success, error, info } = useToast();

  const { user } = useAuth();
  const leadFeatures = user?.leadFeatures;
  const canUseLeadFilters = Boolean(leadFeatures?.filters);
  const canExportLeads = Boolean(leadFeatures?.export);
  const canUseWhatsAppFollowUp = Boolean(leadFeatures?.channels?.whatsapp);
  const canUseEmailFollowUp = Boolean(leadFeatures?.channels?.email);
  const leadFiltersUpgradeTarget = leadFeatures?.upgradeTarget || "PRO";
  const leadNudgeUpgradeTarget = bookingLeadInsights?.locked?.upgradeTarget || leadFiltersUpgradeTarget;

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

        for (const date of bookingCalendar.bookedDates || []) {
          const key = toDateKey(date);
          if (!(key in baseMap)) {
            baseMap[key] = "booked";
          }
        }

        const nextStatusMap: Record<string, DayStatus> = { ...baseMap };

        if (preserveEdits) {
          for (const [dateKey, currentValue] of Object.entries(statusMapRef.current)) {
            const currentStatus = toDayStatus(currentValue);
            const baselineStatus = toDayStatus(initialStatusMapRef.current[dateKey] || "available");

            if (currentStatus !== baselineStatus) {
              nextStatusMap[dateKey] = currentStatus;
            }
          }
        }

        setStatusMap(nextStatusMap);
        setInitialStatusMap(baseMap);
      } catch (err) {
        if (isApiAccessError(err)) {
          return;
        }
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
        const bookingList = await bookingsApi.list({
          page: bookingLeadsPage,
          limit: bookingLeadsLimit,
          ...(bookingLeadFilters.status ? { status: bookingLeadFilters.status } : {}),
          ...(canUseLeadFilters && bookingLeadFilters.source ? { source: bookingLeadFilters.source } : {}),
          ...(canUseLeadFilters && bookingLeadFilters.search.trim()
            ? { search: bookingLeadFilters.search.trim() }
            : {}),
          ...(bookingLeadFilters.from ? { from: bookingLeadFilters.from } : {}),
          ...(bookingLeadFilters.to ? { to: bookingLeadFilters.to } : {}),
        });
        const items = ((bookingList.items || []) as BookingLead[]).slice().sort((a, b) => {
          const scoreDiff = Number(b.leadScore || 0) - Number(a.leadScore || 0);
          if (scoreDiff !== 0) return scoreDiff;

          const left = new Date(a.createdAt || 0).getTime();
          const right = new Date(b.createdAt || 0).getTime();
          return right - left;
        });

        const nextPagination = toBookingLeadsPagination(
          (bookingList.pagination || undefined) as Record<string, unknown> | undefined,
          {
            ...DEFAULT_BOOKING_LEADS_PAGINATION,
            page: bookingLeadsPage,
            limit: bookingLeadsLimit,
          }
        );

        const nextDrafts: Record<string, string> = {};
        for (const item of items) {
          nextDrafts[item.id] = String(item.notes || "");
        }

        setBookingLeads(items);
        setBookingLeadsPagination(nextPagination);
        setBookingLeadNotesDrafts(nextDrafts);
        setBookingLeadInsights((bookingList.leadInsights || null) as LeadInsights | null);
        setBookingLeadWindow((bookingList.leadWindow || null) as LeadWindow | null);
        const nextTemplates = (bookingList.followUpTemplates || []) as FollowUpTemplate[];
        setFollowUpTemplates(nextTemplates);
        setLeadUpgradeNudges((bookingList.upgradeNudges || []) as LeadUpgradeNudge[]);
        setSelectedFollowUpTemplateId((current) => {
          if (!nextTemplates.length) return "";
          if (current && nextTemplates.some((template) => template.id === current)) return current;
          return nextTemplates[0]?.id || "";
        });
      } catch (err) {
        if (isApiAccessError(err)) {
          return;
        }
        error(getApiErrorMessage(err, "Failed to load booking leads"));
      } finally {
        if (showLoading) {
          setBookingLeadsLoading(false);
        }
      }
    },
    [bookingLeadsLimit, bookingLeadsPage, bookingLeadFilters.from, bookingLeadFilters.search, bookingLeadFilters.source, bookingLeadFilters.status, bookingLeadFilters.to, canUseLeadFilters, error]
  );

  useEffect(() => {
    void loadBookingLeads();
  }, [loadBookingLeads]);

  useEffect(() => {
    setBookingLeadsPage(1);
  }, [bookingLeadFilters.status, bookingLeadFilters.source, bookingLeadFilters.search, bookingLeadFilters.from, bookingLeadFilters.to]);

  useEffect(() => {
    if (!leadUpgradeNudges.length) return;
    const key = leadUpgradeNudges.map((item) => item.id).join("|");
    if (!key || trackedLeadNudgesRef.current === key) return;
    trackedLeadNudgesRef.current = key;

    void analyticsApi
      .track({
        action: "lead_nudges_viewed",
        source: "availability_leads",
        nudgeIds: leadUpgradeNudges.map((item) => item.id),
      })
      .catch(() => {
        // Non-blocking tracking
      });
  }, [leadUpgradeNudges]);

  const handleToggleDay = (day: number) => {
    if (isPastDay(day)) {
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

  const handleLeadPeriodPresetChange = (preset: BookingLeadPeriodPreset) => {
    const range = buildPresetDateRange(preset);
    setBookingLeadFilters((current) => ({
      ...current,
      periodPreset: preset,
      from: range.from,
      to: range.to,
    }));
    setBookingLeadsPage(1);
  };

  const handleLeadFilterChange = <K extends keyof BookingLeadFilters>(key: K, value: BookingLeadFilters[K]) => {
    if (!canUseLeadFilters && (key === "source" || key === "search")) {
      setShowLeadFiltersUpgrade(true);
      info(`Upgrade to ${leadFiltersUpgradeTarget} to use lead filters.`);
      return;
    }

    setBookingLeadFilters((current) => ({
      ...current,
      [key]: value,
    }));
    setBookingLeadsPage(1);
  };

  const handleExportLeads = async () => {
    if (!canExportLeads) {
      setShowLeadExportUpgrade(true);
      info(`Upgrade to ${leadFiltersUpgradeTarget} to export leads.`);
      return;
    }

    try {
      setExportingLeads(true);
      const result = await bookingsApi.exportCsv({
        ...(bookingLeadFilters.status ? { status: bookingLeadFilters.status } : {}),
        ...(canUseLeadFilters && bookingLeadFilters.source ? { source: bookingLeadFilters.source } : {}),
        ...(canUseLeadFilters && bookingLeadFilters.search.trim()
          ? { search: bookingLeadFilters.search.trim() }
          : {}),
        ...(bookingLeadFilters.from ? { from: bookingLeadFilters.from } : {}),
        ...(bookingLeadFilters.to ? { to: bookingLeadFilters.to } : {}),
      });

      const url = window.URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      success("Lead export downloaded.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to export leads"));
    } finally {
      setExportingLeads(false);
    }
  };

  const handleSaveLeadNotes = async (lead: BookingLead) => {
    const rawDraft = bookingLeadNotesDrafts[lead.id] ?? "";
    const normalizedDraft = rawDraft.trim();
    const currentNotes = String(lead.notes || "").trim();

    if (normalizedDraft === currentNotes) {
      info("No note changes to save.");
      return;
    }

    try {
      setBookingLeadNotesSavingId(lead.id);
      await bookingsApi.updateNotes(lead.id, normalizedDraft || null);
      success("Lead notes updated.");
      await loadBookingLeads({ showLoading: false });
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to update lead notes"));
    } finally {
      setBookingLeadNotesSavingId(null);
    }
  };

  const selectedFollowUpTemplate = useMemo(
    () => followUpTemplates.find((template) => template.id === selectedFollowUpTemplateId) || null,
    [followUpTemplates, selectedFollowUpTemplateId]
  );

  const handleUpgradeFromLeads = async (context: string) => {
    try {
      await analyticsApi.track({
        action: "lead_upgrade_cta_clicked",
        source: "availability_leads",
        context,
        targetPlan: leadNudgeUpgradeTarget,
      });
    } catch {
      // Non-blocking tracking
    }

    window.location.href = "/dashboard/pricing";
  };

  const handleFollowUpLead = async (lead: BookingLead, channel: "whatsapp" | "email") => {
    if (!selectedFollowUpTemplate) {
      info("No follow-up template available.");
      return;
    }

    if (channel === "whatsapp") {
      const phone = normalizePhoneForWhatsApp(lead.clientPhone);
      if (!phone) {
        info("Lead has no valid WhatsApp number.");
        return;
      }

      const message = fillFollowUpTemplate(selectedFollowUpTemplate.whatsapp, lead, {
        studioName: user?.fullName || user?.username || "My studio",
      });
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      try {
        await analyticsApi.track({
          action: "lead_followup_sent",
          source: "availability_leads",
          channel: "whatsapp",
          templateId: selectedFollowUpTemplate.id,
          leadId: lead.id,
        });
      } catch {
        // Non-blocking tracking
      }

      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const email = String(lead.clientEmail || "").trim();
    if (!email) {
      info("Lead has no email address.");
      return;
    }

    const subject = fillFollowUpTemplate(selectedFollowUpTemplate.emailSubject, lead, {
      studioName: user?.fullName || user?.username || "My studio",
    });
    const body = fillFollowUpTemplate(selectedFollowUpTemplate.emailBody, lead, {
      studioName: user?.fullName || user?.username || "My studio",
    });

    try {
      await analyticsApi.track({
        action: "lead_followup_sent",
        source: "availability_leads",
        channel: "email",
        templateId: selectedFollowUpTemplate.id,
        leadId: lead.id,
      });
    } catch {
      // Non-blocking tracking
    }

    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const { selectedLeadTrend, leadTrendMax } = useLeadTrendData(bookingLeadInsights, leadTrendWindow);
  const pendingReminderSummary = usePendingReminderSummary(bookingLeads);

  const leadsRangeStart = bookingLeads.length
    ? (bookingLeadsPagination.page - 1) * bookingLeadsPagination.limit + 1
    : 0;
  const leadsRangeEnd = bookingLeads.length ? leadsRangeStart + bookingLeads.length - 1 : 0;

  return (
    <DashboardLayout>
      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-6 sm:rounded-xl sm:border-slate-200 sm:bg-linear-to-br sm:from-white sm:to-slate-50 sm:p-6 sm:shadow-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Schedule Management</p>
          <h1 className="mt-2 text-lg font-semibold text-slate-900 sm:text-3xl sm:font-bold">Calendar</h1>
          <p className="mt-1 text-sm text-slate-600">Set available and booked dates so clients can plan with confidence.</p>
        </div>
      </div>

      <AvailabilitySummaryCard
        changedCount={changedCount}
        saving={saving}
        onSave={() => void handleSave()}
        availabilityLegend={AVAILABILITY_LEGEND}
      />

      {loading ? (
        <LoadingCard label="Loading calendar..." />
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <AvailabilityCalendarCard
            month={month}
            year={year}
            monthKey={monthKey}
            calendarCells={calendarCells}
            getDayStatus={getDayStatus}
            getDayKey={getDayKey}
            isPastDay={isPastDay}
            onToggleDay={handleToggleDay}
            onPreviousMonth={() =>
              setCurrentDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
            }
            onNextMonth={() =>
              setCurrentDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
            }
          />

          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:rounded-xl sm:border-gray-200 sm:p-6">
            <BookingLeadsFilterHeader
              filters={bookingLeadFilters}
              canUseLeadFilters={canUseLeadFilters}
              leadFiltersUpgradeTarget={leadFiltersUpgradeTarget}
              showLeadFiltersUpgrade={showLeadFiltersUpgrade}
              bookingLeadWindow={bookingLeadWindow}
              totalLeads={bookingLeadsPagination.total}
              exportingLeads={exportingLeads}
              followUpTemplates={followUpTemplates}
              selectedFollowUpTemplateId={selectedFollowUpTemplateId}
              leadUpgradeNudges={leadUpgradeNudges}
              onStatusChange={(value) => handleLeadFilterChange("status", value)}
              onSourceChange={(value) => handleLeadFilterChange("source", value)}
              onSearchChange={(value) => handleLeadFilterChange("search", value)}
              onPeriodPresetChange={handleLeadPeriodPresetChange}
              onExportLeads={() => {
                void handleExportLeads();
              }}
              onSelectFollowUpTemplateId={setSelectedFollowUpTemplateId}
              onUpgradeFromLeads={(context) => {
                void handleUpgradeFromLeads(context);
              }}
            />

            <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 sm:grid sm:grid-cols-3 sm:gap-3 sm:rounded-none sm:border-none sm:bg-transparent">
              <div className="flex items-center justify-between px-3 py-2.5 sm:rounded-lg sm:border sm:border-slate-200 sm:bg-slate-50">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pending Leads</p>
                <p className="text-base font-semibold text-slate-900 sm:text-lg">{pendingReminderSummary.pending}</p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2.5 sm:rounded-lg sm:border sm:border-amber-200 sm:bg-amber-50 sm:justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Need Follow-up 24h+</p>
                <p className="text-base font-semibold text-amber-800 sm:text-lg">{pendingReminderSummary.stale24h}</p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2.5 sm:rounded-lg sm:border sm:border-red-200 sm:bg-red-50 sm:justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Urgent 3d+</p>
                <p className="text-base font-semibold text-red-800 sm:text-lg">{pendingReminderSummary.stale72h}</p>
              </div>
            </div>

            {showLeadExportUpgrade && !canExportLeads ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Unlock Lead Export</p>
                  <p className="text-xs text-amber-800">CSV export is available on {leadFiltersUpgradeTarget} and above for pipeline review and retargeting.</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => void handleUpgradeFromLeads("export_upgrade_banner")}>View Plans</Button>
              </div>
            ) : null}

            <BookingLeadsList
              data={{
                loading: bookingLeadsLoading,
                leads: bookingLeads,
                notesDrafts: bookingLeadNotesDrafts,
              }}
              uiState={{
                actionId: bookingLeadActionId,
                notesSavingId: bookingLeadNotesSavingId,
              }}
              capabilities={{
                canUseWhatsAppFollowUp,
                canUseEmailFollowUp,
                hasSelectedFollowUpTemplate: Boolean(selectedFollowUpTemplate),
              }}
              pagination={{
                page: bookingLeadsPage,
                totalPages: bookingLeadsPagination.totalPages || 1,
                total: bookingLeadsPagination.total,
                rangeStart: leadsRangeStart,
                rangeEnd: leadsRangeEnd,
              }}
              handlers={{
                onNotesDraftChange: (leadId, value) =>
                  setBookingLeadNotesDrafts((current) => ({
                    ...current,
                    [leadId]: value,
                  })),
                onSaveLeadNotes: (lead) => {
                  void handleSaveLeadNotes(lead);
                },
                onFollowUpLead: (lead, channel) => {
                  void handleFollowUpLead(lead, channel);
                },
                onLeadStatusUpdate: (lead, nextStatus) => {
                  void handleLeadStatusUpdate(lead, nextStatus);
                },
                onPreviousPage: () => setBookingLeadsPage((current) => Math.max(1, current - 1)),
                onNextPage: () =>
                  setBookingLeadsPage((current) =>
                    Math.min(current + 1, bookingLeadsPagination.totalPages || 1)
                  ),
              }}
            />

            <LeadInsightsPanels
              bookingLeadInsights={bookingLeadInsights}
              leadNudgeUpgradeTarget={leadNudgeUpgradeTarget}
              leadTrendWindow={leadTrendWindow}
              selectedLeadTrend={selectedLeadTrend}
              leadTrendMax={leadTrendMax}
              onLeadTrendWindowChange={setLeadTrendWindow}
              onUpgradeFromLeads={(context) => void handleUpgradeFromLeads(context)}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
















