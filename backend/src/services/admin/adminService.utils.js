import { Prisma } from "@prisma/client";
import {
  CMS_SECTIONS,
  CMS_STATUSES,
  EMAIL_NOTIFICATION_DEFAULTS,
  PLAN_TIERS,
} from "./adminService.constants.js";

export const mapUserPlan = (sub) => (sub?.plan || "FREE").toString();

export const normalizeCmsSection = (value, fallback = null) => {
  const normalized = String(value || "").trim().toUpperCase();
  return CMS_SECTIONS.includes(normalized) ? normalized : fallback;
};

export const normalizeCmsStatus = (value, fallback = null) => {
  const normalized = String(value || "").trim().toUpperCase();
  return CMS_STATUSES.includes(normalized) ? normalized : fallback;
};

export const slugifyCms = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 191);

export const toNullableExcerpt = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, 500) : null;
};

export const mapCmsContentItem = (item) => ({
  id: item.id,
  section: item.section,
  slug: item.slug,
  title: item.title,
  excerpt: item.excerpt,
  contentMarkdown: item.contentMarkdown,
  status: item.status,
  sortOrder: item.sortOrder,
  publishedAt: item.publishedAt,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export const decimalToNumber = (value, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const centsToAmount = (value) => Number(value || 0) / 100;

export const startOfMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);
export const addMonths = (date, delta) => new Date(date.getFullYear(), date.getMonth() + delta, 1);
export const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date, delta) => {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
};

export const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
export const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const parseWindowSize = (value, fallback, max = 24) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

export const parseLogRangeStart = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  const now = Date.now();
  if (normalized === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (normalized === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (normalized === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
};

export const toPlanTier = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return PLAN_TIERS.includes(normalized) ? normalized : "FREE";
};

export const buildPhotographerUserWhereSql = ({ search, status } = {}) => {
  const clauses = [Prisma.sql`u."role" = 'PHOTOGRAPHER'`];

  const normalizedSearch = String(search || "").trim();
  if (normalizedSearch) {
    const like = `%${normalizedSearch}%`;
    clauses.push(
      Prisma.sql`(
        u."fullName" ILIKE ${like}
        OR u."email" ILIKE ${like}
        OR u."username" ILIKE ${like}
      )`
    );
  }

  const normalizedStatus = String(status || "").trim().toUpperCase();
  if (normalizedStatus) {
    clauses.push(Prisma.sql`u."status" = ${normalizedStatus}`);
  }

  return clauses.length ? Prisma.join(clauses, Prisma.sql` AND `) : Prisma.sql`TRUE`;
};

export const nowIso = () => new Date().toISOString();

export const toSafeDate = (value, fallback = new Date()) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : fallback;
};

export const normalizeEmailNotificationSettings = (settings) => ({
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

export const chunkArray = (items, size = 200) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export const groupReadyAssetsByPhotographer = (rows) => {
  const grouped = new Map();
  for (const row of rows) {
    if (!row?.photographerId) continue;
    if (!grouped.has(row.photographerId)) grouped.set(row.photographerId, []);
    grouped.get(row.photographerId).push(row);
  }
  return grouped;
};

export const buildMonthlySeries = (rows, { start, months, getDate, getValue, valueKey }) => {
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

export const buildDailySeries = (rows, { start, days, getDate, getValue, valueKey, labelKey = "date" }) => {
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

export const formatPercentChange = (current, previous) => {
  if (!previous) {
    if (!current) return "0%";
    return "+100%";
  }

  const delta = ((current - previous) / previous) * 100;
  const rounded = Number.isFinite(delta) ? delta : 0;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toFixed(1)}%`;
};

export const sourceLabel = (value) => {
  if (!value) return "Direct";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const defaultPackageFeatureLimit = (planName = "FREE") => {
  const normalized = String(planName || "FREE").trim().toUpperCase();
  if (normalized === "PRO") return 10;
  if (normalized === "STUDIO") return 20;
  return 5;
};

export const toPlanLimitRecord = (plan) => ({
  services: plan.maxServices,
  portfolioImages: plan.maxPortfolioImages,
  portfolioPhotos: plan.maxPortfolioImages,
  packages: Number(plan.maxPackagesPerService ?? plan.maxPackages ?? 0),
  packagesPerService: Number(plan.maxPackagesPerService ?? plan.maxPackages ?? 0),
  packageFeatures: Number(
    plan.maxPackageFeaturesPerPackage ?? plan.maxPackageFeatures ?? defaultPackageFeatureLimit(plan.name)
  ),
  maxPackageFeatures: Number(
    plan.maxPackageFeaturesPerPackage ?? plan.maxPackageFeatures ?? defaultPackageFeatureLimit(plan.name)
  ),
  storage: Number(plan.storageGb ?? plan.storageGB ?? 0),
  storageGb: Number(plan.storageGb ?? plan.storageGB ?? 0),
  leadHistoryDays: Number(plan.leadHistoryDays ?? 30),
  leadVisibilityLimit: Number(plan.leadVisibilityLimit ?? 60),
  leadTemplatesCount: Number(plan.leadTemplatesCount ?? 1),
  teamSeats: Number(plan.teamSeats ?? 1),
  customDomain: Boolean(plan.customDomainEnabled ?? plan.customDomain),
  customDomainEnabled: Boolean(plan.customDomainEnabled ?? plan.customDomain),
  analyticsTools: Boolean(plan.analyticsEnabled ?? plan.analyticsTools),
  analyticsEnabled: Boolean(plan.analyticsEnabled ?? plan.analyticsTools),
  hideBrandingEnabled: Boolean(plan.hideBrandingEnabled),
  leadFiltersEnabled: Boolean(plan.leadFiltersEnabled),
  leadExportEnabled: Boolean(plan.leadExportEnabled),
  leadRemindersEnabled: Boolean(plan.leadRemindersEnabled),
  leadAdvancedAnalyticsEnabled: Boolean(plan.leadAdvancedAnalyticsEnabled),
  teamSectionTools: Boolean(plan.teamToolsEnabled ?? plan.teamSectionTools),
  teamToolsEnabled: Boolean(plan.teamToolsEnabled ?? plan.teamSectionTools),
  analyticsMode: String(plan.analyticsMode || "BASIC"),
  leadAnalyticsMode: String(plan.leadAnalyticsMode || "BASIC"),
  supportTier: String(plan.supportTier || "STANDARD"),
  brandingMode: String(plan.brandingMode || "FORCED_LENSAYA"),
  leadChannels: plan.leadChannels || { whatsapp: true, email: true },
  isVisible: Boolean(plan.isVisible ?? true),
  isActive: Boolean(plan.isActive ?? true),
  isMostPopular: Boolean(plan.isMostPopular),
});

export const toPlanDto = (plan) => ({
  id: plan.id,
  name: plan.name,
  displayName: plan.displayName || plan.name,
  tagline: plan.tagline || null,
  subtitle: plan.subtitle || null,
  badgeText: plan.badgeText || null,
  ctaText: plan.ctaText || null,
  monthlyPriceDisplay: plan.monthlyPriceDisplay || null,
  yearlyPriceDisplay: plan.yearlyPriceDisplay || null,
  sortOrder: Number(plan.sortOrder ?? 0),
  isVisible: Boolean(plan.isVisible ?? true),
  isActive: Boolean(plan.isActive ?? true),
  isMostPopular: Boolean(plan.isMostPopular),
  price: decimalToNumber(plan.price),
  yearlyPrice: decimalToNumber(plan.yearlyPrice, decimalToNumber(plan.price) * 10),
  currency: plan.currency,
  trialDays: plan.trialDays,
  referralReward: decimalToNumber(plan.referralReward),
  storageCostPerGB: decimalToNumber(plan.storageCostPerGB),
  maxServices: plan.maxServices,
  maxPortfolioImages: plan.maxPortfolioImages,
  maxPackages: Number(plan.maxPackagesPerService ?? plan.maxPackages ?? 0),
  maxPackagesPerService: Number(plan.maxPackagesPerService ?? plan.maxPackages ?? 0),
  maxPackageFeatures: Number(
    plan.maxPackageFeaturesPerPackage ?? plan.maxPackageFeatures ?? defaultPackageFeatureLimit(plan.name)
  ),
  maxPackageFeaturesPerPackage: Number(
    plan.maxPackageFeaturesPerPackage ?? plan.maxPackageFeatures ?? defaultPackageFeatureLimit(plan.name)
  ),
  storageGB: Number(plan.storageGb ?? plan.storageGB ?? 0),
  storageGb: Number(plan.storageGb ?? plan.storageGB ?? 0),
  leadHistoryDays: Number(plan.leadHistoryDays ?? 30),
  leadVisibilityLimit: Number(plan.leadVisibilityLimit ?? 60),
  leadTemplatesCount: Number(plan.leadTemplatesCount ?? 1),
  teamSeats: Number(plan.teamSeats ?? 1),
  customDomain: Boolean(plan.customDomainEnabled ?? plan.customDomain),
  customDomainEnabled: Boolean(plan.customDomainEnabled ?? plan.customDomain),
  analyticsTools: Boolean(plan.analyticsEnabled ?? plan.analyticsTools),
  analyticsEnabled: Boolean(plan.analyticsEnabled ?? plan.analyticsTools),
  hideBrandingEnabled: Boolean(plan.hideBrandingEnabled),
  leadFiltersEnabled: Boolean(plan.leadFiltersEnabled),
  leadExportEnabled: Boolean(plan.leadExportEnabled),
  leadRemindersEnabled: Boolean(plan.leadRemindersEnabled),
  leadAdvancedAnalyticsEnabled: Boolean(plan.leadAdvancedAnalyticsEnabled),
  teamSectionTools: Boolean(plan.teamToolsEnabled ?? plan.teamSectionTools),
  teamToolsEnabled: Boolean(plan.teamToolsEnabled ?? plan.teamSectionTools),
  analyticsMode: String(plan.analyticsMode || "BASIC"),
  leadAnalyticsMode: String(plan.leadAnalyticsMode || "BASIC"),
  supportTier: String(plan.supportTier || "STANDARD"),
  brandingMode: String(plan.brandingMode || "FORCED_LENSAYA"),
  leadChannels: plan.leadChannels || { whatsapp: true, email: true },
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});

export const csvEscape = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const resolveSearchTerm = (query = {}) => String(query.search || query.q || "").trim();

export const moderationSeverityFromCount = (count) => {
  const total = Number(count || 0);
  if (total >= 8) return "HIGH";
  if (total >= 3) return "MEDIUM";
  return "LOW";
};

export const normalizeModerationToken = (value) => String(value || "").trim().toUpperCase();

export const resolveModerationImageStatuses = (value) => {
  const token = normalizeModerationToken(value);
  if (!token || token === "PENDING") return ["PENDING"];
  if (token === "APPROVED") return ["READY"];
  if (token === "REMOVED") return ["DELETED", "PURGED"];
  if (token === "ALL") return null;
  if (["READY", "DELETED", "PURGED"].includes(token)) return [token];
  return ["PENDING"];
};

export const moderationAbuseLabel = (purpose) => {
  if (purpose === "PORTFOLIO") return "Portfolio";
  if (purpose === "AVATAR") return "Avatar";
  if (purpose === "BANNER") return "Banner";
  return String(purpose || "Unknown");
};

export const moderationImageReason = (status) => {
  if (status === "READY") return "Approved portfolio image";
  if (["DELETED", "PURGED"].includes(status)) return "Removed portfolio image";
  return "Pending portfolio image moderation";
};
