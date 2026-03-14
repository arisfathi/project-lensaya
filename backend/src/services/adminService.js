import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { promises as fs } from "node:fs";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { getR2Client } from "../config/r2.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { ApiError } from "../utils/apiError.js";
import { planLimitService } from "./planLimitService.js";
import { queueMonitoringService } from "./queueMonitoringService.js";

const mapUserPlan = (sub) => (sub?.plan || "FREE").toString();
const PLAN_TIERS = ["FREE", "PRO", "STUDIO"];
const PLAN_KEY_BY_NAME = {
  FREE: "free",
  PRO: "pro",
  STUDIO: "studio",
};
const PLAN_NAME_BY_KEY = {
  free: "FREE",
  pro: "PRO",
  studio: "STUDIO",
};
const BILLING_ACTIVE_STATUSES = new Set(["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"]);
const R2_UPLOADS_PREFIX = "uploads/";
const R2_OBJECT_SCAN_LIMIT = 200000;
const LEGACY_LEGAL_PAGES_STORE_URL = new URL("../../data/legal-pages.json", import.meta.url);
const LEGACY_ADMIN_SETTINGS_STORE_URL = new URL("../../data/admin-settings.json", import.meta.url);
const ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY = "admin_email_notifications";
const LEGAL_PAGE_DEFAULTS = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    content:
      "Describe what data Lensaya collects, how it is used, and how photographers and visitors can request updates or deletion.",
  },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    content:
      "Describe acceptable use, account responsibilities, billing terms, and platform limitations for photographers and visitors.",
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    content:
      "Describe which cookies are used for authentication, analytics, and preferences, and how users can control cookie consent.",
  },
];
const EMAIL_NOTIFICATION_DEFAULTS = {
  newSignup: true,
  subscription: true,
  abuse: true,
  dailyReport: false,
  weeklyReport: true,
};
const decimalToNumber = (value, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const centsToAmount = (value) => Number(value || 0) / 100;
const startOfMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date, delta) => new Date(date.getFullYear(), date.getMonth() + delta, 1);
const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, delta) => {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
};

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseWindowSize = (value, fallback, max = 24) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const parseLogRangeStart = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  const now = Date.now();
  if (normalized === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (normalized === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (normalized === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
};

const nowIso = () => new Date().toISOString();
const toSafeDate = (value, fallback = new Date()) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : fallback;
};
let ensureAdminSettingsInitializedPromise = null;

const createDefaultLegalPages = (timestamp = nowIso()) =>
  LEGAL_PAGE_DEFAULTS.map((page) => ({
    slug: page.slug,
    title: page.title,
    content: page.content,
    updatedAt: timestamp,
  }));

const normalizeLegalPages = (rows) => {
  const fallbackTimestamp = nowIso();
  const list = Array.isArray(rows) ? rows : [];
  const bySlug = new Map(
    list
      .filter((item) => item && typeof item === "object" && typeof item.slug === "string")
      .map((item) => [item.slug, item])
  );

  return LEGAL_PAGE_DEFAULTS.map((defaultPage) => {
    const stored = bySlug.get(defaultPage.slug);
    const updatedAt = stored?.updatedAt ? new Date(stored.updatedAt) : null;
    return {
      slug: defaultPage.slug,
      title:
        typeof stored?.title === "string" && stored.title.trim()
          ? stored.title.trim()
          : defaultPage.title,
      content:
        typeof stored?.content === "string"
          ? stored.content
          : defaultPage.content,
      updatedAt:
        updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toISOString() : fallbackTimestamp,
    };
  });
};

const readLegacyJsonFile = async (fileUrl) => {
  try {
    const fileContent = await fs.readFile(fileUrl, "utf8");
    return JSON.parse(fileContent);
  } catch (_error) {
    return null;
  }
};

const mapLegalPageRecord = (row, fallbackTimestamp = nowIso()) => ({
  slug: row.slug,
  title: row.title,
  content: row.content,
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : fallbackTimestamp,
});

const ensureLegalPagesSeeded = async () => {
  const totalPages = await prisma.legalPage.count();

  if (totalPages === 0) {
    const legacyRows = await readLegacyJsonFile(LEGACY_LEGAL_PAGES_STORE_URL);
    const seedRows = normalizeLegalPages(legacyRows);
    await prisma.legalPage.createMany({
      data: seedRows.map((row) => {
        const timestamp = toSafeDate(row.updatedAt);
        return {
          slug: row.slug,
          title: row.title,
          content: row.content,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      }),
      skipDuplicates: true,
    });
    return;
  }

  await prisma.legalPage.createMany({
    data: LEGAL_PAGE_DEFAULTS.map((row) => ({
      slug: row.slug,
      title: row.title,
      content: row.content,
    })),
    skipDuplicates: true,
  });
};

const ensureEmailSettingsSeeded = async () => {
  const existing = await prisma.platformSetting.findUnique({
    where: { key: ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY },
    select: { key: true },
  });
  if (existing) return;

  const legacySettings = await readLegacyJsonFile(LEGACY_ADMIN_SETTINGS_STORE_URL);
  const emailNotifications = normalizeEmailNotificationSettings(
    legacySettings?.emailNotifications || legacySettings
  );

  try {
    await prisma.platformSetting.create({
      data: {
        key: ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY,
        value: emailNotifications,
      },
    });
  } catch (error) {
    if (String(error?.code || "") !== "P2002") {
      throw error;
    }
  }
};

const ensureAdminSettingsInitialized = async () => {
  if (!ensureAdminSettingsInitializedPromise) {
    ensureAdminSettingsInitializedPromise = Promise.all([
      ensureLegalPagesSeeded(),
      ensureEmailSettingsSeeded(),
    ]).catch((error) => {
      ensureAdminSettingsInitializedPromise = null;
      throw error;
    });
  }

  await ensureAdminSettingsInitializedPromise;
};

const readLegalPagesStore = async () => {
  await ensureAdminSettingsInitialized();
  const rows = await prisma.legalPage.findMany({
    orderBy: { slug: "asc" },
  });

  const fallback = createDefaultLegalPages();
  if (rows.length === 0) return fallback;

  const normalized = normalizeLegalPages(rows.map((row) => mapLegalPageRecord(row)));
  return normalized;
};

const normalizeEmailNotificationSettings = (settings) => ({
  newSignup:
    typeof settings?.newSignup === "boolean"
      ? settings.newSignup
      : EMAIL_NOTIFICATION_DEFAULTS.newSignup,
  subscription:
    typeof settings?.subscription === "boolean"
      ? settings.subscription
      : EMAIL_NOTIFICATION_DEFAULTS.subscription,
  abuse:
    typeof settings?.abuse === "boolean"
      ? settings.abuse
      : EMAIL_NOTIFICATION_DEFAULTS.abuse,
  dailyReport:
    typeof settings?.dailyReport === "boolean"
      ? settings.dailyReport
      : EMAIL_NOTIFICATION_DEFAULTS.dailyReport,
  weeklyReport:
    typeof settings?.weeklyReport === "boolean"
      ? settings.weeklyReport
      : EMAIL_NOTIFICATION_DEFAULTS.weeklyReport,
});

const readAdminSettingsStore = async () => {
  await ensureAdminSettingsInitialized();
  const row = await prisma.platformSetting.findUnique({
    where: { key: ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY },
    select: { value: true, updatedAt: true },
  });

  return {
    emailNotifications: normalizeEmailNotificationSettings(row?.value || null),
    updatedAt: row?.updatedAt || null,
  };
};

const writeAdminSettingsStore = async (settings) => {
  await ensureAdminSettingsInitialized();
  await prisma.platformSetting.upsert({
    where: { key: ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY },
    update: {
      value: settings?.emailNotifications || { ...EMAIL_NOTIFICATION_DEFAULTS },
    },
    create: {
      key: ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY,
      value: settings?.emailNotifications || { ...EMAIL_NOTIFICATION_DEFAULTS },
    },
  });
};

const chunkArray = (items, size = 200) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const groupReadyAssetsByPhotographer = (rows) => {
  const grouped = new Map();
  for (const row of rows) {
    if (!row?.photographerId) continue;
    if (!grouped.has(row.photographerId)) grouped.set(row.photographerId, []);
    grouped.get(row.photographerId).push(row);
  }
  return grouped;
};

const listR2ObjectsByPrefix = async (client, bucket, prefix, maxObjects = R2_OBJECT_SCAN_LIMIT) => {
  let continuationToken = undefined;
  let totalObjects = 0;
  let truncated = false;
  const keys = new Set();

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      })
    );

    const contents = response.Contents || [];
    totalObjects += contents.length;
    for (const item of contents) {
      if (item.Key) keys.add(item.Key);
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken || undefined : undefined;
    if (totalObjects >= maxObjects) {
      truncated = Boolean(continuationToken || response.IsTruncated);
      continuationToken = undefined;
    }
  } while (continuationToken);

  return { totalObjects, keys, truncated };
};

const resolveR2ImageCountsAndMissingReadyAssets = async (photographerIds, readyAssets) => {
  const countsByPhotographerId = new Map();
  const missingReadyAssetIds = [];
  const readyAssetsByPhotographerId = groupReadyAssetsByPhotographer(readyAssets);
  const bucket = env.r2.bucket || "";
  const client = getR2Client();

  for (const photographerId of photographerIds) {
    const dbCount = (readyAssetsByPhotographerId.get(photographerId) || []).length;
    countsByPhotographerId.set(photographerId, dbCount);
  }

  if (!bucket || !client || photographerIds.length === 0) {
    return {
      source: "db",
      countsByPhotographerId,
      missingReadyAssetIds,
    };
  }

  for (const photographerId of photographerIds) {
    const prefix = `${R2_UPLOADS_PREFIX}${photographerId}/`;
    const assets = readyAssetsByPhotographerId.get(photographerId) || [];

    try {
      const scan = await listR2ObjectsByPrefix(client, bucket, prefix);
      countsByPhotographerId.set(photographerId, scan.totalObjects);

      for (const asset of assets) {
        if (!asset.objectKey) continue;
        if (!scan.keys.has(asset.objectKey)) {
          missingReadyAssetIds.push(asset.id);
        }
      }
    } catch (_error) {
      // Keep DB fallback count when R2 listing fails for a photographer.
    }
  }

  return {
    source: "r2",
    countsByPhotographerId,
    missingReadyAssetIds,
  };
};

const markReadyAssetsDeleted = async (assetIds) => {
  if (!Array.isArray(assetIds) || assetIds.length === 0) return 0;

  const uniqueAssetIds = Array.from(new Set(assetIds.filter(Boolean)));
  if (uniqueAssetIds.length === 0) return 0;

  let updated = 0;
  const deletedAt = new Date();

  for (const ids of chunkArray(uniqueAssetIds, 200)) {
    const result = await prisma.asset.updateMany({
      where: {
        id: { in: ids },
        status: "READY",
      },
      data: {
        status: "DELETED",
        deletedAt,
      },
    });
    updated += Number(result.count || 0);
  }

  return updated;
};

const buildMonthlySeries = (rows, { start, months, getDate, getValue, valueKey }) => {
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = addMonths(start, index);
    return {
      key: monthKey(date),
      month: date.toLocaleString("en-US", { month: "short" }),
      [valueKey]: 0,
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const row of rows) {
    const date = getDate(row);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) continue;

    const bucket = bucketMap.get(monthKey(date));
    if (!bucket) continue;

    bucket[valueKey] += Number(getValue(row) || 0);
  }

  return buckets.map(({ key, ...rest }) => rest);
};

const buildDailySeries = (rows, { start, days, getDate, getValue, valueKey, labelKey = "date" }) => {
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: dayKey(date),
      [labelKey]: dayKey(date),
      [valueKey]: 0,
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const row of rows) {
    const date = getDate(row);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) continue;

    const bucket = bucketMap.get(dayKey(date));
    if (!bucket) continue;

    bucket[valueKey] += Number(getValue(row) || 0);
  }

  return buckets.map(({ key, ...rest }) => rest);
};

const formatPercentChange = (current, previous) => {
  if (!previous) {
    if (!current) return "0%";
    return "+100%";
  }

  const delta = ((current - previous) / previous) * 100;
  const rounded = Number.isFinite(delta) ? delta : 0;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toFixed(1)}%`;
};

const sourceLabel = (value) => {
  if (!value) return "Direct";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const toPlanLimitRecord = (plan) => ({
  services: plan.maxServices,
  portfolioImages: plan.maxPortfolioImages,
  portfolioPhotos: plan.maxPortfolioImages,
  packages: plan.maxPackages,
  packagesPerService: plan.maxPackages,
  storage: plan.storageGB,
  customDomain: plan.customDomain,
  analyticsTools: plan.analyticsTools,
});

const toPlanDto = (plan) => ({
  id: plan.id,
  name: plan.name,
  price: decimalToNumber(plan.price),
  yearlyPrice: decimalToNumber(plan.yearlyPrice, decimalToNumber(plan.price) * 10),
  currency: plan.currency,
  trialDays: plan.trialDays,
  referralReward: decimalToNumber(plan.referralReward),
  storageCostPerGB: decimalToNumber(plan.storageCostPerGB),
  maxServices: plan.maxServices,
  maxPortfolioImages: plan.maxPortfolioImages,
  maxPackages: plan.maxPackages,
  storageGB: plan.storageGB,
  customDomain: plan.customDomain,
  analyticsTools: plan.analyticsTools,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});

const csvEscape = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
};

const resolveSearchTerm = (query = {}) => String(query.search || query.q || "").trim();

const MODERATION_REPORT_ACTIONS = new Set(["approve", "suspend", "escalate"]);
const MODERATION_IMAGE_ACTIONS = new Set(["approve", "remove"]);

const moderationSeverityFromCount = (count) => {
  const total = Number(count || 0);
  if (total >= 8) return "HIGH";
  if (total >= 3) return "MEDIUM";
  return "LOW";
};

const normalizeModerationToken = (value) => String(value || "").trim().toUpperCase();

const resolveModerationImageStatuses = (value) => {
  const token = normalizeModerationToken(value);
  if (!token || token === "PENDING") return ["PENDING"];
  if (token === "APPROVED") return ["READY"];
  if (token === "REMOVED") return ["DELETED", "PURGED"];
  if (token === "ALL") return null;
  if (["READY", "DELETED", "PURGED"].includes(token)) return [token];
  return ["PENDING"];
};

const moderationAbuseLabel = (purpose) => {
  if (purpose === "PORTFOLIO") return "Portfolio";
  if (purpose === "AVATAR") return "Avatar";
  if (purpose === "BANNER") return "Banner";
  return String(purpose || "Unknown");
};

const moderationImageReason = (status) => {
  if (status === "READY") return "Approved portfolio image";
  if (["DELETED", "PURGED"].includes(status)) return "Removed portfolio image";
  return "Pending portfolio image moderation";
};

export const adminService = {
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

    const recentPhotographerIds = recentUsers
      .map((user) => user.photographer?.id)
      .filter(Boolean);

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
        imagesStored: user.photographer?.id
          ? imageCountByPhotographerId.get(user.photographer.id) || 0
          : 0,
      })),
    };
  },

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

    const scopedUsers = await prisma.user.findMany({
      where: whereUser,
      select: {
        id: true,
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1, select: { plan: true } },
      },
    });

    const countsByPlan = {
      FREE: 0,
      PRO: 0,
      STUDIO: 0,
    };

    for (const user of scopedUsers) {
      const plan = mapUserPlan(user.subscriptions[0]);
      if (countsByPlan[plan] === undefined) {
        countsByPlan.FREE += 1;
      } else {
        countsByPlan[plan] += 1;
      }
    }

    let users = [];
    let total = 0;

    if (query.plan) {
      const filteredUserIds = scopedUsers
        .filter((user) => mapUserPlan(user.subscriptions[0]) === query.plan)
        .map((user) => user.id);

      total = filteredUserIds.length;
      if (total === 0) {
        return {
          items: [],
          pagination: buildPagination(page, limit, 0),
          countsByPlan,
        };
      }

      users = await prisma.user.findMany({
        where: {
          id: { in: filteredUserIds },
        },
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
      });
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
    const [portfolioCounts, readyAssets] =
      photographerIds.length > 0
        ? await Promise.all([
            prisma.portfolioItem.groupBy({
              by: ["photographerId"],
              where: {
                photographerId: { in: photographerIds },
              },
              _count: { _all: true },
            }),
            prisma.asset.findMany({
              where: {
                photographerId: { in: photographerIds },
                type: "IMAGE",
                status: "READY",
              },
              select: {
                id: true,
                photographerId: true,
                objectKey: true,
              },
            }),
          ])
        : [[], []];

    const portfolioCountByPhotographerId = new Map(
      portfolioCounts.map((row) => [row.photographerId, Number(row._count._all || 0)])
    );
    const { countsByPhotographerId, missingReadyAssetIds } =
      await resolveR2ImageCountsAndMissingReadyAssets(photographerIds, readyAssets);

    if (missingReadyAssetIds.length > 0) {
      await markReadyAssetsDeleted(missingReadyAssetIds);
    }

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
        imagesStored: user.photographer?.id ? countsByPhotographerId.get(user.photographer.id) || 0 : 0,
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

  async setPhotographerStatus(id, status) {
    const nextStatus = status === "active" ? "ACTIVE" : "SUSPENDED";
    const updated = await prisma.user.update({
      where: { id },
      data: { status: nextStatus },
    });

    await prisma.notification.create({
      data: {
        userId: updated.id,
        type: "ADMIN",
        title: nextStatus === "ACTIVE" ? "Account reactivated" : "Account suspended",
        body:
          nextStatus === "ACTIVE"
            ? "Your account access has been restored by the admin team."
            : "Your account has been suspended by the admin team.",
        actionUrl: "/dashboard/settings",
      },
    });

    return {
      id: updated.id,
      status: updated.status.toLowerCase(),
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

  async subscriptionsOverview() {
    const photographerUsers = await prisma.user.findMany({
      where: { role: "PHOTOGRAPHER" },
      select: {
        id: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { plan: true, status: true },
        },
      },
    });

    const planStats = { FREE: 0, PRO: 0, STUDIO: 0 };
    for (const user of photographerUsers) {
      const latest = user.subscriptions[0];
      const activePlan =
        latest && BILLING_ACTIVE_STATUSES.has(String(latest.status || ""))
          ? mapUserPlan(latest)
          : "FREE";
      const normalizedPlan = PLAN_TIERS.includes(activePlan) ? activePlan : "FREE";
      planStats[normalizedPlan] += 1;
    }

    const upgrades = planStats.PRO + planStats.STUDIO;

    return {
      planStats,
      distribution: Object.entries(planStats).map(([plan, count]) => ({ plan, count })),
      upgradesDowngrades: { upgrades, downgrades: 0 },
    };
  },

  async getPlanLimits() {
    const plans = await planLimitService.listAllPlans();
    const planMap = new Map(plans.map((plan) => [plan.name, plan]));

    const normalized = {};
    for (const [planName, key] of Object.entries(PLAN_KEY_BY_NAME)) {
      const row = planMap.get(planName);
      if (!row) {
        throw new ApiError(500, "Subscription plans are not configured");
      }
      normalized[key] = toPlanLimitRecord(row);
    }

    return normalized;
  },

  async updatePlanLimits(limits) {
    const entries = Object.entries(limits || {}).filter(([key, value]) => {
      if (!PLAN_NAME_BY_KEY[key]) return false;
      return Boolean(value && typeof value === "object");
    });

    if (!entries.length) {
      return { updated: true, limits: await this.getPlanLimits() };
    }

    const supportsAnalyticsTools = await planLimitService.supportsAnalyticsToolsColumn();
    const updates = entries
      .map(([key, value]) => {
      const payload = value || {};
      const data = {
        ...(payload.services !== undefined ? { maxServices: Number(payload.services) } : {}),
        ...(payload.portfolioImages !== undefined || payload.portfolioPhotos !== undefined
          ? { maxPortfolioImages: Number(payload.portfolioImages ?? payload.portfolioPhotos) }
          : {}),
        ...(payload.packages !== undefined || payload.packagesPerService !== undefined
          ? { maxPackages: Number(payload.packages ?? payload.packagesPerService) }
          : {}),
        ...(payload.storage !== undefined ? { storageGB: Number(payload.storage) } : {}),
        ...(payload.customDomain !== undefined
          ? { customDomain: Boolean(payload.customDomain) }
          : {}),
        ...(supportsAnalyticsTools && payload.analyticsTools !== undefined
          ? { analyticsTools: Boolean(payload.analyticsTools) }
          : {}),
      };

      if (Object.keys(data).length === 0) {
        return null;
      }

      return prisma.subscriptionPlan.updateMany({
        where: { name: PLAN_NAME_BY_KEY[key] },
        data,
      });
      })
      .filter(Boolean);

    if (!updates.length) {
      return {
        updated: true,
        limits: await this.getPlanLimits(),
      };
    }

    const results = await prisma.$transaction(updates);
    const anyMissing = results.some((result) => result.count === 0);
    if (anyMissing) {
      throw new ApiError(404, "Subscription plan not found");
    }

    return {
      updated: true,
      limits: await this.getPlanLimits(),
    };
  },

  async listPlans() {
    const items = await planLimitService.listAllPlans();
    return {
      items: items
        .slice()
        .sort((a, b) => PLAN_TIERS.indexOf(a.name) - PLAN_TIERS.indexOf(b.name))
        .map(toPlanDto),
    };
  },

  async updatePlan(planId, payload) {
    const existing = await planLimitService.getPlanById(planId);
    const supportsAnalyticsTools = await planLimitService.supportsAnalyticsToolsColumn();

    const data = {
      ...(payload.name !== undefined ? { name: String(payload.name).toUpperCase() } : {}),
      ...(payload.price !== undefined ? { price: Number(payload.price) } : {}),
      ...(payload.yearlyPrice !== undefined ? { yearlyPrice: Number(payload.yearlyPrice) } : {}),
      ...(payload.currency !== undefined ? { currency: String(payload.currency).toUpperCase() } : {}),
      ...(payload.trialDays !== undefined ? { trialDays: Number(payload.trialDays) } : {}),
      ...(payload.referralReward !== undefined
        ? { referralReward: Number(payload.referralReward) }
        : {}),
      ...(payload.storageCostPerGB !== undefined
        ? { storageCostPerGB: Number(payload.storageCostPerGB) }
        : {}),
      ...(payload.maxServices !== undefined ? { maxServices: Number(payload.maxServices) } : {}),
      ...(payload.maxPortfolioImages !== undefined
        ? { maxPortfolioImages: Number(payload.maxPortfolioImages) }
        : {}),
      ...(payload.maxPackages !== undefined ? { maxPackages: Number(payload.maxPackages) } : {}),
      ...(payload.storageGB !== undefined ? { storageGB: Number(payload.storageGB) } : {}),
      ...(payload.customDomain !== undefined
        ? { customDomain: Boolean(payload.customDomain) }
        : {}),
      ...(supportsAnalyticsTools && payload.analyticsTools !== undefined
        ? { analyticsTools: Boolean(payload.analyticsTools) }
        : {}),
    };

    if (!Object.keys(data).length) {
      return toPlanDto(existing);
    }

    const baseSelect = {
      id: true,
      name: true,
      price: true,
      yearlyPrice: true,
      currency: true,
      trialDays: true,
      referralReward: true,
      storageCostPerGB: true,
      maxServices: true,
      maxPortfolioImages: true,
      maxPackages: true,
      storageGB: true,
      customDomain: true,
      createdAt: true,
      updatedAt: true,
    };

    const updated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data,
      select: supportsAnalyticsTools
        ? {
            ...baseSelect,
            analyticsTools: true,
          }
        : baseSelect,
    });

    const normalizedUpdated = supportsAnalyticsTools
      ? updated
      : {
          ...updated,
          analyticsTools: updated.name !== "FREE",
        };

    return toPlanDto(normalizedUpdated);
  },

  async subscriptionChanges(query) {
    const { page, limit, skip, take } = getPagination(query);
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.subscription.count(),
    ]);

    return {
      items: items.map((s) => ({
        user: s.userId,
        from: "FREE",
        to: s.plan,
        action: s.plan === "FREE" ? "downgraded" : "upgraded",
        at: s.createdAt,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },

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

    const [photographerUsers, transactions] = await Promise.all([
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
      prisma.transaction.findMany({
        where: {
          status: "SUCCEEDED",
          createdAt: { gte: seriesStart },
        },
        select: {
          amountCents: true,
          userId: true,
          subscription: {
            select: { plan: true },
          },
        },
      }),
    ]);

    const planByUserId = new Map(
      photographerUsers.map((user) => [user.id, mapUserPlan(user.subscriptions[0])])
    );

    const totalsByPlan = { FREE: 0, PRO: 0, STUDIO: 0 };
    for (const tx of transactions) {
      const inferredPlan =
        tx.subscription?.plan?.toString() || (tx.userId ? planByUserId.get(tx.userId) : null) || "FREE";
      const plan = PLAN_TIERS.includes(inferredPlan) ? inferredPlan : "FREE";
      totalsByPlan[plan] += centsToAmount(tx.amountCents);
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

  async storageOverview() {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const previousMonthStart = addMonths(currentMonthStart, -1);

    const neonSizePromise = prisma.$queryRaw`
      SELECT pg_database_size(current_database())::bigint AS "sizeBytes"
    `.catch(() => []);

    const [totalStorage, totalImages, users, currentMonthGrowth, previousMonthGrowth, neonSizeRows] = await Promise.all([
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
    const client = getR2Client();

    if (!bucket || !client) {
      return {
        configured: false,
        connected: false,
        bucket,
        prefix: R2_UPLOADS_PREFIX,
        totalBytes: 0,
        totalObjects: 0,
        dbReadyBytes,
        dbReadyObjects,
        deltaBytes: null,
        truncated: false,
        lastSyncedAt: new Date().toISOString(),
        message: "R2 is not configured on this server.",
      };
    }

    let continuationToken = undefined;
    let totalBytes = 0;
    let totalObjects = 0;
    let truncated = false;

    try {
      do {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: R2_UPLOADS_PREFIX,
            MaxKeys: 1000,
            ContinuationToken: continuationToken,
          })
        );

        const contents = response.Contents || [];
        for (const item of contents) {
          totalBytes += Number(item.Size || 0);
        }
        totalObjects += contents.length;

        continuationToken = response.IsTruncated ? response.NextContinuationToken || undefined : undefined;
        if (totalObjects >= R2_OBJECT_SCAN_LIMIT) {
          truncated = Boolean(continuationToken || response.IsTruncated);
          continuationToken = undefined;
        }
      } while (continuationToken);

      return {
        configured: true,
        connected: true,
        bucket,
        prefix: R2_UPLOADS_PREFIX,
        totalBytes,
        totalObjects,
        dbReadyBytes,
        dbReadyObjects,
        deltaBytes: totalBytes - dbReadyBytes,
        truncated,
        lastSyncedAt: new Date().toISOString(),
        message: null,
      };
    } catch (error) {
      return {
        configured: true,
        connected: false,
        bucket,
        prefix: R2_UPLOADS_PREFIX,
        totalBytes: 0,
        totalObjects: 0,
        dbReadyBytes,
        dbReadyObjects,
        deltaBytes: null,
        truncated: false,
        lastSyncedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Failed to read R2 usage.",
      };
    }
  },

  async storageByPlan() {
    const [photographerUsers, storageRows] = await Promise.all([
      prisma.user.findMany({
        where: { role: "PHOTOGRAPHER" },
        select: {
          id: true,
          photographer: {
            select: { id: true },
          },
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { plan: true },
          },
        },
      }),
      prisma.asset.groupBy({
        by: ["photographerId"],
        where: { status: "READY" },
        _sum: { sizeBytes: true },
      }),
    ]);

    const storageByPhotographerId = new Map(
      storageRows.map((row) => [row.photographerId, Number(row._sum.sizeBytes || 0)])
    );

    const usageByPlan = { FREE: 0, PRO: 0, STUDIO: 0 };
    for (const user of photographerUsers) {
      if (!user.photographer?.id) continue;

      const plan = mapUserPlan(user.subscriptions[0]);
      const normalizedPlan = PLAN_TIERS.includes(plan) ? plan : "FREE";
      usageByPlan[normalizedPlan] += storageByPhotographerId.get(user.photographer.id) || 0;
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

    const rows = await prisma.asset.findMany({
      where: {
        type: "IMAGE",
        status: "READY",
        createdAt: { gte: seriesStart },
      },
      select: { createdAt: true },
    });

    return {
      series: buildMonthlySeries(rows, {
        start: seriesStart,
        months,
        getDate: (row) => row.createdAt,
        getValue: () => 1,
        valueKey: "uploads",
      }),
    };
  },

  async storageTopUsers(query) {
    const { page, limit, skip, take } = getPagination(query);

    const [rows, total, plans] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          p."userId" AS "userId",
          p."studioName" AS "studioName",
          COALESCE(SUM(a."sizeBytes"), 0)::bigint AS "storageUsed",
          COUNT(a."id")::bigint AS "imageCount"
        FROM "Photographer" p
        LEFT JOIN "Asset" a
          ON a."photographerId" = p."id"
          AND a."status" = 'READY'
        GROUP BY p."id", p."userId", p."studioName"
        ORDER BY COALESCE(SUM(a."sizeBytes"), 0) DESC, p."id" ASC
        OFFSET ${skip}
        LIMIT ${take}
      `,
      prisma.photographer.count(),
      planLimitService.listAllPlans(),
    ]);

    const userIds = rows.map((row) => row.userId).filter(Boolean);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              subscriptions: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { plan: true },
              },
            },
          })
        : [];

    const planByUserId = new Map(users.map((user) => [user.id, mapUserPlan(user.subscriptions[0])]));
    const quotaByPlanBytes = new Map(
      plans.map((plan) => [
        plan.name,
        plan.storageGB < 0 ? 0 : Number(plan.storageGB) * 1024 * 1024 * 1024,
      ])
    );

    return {
      items: rows.map((row) => {
        const used = Number(row.storageUsed || 0);
        const imageCount = Number(row.imageCount || 0);
        const plan = planByUserId.get(row.userId) || "FREE";
        const quotaBytes = quotaByPlanBytes.get(plan) || 0;
        const quotaPercent =
          quotaBytes > 0 ? Number(Math.min((used / quotaBytes) * 100, 100).toFixed(2)) : 0;

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

  async moderationOverview() {
    const startToday = startOfDay(new Date());
    const pendingPortfolioWhere = {
      type: "IMAGE",
      purpose: "PORTFOLIO",
      status: "PENDING",
      photographerId: { not: null },
    };

    const [pendingReportGroups, flaggedImages, suspendedAccounts, abuseGroups, reviewedToday] = await Promise.all([
      prisma.asset.groupBy({
        by: ["photographerId"],
        where: pendingPortfolioWhere,
        _count: { _all: true },
      }),
      prisma.asset.count({
        where: pendingPortfolioWhere,
      }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.asset.groupBy({
        by: ["purpose"],
        where: {
          type: "IMAGE",
          status: "PENDING",
        },
        _count: { _all: true },
      }),
      prisma.adminLog.count({
        where: {
          createdAt: { gte: startToday },
          action: { startsWith: "PATCH /admin/moderation/" },
        },
      }),
    ]);

    return {
      stats: {
        pendingReports: pendingReportGroups.length,
        reviewedToday,
        suspendedAccounts,
        flaggedImages,
      },
      abuseTypes: abuseGroups
        .map((group) => ({
          type: moderationAbuseLabel(group.purpose),
          count: Number(group._count._all || 0),
        }))
        .sort((a, b) => b.count - a.count),
    };
  },

  async moderationReports(query) {
    const { page, limit, skip, take } = getPagination(query);

    const severityFilter = normalizeModerationToken(query.severity);
    const statusFilter = normalizeModerationToken(query.status);
    const search = String(query.search || query.q || "").trim().toLowerCase();

    const pendingGroups = await prisma.asset.groupBy({
      by: ["photographerId"],
      where: {
        type: "IMAGE",
        purpose: "PORTFOLIO",
        status: "PENDING",
        photographerId: { not: null },
      },
      _count: { _all: true },
    });

    const photographerIds = pendingGroups
      .map((group) => group.photographerId)
      .filter(Boolean);
    const photographers =
      photographerIds.length > 0
        ? await prisma.photographer.findMany({
            where: { id: { in: photographerIds } },
            select: {
              id: true,
              username: true,
              studioName: true,
              status: true,
              user: {
                select: {
                  fullName: true,
                  status: true,
                },
              },
            },
          })
        : [];
    const photographerById = new Map(photographers.map((photographer) => [photographer.id, photographer]));

    let items = pendingGroups.map((group) => {
      const photographer = photographerById.get(group.photographerId);
      const reports = Number(group._count._all || 0);
      const severity = moderationSeverityFromCount(reports);
      const isSuspended =
        photographer?.status === "SUSPENDED" || photographer?.user?.status === "SUSPENDED";

      return {
        reportId: group.photographerId,
        photographer:
          photographer?.studioName ||
          photographer?.user?.fullName ||
          (photographer?.username ? `@${photographer.username}` : "Unknown photographer"),
        reports,
        reason:
          reports === 1
            ? "Flagged portfolio image pending moderation"
            : "Flagged portfolio images pending moderation",
        severity,
        status: isSuspended ? "SUSPENDED" : "PENDING",
      };
    });

    if (severityFilter && severityFilter !== "ALL") {
      items = items.filter((item) => item.severity === severityFilter);
    }

    if (statusFilter && statusFilter !== "ALL") {
      items = items.filter((item) => item.status === statusFilter);
    }

    if (search) {
      items = items.filter((item) =>
        [item.photographer, item.reason, item.status, item.severity]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    }

    items.sort((a, b) => {
      if (b.reports !== a.reports) return b.reports - a.reports;
      return String(a.photographer).localeCompare(String(b.photographer));
    });

    const total = items.length;
    const paginatedItems = items.slice(skip, skip + take);

    return {
      items: paginatedItems,
      pagination: buildPagination(page, limit, total),
    };
  },

  async moderationPatchReport(reportId, action) {
    const normalizedAction = String(action || "").trim().toLowerCase();
    if (!MODERATION_REPORT_ACTIONS.has(normalizedAction)) {
      throw new ApiError(400, "Unsupported moderation action");
    }

    const photographer = await prisma.photographer.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        userId: true,
      },
    });
    if (!photographer) throw new ApiError(404, "Report not found");

    if (normalizedAction === "approve") {
      await prisma.asset.updateMany({
        where: {
          photographerId: photographer.id,
          type: "IMAGE",
          purpose: "PORTFOLIO",
          status: "PENDING",
        },
        data: {
          status: "READY",
          deletedAt: null,
        },
      });

      return {
        reportId,
        status: "APPROVED",
        action: normalizedAction,
      };
    }

    if (normalizedAction === "suspend") {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: photographer.userId },
          data: { status: "SUSPENDED" },
        });

        await tx.photographer.update({
          where: { id: photographer.id },
          data: { status: "SUSPENDED" },
        });

        await tx.notification.create({
          data: {
            userId: photographer.userId,
            type: "ADMIN",
            title: "Account suspended",
            body: "Your account has been suspended by the admin team due to moderation review.",
            actionUrl: "/dashboard/settings",
          },
        });
      });

      return {
        reportId,
        status: "SUSPENDED",
        action: normalizedAction,
      };
    }

    return {
      reportId,
      status: "ESCALATED",
      action: normalizedAction,
    };
  },

  async flaggedImages(query) {
    const { page, limit, skip, take } = getPagination(query);
    const imageStatuses = resolveModerationImageStatuses(query.status);
    const search = String(query.search || query.q || "").trim();

    const where = {
      type: "IMAGE",
      purpose: "PORTFOLIO",
      ...(imageStatuses ? { status: { in: imageStatuses } } : {}),
      ...(search
        ? {
            OR: [
              { objectKey: { contains: search, mode: "insensitive" } },
              { originalFileName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          cdnUrl: true,
          objectKey: true,
          photographer: {
            select: {
              studioName: true,
              username: true,
              user: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        imageReportId: item.id,
        photographer:
          item.photographer?.studioName ||
          item.photographer?.user?.fullName ||
          (item.photographer?.username ? `@${item.photographer.username}` : "Unknown photographer"),
        reason: moderationImageReason(item.status),
        reports: 1,
        date: item.createdAt,
        imageUrl: item.cdnUrl || null,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },

  async patchFlaggedImage(imageReportId, action) {
    const normalizedAction = String(action || "").trim().toLowerCase();
    if (!MODERATION_IMAGE_ACTIONS.has(normalizedAction)) {
      throw new ApiError(400, "Unsupported flagged image action");
    }

    const asset = await prisma.asset.findUnique({
      where: { id: imageReportId },
      select: {
        id: true,
        type: true,
        purpose: true,
        status: true,
      },
    });

    if (!asset || asset.type !== "IMAGE" || asset.purpose !== "PORTFOLIO") {
      throw new ApiError(404, "Flagged image not found");
    }

    if (normalizedAction === "approve") {
      if (asset.status === "PURGED") {
        throw new ApiError(409, "Purged image cannot be approved");
      }

      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          status: "READY",
          deletedAt: null,
        },
      });

      return {
        imageReportId,
        status: "APPROVED",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.portfolioItem.deleteMany({
        where: {
          assetId: asset.id,
        },
      });

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
        },
      });
    });

    return {
      imageReportId,
      status: "REMOVED",
    };
  },

  async referralsOverview() {
    const [totalReferrals, conversions, recent] = await Promise.all([
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
      currentActiveUsers,
      previousActiveUsers,
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
      prisma.analyticsEvent.groupBy({
        by: ["userId"],
        where: {
          userId: { not: null },
          createdAt: { gte: currentDailyStart },
        },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["userId"],
        where: {
          userId: { not: null },
          createdAt: { gte: previousDailyStart, lt: currentDailyStart },
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

    const currentMetricsMap = new Map(
      currentMetricGroups.map((row) => [row.eventType, Number(row._count._all || 0)])
    );
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
    const currentActiveUsersCount = currentActiveUsers.length;
    const previousActiveUsersCount = previousActiveUsers.length;

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
        buildMetric(
          "metric-booking-intents",
          "Booking Intents",
          currentBookingIntents,
          previousBookingIntents
        ),
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

  async systemLogs(query) {
    const { page, limit, skip, take } = getPagination(query);
    const rangeStart = parseLogRangeStart(query.range);
    const eventType = query.eventType ? String(query.eventType).trim() : "";
    const where = {
      ...(query.q
        ? {
            OR: [
              { action: { contains: query.q, mode: "insensitive" } },
              { resourceType: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(eventType
        ? {
            action: {
              contains: eventType,
              mode: "insensitive",
            },
          }
        : {}),
      ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.adminLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.adminLog.count({ where }),
    ]);

    return {
      items: items.map((log) => ({
        id: log.id.toString(),
        timestamp: log.createdAt,
        event: log.action,
        user: log.actorUserId,
        ip: log.ipAddress,
        status: log.level,
        details: log.details,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },

  async workerHealth() {
    return queueMonitoringService.getWorkerHealth();
  },

  async getSettings() {
    const [pages, adminSettings] = await Promise.all([
      readLegalPagesStore(),
      readAdminSettingsStore(),
    ]);
    return {
      planLimits: await this.getPlanLimits(),
      emailNotifications: normalizeEmailNotificationSettings(adminSettings?.emailNotifications),
      legalPagesMeta: pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        updatedAt: page.updatedAt,
      })),
    };
  },

  async updateEmailNotifications(payload) {
    const current = await readAdminSettingsStore();
    const emailNotifications = normalizeEmailNotificationSettings(payload);
    await writeAdminSettingsStore({
      ...current,
      emailNotifications,
      updatedAt: nowIso(),
    });

    return { saved: true, ...emailNotifications };
  },

  async updateSettingsPlanLimits(payload) {
    const result = await this.updatePlanLimits(payload);
    return { saved: true, limits: result.limits };
  },

  async legalPages() {
    const pages = await readLegalPagesStore();
    return {
      items: pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        updatedAt: page.updatedAt,
      })),
    };
  },

  async legalPage(slug) {
    await ensureAdminSettingsInitialized();
    const page = await prisma.legalPage.findUnique({
      where: { slug },
      select: {
        slug: true,
        title: true,
        content: true,
        updatedAt: true,
      },
    });
    if (!page) {
      throw new ApiError(404, "Legal page not found");
    }
    return {
      slug: page.slug,
      title: page.title,
      content: page.content,
      updatedAt: page.updatedAt,
    };
  },

  async updateLegalPage(slug, payload) {
    await ensureAdminSettingsInitialized();
    const current = await prisma.legalPage.findUnique({
      where: { slug },
      select: { slug: true, title: true },
    });
    if (!current) {
      throw new ApiError(404, "Legal page not found");
    }

    const updated = await prisma.legalPage.update({
      where: { slug },
      data: {
        title:
          payload.title !== undefined && String(payload.title).trim()
            ? String(payload.title).trim()
            : current.title,
        content: String(payload.content ?? ""),
      },
      select: {
        slug: true,
        title: true,
        content: true,
        updatedAt: true,
      },
    });

    return {
      slug: updated.slug,
      title: updated.title,
      content: updated.content,
      updatedAt: updated.updatedAt,
    };
  },
};
