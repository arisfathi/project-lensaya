import { prisma } from "../config/prisma.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { resolveAssetUrl, hasProcessedVariants } from "../utils/assetVariants.js";
import { enqueueImageProcessing } from "../jobs/imageProcessingQueue.js";
import { redisCache } from "../utils/redisCache.js";
import { planLimitService } from "./planLimitService.js";
import {
  DEFAULT_PUBLIC_PRICING_CONTENT,
  PUBLIC_PRICING_CONTENT_SETTING_KEY,
  normalizePublicPricingContent,
} from "../utils/publicPricingContent.js";

const ACTIVE_SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"];

const PUBLIC_PROFILE_CACHE_TTL_SECONDS = 30;
const PUBLIC_PROFILE_CACHE_PREFIX = "cache:public-profile:v1:";
const PUBLIC_SERVICES_CACHE_TTL_SECONDS = 30;
const PUBLIC_SERVICES_CACHE_PREFIX = "cache:public-services:v1:";
const PUBLIC_PORTFOLIO_CACHE_TTL_SECONDS = 20;
const PUBLIC_PORTFOLIO_CACHE_PREFIX = "cache:public-portfolio:v1:";
const PUBLIC_GALLERY_CACHE_TTL_SECONDS = 20;
const PUBLIC_GALLERY_CACHE_PREFIX = "cache:public-gallery:v1:";
const PUBLIC_PACKAGES_CACHE_TTL_SECONDS = 30;
const PUBLIC_PACKAGES_CACHE_PREFIX = "cache:public-packages:v1:";

const PUBLIC_SERVICES_MAX_LIMIT = 100;
const PUBLIC_SERVICE_PREVIEW_DEFAULT_LIMIT = 120;
const PUBLIC_SERVICE_PREVIEW_MAX_LIMIT = 300;
const PUBLIC_GALLERY_DEFAULT_LIMIT = 120;
const PUBLIC_GALLERY_MAX_LIMIT = 500;
const PUBLIC_PACKAGES_DEFAULT_LIMIT = 40;
const PUBLIC_PACKAGES_MAX_LIMIT = 100;
const PUBLIC_CONTENT_DEFAULT_LIMIT = 20;
const PUBLIC_CONTENT_MAX_LIMIT = 100;
const PUBLIC_CONTENT_SECTIONS = ["RESOURCES", "HELP_CENTER", "BLOG", "GUIDES", "ABOUT", "CONTACT", "LEGAL"];
const DEMO_PRIORITY_USERNAME = "lensaya";

const scheduleVariantBackfill = (asset) => {
  if (!asset?.id || hasProcessedVariants(asset)) return;
  void enqueueImageProcessing({
    assetId: asset.id,
    jobId: `asset:${asset.id}`,
  });
};

const resolvePublicAssetUrl = (asset, preferredVariant = "web") => {
  if (!asset) return null;
  scheduleVariantBackfill(asset);
  return resolveAssetUrl(asset, preferredVariant);
};

const toNullableText = (value, maxLength = 191) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const toPriceCents = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
};

const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const normalizeAvailabilityStatus = (value) =>
  String(value || "").trim().toUpperCase() === "AVAILABLE" ? "available" : "booked";

const normalizeTeamMembers = (members) => {
  if (!Array.isArray(members)) return [];
  return members
    .map((member) => {
      const name = toNullableText(member?.name, 191);
      const role = toNullableText(member?.role, 191);
      const image = toNullableText(member?.image, 1024);
      if (!name || !role || !image) return null;
      return { name, role, image };
    })
    .filter(Boolean)
    .slice(0, 12);
};

const mapPublicPhotographer = (p) => ({
  username: p.username,
  studioName: p.studioName,
  category: p.specialty || null,
  imageUrl: resolvePublicAssetUrl(p.avatarAsset, "thumb"),
  location: p.location || null,
  city: p.city || null,
  country: p.country || null,
  specialty: p.specialty || null,
  style: p.style || null,
});

const mapFeaturedPhotographer = (item) => {
  const photographer = item?.photographer;
  if (!photographer) return null;

  const imageUrl = resolvePublicAssetUrl(item.asset, "web");
  if (!imageUrl) return null;

  return {
    username: photographer.username,
    studioName: photographer.studioName,
    category: toNullableText(item.category, 64) || photographer.specialty || null,
    imageUrl,
    location: photographer.location || null,
    city: photographer.city || null,
    country: photographer.country || null,
    specialty: photographer.specialty || null,
    style: photographer.style || null,
  };
};

const prioritizeDemoFirst = (items = []) => {
  const normalized = Array.isArray(items) ? items.filter(Boolean) : [];
  const index = normalized.findIndex(
    (item) => String(item?.username || "").trim().toLowerCase() === DEMO_PRIORITY_USERNAME
  );
  if (index <= 0) return normalized;

  const copy = normalized.slice();
  const [demo] = copy.splice(index, 1);
  copy.unshift(demo);
  return copy;
};

const toPublicProfileCacheKey = (username) => {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) return null;
  return `${PUBLIC_PROFILE_CACHE_PREFIX}${normalized}`;
};

const toPublicListCacheKey = (prefix, username, segments = []) => {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) return null;
  const suffix = segments
    .map((segment) => String(segment ?? "").trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "_"))
    .join(":");
  return `${prefix}${normalized}${suffix ? `:${suffix}` : ""}`;
};

export const publicService = {
  async pricingContent() {
    const row = await prisma.platformSetting.findUnique({
      where: { key: PUBLIC_PRICING_CONTENT_SETTING_KEY },
      select: { value: true, updatedAt: true },
    });

    const normalized = normalizePublicPricingContent(row?.value || null, DEFAULT_PUBLIC_PRICING_CONTENT);

    return {
      ...normalized,
      updatedAt: row?.updatedAt || null,
    };
  },

  async content(query = {}) {
    const section = String(query.section || "").trim().toUpperCase();
    const safeSection = PUBLIC_CONTENT_SECTIONS.includes(section) ? section : null;
    const requestedLimit = Number(query.limit);
    const take = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.floor(requestedLimit), PUBLIC_CONTENT_MAX_LIMIT))
      : PUBLIC_CONTENT_DEFAULT_LIMIT;

    const items = await prisma.cmsContent.findMany({
      where: {
        status: "PUBLISHED",
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
        ...(safeSection ? { section: safeSection } : {}),
      },
      orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        section: item.section,
        slug: item.slug,
        title: item.title,
        excerpt: item.excerpt,
        contentMarkdown: item.contentMarkdown,
        sortOrder: item.sortOrder,
        publishedAt: item.publishedAt,
        updatedAt: item.updatedAt,
      })),
    };
  },

  async featured({ limit = 6, service }) {
    const normalizedService = toNullableText(service, 128);
    const safeLimit = Math.max(1, Math.min(Number(limit) || 6, 24));
    const where = {
      photographer: {
        isDirectoryVisible: true,
        status: "ACTIVE",
        ...(normalizedService
          ? {
              services: {
                some: {
                  name: { contains: normalizedService, mode: "insensitive" },
                  status: "ACTIVE",
                },
              },
            }
          : {}),
      },
      ...(normalizedService
        ? {
            service: {
              is: {
                name: { contains: normalizedService, mode: "insensitive" },
                status: "ACTIVE",
              },
            },
          }
        : {}),
    };

    const rows = await prisma.portfolioItem.findMany({
      where,
      include: {
        asset: true,
        photographer: true,
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: Math.max(safeLimit * 3, 24),
    });

    const items = [];
    const seenPhotographers = new Set();
    for (const row of rows) {
      if (seenPhotographers.has(row.photographerId)) continue;
      const preview = mapFeaturedPhotographer(row);
      if (!preview) continue;
      seenPhotographers.add(row.photographerId);
      items.push(preview);
      if (items.length >= safeLimit) break;
    }

    return { items: prioritizeDemoFirst(items) };
  },

  async directory(query) {
    const { page, limit, skip, take } = getPagination(query);
    const city = toNullableText(query.city, 128);
    const specialty = toNullableText(query.specialty, 128);
    const minPriceCents = toPriceCents(query.minPrice);
    const maxPriceCents = toPriceCents(query.maxPrice);
    const packagePriceWhere =
      minPriceCents !== null || maxPriceCents !== null
        ? {
            some: {
              status: "ACTIVE",
              ...(minPriceCents !== null || maxPriceCents !== null
                ? {
                    priceCents: {
                      ...(minPriceCents !== null ? { gte: minPriceCents } : {}),
                      ...(maxPriceCents !== null ? { lte: maxPriceCents } : {}),
                    },
                  }
                : {}),
            },
          }
        : undefined;

    const where = {
      isDirectoryVisible: true,
      status: "ACTIVE",
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
      ...(specialty ? { specialty: { contains: specialty, mode: "insensitive" } } : {}),
      ...(packagePriceWhere ? { packages: packagePriceWhere } : {}),
      ...(query.search
        ? {
            OR: [
              { studioName: { contains: query.search, mode: "insensitive" } },
              { username: { contains: query.search, mode: "insensitive" } },
              { location: { contains: query.search, mode: "insensitive" } },
              { city: { contains: query.search, mode: "insensitive" } },
              { country: { contains: query.search, mode: "insensitive" } },
              { specialty: { contains: query.search, mode: "insensitive" } },
              { style: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.photographer.findMany({
        where,
        skip,
        take,
        include: { avatarAsset: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.photographer.count({ where }),
    ]);

    return {
      items: prioritizeDemoFirst(items.map(mapPublicPhotographer)),
      pagination: buildPagination(page, limit, total),
    };
  },

  async profileByUsername(username) {
    const cacheKey = toPublicProfileCacheKey(username);
    if (cacheKey) {
      const cached = await redisCache.getJson(cacheKey);
      if (cached && typeof cached === "object") {
        return cached;
      }
    }

    const p = await prisma.photographer.findFirst({
      where: { username, status: "ACTIVE" },
      include: {
        avatarAsset: true,
        bannerAsset: true,
      },
    });
    if (!p) return null;

    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        photographerId: p.id,
        status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      select: { plan: true },
    });

    const planName = String(activeSubscription?.plan || "FREE").toUpperCase();
    const entitlements = await planLimitService.getPlanEntitlements(planName);
    const canHideBranding =
      Boolean(entitlements?.features?.hideBrandingEnabled) &&
      String(entitlements?.modes?.brandingMode || "FORCED_LENSAYA") === "REMOVABLE";
    const showLensayaBranding = !(canHideBranding && p.hideBranding);
    const teamSectionAllowed = Boolean(entitlements?.features?.teamToolsEnabled);

    const response = {
      id: p.id,
      username: p.username,
      studioName: p.studioName,
      name: p.studioName,
      bio: p.bio,
      avatarUrl: resolvePublicAssetUrl(p.avatarAsset, "thumb"),
      heroTitle: p.heroTitle,
      heroSubtitle: p.heroSubtitle,
      heroImageUrl: p.heroImageUrl || resolvePublicAssetUrl(p.bannerAsset, "web"),
      showHero: p.showHero,
      teamSection: {
        enabled: teamSectionAllowed ? Boolean(p.showTeamSection) : false,
        canManage: false,
        members: teamSectionAllowed ? normalizeTeamMembers(p.teamMembers) : [],
      },
      location: p.location,
      city: p.city,
      country: p.country,
      specialty: p.specialty,
      style: p.style,
      showLensayaBranding,
      socialLinks: {
        instagram: p.instagramHandle,
        facebook: p.facebookUrl,
        tiktok: p.tiktokHandle,
      },
      whatsappNumber: p.whatsappNumber,
      phone: p.phone,
      themeColor: p.themeColor,
    };

    if (cacheKey) {
      await redisCache.setJson(cacheKey, response, PUBLIC_PROFILE_CACHE_TTL_SECONDS);
    }

    return response;
  },

  async services(username, query = {}) {
    const requestedServicesLimit = Number(query?.limit);
    const serviceTake = Number.isFinite(requestedServicesLimit)
      ? Math.max(1, Math.min(Math.floor(requestedServicesLimit), PUBLIC_SERVICES_MAX_LIMIT))
      : PUBLIC_SERVICES_MAX_LIMIT;

    const requestedPreviewLimit = Number(query?.previewLimit);
    const previewTake = Number.isFinite(requestedPreviewLimit)
      ? Math.max(1, Math.min(Math.floor(requestedPreviewLimit), PUBLIC_SERVICE_PREVIEW_MAX_LIMIT))
      : PUBLIC_SERVICE_PREVIEW_DEFAULT_LIMIT;

    const cacheKey = toPublicListCacheKey(PUBLIC_SERVICES_CACHE_PREFIX, username, [
      `services_limit:${serviceTake}`,
      `preview_limit:${previewTake}`,
    ]);
    if (cacheKey) {
      const cached = await redisCache.getJson(cacheKey);
      if (cached && typeof cached === "object") {
        return cached;
      }
    }

    const photographer = await prisma.photographer.findFirst({ where: { username, status: "ACTIVE" } });
    if (!photographer) return null;

    const [totalServices, items, portfolioImages] = await Promise.all([
      prisma.service.count({
        where: { photographerId: photographer.id, status: "ACTIVE" },
      }),
      prisma.service.findMany({
        where: { photographerId: photographer.id, status: "ACTIVE" },
        orderBy: { displayOrder: "asc" },
        include: { thumbnailAsset: true },
        take: serviceTake,
      }),
      prisma.portfolioItem.findMany({
        where: {
          photographerId: photographer.id,
          serviceId: { not: null },
        },
        include: { asset: true },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: previewTake,
      }),
    ]);

    const response = {
      services: items.map((s) => ({
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        thumbnailUrl: resolvePublicAssetUrl(s.thumbnailAsset, "thumb"),
        order: s.displayOrder,
      })),
      portfolioImages: portfolioImages.map((item) => ({
        id: item.id,
        imageUrl: resolvePublicAssetUrl(item.asset, "web"),
        serviceId: item.serviceId,
      })),
      preview: {
        servicesLimit: serviceTake,
        previewImagesLimit: previewTake,
        hasMoreServices: totalServices > serviceTake,
      },
    };

    if (cacheKey) {
      await redisCache.setJson(cacheKey, response, PUBLIC_SERVICES_CACHE_TTL_SECONDS);
    }

    return response;
  },

  async portfolio(username, query = {}) {
    const { page, limit, skip, take } = getPagination(query);
    const serviceId = toNullableText(query?.serviceId, 191) || "all";

    const cacheKey = toPublicListCacheKey(PUBLIC_PORTFOLIO_CACHE_PREFIX, username, [
      `page:${page}`,
      `take:${take}`,
      `service:${serviceId}`,
    ]);
    if (cacheKey) {
      const cached = await redisCache.getJson(cacheKey);
      if (cached && typeof cached === "object") {
        return cached;
      }
    }

    const photographer = await prisma.photographer.findFirst({ where: { username, status: "ACTIVE" } });
    if (!photographer) return null;

    const where = {
      photographerId: photographer.id,
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.portfolioItem.findMany({
        where,
        skip,
        take,
        include: { asset: true },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      }),
      prisma.portfolioItem.count({ where }),
    ]);

    const response = {
      items: items.map((item) => ({
        id: item.id,
        imageUrl: resolvePublicAssetUrl(item.asset, "web"),
        serviceId: item.serviceId,
        category: item.category,
        featured: item.isFeatured,
        views: item.viewsCount,
      })),
      pagination: buildPagination(page, limit, total),
    };

    if (cacheKey) {
      await redisCache.setJson(cacheKey, response, PUBLIC_PORTFOLIO_CACHE_TTL_SECONDS);
    }

    return response;
  },

  async gallery(username, query = {}) {
    const { page, limit, skip } = getPagination(query);
    const take = Math.max(1, Math.min(limit || PUBLIC_GALLERY_DEFAULT_LIMIT, PUBLIC_GALLERY_MAX_LIMIT));
    const category = toNullableText(query?.category, 128) || "all";

    const cacheKey = toPublicListCacheKey(PUBLIC_GALLERY_CACHE_PREFIX, username, [
      `page:${page}`,
      `take:${take}`,
      `category:${category}`,
    ]);
    if (cacheKey) {
      const cached = await redisCache.getJson(cacheKey);
      if (cached && typeof cached === "object") {
        return cached;
      }
    }

    const photographer = await prisma.photographer.findFirst({ where: { username, status: "ACTIVE" } });
    if (!photographer) return null;

    const where = {
      photographerId: photographer.id,
      ...(query.category
        ? {
            category: {
              equals: query.category,
              mode: "insensitive",
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.portfolioItem.findMany({
        where,
        include: { asset: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.portfolioItem.count({ where }),
    ]);

    const response = {
      items: items.map((item) => ({
        id: item.id,
        imageUrl: resolvePublicAssetUrl(item.asset, "web"),
        serviceId: item.serviceId,
        category: item.category,
        featured: item.isFeatured,
        views: item.viewsCount,
        createdAt: item.createdAt,
      })),
      pagination: buildPagination(page, take, total),
    };

    if (cacheKey) {
      await redisCache.setJson(cacheKey, response, PUBLIC_GALLERY_CACHE_TTL_SECONDS);
    }

    return response;
  },

  async packages(username, query = {}) {
    const { page, limit, skip } = getPagination(query);
    const take = Math.max(1, Math.min(limit || PUBLIC_PACKAGES_DEFAULT_LIMIT, PUBLIC_PACKAGES_MAX_LIMIT));
    const serviceId = toNullableText(query?.serviceId, 191) || "all";

    const cacheKey = toPublicListCacheKey(PUBLIC_PACKAGES_CACHE_PREFIX, username, [
      `page:${page}`,
      `take:${take}`,
      `service:${serviceId}`,
    ]);
    if (cacheKey) {
      const cached = await redisCache.getJson(cacheKey);
      if (cached && typeof cached === "object") {
        return cached;
      }
    }

    const photographer = await prisma.photographer.findFirst({ where: { username, status: "ACTIVE" } });
    if (!photographer) return null;

    const where = {
      photographerId: photographer.id,
      status: "ACTIVE",
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.package.findMany({
        where,
        orderBy: [{ isPopular: "desc" }, { displayOrder: "asc" }],
        skip,
        take,
      }),
      prisma.package.count({ where }),
    ]);

    const response = {
      items: items.map((pkg) => ({
        id: pkg.id,
        serviceId: pkg.serviceId,
        name: pkg.name,
        price: pkg.priceCents / 100,
        currency: pkg.currency,
        duration: pkg.durationLabel,
        features: pkg.features,
      })),
      pagination: buildPagination(page, take, total),
    };

    if (cacheKey) {
      await redisCache.setJson(cacheKey, response, PUBLIC_PACKAGES_CACHE_TTL_SECONDS);
    }

    return response;
  },

  async availability(username, month) {
    const photographer = await prisma.photographer.findFirst({ where: { username, status: "ACTIVE" } });
    if (!photographer) return null;

    const target = month || new Date().toISOString().slice(0, 7);
    const start = new Date(`${target}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const [days, bookings] = await Promise.all([
      prisma.availability.findMany({
        where: {
          photographerId: photographer.id,
          date: { gte: start, lt: end },
        },
        orderBy: { date: "asc" },
      }),
      prisma.booking.findMany({
        where: {
          photographerId: photographer.id,
          preferredDate: { gte: start, lt: end },
          status: { in: ["CONFIRMED", "COMPLETED"] },
        },
        select: { preferredDate: true },
      }),
    ]);

    const dayMap = new Map();
    for (const day of days) {
      const key = toDateKey(day.date);
      if (!key) continue;
      dayMap.set(key, normalizeAvailabilityStatus(day.status));
    }
    for (const booking of bookings) {
      const key = toDateKey(booking.preferredDate);
      if (!key) continue;
      if (!dayMap.has(key)) {
        dayMap.set(key, "booked");
      }
    }

    const mergedDays = Array.from(dayMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, status]) => ({
        date: new Date(`${date}T00:00:00.000Z`),
        status,
      }));

    return {
      month: target,
      days: mergedDays,
    };
  },
};
