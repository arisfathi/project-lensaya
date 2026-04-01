import { AlertCircle, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import type { BookingLead, LeadStatusAction } from "../types";
import {
  formatDateTime,
  formatPreferredDateTime,
  getLeadAgingConfig,
  getLeadStatusActions,
  getLeadStatusConfig,
  getLeadTemperatureConfig,
} from "../utils";

type BookingLeadsListProps = {
  data: {
    loading: boolean;
    leads: BookingLead[];
    notesDrafts: Record<string, string>;
  };
  uiState: {
    actionId: string | null;
    notesSavingId: string | null;
  };
  capabilities: {
    canUseWhatsAppFollowUp: boolean;
    canUseEmailFollowUp: boolean;
    hasSelectedFollowUpTemplate: boolean;
  };
  pagination: {
    page: number;
    totalPages: number;
    total: number;
    rangeStart: number;
    rangeEnd: number;
  };
  handlers: {
    onNotesDraftChange: (leadId: string, value: string) => void;
    onSaveLeadNotes: (lead: BookingLead) => void;
    onFollowUpLead: (lead: BookingLead, channel: "whatsapp" | "email") => void;
    onLeadStatusUpdate: (lead: BookingLead, nextStatus: LeadStatusAction["nextStatus"]) => void;
    onPreviousPage: () => void;
    onNextPage: () => void;
  };
};

export function BookingLeadsList({
  data,
  uiState,
  capabilities,
  pagination,
  handlers,
}: BookingLeadsListProps) {
  if (data.loading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((row) => (
          <div key={row} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white/80 p-8 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
          <AlertCircle className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-slate-900">No booking inquiries yet</p>
        <p className="text-xs text-slate-600 mt-1">New booking leads will appear here as clients submit requests.</p>
      </div>
    );
  }

  return (
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
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Notes</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.leads.map((lead) => {
              const statusConfig = getLeadStatusConfig(lead.status);
              const StatusIcon = statusConfig.icon;
              const actions = getLeadStatusActions(lead.status);
              const leadTemperatureConfig = getLeadTemperatureConfig(lead.leadTemperature);
              const isUpdatingLead = uiState.actionId === lead.id;

              return (
                <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4">
                    <p className="text-sm font-medium text-slate-900">{lead.clientName || "Unknown client"}</p>
                    <div className="mt-1">
                      {(() => {
                        const aging = getLeadAgingConfig(lead);
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${aging.badgeClass}`}>
                            {aging.urgent ? <AlertTriangle className="w-3 h-3" /> : <Clock3 className="w-3 h-3" />}
                            {aging.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${leadTemperatureConfig.className}`}>
                        {leadTemperatureConfig.label} {Number(lead.leadScore || 0)}
                      </span>
                    </div>
                    {lead.message ? (
                      <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap wrap-break-word">{lead.message}</p>
                    ) : null}
                  </td>
                  <td className="py-4 px-4 text-sm text-slate-700">{lead.clientPhone || "N/A"}</td>
                  <td className="py-4 px-4 text-sm text-slate-700">{lead.clientEmail || "N/A"}</td>
                  <td className="py-4 px-4 text-sm text-slate-700">{lead.service?.name || "N/A"}</td>
                  <td className="py-4 px-4 text-sm text-slate-700">{lead.package?.name || "N/A"}</td>
                  <td className="py-4 px-4 text-sm text-slate-700">{formatPreferredDateTime(lead.preferredDate, lead.preferredTime)}</td>
                  <td className="py-4 px-4 text-sm text-slate-700">{formatDateTime(lead.createdAt)}</td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.badgeClass}`}>
                      <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.iconClass}`} />
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="py-4 px-4 align-top">
                    <div className="flex min-w-55 flex-col gap-2">
                      <textarea
                        value={data.notesDrafts[lead.id] ?? ""}
                        onChange={(event) => handlers.onNotesDraftChange(lead.id, event.target.value)}
                        placeholder="Add private note"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        rows={2}
                        maxLength={5000}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2.5 py-1 text-xs self-start"
                        disabled={Boolean(uiState.notesSavingId) || uiState.actionId === lead.id}
                        onClick={() => {
                          handlers.onSaveLeadNotes(lead);
                        }}
                      >
                        {uiState.notesSavingId === lead.id ? "Saving..." : "Save Note"}
                      </Button>
                    </div>
                  </td>
                  <td className={"py-4 px-4" + (actions.length > 0 ? " align-top" : "")}>
                    <div className="flex min-w-55 flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2.5 py-1 text-xs"
                          disabled={!capabilities.canUseWhatsAppFollowUp || !capabilities.hasSelectedFollowUpTemplate}
                          onClick={() => {
                            handlers.onFollowUpLead(lead, "whatsapp");
                          }}
                        >
                          Send WA
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2.5 py-1 text-xs"
                          disabled={!capabilities.canUseEmailFollowUp || !capabilities.hasSelectedFollowUpTemplate}
                          onClick={() => {
                            handlers.onFollowUpLead(lead, "email");
                          }}
                        >
                          Send Email
                        </Button>
                      </div>
                      {actions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {actions.map((action) => (
                            <Button
                              key={action.nextStatus}
                              type="button"
                              variant={action.variant}
                              className="px-3 py-1.5 text-xs"
                              disabled={Boolean(uiState.actionId)}
                              onClick={() => {
                                handlers.onLeadStatusUpdate(lead, action.nextStatus);
                              }}
                            >
                              {isUpdatingLead ? "Updating..." : action.label}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">No status actions</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm">
        {data.leads.map((lead, index) => {
          const statusConfig = getLeadStatusConfig(lead.status);
          const StatusIcon = statusConfig.icon;
          const actions = getLeadStatusActions(lead.status);
          const leadTemperatureConfig = getLeadTemperatureConfig(lead.leadTemperature);
          const isUpdatingLead = uiState.actionId === lead.id;
          const aging = getLeadAgingConfig(lead);
          const submittedAt = new Date(lead.createdAt);
          const submittedLabel = Number.isNaN(submittedAt.getTime())
            ? "-"
            : submittedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });

          return (
            <article
              key={lead.id}
              className="motion-feed-row border-b border-slate-100/90 px-3 py-3.5 last:border-b-0"
              style={{ animationDelay: `${Math.min(index, 6) * 38}ms` }}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{lead.clientName || "Unknown client"}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">{submittedLabel}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${leadTemperatureConfig.className}`}>
                      {leadTemperatureConfig.label} {Number(lead.leadScore || 0)}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${aging.badgeClass}`}>
                      {aging.urgent ? <AlertTriangle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                      {aging.label}
                    </span>
                  </div>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusConfig.badgeClass}`}>
                  <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.iconClass}`} />
                  {statusConfig.label}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-1 text-[11px] leading-4 text-slate-600">
                <p className="truncate">
                  <span className="font-semibold text-slate-500">Service:</span> {lead.service?.name || "N/A"}
                  {"  •  "}
                  <span className="font-semibold text-slate-500">Package:</span> {lead.package?.name || "N/A"}
                </p>
                <p className="col-span-2 truncate">
                  <span className="font-semibold text-slate-500">Preferred:</span> {formatPreferredDateTime(lead.preferredDate, lead.preferredTime)}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2.5 py-1 text-[11px]"
                  disabled={!capabilities.canUseWhatsAppFollowUp || !capabilities.hasSelectedFollowUpTemplate}
                  onClick={() => {
                    handlers.onFollowUpLead(lead, "whatsapp");
                  }}
                >
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2.5 py-1 text-[11px]"
                  disabled={!capabilities.canUseEmailFollowUp || !capabilities.hasSelectedFollowUpTemplate}
                  onClick={() => {
                    handlers.onFollowUpLead(lead, "email");
                  }}
                >
                  Email
                </Button>
                {actions.length > 0
                  ? actions.map((action) => (
                      <Button
                        key={action.nextStatus}
                        type="button"
                        variant={action.variant}
                        className="px-2.5 py-1 text-[11px]"
                        disabled={Boolean(uiState.actionId)}
                        onClick={() => {
                          handlers.onLeadStatusUpdate(lead, action.nextStatus);
                        }}
                      >
                        {isUpdatingLead ? "Updating..." : action.label}
                      </Button>
                    ))
                  : null}
              </div>

              <details className="group mt-3 rounded-lg bg-slate-50/75">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-700">
                  <span>Open details, message, and private note</span>
                  <ChevronDown className="motion-chevron h-3.5 w-3.5 text-slate-500" />
                </summary>
                <div className="motion-details-content space-y-2 border-t border-slate-200/80 px-3 py-3">
                  <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-600">
                    <p className="truncate"><span className="font-semibold text-slate-500">Phone:</span> {lead.clientPhone || "N/A"}</p>
                    <p className="truncate"><span className="font-semibold text-slate-500">Email:</span> {lead.clientEmail || "N/A"}</p>
                    <p className="truncate"><span className="font-semibold text-slate-500">Submitted:</span> {formatDateTime(lead.createdAt)}</p>
                  </div>
                  {lead.message ? (
                    <p className="rounded-md border border-slate-200/80 bg-white px-2.5 py-2 text-xs leading-5 text-slate-600">
                      {lead.message}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">No message provided by client.</p>
                  )}

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Private Note</label>
                    <textarea
                      value={data.notesDrafts[lead.id] ?? ""}
                      onChange={(event) => handlers.onNotesDraftChange(lead.id, event.target.value)}
                      placeholder="Add private note"
                      className="w-full rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      rows={3}
                      maxLength={5000}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-2 px-2.5 py-1 text-[11px]"
                      disabled={Boolean(uiState.notesSavingId) || uiState.actionId === lead.id}
                      onClick={() => {
                        handlers.onSaveLeadNotes(lead);
                      }}
                    >
                      {uiState.notesSavingId === lead.id ? "Saving..." : "Save Note"}
                    </Button>
                  </div>
                </div>
              </details>

              {actions.length === 0 ? (
                <p className="mt-2 text-[11px] text-slate-500">No status actions available for this lead.</p>
              ) : null}
            </article>
          );
        })}
      </div>

      {pagination.totalPages > 1 ? (
        <div className="mt-5 flex flex-col items-start justify-between gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center">
          <p className="text-xs sm:text-sm text-slate-600">
            Showing {pagination.rangeStart}-{pagination.rangeEnd} of {pagination.total} leads
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlers.onPreviousPage}
              disabled={pagination.page <= 1 || data.loading}
              className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-white">
              {pagination.page}
            </span>
            <button
              type="button"
              onClick={handlers.onNextPage}
              disabled={pagination.page >= pagination.totalPages || data.loading}
              className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
