import { prisma } from "../../config/prisma.js";
import { planLimitService } from "../planLimitService.js";
import { applyTenantFilter } from "../../utils/tenantQuery.js";
import { getPagination, buildPagination } from "../../utils/pagination.js";
import {
  requireTenantPhotographerId,
  buildAnalyticsAccess,
  startOfDay,
  addDays,
  dayKey,
  sourceLabel,
  rankCategorySeries,
  getPortfolioViewCategorySeries,
  loadAnalyticsRollupSnapshot,
} from "./photographerService.utils.js";
import { FREE_ANALYTICS_ACTIVITY_PREVIEW_LIMIT } from "./photographerService.constants.js";

const DEFAULT_ANALYTICS_WINDOW_DAYS = 30;
const ALLOWED_ANALYTICS_WINDOWS = new Set([7, 30, 90]);

const parseAnalyticsWindowDays = (query = {}) => {
  const raw = Number(query?.windowDays);
  if (!Number.isFinite(raw)) return DEFAULT_ANALYTICS_WINDOW_DAYS;
  const normalized = Math.floor(raw);
  return ALLOWED_ANALYTICS_WINDOWS.has(normalized) ? normalized : DEFAULT_ANALYTICS_WINDOW_DAYS;
};

const buildChangeSummary = (currentValue, previousValue) => {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  if (previous <= 0) {
    return {
      current,
      previous,
      changePercent: current > 0 ? 100 : 0,
      trend: current >= previous ? "up" : "down",
    };
  }

  const changePercent = Number((((current - previous) / previous) * 100).toFixed(2));
  return {
    current,
    previous,
    changePercent,
    trend: changePercent >= 0 ? "up" : "down",
  };
};

export const photographerAnalyticsService = {
  async analyticsOverview(tenant, query = {}) {
    const photographerId = requireTenantPhotographerId(tenant);
    const plan = await planLimitService.getPlanByPhotographerId(photographerId);
    const access = buildAnalyticsAccess(plan);
    const now = new Date();
    const trafficDays = 7;
    const goalHistoryMonths = 12;
    const metricsDays = parseAnalyticsWindowDays(query);
    const trafficStart = addDays(startOfDay(now), -(trafficDays - 1));
    const metricsStart = addDays(startOfDay(now), -(metricsDays - 1));
    const previousMetricsStart = addDays(metricsStart, -metricsDays);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const goalHistoryStartMonth = new Date(now.getFullYear(), now.getMonth() - (goalHistoryMonths - 1), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsedInMonth = Math.max(1, now.getDate());

    const categorySeries = await getPortfolioViewCategorySeries(photographerId, metricsStart);

    const trafficBuckets = Array.from({ length: trafficDays }, (_, index) => {
      const date = addDays(trafficStart, index);
      return {
        key: dayKey(date),
        name: date.toLocaleString("en-US", { weekday: "short" }),
        views: 0,
      };
    });
    const trafficMap = new Map(trafficBuckets.map((bucket) => [bucket.key, bucket]));

    const metricsMap = new Map();
    const previousMetricsMap = new Map();
    let monthlyVisitors = 0;

    const [photographerRecord, serviceCatalog, packageCatalog, inquiriesMonthToDateRaw, monthlyInquiriesRows] = await Promise.all([
      prisma.photographer.findUnique({
        where: { id: photographerId },
        select: { inquiryGoalTarget: true },
      }),
      prisma.service.findMany({
        where: {
          photographerId,
          status: { not: "ARCHIVED" },
        },
        select: { id: true, name: true },
      }),
      prisma.package.findMany({
        where: {
          photographerId,
          status: { not: "ARCHIVED" },
        },
        select: { id: true, name: true, serviceId: true },
      }),
      prisma.analyticsEvent.count({
        where: {
          photographerId,
          eventType: "BOOKING_INTENT",
          createdAt: { gte: monthStart },
        },
      }),
      prisma.$queryRaw`
        SELECT DATE_TRUNC('month', "createdAt") AS "monthBucket", COUNT(*)::int AS "inquiries"
        FROM "AnalyticsEvent"
        WHERE "photographerId" = ${photographerId}::uuid
          AND "eventType" = 'BOOKING_INTENT'
          AND "createdAt" >= ${goalHistoryStartMonth}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY DATE_TRUNC('month', "createdAt") ASC
      `,
    ]);

    const trackedServiceEvents = ["PORTFOLIO_VIEW", "PACKAGE_VIEW", "SERVICE_SELECT", "PACKAGE_SELECT", "BOOKING_INTENT"];
    const trackedPackageEvents = ["PACKAGE_VIEW", "PACKAGE_SELECT", "BOOKING_INTENT"];

    const [serviceEventGroups, packageEventGroups] = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ["serviceId", "eventType"],
        where: {
          photographerId,
          serviceId: { not: null },
          eventType: { in: trackedServiceEvents },
          createdAt: { gte: metricsStart },
        },
        _count: { _all: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["packageId", "eventType"],
        where: {
          photographerId,
          packageId: { not: null },
          eventType: { in: trackedPackageEvents },
          createdAt: { gte: metricsStart },
        },
        _count: { _all: true },
      }),
    ]);

    const [sourceFunnelGroups, previousMetricGroups] = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ["source", "eventType"],
        where: {
          photographerId,
          eventType: { in: ["PAGE_VIEW", "PORTFOLIO_VIEW", "PACKAGE_VIEW", "PACKAGE_SELECT", "BOOKING_INTENT", "WHATSAPP_CLICK"] },
          createdAt: { gte: metricsStart },
        },
        _count: { _all: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["eventType"],
        where: {
          photographerId,
          createdAt: { gte: previousMetricsStart, lt: metricsStart },
        },
        _count: { _all: true },
      }),
    ]);

    for (const row of previousMetricGroups) {
      previousMetricsMap.set(row.eventType, Number(row._count?._all || 0));
    }
    const sourceTotals = new Map();

    const rollupSnapshot = await loadAnalyticsRollupSnapshot({
      photographerId,
      trafficStart,
      metricsStart,
    });

    if (rollupSnapshot?.usingRollups) {
      for (const row of rollupSnapshot.trafficRollups) {
        const key = dayKey(row.date);
        const bucket = trafficMap.get(key);
        if (bucket) {
          bucket.views += Number(row.eventCount || 0);
        }
      }

      for (const row of rollupSnapshot.metricRollups) {
        metricsMap.set(
          row.eventType,
          (metricsMap.get(row.eventType) || 0) + Number(row.eventCount || 0)
        );
      }

      monthlyVisitors = Number(rollupSnapshot.monthlyVisitors || 0);

      for (const row of rollupSnapshot.sourceRollups) {
        const label = sourceLabel(row.source);
        sourceTotals.set(label, (sourceTotals.get(label) || 0) + Number(row.eventCount || 0));
      }
    } else {
      const [trafficRows, sourceRows, metricGroups, visitorGroups] = await Promise.all([
        prisma.analyticsEvent.findMany({
          where: {
            photographerId,
            eventType: "PAGE_VIEW",
            createdAt: { gte: trafficStart },
          },
          select: { createdAt: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["source"],
          where: {
            photographerId,
            eventType: "PAGE_VIEW",
            createdAt: { gte: metricsStart },
          },
          _count: { _all: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["eventType"],
          where: {
            photographerId,
            createdAt: { gte: metricsStart },
          },
          _count: { _all: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["visitorId"],
          where: {
            photographerId,
            visitorId: { not: null },
            createdAt: { gte: metricsStart },
          },
        }),
      ]);

      for (const row of trafficRows) {
        const key = dayKey(row.createdAt);
        const bucket = trafficMap.get(key);
        if (bucket) {
          bucket.views += 1;
        }
      }

      for (const row of metricGroups) {
        metricsMap.set(row.eventType, Number(row._count?._all || 0));
      }

      monthlyVisitors = visitorGroups.length;

      for (const row of sourceRows) {
        const label = sourceLabel(row.source);
        sourceTotals.set(label, (sourceTotals.get(label) || 0) + Number(row._count?._all || 0));
      }
    }

    const portfolioViews = metricsMap.get("PORTFOLIO_VIEW") || 0;
    const packageViews = metricsMap.get("PACKAGE_VIEW") || 0;
    const serviceSelections = metricsMap.get("SERVICE_SELECT") || 0;
    const packageSelections = metricsMap.get("PACKAGE_SELECT") || 0;
    const whatsappClicks = metricsMap.get("WHATSAPP_CLICK") || 0;
    const inquiries = metricsMap.get("BOOKING_INTENT") || 0;
    const profileClicks = metricsMap.get("PROFILE_CLICK") || 0;
    const conversionRate = portfolioViews > 0 ? Number(((inquiries / portfolioViews) * 100).toFixed(2)) : 0;
    const packageSelectionRate = packageViews > 0 ? Number(((packageSelections / packageViews) * 100).toFixed(2)) : 0;
    const inquiryRateFromSelections = packageSelections > 0 ? Number(((inquiries / packageSelections) * 100).toFixed(2)) : 0;

    const serviceNameById = new Map(serviceCatalog.map((service) => [service.id, service.name]));
    const packageMetaById = new Map(packageCatalog.map((pkg) => [pkg.id, { name: pkg.name, serviceId: pkg.serviceId }]));

    const serviceAggregateMap = new Map();
    for (const row of serviceEventGroups) {
      if (!row?.serviceId) continue;
      if (!serviceAggregateMap.has(row.serviceId)) {
        serviceAggregateMap.set(row.serviceId, {
          serviceId: row.serviceId,
          name: serviceNameById.get(row.serviceId) || "Untitled service",
          portfolioViews: 0,
          packageViews: 0,
          serviceSelections: 0,
          packageSelections: 0,
          inquiries: 0,
          conversionRate: 0,
        });
      }

      const bucket = serviceAggregateMap.get(row.serviceId);
      const count = Number(row._count?._all || 0);
      if (row.eventType === "PORTFOLIO_VIEW") bucket.portfolioViews += count;
      if (row.eventType === "PACKAGE_VIEW") bucket.packageViews += count;
      if (row.eventType === "SERVICE_SELECT") bucket.serviceSelections += count;
      if (row.eventType === "PACKAGE_SELECT") bucket.packageSelections += count;
      if (row.eventType === "BOOKING_INTENT") bucket.inquiries += count;
    }

    const servicePerformance = Array.from(serviceAggregateMap.values())
      .map((item) => ({
        ...item,
        conversionRate:
          item.portfolioViews > 0
            ? Number(((item.inquiries / item.portfolioViews) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.inquiries - a.inquiries || b.packageViews - a.packageViews)
      .slice(0, 5);

    const packageAggregateMap = new Map();
    for (const row of packageEventGroups) {
      if (!row?.packageId) continue;
      if (!packageAggregateMap.has(row.packageId)) {
        const meta = packageMetaById.get(row.packageId);
        packageAggregateMap.set(row.packageId, {
          packageId: row.packageId,
          name: meta?.name || "Untitled package",
          serviceId: meta?.serviceId || null,
          packageViews: 0,
          packageSelections: 0,
          inquiries: 0,
          selectionRate: 0,
          inquiryRate: 0,
        });
      }

      const bucket = packageAggregateMap.get(row.packageId);
      const count = Number(row._count?._all || 0);
      if (row.eventType === "PACKAGE_VIEW") bucket.packageViews += count;
      if (row.eventType === "PACKAGE_SELECT") bucket.packageSelections += count;
      if (row.eventType === "BOOKING_INTENT") bucket.inquiries += count;
    }

    const packagePerformance = Array.from(packageAggregateMap.values())
      .map((item) => ({
        ...item,
        selectionRate: item.packageViews > 0 ? Number(((item.packageSelections / item.packageViews) * 100).toFixed(2)) : 0,
        inquiryRate: item.packageSelections > 0 ? Number(((item.inquiries / item.packageSelections) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.inquiries - a.inquiries || b.packageSelections - a.packageSelections)
      .slice(0, 5);

    const sourceFunnelMap = new Map();
    for (const row of sourceFunnelGroups) {
      const sourceKey = sourceLabel(row.source);
      if (!sourceFunnelMap.has(sourceKey)) {
        sourceFunnelMap.set(sourceKey, {
          source: sourceKey,
          pageViews: 0,
          portfolioViews: 0,
          packageViews: 0,
          packageSelections: 0,
          inquiries: 0,
          whatsappClicks: 0,
          viewToInquiryRate: 0,
        });
      }

      const bucket = sourceFunnelMap.get(sourceKey);
      const count = Number(row._count?._all || 0);
      if (row.eventType === "PAGE_VIEW") bucket.pageViews += count;
      if (row.eventType === "PORTFOLIO_VIEW") bucket.portfolioViews += count;
      if (row.eventType === "PACKAGE_VIEW") bucket.packageViews += count;
      if (row.eventType === "PACKAGE_SELECT") bucket.packageSelections += count;
      if (row.eventType === "BOOKING_INTENT") bucket.inquiries += count;
      if (row.eventType === "WHATSAPP_CLICK") bucket.whatsappClicks += count;
    }

    const sourceFunnelBreakdown = Array.from(sourceFunnelMap.values())
      .map((item) => ({
        ...item,
        viewToInquiryRate:
          item.portfolioViews > 0
            ? Number(((item.inquiries / item.portfolioViews) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.inquiries - a.inquiries || b.portfolioViews - a.portfolioViews)
      .slice(0, 6);

    const comparison = {
      portfolioViews: buildChangeSummary(portfolioViews, previousMetricsMap.get("PORTFOLIO_VIEW") || 0),
      packageViews: buildChangeSummary(packageViews, previousMetricsMap.get("PACKAGE_VIEW") || 0),
      packageSelections: buildChangeSummary(packageSelections, previousMetricsMap.get("PACKAGE_SELECT") || 0),
      inquiries: buildChangeSummary(inquiries, previousMetricsMap.get("BOOKING_INTENT") || 0),
      whatsappClicks: buildChangeSummary(whatsappClicks, previousMetricsMap.get("WHATSAPP_CLICK") || 0),
    };

    const inquiriesMonthToDate = Number(inquiriesMonthToDateRaw || 0);
    const currentDailyPace = Number((inquiriesMonthToDate / daysElapsedInMonth).toFixed(2));
    const projectedInquiries = Number((currentDailyPace * daysInMonth).toFixed(1));
    const savedGoalTargetRaw = Number(photographerRecord?.inquiryGoalTarget || 0);
    const savedGoalTarget = savedGoalTargetRaw > 0 ? savedGoalTargetRaw : null;
    const suggestedGoal = Math.max(5, Math.ceil(Math.max(projectedInquiries, inquiriesMonthToDate, 5) / 5) * 5);
    const activeGoalTarget = savedGoalTarget || suggestedGoal;
    const remainingForSuggestedGoal = Math.max(activeGoalTarget - inquiriesMonthToDate, 0);
    const daysRemainingInMonth = Math.max(daysInMonth - daysElapsedInMonth, 0);
    const requiredDailyRateToGoal = Number((remainingForSuggestedGoal / Math.max(daysRemainingInMonth, 1)).toFixed(2));
    const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

    const monthlyInquiriesMap = new Map();
    for (const row of monthlyInquiriesRows || []) {
      const bucketDate = new Date(row.monthBucket);
      const bucketKey = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, "0")}`;
      monthlyInquiriesMap.set(bucketKey, Number(row.inquiries || 0));
    }

    const history = Array.from({ length: goalHistoryMonths }, (_, index) => {
      const bucketDate = new Date(now.getFullYear(), now.getMonth() - (goalHistoryMonths - 1 - index), 1);
      const bucketKey = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, "0")}`;
      const inquiries = Number(monthlyInquiriesMap.get(bucketKey) || 0);
      const attainmentPercent = activeGoalTarget > 0 ? Number(((inquiries / activeGoalTarget) * 100).toFixed(1)) : 0;
      return {
        key: bucketKey,
        label: bucketDate.toLocaleString("en-US", { month: "short" }),
        monthLabel: bucketDate.toLocaleString("en-US", { month: "long", year: "numeric" }),
        inquiries,
        target: activeGoalTarget,
        attainmentPercent,
        achieved: inquiries >= activeGoalTarget,
        isCurrentMonth: index === goalHistoryMonths - 1,
      };
    });

    let currentStreak = 0;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (!history[index].achieved) break;
      currentStreak += 1;
    }

    let bestStreak = 0;
    let rollingStreak = 0;
    for (const item of history) {
      if (item.achieved) {
        rollingStreak += 1;
        if (rollingStreak > bestStreak) bestStreak = rollingStreak;
      } else {
        rollingStreak = 0;
      }
    }

    const totalMonthsAchieved = history.filter((item) => item.achieved).length;
    const badges = [
      { id: "goal_streak_3", label: "3-Month Streak", threshold: 3, earned: bestStreak >= 3 },
      { id: "goal_streak_6", label: "6-Month Streak", threshold: 6, earned: bestStreak >= 6 },
      { id: "goal_streak_12", label: "12-Month Streak", threshold: 12, earned: bestStreak >= 12 },
    ];

    const sourceBreakdown = Array.from(sourceTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        id: "source-" + (index + 1),
        name,
        value,
      }));

    const rankedCategorySeries = rankCategorySeries(categorySeries);
    const previewTopCategories = rankedCategorySeries.slice(0, 3).map((item, index) => ({
      name: item.name,
      rank: index + 1,
    }));

    return {
      photographerId,
      access,
      stats: {
        portfolioViews,
        packageViews,
        serviceSelections,
        packageSelections,
        profileClicks: access.hasFullAccess ? profileClicks : null,
        whatsappClicks,
        inquiries,
        packageSelectionRate: access.hasFullAccess ? packageSelectionRate : null,
        inquiryRateFromSelections: access.hasFullAccess ? inquiryRateFromSelections : null,
        conversionRate: access.hasFullAccess ? conversionRate : null,
        monthlyVisitors: access.hasFullAccess ? monthlyVisitors : null,
      },
      trafficSeries: trafficBuckets.map(({ key: _key, ...rest }) => rest),
      categorySeries: access.hasFullAccess ? rankedCategorySeries : [],
      sourceBreakdown: access.hasFullAccess ? sourceBreakdown : [],
      comparison: access.hasFullAccess ? comparison : null,
      funnel: {
        portfolioViews,
        packageViews,
        packageSelections,
        inquiries,
        whatsappClicks,
        viewToInquiryRate: access.hasFullAccess ? conversionRate : null,
        selectionToInquiryRate: access.hasFullAccess ? inquiryRateFromSelections : null,
      },
      servicePerformance: access.hasFullAccess ? servicePerformance : [],
      packagePerformance: access.hasFullAccess ? packagePerformance : [],
      sourceFunnelBreakdown: access.hasFullAccess ? sourceFunnelBreakdown : [],
      goalTracker: {
        locked: !access.hasFullAccess,
        monthLabel,
        inquiriesMonthToDate,
        daysElapsedInMonth,
        daysInMonth,
        daysRemainingInMonth,
        currentDailyPace,
        projectedInquiries,
        savedGoalTarget,
        suggestedGoal,
        requiredDailyRateToGoal,
        onTrackForSuggestedGoal: projectedInquiries >= activeGoalTarget,
        history,
        streak: {
          current: currentStreak,
          best: bestStreak,
          totalMonthsAchieved,
        },
        badges,
      },
      preview: {
        trafficWindowDays: trafficDays,
        metricsWindowDays: metricsDays,
        contactActions: whatsappClicks + inquiries,
        topSource: sourceBreakdown[0]?.name || null,
        sourceCount: sourceBreakdown.length,
        topCategories: previewTopCategories,
        totalCategoriesTracked: rankedCategorySeries.length,
      },
    };
  },

  async updateAnalyticsGoal(tenant, payload = {}) {
    const photographerId = requireTenantPhotographerId(tenant);
    const nextGoal = Math.floor(Number(payload?.inquiryGoalTarget || 0));

    const updated = await prisma.photographer.update({
      where: { id: photographerId },
      data: {
        inquiryGoalTarget: nextGoal,
      },
      select: {
        inquiryGoalTarget: true,
      },
    });

    return {
      inquiryGoalTarget: Number(updated.inquiryGoalTarget || 0),
    };
  },

  async analyticsActivity(tenant, query) {
    const photographerId = requireTenantPhotographerId(tenant);
    const plan = await planLimitService.getPlanByPhotographerId(photographerId);
    const access = buildAnalyticsAccess(plan);
    const { page, limit, skip, take } = getPagination(query);
    const visibleLimit = access.hasFullAccess ? take : FREE_ANALYTICS_ACTIVITY_PREVIEW_LIMIT;
    const visibleSkip = access.hasFullAccess ? skip : 0;

    const scoped = applyTenantFilter({}, tenant);
    const activityWhere = scoped.where
      ? { AND: [scoped.where, { eventType: { not: "OTHER" } }] }
      : { eventType: { not: "OTHER" } };
    const [items, total] = await Promise.all([
      prisma.analyticsEvent.findMany({
        ...scoped,
        where: activityWhere,
        skip: visibleSkip,
        take: visibleLimit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.analyticsEvent.count({ where: activityWhere }),
    ]);

    return {
      access,
      items: items.map((item) => ({
        at: item.createdAt,
        action: item.eventType,
        portfolio: item.portfolioItemId,
        source: item.source,
      })),
      pagination: access.hasFullAccess ? buildPagination(page, limit, total) : buildPagination(1, visibleLimit, total),
      preview: {
        shownCount: items.length,
        hiddenCount: access.hasFullAccess ? 0 : Math.max(total - items.length, 0),
        totalTrackedEvents: total,
      },
    };
  },
};
