import { prisma } from "../../config/prisma.js";
import { getPagination, buildPagination } from "../../utils/pagination.js";

export const adminReferralsService = {
  async referralsOverview() {
    const [totalReferrals, conversions, recent, repeatVisitors] = await Promise.all([
      prisma.referral.count(),
      prisma.referral.count({ where: { status: { in: ["CONVERTED", "REWARDED"] } } }),
      prisma.referral.findMany({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
          },
        },
        select: {
          createdAt: true,
          status: true,
        },
      }),
      prisma.referral.groupBy({
        by: ["visitorId"],
        where: {
          visitorId: { not: null },
          status: "CLICKED",
        },
        _count: {
          visitorId: true,
        },
      }),
    ]);

    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      return {
        key,
        month: date.toLocaleString("en-US", { month: "short" }),
        referrals: 0,
        conversions: 0,
      };
    });
    const bucketMap = new Map(buckets.map((item) => [item.key, item]));

    for (const row of recent) {
      const created = new Date(row.createdAt);
      const key = `${created.getFullYear()}-${created.getMonth() + 1}`;
      const target = bucketMap.get(key);
      if (!target) continue;

      target.referrals += 1;
      if (["CONVERTED", "REWARDED"].includes(row.status)) {
        target.conversions += 1;
      }
    }

    return {
      stats: {
        totalReferrals,
        conversions,
        repeatVisitorClicks: repeatVisitors.filter((item) => Number(item._count.visitorId || 0) > 1).length,
      },
      growthSeries: buckets.map(({ month, referrals, conversions }) => ({
        month,
        referrals,
        conversions,
      })),
    };
  },

  async topReferrers(query) {
    const { page, limit, skip, take } = getPagination(query);
    const [groups, allReferrers] = await Promise.all([
      prisma.referral.groupBy({
        by: ["referrerUserId"],
        _count: { referrerUserId: true },
        _sum: { rewardCents: true },
        orderBy: { _count: { referrerUserId: "desc" } },
        skip,
        take,
      }),
      prisma.referral.groupBy({
        by: ["referrerUserId"],
      }),
    ]);

    const referrerIds = groups.map((g) => g.referrerUserId);
    const conversionGroups =
      referrerIds.length > 0
        ? await prisma.referral.groupBy({
            by: ["referrerUserId"],
            where: {
              referrerUserId: { in: referrerIds },
              status: { in: ["CONVERTED", "REWARDED"] },
            },
            _count: { referrerUserId: true },
          })
        : [];
    const conversionMap = new Map(
      conversionGroups.map((item) => [item.referrerUserId, Number(item._count.referrerUserId || 0)])
    );

    return {
      items: groups.map((g) => ({
        userId: g.referrerUserId,
        referrals: Number(g._count.referrerUserId || 0),
        conversions: conversionMap.get(g.referrerUserId) || 0,
        conversionRate: Number(g._count.referrerUserId || 0)
          ? Number(
              (
                ((conversionMap.get(g.referrerUserId) || 0) / Number(g._count.referrerUserId || 0)) *
                100
              ).toFixed(2)
            )
          : 0,
        rewardEarned: (g._sum.rewardCents || 0) / 100,
      })),
      pagination: buildPagination(page, limit, allReferrers.length),
    };
  },
};

