import { prisma } from "../config/prisma.js";
import { hashIp } from "../utils/crypto.js";
import { ApiError } from "../utils/apiError.js";
import { ensureTenantOwnership, isAdminTenant } from "../utils/tenantQuery.js";
import { planLimitService } from "./planLimitService.js";

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

const classifyHostSource = (hostname = "") => {
  const host = String(hostname || "").toLowerCase();
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

const inferSourceFromReferrer = (referrer = "") => {
  const value = String(referrer || "").trim();
  if (!value) return "direct";

  try {
    const url = new URL(value);
    return classifyHostSource(url.hostname || "");
  } catch {
    return "referral";
  }
};

const resolveSource = ({ source, referrer }) => {
  const normalized = sanitizeSource(source);
  if (normalized) {
    return normalized;
  }
  return inferSourceFromReferrer(referrer);
};

export const analyticsService = {
  async ingest(event, tenant = null) {
    const photographerId = tenant?.photographerId || event.photographerId || null;
    const serviceId = await ensureScopedReference(tenant, "service", event.serviceId, "Service");
    const packageId = await ensureScopedReference(tenant, "package", event.packageId, "Package");
    const portfolioItemId = await ensureScopedReference(tenant, "portfolioItem", event.portfolioItemId, "Portfolio item");
    const bookingId = await ensureScopedReference(tenant, "booking", event.bookingId, "Booking");

    return prisma.analyticsEvent.create({
      data: {
        eventType: event.eventType,
        photographerId,
        serviceId,
        packageId,
        portfolioItemId,
        bookingId,
        userId: event.userId || null,
        sessionId: event.sessionId || null,
        visitorId: event.visitorId || null,
        source: resolveSource({ source: event.source, referrer: event.referrer }),
        path: event.path || null,
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
        source: resolveSource({ source: data.source, referrer: data.referrer }),
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
    const groupedViews = await prisma.analyticsEvent.groupBy({
      by: ["serviceId"],
      where: {
        photographerId,
        eventType: "PORTFOLIO_VIEW",
        serviceId: { in: serviceIds },
      },
      _count: {
        _all: true,
      },
    });

    const viewCountByServiceId = new Map(
      groupedViews
        .filter((row) => Boolean(row.serviceId))
        .map((row) => [row.serviceId, Number(row._count?._all || 0)])
    );

    const categories = services
      .map((service) => ({
        name: service.name,
        views: viewCountByServiceId.get(service.id) || 0,
      }))
      .filter((item) => item.views > 0);

    return { categories };
  },
};
