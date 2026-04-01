import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { redisCache } from "../../utils/redisCache.js";
import { getPagination, buildPagination } from "../../utils/pagination.js";
import { planLimitService } from "../planLimitService.js";
import {
  ADMIN_STORAGE_R2_CACHE_KEY,
  ADMIN_STORAGE_R2_CACHE_TTL_SECONDS,
  ADMIN_STORAGE_R2_SNAPSHOT_KEY,
  PLAN_TIERS,
  R2_UPLOADS_PREFIX,
} from "./adminService.constants.js";
import { addMonths, monthKey, parseWindowSize, startOfMonth, toPlanTier } from "./adminService.utils.js";

export const adminStorageService = {
  async storageOverview() {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const previousMonthStart = addMonths(currentMonthStart, -1);

    const neonSizePromise = prisma.$queryRaw`
      SELECT pg_database_size(current_database())::bigint AS "sizeBytes"
    `.catch(() => []);

    const [totalStorage, totalImages, users, currentMonthGrowth, previousMonthGrowth, neonSizeRows] =
      await Promise.all([
        prisma.asset.aggregate({ where: { status: "READY" }, _sum: { sizeBytes: true } }),
        prisma.asset.count({ where: { type: "IMAGE", status: "READY" } }),
        prisma.photographer.count(),
        prisma.asset.aggregate({
          where: {
            status: "READY",
            createdAt: { gte: currentMonthStart },
          },
          _sum: { sizeBytes: true },
        }),
        prisma.asset.aggregate({
          where: {
            status: "READY",
            createdAt: { gte: previousMonthStart, lt: currentMonthStart },
          },
          _sum: { sizeBytes: true },
        }),
        neonSizePromise,
      ]);

    const totalBytes = Number(totalStorage._sum.sizeBytes || 0);
    const rawNeonBytes = neonSizeRows?.[0]?.sizeBytes;
    const parsedNeonBytes = rawNeonBytes === undefined || rawNeonBytes === null ? null : Number(rawNeonBytes);
    const neonDatabaseSizeBytes = Number.isFinite(parsedNeonBytes) && parsedNeonBytes >= 0 ? parsedNeonBytes : null;
    const monthlyGrowth =
      Number(currentMonthGrowth._sum.sizeBytes || 0) - Number(previousMonthGrowth._sum.sizeBytes || 0);

    return {
      totalStorage,
      totalImages,
      avgPerUser: users ? totalBytes / users : 0,
      monthlyGrowth,
      neonDatabaseSizeBytes,
    };
  },

  async storageR2Overview() {
    const dbUsage = await prisma.asset.aggregate({
      where: { status: "READY" },
      _sum: { sizeBytes: true },
      _count: { _all: true },
    });

    const dbReadyBytes = Number(dbUsage._sum.sizeBytes || 0);
    const dbReadyObjects = Number(dbUsage._count._all || 0);
    const bucket = env.r2.bucket || null;

    const [cachedSnapshot, persistedSnapshot] = await Promise.all([
      redisCache.getJson(ADMIN_STORAGE_R2_CACHE_KEY),
      prisma.platformSetting.findUnique({
        where: { key: ADMIN_STORAGE_R2_SNAPSHOT_KEY },
        select: { value: true, updatedAt: true },
      }),
    ]);

    const snapshot =
      (cachedSnapshot && typeof cachedSnapshot === "object" ? cachedSnapshot : null) ||
      (persistedSnapshot?.value && typeof persistedSnapshot.value === "object" ? persistedSnapshot.value : null);

    const response = {
      configured: Boolean(bucket),
      connected: snapshot?.connected ?? null,
      bucket,
      prefix: R2_UPLOADS_PREFIX,
      totalBytes: Number(snapshot?.totalBytes || 0),
      totalObjects: Number(snapshot?.totalObjects || 0),
      dbReadyBytes,
      dbReadyObjects,
      deltaBytes: typeof snapshot?.totalBytes === "number" ? Number(snapshot.totalBytes) - dbReadyBytes : null,
      truncated: Boolean(snapshot?.truncated),
      lastSyncedAt:
        snapshot?.lastSyncedAt ||
        (persistedSnapshot?.updatedAt ? new Date(persistedSnapshot.updatedAt).toISOString() : null),
      message:
        snapshot?.message ||
        "R2 usage snapshot is precomputed; run the storage reconciliation worker/job to refresh it.",
    };

    await redisCache.setJson(ADMIN_STORAGE_R2_CACHE_KEY, response, ADMIN_STORAGE_R2_CACHE_TTL_SECONDS);
    return response;
  },

  async storageByPlan() {
    const rows = await prisma.$queryRaw`
      SELECT
        CASE
          WHEN COALESCE(ls."plan", 'FREE') IN ('FREE', 'PRO', 'STUDIO')
            THEN COALESCE(ls."plan", 'FREE')
          ELSE 'FREE'
        END AS "plan",
        COALESCE(SUM(a."sizeBytes"), 0)::bigint AS "usage"
      FROM "Photographer" p
      JOIN "User" u
        ON u."id" = p."userId"
      LEFT JOIN LATERAL (
        SELECT s."plan"
        FROM "Subscription" s
        WHERE s."userId" = u."id"
        ORDER BY s."createdAt" DESC
        LIMIT 1
      ) ls ON TRUE
      LEFT JOIN "Asset" a
        ON a."photographerId" = p."id"
       AND a."status" = 'READY'
      GROUP BY 1
    `;

    const usageByPlan = { FREE: 0, PRO: 0, STUDIO: 0 };
    for (const row of rows) {
      const plan = toPlanTier(row?.plan);
      usageByPlan[plan] += Number(row?.usage || 0);
    }

    return {
      items: PLAN_TIERS.map((plan) => ({
        plan,
        usage: usageByPlan[plan],
      })),
    };
  },

  async storageUploads(query = {}) {
    const now = new Date();
    const months = parseWindowSize(query.months, 6);
    const seriesStart = addMonths(startOfMonth(now), -(months - 1));

    const rows = await prisma.$queryRaw`
      SELECT
        date_trunc('month', a."createdAt") AS "monthBucket",
        COUNT(*)::bigint AS "uploads"
      FROM "Asset" a
      WHERE a."type" = 'IMAGE'
        AND a."status" = 'READY'
        AND a."createdAt" >= ${seriesStart}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const uploadsByMonth = new Map(rows.map((row) => [monthKey(new Date(row.monthBucket)), Number(row.uploads || 0)]));

    const series = Array.from({ length: months }, (_, index) => {
      const date = addMonths(seriesStart, index);
      return {
        month: date.toLocaleString("en-US", { month: "short" }),
        uploads: uploadsByMonth.get(monthKey(date)) || 0,
      };
    });

    return { series };
  },

  async storageTopUsers(query) {
    const { page, limit, skip, take } = getPagination(query);

    const plans = await planLimitService.listAllPlans();
    const quotaByPlanBytes = new Map(
      plans.map((plan) => [plan.name, plan.storageGB < 0 ? 0 : Number(plan.storageGB) * 1024 * 1024 * 1024])
    );

    const [rows, totalRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          p."userId" AS "userId",
          p."studioName" AS "studioName",
          COALESCE(ls."plan", 'FREE') AS "plan",
          COALESCE(SUM(a."sizeBytes"), 0)::bigint AS "storageUsed",
          COUNT(a."id")::bigint AS "imageCount"
        FROM "Photographer" p
        LEFT JOIN LATERAL (
          SELECT s."plan"
          FROM "Subscription" s
          WHERE s."userId" = p."userId"
          ORDER BY s."createdAt" DESC
          LIMIT 1
        ) ls ON TRUE
        LEFT JOIN "Asset" a
          ON a."photographerId" = p."id"
          AND a."status" = 'READY'
        GROUP BY p."id", p."userId", p."studioName", COALESCE(ls."plan", 'FREE')
        ORDER BY COALESCE(SUM(a."sizeBytes"), 0) DESC, p."id" ASC
        OFFSET ${skip}
        LIMIT ${take}
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::bigint AS "count"
        FROM "Photographer"
      `,
    ]);

    const total = Number(totalRows?.[0]?.count || 0);

    return {
      items: rows.map((row) => {
        const used = Number(row.storageUsed || 0);
        const imageCount = Number(row.imageCount || 0);
        const plan = toPlanTier(row.plan);
        const quotaBytes = quotaByPlanBytes.get(plan) || 0;
        const quotaPercent = quotaBytes > 0 ? Number(Math.min((used / quotaBytes) * 100, 100).toFixed(2)) : 0;

        return {
          userId: row.userId,
          name: row.studioName,
          plan,
          storageUsed: used,
          imageCount,
          quotaPercent,
        };
      }),
      pagination: buildPagination(page, limit, total),
    };
  },
};

