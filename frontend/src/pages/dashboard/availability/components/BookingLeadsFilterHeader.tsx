import { ChevronDown, Download } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { BOOKING_LEAD_PERIOD_PRESETS } from "../constants";
import type {
  BookingLeadFilters,
  BookingLeadPeriodPreset,
  BookingLeadSource,
  BookingLeadStatus,
  FollowUpTemplate,
  LeadUpgradeNudge,
  LeadWindow,
} from "../types";

type BookingLeadsFilterHeaderProps = {
  filters: BookingLeadFilters;
  canUseLeadFilters: boolean;
  leadFiltersUpgradeTarget: string;
  showLeadFiltersUpgrade: boolean;
  bookingLeadWindow: LeadWindow | null;
  totalLeads: number;
  exportingLeads: boolean;
  followUpTemplates: FollowUpTemplate[];
  selectedFollowUpTemplateId: string;
  leadUpgradeNudges: LeadUpgradeNudge[];
  onStatusChange: (value: "" | BookingLeadStatus) => void;
  onSourceChange: (value: "" | BookingLeadSource) => void;
  onSearchChange: (value: string) => void;
  onPeriodPresetChange: (preset: BookingLeadPeriodPreset) => void;
  onExportLeads: () => void;
  onSelectFollowUpTemplateId: (value: string) => void;
  onUpgradeFromLeads: (context: string) => void;
};

export function BookingLeadsFilterHeader({
  filters,
  canUseLeadFilters,
  leadFiltersUpgradeTarget,
  showLeadFiltersUpgrade,
  bookingLeadWindow,
  totalLeads,
  exportingLeads,
  followUpTemplates,
  selectedFollowUpTemplateId,
  leadUpgradeNudges,
  onStatusChange,
  onSourceChange,
  onSearchChange,
  onPeriodPresetChange,
  onExportLeads,
  onSelectFollowUpTemplateId,
  onUpgradeFromLeads,
}: BookingLeadsFilterHeaderProps) {
  return (
    <>
      <div className="mb-4 sm:hidden">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Leads Inbox</h2>
            <p className="text-[11px] text-slate-500">Compact follow-up feed</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
              {totalLeads}
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={onExportLeads}
              disabled={exportingLeads}
              className="px-2.5 py-1 text-[11px]"
            >
              <Download className="w-3 h-3" />
              CSV
            </Button>
          </div>
        </div>

        <div className="mt-3 space-y-2.5">
          <input
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name, phone, email, or message"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />

          <div className="overflow-x-auto pb-1">
            <div className="inline-flex min-w-full items-center gap-1.5">
              {BOOKING_LEAD_PERIOD_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onPeriodPresetChange(preset.value)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    filters.periodPreset === preset.value
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <details className="group rounded-xl bg-slate-50/90">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-700">
              <span>Filters and playbook tools</span>
              <ChevronDown className="motion-chevron h-3.5 w-3.5 text-slate-500" />
            </summary>
            <div className="motion-details-content space-y-2.5 border-t border-slate-200/80 px-3 py-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={filters.status}
                  onChange={(event) => onStatusChange(event.target.value as "" | BookingLeadStatus)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="DECLINED">Declined</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELED">Canceled</option>
                  <option value="EXPIRED">Expired</option>
                </select>
                <select
                  value={filters.source}
                  onChange={(event) => onSourceChange(event.target.value as "" | BookingLeadSource)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All sources</option>
                  <option value="WEBSITE">lensaya.com</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="DIRECT">Direct</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {followUpTemplates.length ? (
                <select
                  value={selectedFollowUpTemplateId}
                  onChange={(event) => onSelectFollowUpTemplateId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {followUpTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </details>
        </div>

        {(bookingLeadWindow?.isHistoryClamped || (bookingLeadWindow?.isVisibleClamped && Number(bookingLeadWindow?.maxVisibleLeads || 0) > 0)) ? (
          <div className="mt-2 space-y-1">
            {bookingLeadWindow?.isHistoryClamped ? (
              <p className="text-[11px] text-amber-700">History window: last {bookingLeadWindow.historyDays} days.</p>
            ) : null}
            {bookingLeadWindow?.isVisibleClamped && Number(bookingLeadWindow?.maxVisibleLeads || 0) > 0 ? (
              <p className="text-[11px] text-amber-700">Visibility cap: latest {bookingLeadWindow.maxVisibleLeads} leads.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="hidden sm:block">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Booking Leads</h2>
            <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">Latest inquiries, optimized for quick follow-up.</p>
            {bookingLeadWindow?.isHistoryClamped ? (
              <p className="mt-1 text-xs text-amber-700">History window applied: showing last {bookingLeadWindow.historyDays} days.</p>
            ) : null}
            {bookingLeadWindow?.isVisibleClamped && Number(bookingLeadWindow?.maxVisibleLeads || 0) > 0 ? (
              <p className="mt-1 text-xs text-amber-700">Lead visibility limit reached: showing the latest {bookingLeadWindow.maxVisibleLeads} leads.</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
              {totalLeads} total
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={onExportLeads}
              disabled={exportingLeads}
              className="px-3 py-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingLeads ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(event) => onStatusChange(event.target.value as "" | BookingLeadStatus)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="DECLINED">Declined</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELED">Canceled</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Source</label>
            <select
              value={filters.source}
              onChange={(event) => onSourceChange(event.target.value as "" | BookingLeadSource)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All sources</option>
              <option value="WEBSITE">lensaya.com</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="TIKTOK">TikTok</option>
              <option value="DIRECT">Direct</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Search</label>
            <input
              value={filters.search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search leads (name, email, phone, message)"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="mb-4 overflow-x-auto pb-1">
          <div className="inline-flex min-w-full items-center gap-2 sm:min-w-0">
            <span className="shrink-0 text-xs font-semibold text-slate-600">Period:</span>
            {BOOKING_LEAD_PERIOD_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => onPeriodPresetChange(preset.value)}
                className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  filters.periodPreset === preset.value
                    ? "border-cyan-500 bg-cyan-500 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showLeadFiltersUpgrade && !canUseLeadFilters ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-900">Unlock Lead Filters</p>
            <p className="text-xs text-amber-800">Source and search filters are available on {leadFiltersUpgradeTarget} and above to prioritize high-intent leads faster.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => onUpgradeFromLeads("filters_upgrade_banner")}>View Plans</Button>
        </div>
      ) : null}

      {followUpTemplates.length ? (
        <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-3 sm:px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cyan-900">Follow-up Playbook</p>
              <p className="text-xs text-cyan-800">
                Pick a script, then use the quick actions per lead to reply in under 1 minute.
              </p>
            </div>
            <div className="w-full md:w-[320px]">
              <select
                value={selectedFollowUpTemplateId}
                onChange={(event) => onSelectFollowUpTemplateId(event.target.value)}
                className="w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {followUpTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {leadUpgradeNudges.length ? (
        <div className="mb-4 grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-3">
          {leadUpgradeNudges.map((nudge) => (
            <div key={nudge.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{nudge.type}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{nudge.title}</p>
              <p className="mt-1 text-xs text-slate-600">{nudge.body}</p>
              {nudge.type === "upgrade" ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2 px-2.5 py-1 text-xs"
                  onClick={() => onUpgradeFromLeads(`nudge_${nudge.id}`)}
                >
                  Unlock Now
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
