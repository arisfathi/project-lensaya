import { ApiError } from "../../utils/apiError.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../config/prisma.js";
import { FREE_ANALYTICS_LOCKED_SECTIONS } from "./photographerService.constants.js";

export const requireTenantPhotographerId = (tenant) => {
  if (!tenant?.photographerId) {
    throw new ApiError(403, "Access denied");
  }
  return tenant.photographerId;
};

export const normalizePackageFeatures = (features) => {
  if (!Array.isArray(features)) return [];
  return features
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

export const enforcePackageFeatureLimit = ({ plan, features }) => {
  const normalizedPlan = String(plan?.name || "FREE").trim().toUpperCase() || "FREE";
  const limit = Number(
    plan?.maxPackageFeatures ??
      (normalizedPlan === "PRO" ? 10 : normalizedPlan === "STUDIO" ? 20 : 5)
  );
  const count = Array.isArray(features) ? features.length : 0;

  if (!Number.isFinite(limit) || limit < 0 || count <= limit) {
    return;
  }

  throw new ApiError(
    403,
    `You can only add up to ${limit} package features on the ${normalizedPlan} plan. Reduce features or upgrade your plan.`
  );
};

export const monthRange = (month) => {
  const target = month || new Date().toISOString().slice(0, 7);
  const start = new Date(`${target}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { target, start, end };
};

export const normalizeAvailabilityStatusValue = (value) =>
  String(value || "").trim().toUpperCase() === "AVAILABLE" ? "AVAILABLE" : "BOOKED";
export const toNormalizedAvailabilityDayStatus = (value) =>
  normalizeAvailabilityStatusValue(value) === "BOOKED" ? "booked" : "available";

export const toUtcDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const addDays = (date, delta) => {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
};
export const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const sourceLabel = (value) => {
  if (!value || value === "direct") return "Direct";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const buildAnalyticsAccess = (plan) => {
  const tier = String(plan?.name || "FREE").trim().toUpperCase() || "FREE";
  const hasFullAccess = Boolean(plan?.analyticsTools);

  return {
    tier,
    hasFullAccess,
    upgradeTarget: hasFullAccess ? null : "PRO",
    lockedSections: hasFullAccess ? [] : FREE_ANALYTICS_LOCKED_SECTIONS,
  };
};

export const rankCategorySeries = (series = []) =>
  [...series].sort(
    (a, b) =>
      Number(b?.views || 0) - Number(a?.views || 0) ||
      String(a?.name || "").localeCompare(String(b?.name || ""))
  );

export const toNullableText = (value, maxLength = null) => {
  if (value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  if (!normalized) return null;
  if (Number.isInteger(maxLength) && maxLength > 0) {
    return normalized.slice(0, maxLength);
  }
  return normalized;
};

export const normalizeSocialSlug = (value, domain) => {
  if (value === undefined) {
    return undefined;
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  let normalized = raw.replace(/^@+/, "");

  try {
    const candidate = /^[a-z]+:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === domain || host.endsWith(`.${domain}`)) {
      normalized = parsed.pathname.split("/").filter(Boolean)[0] || "";
    }
  } catch {
    // Fall back to manual parsing for raw handles/slugs.
  }

  const escapedDomain = domain.replace(/\./g, "\\.");
  normalized = normalized
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(new RegExp(`^(?:m\\.)?${escapedDomain}\\/?`, "i"), "")
    .split(/[?#]/)[0];
  normalized = (normalized.split("/").filter(Boolean)[0] || normalized).replace(/^@+/, "").trim();

  return normalized || null;
};

export const normalizeInstagramHandle = (value) => normalizeSocialSlug(value, "instagram.com");
export const normalizeFacebookSlug = (value) => normalizeSocialSlug(value, "facebook.com");
export const normalizeTiktokHandle = (value) => normalizeSocialSlug(value, "tiktok.com");

export const normalizeWhatsappNumber = (value) => {
  if (value === undefined) {
    return undefined;
  }

  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : null;
};

export const normalizeTeamMembers = (members) => {
  if (!Array.isArray(members)) {
    return [];
  }

  return members
    .map((member) => {
      const name = toNullableText(member?.name, 191);
      const role = toNullableText(member?.role, 191);
      const image = toNullableText(member?.image, 1024);

      if (!name || !role || !image) {
        return null;
      }

      return { name, role, image };
    })
    .filter(Boolean)
    .slice(0, 12);
};

export const getPortfolioViewCategorySeries = async (photographerId, metricsStart = null) => {
  const services = await prisma.service.findMany({
    where: {
      photographerId,
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  if (services.length === 0) {
    return [];
  }

  const serviceIds = services.map((service) => service.id);
  let groupedViews = [];

  try {
    groupedViews = await prisma.analyticsDailyServiceRollup.findMany({
      where: {
        photographerId,
        eventType: "PORTFOLIO_VIEW",
        serviceId: { in: serviceIds },
        ...(metricsStart ? { date: { gte: metricsStart } } : {}),
      },
      select: {
        serviceId: true,
        eventCount: true,
      },
    });
  } catch (error) {
    logger.warn(
      { err: error, photographerId },
      "Analytics daily service rollups unavailable, falling back to raw analytics events"
    );

    groupedViews = await prisma.analyticsEvent.groupBy({
      by: ["serviceId"],
      where: {
        photographerId,
        eventType: "PORTFOLIO_VIEW",
        serviceId: { in: serviceIds },
        ...(metricsStart ? { createdAt: { gte: metricsStart } } : {}),
      },
      _count: {
        _all: true,
      },
    }).then((rows) => rows.map((row) => ({ serviceId: row.serviceId, eventCount: Number(row._count?._all || 0) })));
  }

  const viewCountByServiceId = new Map();
  for (const row of groupedViews) {
    if (!row?.serviceId) continue;
    viewCountByServiceId.set(
      row.serviceId,
      (viewCountByServiceId.get(row.serviceId) || 0) + Number(row?.eventCount || 0)
    );
  }

  return services
    .map((service) => ({
      name: service.name,
      views: viewCountByServiceId.get(service.id) || 0,
    }))
    .filter((item) => item.views > 0);
};

export const loadAnalyticsRollupSnapshot = async ({ photographerId, trafficStart, metricsStart }) => {
  try {
    const [trafficRollups, metricRollups, sourceRollups, monthlyVisitorRows] = await Promise.all([
      prisma.analyticsDailyEventRollup.findMany({
        where: {
          photographerId,
          eventType: "PAGE_VIEW",
          date: { gte: trafficStart },
        },
        select: { date: true, eventCount: true },
      }),
      prisma.analyticsDailyEventRollup.findMany({
        where: {
          photographerId,
          date: { gte: metricsStart },
        },
        select: { eventType: true, eventCount: true },
      }),
      prisma.analyticsDailyEventRollup.findMany({
        where: {
          photographerId,
          eventType: "PAGE_VIEW",
          date: { gte: metricsStart },
        },
        select: { source: true, eventCount: true },
      }),
      prisma.analyticsDailyVisitorRollup.groupBy({
        by: ["visitorId"],
        where: {
          photographerId,
          date: { gte: metricsStart },
        },
      }),
    ]);

    if (metricRollups.length === 0) {
      const rawEventsInRange = await prisma.analyticsEvent.count({
        where: {
          photographerId,
          createdAt: { gte: metricsStart },
        },
      });

      if (rawEventsInRange > 0) {
        return null;
      }
    }

    return {
      trafficRollups,
      metricRollups,
      sourceRollups,
      monthlyVisitors: monthlyVisitorRows.length,
      usingRollups: true,
    };
  } catch (error) {
    logger.warn(
      { err: error, photographerId },
      "Analytics rollups unavailable, falling back to raw analytics events"
    );
    return null;
  }
};
