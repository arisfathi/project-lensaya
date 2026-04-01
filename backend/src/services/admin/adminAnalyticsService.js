import { prisma } from "../../config/prisma.js";
import {
  addDays,
  addMonths,
  buildDailySeries,
  buildMonthlySeries,
  formatPercentChange,
  parseWindowSize,
  sourceLabel,
  startOfDay,
  startOfMonth,
} from "./adminService.utils.js";

export const adminAnalyticsService = {
  async analyticsOverview(query = {}) {
    const now = new Date();
    const months = parseWindowSize(query.months, 6);
    const days = parseWindowSize(query.days, 30, 90);

    const monthlyStart = addMonths(startOfMonth(now), -(months - 1));
    const currentDailyStart = addDays(startOfDay(now), -(days - 1));
    const previousDailyStart = addDays(currentDailyStart, -days);

    const [
      trafficRows,
      sourceRows,
      portfolioViewRows,
      bookingRows,
      userGrowthRows,
      currentMetricGroups,
      previousMetricGroups,
      currentActiveIdentities,
      previousActiveIdentities,
    ] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where: {
          eventType: "PAGE_VIEW",
          createdAt: { gte: monthlyStart },
        },
        select: { createdAt: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["source"],
        where: {
          eventType: "PAGE_VIEW",
          createdAt: { gte: monthlyStart },
        },
        _count: { _all: true },
      }),
      prisma.analyticsEvent.findMany({
        where: {
          eventType: "PORTFOLIO_VIEW",
          createdAt: { gte: monthlyStart },
        },
        select: { createdAt: true },
      }),
      prisma.booking.findMany({
        where: { createdAt: { gte: currentDailyStart } },
        select: { createdAt: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: monthlyStart } },
        select: { createdAt: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["eventType"],
        where: { createdAt: { gte: currentDailyStart } },
        _count: { _all: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["eventType"],
        where: { createdAt: { gte: previousDailyStart, lt: currentDailyStart } },
        _count: { _all: true },
      }),
      prisma.analyticsEvent.findMany({
        where: {
          createdAt: { gte: currentDailyStart },
        },
        select: {
          userId: true,
          visitorId: true,
          sessionId: true,
        },
      }),
      prisma.analyticsEvent.findMany({
        where: {
          createdAt: { gte: previousDailyStart, lt: currentDailyStart },
        },
        select: {
          userId: true,
          visitorId: true,
          sessionId: true,
        },
      }),
    ]);

    const sourceTotals = new Map();
    for (const row of sourceRows) {
      const label = sourceLabel(row.source);
      sourceTotals.set(label, (sourceTotals.get(label) || 0) + Number(row._count._all || 0));
    }

    const sourceBreakdown = Array.from(sourceTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        id: `source-${index + 1}`,
        name,
        value,
      }));

    const currentMetricsMap = new Map(currentMetricGroups.map((row) => [row.eventType, Number(row._count._all || 0)]));
    const previousMetricsMap = new Map(
      previousMetricGroups.map((row) => [row.eventType, Number(row._count._all || 0)])
    );

    const buildMetric = (id, metric, currentValue, previousValue) => ({
      id,
      metric,
      value: String(currentValue),
      change: formatPercentChange(currentValue, previousValue),
      trend: currentValue >= previousValue ? "up" : "down",
    });

    const currentWhatsapp = currentMetricsMap.get("WHATSAPP_CLICK") || 0;
    const previousWhatsapp = previousMetricsMap.get("WHATSAPP_CLICK") || 0;
    const currentBookingIntents = currentMetricsMap.get("BOOKING_INTENT") || 0;
    const previousBookingIntents = previousMetricsMap.get("BOOKING_INTENT") || 0;
    const currentPortfolioViews = currentMetricsMap.get("PORTFOLIO_VIEW") || 0;
    const previousPortfolioViews = previousMetricsMap.get("PORTFOLIO_VIEW") || 0;
    const toIdentityKey = (row) => {
      if (row.visitorId) return `visitor:${row.visitorId}`;
      if (row.sessionId) return `session:${row.sessionId}`;
      if (row.userId) return `user:${row.userId}`;
      return "";
    };
    const currentActiveUsersCount = new Set(currentActiveIdentities.map(toIdentityKey).filter(Boolean)).size;
    const previousActiveUsersCount = new Set(previousActiveIdentities.map(toIdentityKey).filter(Boolean)).size;

    return {
      trafficSeries: buildMonthlySeries(trafficRows, {
        start: monthlyStart,
        months,
        getDate: (row) => row.createdAt,
        getValue: () => 1,
        valueKey: "visitors",
      }),
      sourceBreakdown,
      portfolioViewsSeries: buildMonthlySeries(portfolioViewRows, {
        start: monthlyStart,
        months,
        getDate: (row) => row.createdAt,
        getValue: () => 1,
        valueKey: "views",
      }),
      engagementMetrics: [
        buildMetric("metric-whatsapp-clicks", "WhatsApp Clicks", currentWhatsapp, previousWhatsapp),
        buildMetric("metric-active-users", "Active Users", currentActiveUsersCount, previousActiveUsersCount),
        buildMetric("metric-booking-intents", "Booking Intents", currentBookingIntents, previousBookingIntents),
        buildMetric(
          "metric-portfolio-views",
          "Portfolio Views (Window)",
          currentPortfolioViews,
          previousPortfolioViews
        ),
      ],
      bookingsPerDay: buildDailySeries(bookingRows, {
        start: currentDailyStart,
        days,
        getDate: (row) => row.createdAt,
        getValue: () => 1,
        valueKey: "bookings",
      }),
      newUserGrowth: buildMonthlySeries(userGrowthRows, {
        start: monthlyStart,
        months,
        getDate: (row) => row.createdAt,
        getValue: () => 1,
        valueKey: "users",
      }),
    };
  },
};

