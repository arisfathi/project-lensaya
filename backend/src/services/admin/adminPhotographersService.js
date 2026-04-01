import { prisma } from "../../config/prisma.js";
import { getPagination, buildPagination } from "../../utils/pagination.js";
import { ApiError } from "../../utils/apiError.js";
import { PLAN_TIERS } from "./adminService.constants.js";
import { buildPhotographerUserWhereSql, csvEscape, mapUserPlan, toPlanTier } from "./adminService.utils.js";

export const adminPhotographersService = {
  async listPhotographers(query) {
    const { page, limit, skip, take } = getPagination(query);

    const whereUser = {
      role: "PHOTOGRAPHER",
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { username: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),
    };

    const userWhereSql = buildPhotographerUserWhereSql({
      search: query.search,
      status: query.status,
    });

    const planCountsRows = await prisma.$queryRaw`
      SELECT
        COALESCE(ls."plan", 'FREE') AS "plan",
        COUNT(*)::bigint AS "count"
      FROM "User" u
      LEFT JOIN LATERAL (
        SELECT s."plan"
        FROM "Subscription" s
        WHERE s."userId" = u."id"
        ORDER BY s."createdAt" DESC
        LIMIT 1
      ) ls ON TRUE
      WHERE ${userWhereSql}
      GROUP BY COALESCE(ls."plan", 'FREE')
    `;

    const countsByPlan = { FREE: 0, PRO: 0, STUDIO: 0 };
    for (const row of planCountsRows) {
      const plan = toPlanTier(row?.plan);
      countsByPlan[plan] += Number(row?.count || 0);
    }

    let users = [];
    let total = 0;

    const requestedPlan = String(query.plan || "").trim().toUpperCase();
    if (requestedPlan) {
      if (!PLAN_TIERS.includes(requestedPlan)) {
        return {
          items: [],
          pagination: buildPagination(page, limit, 0),
          countsByPlan,
        };
      }

      const [pagedRows, totalRows] = await Promise.all([
        prisma.$queryRaw`
          SELECT u."id"
          FROM "User" u
          LEFT JOIN LATERAL (
            SELECT s."plan"
            FROM "Subscription" s
            WHERE s."userId" = u."id"
            ORDER BY s."createdAt" DESC
            LIMIT 1
          ) ls ON TRUE
          WHERE ${userWhereSql}
            AND COALESCE(ls."plan", 'FREE') = ${requestedPlan}
          ORDER BY u."createdAt" DESC
          OFFSET ${skip}
          LIMIT ${take}
        `,
        prisma.$queryRaw`
          SELECT COUNT(*)::bigint AS "count"
          FROM "User" u
          LEFT JOIN LATERAL (
            SELECT s."plan"
            FROM "Subscription" s
            WHERE s."userId" = u."id"
            ORDER BY s."createdAt" DESC
            LIMIT 1
          ) ls ON TRUE
          WHERE ${userWhereSql}
            AND COALESCE(ls."plan", 'FREE') = ${requestedPlan}
        `,
      ]);

      const orderedIds = pagedRows.map((row) => row.id).filter(Boolean);
      total = Number(totalRows?.[0]?.count || 0);

      if (orderedIds.length > 0) {
        const records = await prisma.user.findMany({
          where: { id: { in: orderedIds } },
          include: {
            photographer: {
              include: {
                avatarAsset: {
                  select: { cdnUrl: true },
                },
              },
            },
            subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        });

        const byId = new Map(records.map((row) => [row.id, row]));
        users = orderedIds.map((id) => byId.get(id)).filter(Boolean);
      }
    } else {
      [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereUser,
          skip,
          take,
          include: {
            photographer: {
              include: {
                avatarAsset: {
                  select: { cdnUrl: true },
                },
              },
            },
            subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.user.count({ where: whereUser }),
      ]);
    }

    const photographerIds = users.map((user) => user.photographer?.id).filter(Boolean);
    const [portfolioCounts, readyImageCounts] =
      photographerIds.length > 0
        ? await Promise.all([
            prisma.portfolioItem.groupBy({
              by: ["photographerId"],
              where: {
                photographerId: { in: photographerIds },
              },
              _count: { _all: true },
            }),
            prisma.asset.groupBy({
              by: ["photographerId"],
              where: {
                photographerId: { in: photographerIds },
                type: "IMAGE",
                status: "READY",
              },
              _count: { _all: true },
            }),
          ])
        : [[], []];

    const portfolioCountByPhotographerId = new Map(
      portfolioCounts.map((row) => [row.photographerId, Number(row._count._all || 0)])
    );
    const imageCountByPhotographerId = new Map(
      readyImageCounts.map((row) => [row.photographerId, Number(row._count._all || 0)])
    );

    const items = users.map((user) => ({
      id: user.id,
      name: user.fullName,
      username: user.photographer?.username || user.username,
      avatarUrl: user.photographer?.avatarAsset?.cdnUrl || null,
      plan: mapUserPlan(user.subscriptions[0]),
      status: user.status,
      portfolioCount: user.photographer?.id
        ? portfolioCountByPhotographerId.get(user.photographer.id) || 0
        : 0,
      imagesStored: user.photographer?.id ? imageCountByPhotographerId.get(user.photographer.id) || 0 : 0,
      joinDate: user.createdAt,
      lastActive: user.lastLoginAt,
    }));

    return {
      items,
      pagination: buildPagination(page, limit, total),
      countsByPlan,
    };
  },

  async photographerDetail(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        photographer: true,
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!user) throw new ApiError(404, "Photographer not found");

    const photographerId = user.photographer?.id || null;
    const [storage, activity] =
      photographerId
        ? await Promise.all([
            prisma.asset.aggregate({
              where: {
                photographerId,
                type: "IMAGE",
                status: "READY",
              },
              _sum: { sizeBytes: true },
              _count: { _all: true },
            }),
            Promise.all([
              prisma.portfolioItem.count({ where: { photographerId } }),
              prisma.booking.count({ where: { photographerId } }),
              prisma.analyticsEvent.count({
                where: {
                  photographerId,
                  eventType: "PORTFOLIO_VIEW",
                },
              }),
            ]),
          ])
        : [
            { _sum: { sizeBytes: 0 }, _count: { _all: 0 } },
            [0, 0, 0],
          ];

    const [portfolioCount, bookingCount, portfolioViews] = activity;

    return {
      photographer: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        username: user.photographer?.username || user.username,
        status: user.status,
      },
      subscription: user.subscriptions[0] || null,
      storage: {
        totalBytes: storage._sum.sizeBytes || 0,
        imageCount: storage._count._all || 0,
      },
      activity: {
        portfolioCount,
        bookingCount,
        portfolioViews,
        lastActive: user.lastLoginAt,
      },
    };
  },

  async exportPhotographers(query = {}) {
    const exportLimit = 100;
    const maxPages = 200;
    let page = 1;
    let totalPages = 1;
    const allItems = [];

    do {
      const result = await this.listPhotographers({
        ...query,
        page,
        limit: exportLimit,
      });
      allItems.push(...(result.items || []));
      totalPages = Number(result.pagination?.totalPages || 1);
      page += 1;
    } while (page <= totalPages && page <= maxPages);

    const headers = [
      "Photographer",
      "Username",
      "Plan",
      "Status",
      "Portfolios",
      "Images",
      "Joined",
      "Last Active",
    ];

    const rows = allItems.map((item) => [
      item.name || "",
      item.username || "",
      item.plan || "",
      item.status || "",
      Number(item.portfolioCount || 0),
      Number(item.imagesStored || 0),
      item.joinDate ? new Date(item.joinDate).toISOString() : "",
      item.lastActive ? new Date(item.lastActive).toISOString() : "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => csvEscape(value)).join(","))
      .join("\r\n");

    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `photographers-${stamp}.csv`;
    const downloadUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

    return {
      downloadUrl,
      fileName,
      count: rows.length,
      filters: {
        search: query.search || null,
        plan: query.plan || null,
        status: query.status || null,
      },
    };
  },
};

