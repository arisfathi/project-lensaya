import { prisma } from "../../config/prisma.js";
import { PLAN_TIERS } from "./adminService.constants.js";
import {
  addMonths,
  buildMonthlySeries,
  centsToAmount,
  mapUserPlan,
  parseWindowSize,
  startOfMonth,
} from "./adminService.utils.js";

export const adminDashboardService = {
  async dashboardOverview(query = {}) {
    const now = new Date();
    const months = parseWindowSize(query.months, 6);
    const currentMonthStart = startOfMonth(now);
    const seriesStart = addMonths(currentMonthStart, -(months - 1));

    const [
      totalUsers,
      totalPhotographers,
      activePhotographers,
      totalBookings,
      totalRevenueCents,
      monthlyRevenueCents,
      activeSubscriptions,
      totalImagesStored,
      totalStorageBytes,
      photographerUsers,
      recentUsers,
      photographerGrowthRows,
      userGrowthRows,
      uploadRows,
      revenueRows,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.photographer.count(),
      prisma.photographer.count({ where: { status: "ACTIVE" } }),
      prisma.booking.count(),
      prisma.transaction.aggregate({
        where: { status: "SUCCEEDED" },
        _sum: { amountCents: true },
      }),
      prisma.transaction.aggregate({
        where: {
          status: "SUCCEEDED",
          createdAt: { gte: currentMonthStart },
        },
        _sum: { amountCents: true },
      }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.asset.count({ where: { type: "IMAGE", status: "READY" } }),
      prisma.asset.aggregate({
        where: { status: "READY" },
        _sum: { sizeBytes: true },
      }),
      prisma.user.findMany({
        where: { role: "PHOTOGRAPHER" },
        select: {
          id: true,
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { plan: true },
          },
        },
      }),
      prisma.user.findMany({
        where: { role: "PHOTOGRAPHER" },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          fullName: true,
          username: true,
          status: true,
          photographer: {
            select: {
              id: true,
              username: true,
              studioName: true,
            },
          },
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { plan: true },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          role: "PHOTOGRAPHER",
          createdAt: { gte: seriesStart },
        },
        select: { createdAt: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: seriesStart } },
        select: { createdAt: true },
      }),
      prisma.asset.findMany({
        where: {
          type: "IMAGE",
          status: "READY",
          createdAt: { gte: seriesStart },
        },
        select: { createdAt: true },
      }),
      prisma.transaction.findMany({
        where: {
          status: "SUCCEEDED",
          createdAt: { gte: seriesStart },
        },
        select: {
          createdAt: true,
          amountCents: true,
        },
      }),
    ]);

    const recentPhotographerIds = recentUsers.map((user) => user.photographer?.id).filter(Boolean);

    const recentImageCounts =
      recentPhotographerIds.length > 0
        ? await prisma.asset.groupBy({
            by: ["photographerId"],
            where: {
              photographerId: { in: recentPhotographerIds },
              type: "IMAGE",
              status: "READY",
            },
            _count: { _all: true },
          })
        : [];

    const imageCountByPhotographerId = new Map(
      recentImageCounts.map((row) => [row.photographerId, Number(row._count._all || 0)])
    );

    const planStats = { FREE: 0, PRO: 0, STUDIO: 0 };
    for (const user of photographerUsers) {
      const plan = mapUserPlan(user.subscriptions[0]);
      if (planStats[plan] === undefined) {
        planStats.FREE += 1;
        continue;
      }

      planStats[plan] += 1;
    }

    return {
      stats: {
        totalUsers,
        totalPhotographers,
        activePhotographers,
        totalBookings,
        totalRevenue: centsToAmount(totalRevenueCents._sum.amountCents),
        monthlyRevenue: centsToAmount(monthlyRevenueCents._sum.amountCents),
        activeSubscriptions,
        storageUsage: totalStorageBytes._sum.sizeBytes || 0,
        totalImagesStored,
      },
      growthSeries: buildMonthlySeries(photographerGrowthRows, {
        start: seriesStart,
        months,
        getDate: (row) => row.createdAt,
        getValue: () => 1,
        valueKey: "photographers",
      }),
      revenueSeries: buildMonthlySeries(revenueRows, {
        start: seriesStart,
        months,
        getDate: (row) => row.createdAt,
        getValue: (row) => centsToAmount(row.amountCents),
        valueKey: "revenue",
      }),
      userSeries: buildMonthlySeries(userGrowthRows, {
        start: seriesStart,
        months,
        getDate: (row) => row.createdAt,
        getValue: () => 1,
        valueKey: "users",
      }),
      planDistribution: PLAN_TIERS.map((plan) => ({
        plan,
        count: planStats[plan] || 0,
      })),
      uploadsSeries: buildMonthlySeries(uploadRows, {
        start: seriesStart,
        months,
        getDate: (row) => row.createdAt,
        getValue: () => 1,
        valueKey: "uploads",
      }),
      recentPhotographers: recentUsers.map((user) => ({
        id: user.id,
        name: user.photographer?.studioName || user.fullName,
        username: user.photographer?.username || user.username,
        plan: mapUserPlan(user.subscriptions[0]),
        status: user.status,
        imagesStored: user.photographer?.id ? imageCountByPhotographerId.get(user.photographer.id) || 0 : 0,
      })),
    };
  },
};

