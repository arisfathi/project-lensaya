import { prisma } from "../config/prisma.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { resolveAssetUrl, hasProcessedVariants } from "../utils/assetVariants.js";
import { enqueueImageProcessing } from "../jobs/imageProcessingQueue.js";

const ACTIVE_SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"];

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

export const publicService = {
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

    const items = [];
    const seenPhotographers = new Set();
    const batchSize = Math.max(safeLimit * 4, 24);
    let skip = 0;

    while (items.length < safeLimit) {
      const rows = await prisma.portfolioItem.findMany({
        where,
        skip,
        take: batchSize,
        include: {
          asset: true,
          photographer: true,
        },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      });

      if (!rows.length) break;

      for (const row of rows) {
        if (seenPhotographers.has(row.photographerId)) continue;

        const preview = mapFeaturedPhotographer(row);
        if (!preview) continue;

        seenPhotographers.add(row.photographerId);
        items.push(preview);

        if (items.length >= safeLimit) break;
      }

      if (rows.length < batchSize) break;
      skip += rows.length;
    }

    return { items };
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
      items: items.map(mapPublicPhotographer),
      pagination: buildPagination(page, limit, total),
    };
  },

  async profileByUsername(username) {
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
    const canHideBranding = String(activeSubscription?.plan || "FREE").toUpperCase() !== "FREE";
    const showLensayaBranding = !(canHideBranding && p.hideBranding);

    return {
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
  },

  async services(username) {
    const photographer = await prisma.photographer.findFirst({ where: { username, status: "ACTIVE" } });
    if (!photographer) return null;

    const [items, portfolioImages] = await Promise.all([
      prisma.service.findMany({
        where: { photographerId: photographer.id, status: "ACTIVE" },
        orderBy: { displayOrder: "asc" },
        include: { thumbnailAsset: true },
      }),
      prisma.portfolioItem.findMany({
        where: {
          photographerId: photographer.id,
          serviceId: { not: null },
        },
        include: { asset: true },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    return {
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
    };
  },

  async portfolio(username, query) {
    const photographer = await prisma.photographer.findFirst({ where: { username, status: "ACTIVE" } });
    if (!photographer) return null;

    const { page, limit, skip, take } = getPagination(query);
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

    return {
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
  },

  async gallery(username, query) {
    const photographer = await prisma.photographer.findFirst({ where: { username, status: "ACTIVE" } });
    if (!photographer) return null;

    const items = await prisma.portfolioItem.findMany({
      where: {
        photographerId: photographer.id,
        ...(query.category
          ? {
              category: {
                equals: query.category,
                mode: "insensitive",
              },
            }
          : {}),
      },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        imageUrl: resolvePublicAssetUrl(item.asset, "web"),
        serviceId: item.serviceId,
        category: item.category,
        featured: item.isFeatured,
        views: item.viewsCount,
        createdAt: item.createdAt,
      })),
    };
  },

  async packages(username, query) {
    const photographer = await prisma.photographer.findFirst({ where: { username, status: "ACTIVE" } });
    if (!photographer) return null;

    const items = await prisma.package.findMany({
      where: {
        photographerId: photographer.id,
        status: "ACTIVE",
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      },
      orderBy: [{ isPopular: "desc" }, { displayOrder: "asc" }],
    });

    return {
      items: items.map((pkg) => ({
        id: pkg.id,
        serviceId: pkg.serviceId,
        name: pkg.name,
        price: pkg.priceCents / 100,
        currency: pkg.currency,
        duration: pkg.durationLabel,
        features: pkg.features,
      })),
    };
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
          status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
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
      dayMap.set(key, "booked");
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


