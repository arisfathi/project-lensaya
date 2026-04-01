import { useMemo } from "react";
import type { BookingLead, PendingReminderSummary } from "../types";
import { getLeadAgingConfig, toLeadStatus } from "../utils";

export const usePendingReminderSummary = (bookingLeads: BookingLead[]): PendingReminderSummary =>
  useMemo(() => {
    let pending = 0;
    let stale24h = 0;
    let stale72h = 0;

    for (const lead of bookingLeads) {
      if (toLeadStatus(lead.status) !== "PENDING") continue;
      pending += 1;
      const aging = getLeadAgingConfig(lead);
      if (aging.level === "critical") stale72h += 1;
      else if (aging.level === "warning") stale24h += 1;
    }

    return { pending, stale24h, stale72h };
  }, [bookingLeads]);
