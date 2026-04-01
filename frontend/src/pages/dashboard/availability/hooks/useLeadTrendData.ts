import { useMemo } from "react";
import type { LeadInsights, LeadTrendPoint } from "../types";

export const useLeadTrendData = (bookingLeadInsights: LeadInsights | null, leadTrendWindow: "7d" | "30d") => {
  const selectedLeadTrend = useMemo(() => {
    if (!bookingLeadInsights?.trends) return [] as LeadTrendPoint[];
    return leadTrendWindow === "30d" ? bookingLeadInsights.trends.daily30d : bookingLeadInsights.trends.daily7d;
  }, [bookingLeadInsights, leadTrendWindow]);

  const leadTrendMax = useMemo(() => {
    if (!selectedLeadTrend.length) return 1;
    const maxValue = selectedLeadTrend.reduce((max, row) => Math.max(max, row.leads, row.converted), 0);
    return Math.max(1, maxValue);
  }, [selectedLeadTrend]);

  return { selectedLeadTrend, leadTrendMax };
};
