import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/apiError.js";
import { planLimitService } from "../planLimitService.js";
import {
  addDays,
  buildAnalyticsAccess,
  dayKey,
  getPortfolioViewCategorySeries,
  loadAnalyticsRollupSnapshot,
  rankCategorySeries,
  startOfDay,
} from "./photographerService.utils.js";

const getPhotographerByUserId = async (userId) => {
  const photographer = await prisma.photographer.findUnique({ where: { userId } });
  if (!photographer) throw new ApiError(404, "Photographer profile not found");
  return photographer;
};

export const photographerDashboardService = {
  async dashboardOverview(userId) {
    const photographer = await getPhotographerByUserId(userId);
    const plan = await planLimitService.getPlanByUserId(userId);
    const entitlements = planLimitService.toEntitlements(plan);
    const analyticsAccess = buildAnalyticsAccess(plan);
    const now = new Date();
    const trafficDays = 7;
    const metricsDays = 30;
    const trafficStart = addDays(startOfDay(now), -(trafficDays - 1));
    const metricsStart = addDays(startOfDay(now), -(metricsDays - 1));

    const [portfolioCount, serviceCount, packageCount, bookingCount, categorySeries, packagesPerServiceUsage] =
      await Promise.all([
        prisma.portfolioItem.count({ where: { photographerId: photographer.id } }),
        prisma.service.count({
          where: {
            photographerId: photographer.id,
            status: { not: "ARCHIVED" },
          },
        }),
        prisma.package.count({
          where: {
            photographerId: photographer.id,
            status: { not: "ARCHIVED" },
          },
        }),
        prisma.booking.count({ where: { photographerId: photographer.id } }),
        getPortfolioViewCategorySeries(photographer.id, metricsStart),
        planLimitService.getPackagesPerServiceUsage(
          photographer.id,
          entitlements?.limits?.maxPackagesPerService
        ),
      ]);

    const [storageUsage] = await Promise.all([
      prisma.asset.aggregate({
        where: {
          photographerId: photographer.id,
          status: "READY",
          deletedAt: null,
        },
        _sum: { sizeBytes: true },
      }),
    ]);

    const storageUsedBytes = Number(storageUsage?._sum?.sizeBytes || 0);
    const storageUsedGb = Number((storageUsedBytes / (1024 * 1024 * 1024)).toFixed(3));

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
    let monthlyVisitors = 0;

    const rollupSnapshot = await loadAnalyticsRollupSnapshot({
      photographerId: photographer.id,
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
    } else {
      const [trafficRows, metricGroups, visitorGroups] = await Promise.all([
        prisma.analyticsEvent.findMany({
          where: {
            photographerId: photographer.id,
            eventType: "PAGE_VIEW",
            createdAt: { gte: trafficStart },
          },
          select: { createdAt: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["eventType"],
          where: {
            photographerId: photographer.id,
            createdAt: { gte: metricsStart },
          },
          _count: { _all: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["visitorId"],
          where: {
            photographerId: photographer.id,
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
    }

    const portfolioViews = metricsMap.get("PORTFOLIO_VIEW") || 0;
    const inquiries = metricsMap.get("BOOKING_INTENT") || 0;
    const conversionRate = portfolioViews > 0 ? Number(((inquiries / portfolioViews) * 100).toFixed(2)) : 0;
    const rankedCategorySeries = rankCategorySeries(categorySeries);
    const previewTopCategories = rankedCategorySeries.slice(0, 3).map((item, index) => ({
      name: item.name,
      rank: index + 1,
    }));

    return {
      photographerId: photographer.id,
      stats: {
        portfolioViews,
        profileClicks: metricsMap.get("PROFILE_CLICK") || 0,
        whatsappClicks: metricsMap.get("WHATSAPP_CLICK") || 0,
        inquiries,
        conversionRate,
        monthlyTraffic: monthlyVisitors,
      },
      trafficSeries: trafficBuckets.map(({ key: _key, ...rest }) => rest),
      categorySeries: analyticsAccess.hasFullAccess ? rankedCategorySeries : [],
      analyticsAccess,
      analyticsPreview: {
        topCategories: previewTopCategories,
        totalCategoriesTracked: rankedCategorySeries.length,
      },
      quickCounts: {
        portfolioCount,
        serviceCount,
        packageCount,
        bookingCount,
      },
      plan: {
        name: plan.name,
        price: Number(plan.price || 0),
        currency: plan.currency,
        trialDays: plan.trialDays,
      },
      usage: {
        services: { used: serviceCount, limit: entitlements?.limits?.maxServices },
        packages: {
          used: packageCount,
          limit: entitlements?.limits?.maxPackagesPerService,
        },
        packagesPerService: packagesPerServiceUsage,
        portfolioImages: {
          used: portfolioCount,
          limit: entitlements?.limits?.maxPortfolioImages,
        },
        storage: {
          used: storageUsedGb,
          usedBytes: storageUsedBytes,
          limit: entitlements?.limits?.storageGb,
        },
        leads: {
          used: bookingCount,
          limit: entitlements?.limits?.leadVisibilityLimit,
        },
      },
    };
  },

  async websiteSummary(userId) {
    const photographer = await getPhotographerByUserId(userId);

    const [portfolioCount, serviceCount, packageCount] = await Promise.all([
      prisma.portfolioItem.count({ where: { photographerId: photographer.id } }),
      prisma.service.count({ where: { photographerId: photographer.id } }),
      prisma.package.count({ where: { photographerId: photographer.id } }),
    ]);

    return {
      websiteUrl: photographer.websiteUrl || `${photographer.username}.${env.publicAppDomain}`,
      portfolioCount,
      serviceCount,
      packageCount,
      lastUpdated: photographer.updatedAt,
    };
  },
};
