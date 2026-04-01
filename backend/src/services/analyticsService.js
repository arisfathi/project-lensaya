import { prisma } from "../config/prisma.js";
import { hashIp } from "../utils/crypto.js";
import { ApiError } from "../utils/apiError.js";
import { ensureTenantOwnership, isAdminTenant } from "../utils/tenantQuery.js";
import { planLimitService } from "./planLimitService.js";

const ANALYTICS_INGEST_DEDUPE_WINDOWS_MS = {
  PAGE_VIEW: 15000,
  PORTFOLIO_VIEW: 5000,
};

const SOURCE_TAXONOMY = Object.freeze([
  "direct",
  "instagram",
  "facebook",
  "whatsapp",
  "tiktok",
  "youtube",
  "x",
  "search",
  "referral",
  "other",
]);
const SOURCE_TAXONOMY_SET = new Set(SOURCE_TAXONOMY);

const ensureScopedReference = async (tenant, model, id, label) => {
  if (!id || !tenant || isAdminTenant(tenant)) return id || null;

  const resource = await prisma[model].findUnique({
    where: { id },
    select: { id: true, photographerId: true },
  });
  ensureTenantOwnership(resource, tenant, label);
  return id;
};

const sanitizeSource = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

const normalizeComparableHost = (value = "") => String(value || "").trim().toLowerCase().replace(/^www\./, "");

const parseUrlSafely = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

const classifySourceToken = (value = "") => {
  const normalized = sanitizeSource(value);
  if (!normalized) return "";
  if (normalized === "ig" || normalized.includes("instagram")) return "instagram";
  if (normalized === "fb" || normalized.includes("facebook")) return "facebook";
  if (normalized === "wa" || normalized.includes("whatsapp")) return "whatsapp";
  if (normalized === "tt" || normalized.includes("tiktok")) return "tiktok";
  if (normalized.includes("youtube") || normalized.includes("youtu")) return "youtube";
  if (normalized === "x" || normalized.includes("twitter") || normalized.includes("x_com") || normalized.includes("t_co")) {
    return "x";
  }
  if (
    normalized.includes("google") ||
    normalized.includes("bing") ||
    normalized.includes("yahoo") ||
    normalized.includes("duckduckgo") ||
    normalized.includes("search")
  ) {
    return "search";
  }
  if (normalized.includes("ref") || normalized.includes("affiliate")) return "referral";
  if (normalized.includes("direct")) return "direct";
  if (SOURCE_TAXONOMY_SET.has(normalized)) return normalized;
  return "other";
};

const classifyHostSource = (hostname = "") => {
  const host = normalizeComparableHost(hostname);
  if (!host) return "direct";
  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook") || host.includes("fb.")) return "facebook";
  if (host.includes("whatsapp") || host.includes("wa.me")) return "whatsapp";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
  if (host.includes("x.com") || host.includes("twitter") || host.includes("t.co")) return "x";
  if (host.includes("google.") || host.includes("bing.") || host.includes("yahoo.") || host.includes("duckduckgo.")) {
    return "search";
  }
  return "referral";
};

const hasReferralQuerySignal = (params) => {
  const ref = String(params.get("ref") || "").trim();
  const referralCode = String(params.get("referral") || params.get("referral_code") || "").trim();
  return Boolean(ref || referralCode);
};

const extractSourceFromPageSignals = ({ pageUrl, path }) => {
  const page = parseUrlSafely(pageUrl);
  const pathToken = String(path || "").trim();
  const pathQueryIndex = pathToken.indexOf("?");
  const pathQuery = pathQueryIndex >= 0 ? pathToken.slice(pathQueryIndex + 1) : "";
  const params = new URLSearchParams(page?.search || pathQuery || "");

  const utmSource = classifySourceToken(params.get("utm_source") || "");
  if (utmSource) return utmSource;

  const source = classifySourceToken(params.get("source") || "");
  if (source) return source;

  if (hasReferralQuerySignal(params)) return "referral";
  if (params.has("gclid")) return "search";
  if (params.has("fbclid")) return "facebook";
  if (params.has("ttclid")) return "tiktok";
  return "";
};

const inferSourceFromReferrer = ({ referrer = "", requestHost = "", pageUrl = "" } = {}) => {
  const value = String(referrer || "").trim();
  if (!value) return "direct";

  try {
    const url = new URL(value);
    const referrerHost = normalizeComparableHost(url.hostname || "");
    const requestComparableHost = normalizeComparableHost(requestHost);
    const pageComparableHost = normalizeComparableHost(parseUrlSafely(pageUrl)?.hostname || "");

    if (
      referrerHost &&
      (referrerHost === requestComparableHost ||
        referrerHost === pageComparableHost ||
        (requestComparableHost && requestComparableHost.endsWith(`.${referrerHost}`)) ||
        (referrerHost && referrerHost.endsWith(`.${requestComparableHost}`)) ||
        (pageComparableHost && pageComparableHost.endsWith(`.${referrerHost}`)) ||
        (referrerHost && referrerHost.endsWith(`.${pageComparableHost}`)))
    ) {
      return "direct";
    }

    return classifyHostSource(url.hostname || "");
  } catch {
    return "referral";
  }
};

const resolveSource = ({ source, referrer, pageUrl, path, requestHost }) => {
  const fromPageSignals = extractSourceFromPageSignals({ pageUrl, path });
  if (fromPageSignals) {
    return fromPageSignals;
  }

  const fromSource = classifySourceToken(source);
  if (fromSource) {
    return fromSource;
  }

  return inferSourceFromReferrer({ referrer, requestHost, pageUrl });
};

const normalizeEventType = (eventType) => String(eventType || "").trim().toUpperCase();
const normalizePath = (path) => {
  const normalized = String(path || "").trim();
  return normalized ? normalized.slice(0, 512) : null;
};

const buildDedupeWhere = ({ eventType, photographerId, serviceId, packageId, portfolioItemId, bookingId, userId, sessionId, visitorId, path, source, windowStart }) => {
  if (!eventType || !windowStart) return null;
  if (!visitorId && !sessionId && !userId) return null;

  const identityFilter = [];
  if (visitorId) identityFilter.push({ visitorId });
  if (sessionId) identityFilter.push({ sessionId });
  if (userId) identityFilter.push({ userId });

  return {
    eventType,
    photographerId,
    serviceId,
    packageId,
    portfolioItemId,
    bookingId,
    path,
    source,
    createdAt: { gte: windowStart },
    OR: identityFilter,
  };
};

export const analyticsService = {
  async ingest(event, tenant = null) {
    const eventType = normalizeEventType(event.eventType);
    const photographerId = tenant?.photographerId || event.photographerId || null;
    const serviceId = await ensureScopedReference(tenant, "service", event.serviceId, "Service");
    const packageId = await ensureScopedReference(tenant, "package", event.packageId, "Package");
    const portfolioItemId = await ensureScopedReference(tenant, "portfolioItem", event.portfolioItemId, "Portfolio item");
    const bookingId = await ensureScopedReference(tenant, "booking", event.bookingId, "Booking");
    const source = resolveSource({
      source: event.source,
      referrer: event.referrer,
      pageUrl: event.pageUrl,
      path: event.path,
      requestHost: event.requestHost,
    });
    const path = normalizePath(event.path);
    const userId = event.userId || null;
    const sessionId = event.sessionId || null;
    const visitorId = event.visitorId || null;

    const dedupeWindowMs = ANALYTICS_INGEST_DEDUPE_WINDOWS_MS[eventType] || 0;
    if (dedupeWindowMs > 0) {
      const dedupeWhere = buildDedupeWhere({
        eventType,
        photographerId,
        serviceId,
        packageId,
        portfolioItemId,
        bookingId,
        userId,
        sessionId,
        visitorId,
        path,
        source,
        windowStart: new Date(Date.now() - dedupeWindowMs),
      });

      if (dedupeWhere) {
        const duplicate = await prisma.analyticsEvent.findFirst({
          where: dedupeWhere,
          orderBy: { createdAt: "desc" },
        });

        if (duplicate) {
          return duplicate;
        }
      }
    }

    return prisma.analyticsEvent.create({
      data: {
        eventType,
        photographerId,
        serviceId,
        packageId,
        portfolioItemId,
        bookingId,
        userId,
        sessionId,
        visitorId,
        source,
        path,
        ipHash: hashIp(event.ipAddress || ""),
        userAgent: event.userAgent || null,
        referrer: event.referrer || null,
        metadata: event.metadata || null,
      },
    });
  },

  async recordEvent(data) {
    const dedupeWindowStart = new Date(Date.now() - 5000);

    if (data.visitorId && data.photographerId) {
      const duplicate = await prisma.analyticsEvent.findFirst({
        where: {
          eventType: "PORTFOLIO_VIEW",
          visitorId: data.visitorId,
          photographerId: data.photographerId,
          createdAt: {
            gte: dedupeWindowStart,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (duplicate) {
        return { event: duplicate, deduplicated: true };
      }
    }

    const event = await prisma.analyticsEvent.create({
      data: {
        eventType: "PORTFOLIO_VIEW",
        photographerId: data.photographerId,
        serviceId: data.serviceId || null,
        packageId: data.packageId || null,
        portfolioItemId: data.portfolioItemId || null,
        sessionId: data.sessionId || null,
        visitorId: data.visitorId || null,
        source: resolveSource({
          source: data.source,
          referrer: data.referrer,
          pageUrl: data.pageUrl,
          path: data.path,
          requestHost: data.requestHost,
        }),
        path: data.path || null,
        ipHash: hashIp(data.ipAddress || ""),
        userAgent: data.userAgent || null,
        metadata: data.metadata || null,
        createdAt: new Date(),
      },
    });

    return { event, deduplicated: false };
  },

  async categoriesByPhotographer(tenant) {
    const photographerId = tenant?.photographerId || null;

    if (!photographerId) {
      throw new ApiError(403, "Access denied");
    }
    await planLimitService.assertAnalyticsToolsAccessByPhotographerId(photographerId);

    const services = await prisma.service.findMany({
      where: {
        photographerId,
        status: { not: "ARCHIVED" },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { displayOrder: "asc" },
    });

    if (services.length === 0) {
      return { categories: [] };
    }

    const serviceIds = services.map((service) => service.id);
    let groupedViews = [];
    try {
      groupedViews = await prisma.analyticsDailyServiceRollup.findMany({
        where: {
          photographerId,
          eventType: "PORTFOLIO_VIEW",
          serviceId: { in: serviceIds },
        },
        select: {
          serviceId: true,
          eventCount: true,
        },
      });
    } catch {
      groupedViews = await prisma.analyticsEvent
        .groupBy({
          by: ["serviceId"],
          where: {
            photographerId,
            eventType: "PORTFOLIO_VIEW",
            serviceId: { in: serviceIds },
          },
          _count: {
            _all: true,
          },
        })
        .then((rows) => rows.map((row) => ({ serviceId: row.serviceId, eventCount: Number(row._count?._all || 0) })));
    }

    const viewCountByServiceId = new Map();
    for (const row of groupedViews) {
      if (!row?.serviceId) continue;
      viewCountByServiceId.set(row.serviceId, (viewCountByServiceId.get(row.serviceId) || 0) + Number(row?.eventCount || 0));
    }

    const categories = services
      .map((service) => ({
        name: service.name,
        views: viewCountByServiceId.get(service.id) || 0,
      }))
      .filter((item) => item.views > 0);

    return { categories };
  },
};
