import { prisma } from "../../config/prisma.js";
import { getPagination, buildPagination } from "../../utils/pagination.js";
import { PLAN_TIERS } from "./adminService.constants.js";
import {
  addMonths,
  buildMonthlySeries,
  centsToAmount,
  parseWindowSize,
  startOfMonth,
  toPlanTier,
} from "./adminService.utils.js";

export const adminRevenueService = {
  async revenueOverview() {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [mrr, ytd, subscriptionRevenue, successCount, totalCount, activeSubscriptions, totalsByStatus] =
      await Promise.all([
        prisma.transaction.aggregate({
          where: {
            status: "SUCCEEDED",
            createdAt: { gte: currentMonthStart },
          },
          _sum: { amountCents: true },
        }),
        prisma.transaction.aggregate({
          where: {
            status: "SUCCEEDED",
            createdAt: { gte: yearStart },
          },
          _sum: { amountCents: true },
        }),
        prisma.transaction.aggregate({
          where: {
            status: "SUCCEEDED",
            subscriptionId: { not: null },
            createdAt: { gte: yearStart },
          },
          _sum: { amountCents: true },
        }),
        prisma.transaction.count({ where: { status: "SUCCEEDED" } }),
        prisma.transaction.count(),
        prisma.subscription.count({ where: { status: "ACTIVE" } }),
        prisma.transaction.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
      ]);

    const transactionTotals = {
      total: totalCount,
      succeeded: 0,
      failed: 0,
      pending: 0,
      refunded: 0,
      canceled: 0,
    };

    for (const row of totalsByStatus) {
      const key = row.status.toLowerCase();
      if (transactionTotals[key] !== undefined) {
        transactionTotals[key] = Number(row._count._all || 0);
      }
    }

    return {
      mrr: centsToAmount(mrr._sum.amountCents),
      successRate: totalCount ? (successCount / totalCount) * 100 : 0,
      ytdRevenue: centsToAmount(ytd._sum.amountCents),
      activeSubscriptions,
      subscriptionRevenue: centsToAmount(subscriptionRevenue._sum.amountCents),
      transactionTotals,
    };
  },

  async monthlyRevenue(query = {}) {
    const now = new Date();
    const months = parseWindowSize(query.months, 6);
    const seriesStart = addMonths(startOfMonth(now), -(months - 1));

    const rows = await prisma.transaction.findMany({
      where: {
        status: "SUCCEEDED",
        createdAt: { gte: seriesStart },
      },
      select: {
        createdAt: true,
        amountCents: true,
      },
    });

    return {
      series: buildMonthlySeries(rows, {
        start: seriesStart,
        months,
        getDate: (row) => row.createdAt,
        getValue: (row) => centsToAmount(row.amountCents),
        valueKey: "revenue",
      }),
    };
  },

  async revenueByPlan(query = {}) {
    const now = new Date();
    const months = parseWindowSize(query.months, 12, 36);
    const seriesStart = addMonths(startOfMonth(now), -(months - 1));

    const rows = await prisma.$queryRaw`
      SELECT
        CASE
          WHEN COALESCE(s."plan", ls."plan", 'FREE') IN ('FREE', 'PRO', 'STUDIO')
            THEN COALESCE(s."plan", ls."plan", 'FREE')
          ELSE 'FREE'
        END AS "plan",
        COALESCE(SUM(t."amountCents"), 0)::bigint AS "amountCents"
      FROM "Transaction" t
      LEFT JOIN "Subscription" s
        ON s."id" = t."subscriptionId"
      LEFT JOIN LATERAL (
        SELECT sx."plan"
        FROM "Subscription" sx
        WHERE sx."userId" = t."userId"
        ORDER BY sx."createdAt" DESC
        LIMIT 1
      ) ls ON TRUE
      WHERE t."status" = 'SUCCEEDED'
        AND t."createdAt" >= ${seriesStart}
      GROUP BY 1
    `;

    const totalsByPlan = { FREE: 0, PRO: 0, STUDIO: 0 };
    for (const row of rows) {
      const plan = toPlanTier(row?.plan);
      totalsByPlan[plan] += centsToAmount(Number(row?.amountCents || 0));
    }

    return {
      items: PLAN_TIERS.map((plan) => ({
        plan,
        revenue: Number(totalsByPlan[plan].toFixed(2)),
      })),
    };
  },

  async revenueTransactions(query) {
    const { page, limit, skip, take } = getPagination(query);
    const status = query.status ? String(query.status).toUpperCase() : null;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          subscription: {
            select: {
              plan: true,
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((tx) => ({
        id: tx.id,
        photographer: tx.user?.fullName || tx.userId || "Unknown",
        plan: tx.subscription?.plan || null,
        amount: centsToAmount(tx.amountCents),
        status: tx.status.toLowerCase(),
        date: tx.createdAt,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },
};

