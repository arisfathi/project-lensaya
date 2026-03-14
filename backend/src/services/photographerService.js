import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { getR2Client } from "../config/r2.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { applyTenantFilter, ensureTenantOwnership, isAdminTenant } from "../utils/tenantQuery.js";
import { resolveAssetUrl, hasProcessedVariants } from "../utils/assetVariants.js";
import { planLimitService } from "./planLimitService.js";
import { enqueueImageProcessing } from "../jobs/imageProcessingQueue.js";
import { normalizeUsernameSeed, isReservedUsername } from "../utils/generateUsername.js";

const getPhotographerByUserId = async (userId) => {
  const photographer = await prisma.photographer.findUnique({ where: { userId } });
  if (!photographer) throw new ApiError(404, "Photographer profile not found");
  return photographer;
};

const requireTenantPhotographerId = (tenant) => {
  if (!tenant?.photographerId) {
    throw new ApiError(403, "Access denied");
  }
  return tenant.photographerId;
};

const monthRange = (month) => {
  const target = month || new Date().toISOString().slice(0, 7);
  const start = new Date(`${target}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { target, start, end };
};
const normalizeAvailabilityStatusValue = (value) =>
  String(value || "").trim().toUpperCase() === "AVAILABLE" ? "AVAILABLE" : "BOOKED";
const toNormalizedAvailabilityDayStatus = (value) =>
  normalizeAvailabilityStatusValue(value) === "BOOKED" ? "booked" : "available";
const toUtcDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, delta) => {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
};
const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const sourceLabel = (value) => {
  if (!value || value === "direct") return "Direct";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
};
const USERNAME_PREVIEW_MIN_LENGTH = 3;

const getPortfolioViewCategorySeries = async (photographerId) => {
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

  return services
    .map((service) => ({
      name: service.name,
      views: viewCountByServiceId.get(service.id) || 0,
    }))
    .filter((item) => item.views > 0);
};

const scheduleVariantBackfill = (asset) => {
  if (!asset?.id || hasProcessedVariants(asset)) return;
  void enqueueImageProcessing({
    assetId: asset.id,
    jobId: `asset:${asset.id}`,
  });
};

const resolveAssetDeliveryUrl = (asset, preferredVariant = "web") => {
  if (!asset) return null;
  scheduleVariantBackfill(asset);
  return resolveAssetUrl(asset, preferredVariant);
};
const countActivePackagesForService = (photographerId, serviceId) =>
  prisma.package.count({
    where: {
      photographerId,
      serviceId,
      status: { not: "ARCHIVED" },
    },
  });
const toNullableText = (value, maxLength = null) => {
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
const normalizeSocialSlug = (value, domain) => {
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
const normalizeInstagramHandle = (value) => normalizeSocialSlug(value, "instagram.com");
const normalizeFacebookSlug = (value) => normalizeSocialSlug(value, "facebook.com");
const normalizeTiktokHandle = (value) => normalizeSocialSlug(value, "tiktok.com");
const normalizeWhatsappNumber = (value) => {
  if (value === undefined) {
    return undefined;
  }

  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : null;
};

const resolveUsernamePreview = async ({ photographer, studioName, db = prisma }) => {
  const normalizedStudioName = String(studioName || "").trim();
  const username = normalizeUsernameSeed(normalizedStudioName);

  if (!username) {
    return {
      studioName: normalizedStudioName,
      username: "",
      available: false,
      reason: "invalid",
    };
  }

  if (username.length < USERNAME_PREVIEW_MIN_LENGTH) {
    return {
      studioName: normalizedStudioName,
      username,
      available: false,
      reason: "too_short",
    };
  }

  if (isReservedUsername(username)) {
    return {
      studioName: normalizedStudioName,
      username,
      available: false,
      reason: "reserved",
    };
  }

  const [existingPhotographer, existingUser] = await Promise.all([
    db.photographer.findFirst({
      where: {
        id: { not: photographer.id },
        username: { equals: username, mode: "insensitive" },
      },
      select: { id: true },
    }),
    db.user.findFirst({
      where: {
        id: { not: photographer.userId },
        username: { equals: username, mode: "insensitive" },
      },
      select: { id: true },
    }),
  ]);

  return {
    studioName: normalizedStudioName,
    username,
    available: !existingPhotographer && !existingUser,
    reason: existingPhotographer || existingUser ? "taken" : null,
  };
};

const getCountValue = (rows) => Number(rows?.[0]?.count || 0);const getAssetReferenceCounts = async (tx, assetId) => {
  const [portfolioRefs, serviceRefs, avatarRefs, bannerRefs] = await Promise.all([
    tx.$queryRaw`SELECT COUNT(*)::int AS count FROM "PortfolioItem" WHERE "assetId" = ${assetId}::uuid`,
    tx.$queryRaw`SELECT COUNT(*)::int AS count FROM "Service" WHERE "thumbnailAssetId" = ${assetId}::uuid`,
    tx.$queryRaw`SELECT COUNT(*)::int AS count FROM "Photographer" WHERE "avatarAssetId" = ${assetId}::uuid`,
    tx.$queryRaw`SELECT COUNT(*)::int AS count FROM "Photographer" WHERE "bannerAssetId" = ${assetId}::uuid`,
  ]);

  return [
    getCountValue(portfolioRefs),
    getCountValue(serviceRefs),
    getCountValue(avatarRefs),
    getCountValue(bannerRefs),
  ];
};

export const photographerService = {
  async dashboardOverview(userId) {
    const photographer = await getPhotographerByUserId(userId);
    const plan = await planLimitService.getPlanByUserId(userId);
    const now = new Date();
    const trafficDays = 7;
    const metricsDays = 30;
    const trafficStart = addDays(startOfDay(now), -(trafficDays - 1));
    const metricsStart = addDays(startOfDay(now), -(metricsDays - 1));

    const [
      portfolioCount,
      serviceCount,
      packageCount,
      bookingCount,
      trafficRows,
      metricGroups,
      visitorGroups,
      categorySeries,
      packagesPerServiceUsage,
    ] =
      await Promise.all([
        prisma.portfolioItem.count({ where: { photographerId: photographer.id } }),
        prisma.service.count({
          where: {
            photographerId: photographer.id,
            status: { not: "ARCHIVED" },
          },
        }),
        prisma.package.count({
          where: {
            photographerId: photographer.id,
            status: { not: "ARCHIVED" },
          },
        }),
        prisma.booking.count({ where: { photographerId: photographer.id } }),
        prisma.analyticsEvent.findMany({
          where: {
            photographerId: photographer.id,
            eventType: "PAGE_VIEW",
            createdAt: { gte: trafficStart },
          },
          select: { createdAt: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["eventType"],
          where: {
            photographerId: photographer.id,
            createdAt: { gte: metricsStart },
          },
          _count: { _all: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["visitorId"],
          where: {
            photographerId: photographer.id,
            visitorId: { not: null },
            createdAt: { gte: metricsStart },
          },
        }),
        getPortfolioViewCategorySeries(photographer.id),
        planLimitService.getPackagesPerServiceUsage(photographer.id, plan.maxPackages),
      ]);

    const trafficBuckets = Array.from({ length: trafficDays }, (_, index) => {
      const date = addDays(trafficStart, index);
      return {
        key: dayKey(date),
        name: date.toLocaleString("en-US", { weekday: "short" }),
        views: 0,
      };
    });
    const trafficMap = new Map(trafficBuckets.map((bucket) => [bucket.key, bucket]));

    for (const row of trafficRows) {
      const key = dayKey(row.createdAt);
      const bucket = trafficMap.get(key);
      if (bucket) {
        bucket.views += 1;
      }
    }

    const metricsMap = new Map(metricGroups.map((row) => [row.eventType, Number(row._count?._all || 0)]));
    const portfolioViews = metricsMap.get("PORTFOLIO_VIEW") || 0;
    const inquiries = metricsMap.get("BOOKING_INTENT") || 0;
    const conversionRate = portfolioViews > 0 ? Number(((inquiries / portfolioViews) * 100).toFixed(2)) : 0;

    return {
      stats: {
        portfolioViews,
        profileClicks: metricsMap.get("PROFILE_CLICK") || 0,
        whatsappClicks: metricsMap.get("WHATSAPP_CLICK") || 0,
        inquiries,
        conversionRate,
        monthlyTraffic: visitorGroups.length,
      },
      trafficSeries: trafficBuckets.map(({ key: _key, ...rest }) => rest),
      categorySeries,
      quickCounts: {
        portfolioCount,
        serviceCount,
        packageCount,
        bookingCount,
      },
      plan: {
        name: plan.name,
        price: Number(plan.price || 0),
        currency: plan.currency,
        trialDays: plan.trialDays,
      },
      usage: {
        services: { used: serviceCount, limit: plan.maxServices },
        // Kept for backward compatibility where older clients read a generic "packages" usage key.
        packages: { used: packageCount, limit: plan.maxPackages },
        packagesPerService: packagesPerServiceUsage,
        portfolioImages: { used: portfolioCount, limit: plan.maxPortfolioImages },
      },
    };
  },

  async websiteSummary(userId) {
    const photographer = await getPhotographerByUserId(userId);

    const [portfolioCount, serviceCount, packageCount] = await Promise.all([
      prisma.portfolioItem.count({ where: { photographerId: photographer.id } }),
      prisma.service.count({ where: { photographerId: photographer.id } }),
      prisma.package.count({ where: { photographerId: photographer.id } }),
    ]);

    return {
      websiteUrl: photographer.websiteUrl || `${photographer.username}.${env.publicAppDomain}`,
      portfolioCount,
      serviceCount,
      packageCount,
      lastUpdated: photographer.updatedAt,
    };
  },

  async getProfile(userId) {
    const [photographer, plan] = await Promise.all([
      prisma.photographer.findUnique({
        where: { userId },
        include: {
          user: true,
          avatarAsset: true,
          bannerAsset: true,
        },
      }),
      planLimitService.getPlanByUserId(userId),
    ]);
    if (!photographer) throw new ApiError(404, "Photographer profile not found");

    const canHideBranding = String(plan?.name || "FREE").toUpperCase() !== "FREE";

    return {
      studioName: photographer.studioName,
      bio: photographer.bio,
      email: photographer.user.email,
      username: photographer.username,
      avatarUrl: resolveAssetDeliveryUrl(photographer.avatarAsset, "thumb"),
      bannerUrl: resolveAssetDeliveryUrl(photographer.bannerAsset, "web"),
      heroTitle: photographer.heroTitle,
      heroSubtitle: photographer.heroSubtitle,
      heroImageUrl: photographer.heroImageUrl || resolveAssetDeliveryUrl(photographer.bannerAsset, "web"),
      showHero: photographer.showHero,
      location: photographer.location,
      city: photographer.city,
      country: photographer.country,
      specialty: photographer.specialty,
      style: photographer.style,
      hideBranding: canHideBranding ? Boolean(photographer.hideBranding) : false,
      canHideBranding,
      socialLinks: {
        instagram: photographer.instagramHandle,
        facebook: photographer.facebookUrl,
        tiktok: photographer.tiktokHandle,
        whatsapp: photographer.whatsappNumber,
      },
      themeColor: photographer.themeColor,
    };
  },

  async previewUsername(userId, studioName) {
    const photographer = await getPhotographerByUserId(userId);
    return resolveUsernamePreview({ photographer, studioName });
  },

  async updateProfile(userId, data) {
    const photographer = await getPhotographerByUserId(userId);
    const plan = await planLimitService.getPlanByUserId(userId);
    const canHideBranding = String(plan?.name || "FREE").toUpperCase() !== "FREE";
    if (data.hideBranding === true && !canHideBranding) {
      throw new ApiError(403, "Branding can only be hidden on Pro or Studio plans");
    }

    const normalizedInstagram = normalizeInstagramHandle(data.socialLinks?.instagram);
    const normalizedFacebook = normalizeFacebookSlug(data.socialLinks?.facebook);
    const normalizedTiktok = normalizeTiktokHandle(data.socialLinks?.tiktok);
    const normalizedWhatsapp = normalizeWhatsappNumber(data.socialLinks?.whatsapp);
    const nextStudioName =
      data.studioName !== undefined ? toNullableText(data.studioName, 191) : undefined;
    const studioNameChanged =
      nextStudioName !== undefined && nextStudioName !== String(photographer.studioName || "");

    if (data.studioName !== undefined && !nextStudioName) {
      throw new ApiError(400, "Studio name is required");
    }

    const usernamePreview = studioNameChanged
      ? await resolveUsernamePreview({ photographer, studioName: nextStudioName })
      : null;

    if (usernamePreview && !usernamePreview.available) {
      if (usernamePreview.reason === "too_short") {
        throw new ApiError(400, "Studio name must generate a username with at least 3 characters");
      }
      if (usernamePreview.reason === "reserved") {
        throw new ApiError(400, "This studio name generates a reserved username");
      }
      if (usernamePreview.reason === "taken") {
        throw new ApiError(409, "This studio name generates a username that is already taken");
      }
      throw new ApiError(400, "Unable to generate a valid username from the studio name");
    }

    const nextUsername = studioNameChanged ? usernamePreview?.username || null : null;
    const usernameChanged =
      studioNameChanged &&
      Boolean(nextUsername) &&
      nextUsername !== String(photographer.username || "").toLowerCase();
    const shouldSyncDefaultWebsiteUrl =
      usernameChanged &&
      (!photographer.websiteUrl ||
        photographer.websiteUrl === `${photographer.username}.${env.publicAppDomain}`);

    const userUpdateData = {
      ...(data.email ? { email: data.email } : {}),
      ...(usernameChanged ? { username: nextUsername } : {}),
    };
    const photographerUpdateData = {
      ...(nextStudioName !== undefined ? { studioName: nextStudioName } : {}),
      bio: data.bio,
      instagramHandle: normalizedInstagram,
      facebookUrl: normalizedFacebook,
      tiktokHandle: normalizedTiktok,
      whatsappNumber: normalizedWhatsapp,
      themeColor: data.themeColor,
      ...(data.location !== undefined ? { location: toNullableText(data.location, 191) } : {}),
      ...(data.city !== undefined ? { city: toNullableText(data.city, 128) } : {}),
      ...(data.country !== undefined ? { country: toNullableText(data.country, 128) } : {}),
      ...(data.specialty !== undefined ? { specialty: toNullableText(data.specialty, 128) } : {}),
      ...(data.style !== undefined ? { style: toNullableText(data.style, 128) } : {}),
      ...(data.hideBranding !== undefined
        ? { hideBranding: canHideBranding ? Boolean(data.hideBranding) : false }
        : {}),
      ...(usernameChanged ? { username: nextUsername } : {}),
      ...(shouldSyncDefaultWebsiteUrl ? { websiteUrl: `${nextUsername}.${env.publicAppDomain}` } : {}),
    };

    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (Object.keys(userUpdateData).length > 0) {
          await tx.user.update({
            where: { id: photographer.userId },
            data: userUpdateData,
          });
        }

        return tx.photographer.update({
          where: { id: photographer.id },
          data: photographerUpdateData,
        });
      });

      return { profile: updated };
    } catch (error) {
      if (String(error?.code || "") === "P2002") {
        const targets = Array.isArray(error?.meta?.target)
          ? error.meta.target.map((item) => String(item))
          : [];
        if (
          usernameChanged &&
          (targets.length === 0 || targets.some((target) => /username/i.test(target)))
        ) {
          throw new ApiError(409, "This studio name generates a username that is already taken");
        }
        if (targets.some((target) => /email/i.test(target))) {
          throw new ApiError(409, "Email is already in use");
        }
      }
      throw error;
    }
  },

  async updateHero(userId, data) {
    const photographer = await getPhotographerByUserId(userId);

    const updated = await prisma.photographer.update({
      where: { id: photographer.id },
      data: {
        ...(data.heroSubtitle !== undefined ? { heroSubtitle: toNullableText(data.heroSubtitle) } : {}),
        ...(data.heroImageUrl !== undefined ? { heroImageUrl: toNullableText(data.heroImageUrl) } : {}),
        ...(data.showHero !== undefined ? { showHero: Boolean(data.showHero) } : {}),
      },
    });

    return {
      hero: {
        heroSubtitle: updated.heroSubtitle,
        heroImageUrl: updated.heroImageUrl,
        showHero: updated.showHero,
      },
    };
  },

  async listServices(tenant) {
    const items = await prisma.service.findMany(
      applyTenantFilter(
        {
          orderBy: { displayOrder: "asc" },
          include: { packages: true, thumbnailAsset: true },
        },
        tenant
      )
    );

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        emoji: item.emoji,
        thumbnailUrl: resolveAssetDeliveryUrl(item.thumbnailAsset, "thumb"),
        packageCount: item.packages.length,
        order: item.displayOrder,
      })),
    };
  },

  async createService(tenant, data) {
    const photographerId = requireTenantPhotographerId(tenant);

    if (!isAdminTenant(tenant)) {
      const [plan, serviceCount] = await Promise.all([
        planLimitService.getPlanByPhotographerId(photographerId),
        prisma.service.count({
          where: {
            photographerId,
            status: { not: "ARCHIVED" },
          },
        }),
      ]);
      if (planLimitService.isLimitReached({ used: serviceCount, max: plan.maxServices })) {
        await planLimitService.throwLimitReached({
          metric: "services",
          used: serviceCount,
          plan,
        });
      }
    }

    if (data.thumbnailAssetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: data.thumbnailAssetId },
        select: { id: true, photographerId: true, uploadedById: true },
      });

      if (!asset) {
        throw new ApiError(404, "Thumbnail asset not found");
      }

      if (
        !isAdminTenant(tenant) &&
        asset.photographerId !== photographerId &&
        asset.uploadedById !== tenant.userId
      ) {
        throw new ApiError(403, "Access denied");
      }
    }

    const service = await prisma.service.create({
      data: {
        photographerId,
        name: data.name,
        description: data.description || null,
        emoji: data.emoji || null,
        thumbnailAssetId: data.thumbnailAssetId || null,
        displayOrder: data.order || 0,
      },
    });
    return { service };
  },

  async updateService(tenant, serviceId, data) {
    const existing = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, photographerId: true },
    });
    ensureTenantOwnership(existing, tenant, "Service");

    if (data.thumbnailAssetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: data.thumbnailAssetId },
        select: { id: true, photographerId: true, uploadedById: true },
      });

      if (!asset) {
        throw new ApiError(404, "Thumbnail asset not found");
      }

      if (
        !isAdminTenant(tenant) &&
        asset.photographerId !== existing.photographerId &&
        asset.uploadedById !== tenant?.userId
      ) {
        throw new ApiError(403, "Access denied");
      }
    }

    const service = await prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.emoji !== undefined ? { emoji: data.emoji } : {}),
        ...(data.thumbnailAssetId !== undefined ? { thumbnailAssetId: data.thumbnailAssetId } : {}),
        ...(data.order !== undefined ? { displayOrder: data.order } : {}),
      },
    });

    return { service };
  },

  async deleteService(tenant, serviceId) {
    const existing = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, photographerId: true },
    });
    ensureTenantOwnership(existing, tenant, "Service");

    await prisma.service.delete({ where: { id: serviceId } });
    return { deleted: true };
  },

  async listPackages(tenant, query) {
    const items = await prisma.package.findMany(
      applyTenantFilter(
        {
          where: {
            ...(query.serviceId ? { serviceId: query.serviceId } : {}),
          },
          orderBy: [{ isPopular: "desc" }, { displayOrder: "asc" }],
        },
        tenant
      )
    );

    return { items };
  },

  async createPackage(tenant, data) {
    const photographerId = requireTenantPhotographerId(tenant);

    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
      select: { id: true, photographerId: true, name: true },
    });
    ensureTenantOwnership(service, tenant, "Service");

    if (!isAdminTenant(tenant)) {
      const [plan, packageCount] = await Promise.all([
        planLimitService.getPlanByPhotographerId(photographerId),
        countActivePackagesForService(photographerId, data.serviceId),
      ]);
      if (planLimitService.isLimitReached({ used: packageCount, max: plan.maxPackages })) {
        await planLimitService.throwLimitReached({
          metric: "packagesPerService",
          used: packageCount,
          plan,
          contextLabel: service?.name || "this service",
        });
      }
    }

    const pkg = await prisma.package.create({
      data: {
        photographerId,
        serviceId: data.serviceId,
        name: data.name,
        priceCents: Math.round(Number(data.price) * 100),
        durationLabel: data.duration,
        features: data.features || [],
        isPopular: Boolean(data.popular),
      },
    });
    return { package: pkg };
  },

  async updatePackage(tenant, packageId, data) {
    const existing = await prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true, photographerId: true, serviceId: true, status: true },
    });
    ensureTenantOwnership(existing, tenant, "Package");

    if (data.serviceId !== undefined) {
      const service = await prisma.service.findUnique({
        where: { id: data.serviceId },
        select: { id: true, photographerId: true, name: true },
      });
      ensureTenantOwnership(service, tenant, "Service");

      if (!isAdminTenant(tenant) && data.serviceId !== existing.serviceId && existing.status !== "ARCHIVED") {
        const [plan, packageCount] = await Promise.all([
          planLimitService.getPlanByPhotographerId(existing.photographerId),
          countActivePackagesForService(existing.photographerId, data.serviceId),
        ]);
        if (planLimitService.isLimitReached({ used: packageCount, max: plan.maxPackages })) {
          await planLimitService.throwLimitReached({
            metric: "packagesPerService",
            used: packageCount,
            plan,
            contextLabel: service?.name || "this service",
          });
        }
      }
    }

    const pkg = await prisma.package.update({
      where: { id: packageId },
      data: {
        ...(data.serviceId !== undefined ? { serviceId: data.serviceId } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.price !== undefined ? { priceCents: Math.round(Number(data.price) * 100) } : {}),
        ...(data.duration !== undefined ? { durationLabel: data.duration } : {}),
        ...(data.features !== undefined ? { features: data.features } : {}),
        ...(data.popular !== undefined ? { isPopular: data.popular } : {}),
      },
    });

    return { package: pkg };
  },

  async duplicatePackage(tenant, packageId, name) {
    const original = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        service: {
          select: { name: true },
        },
      },
    });
    ensureTenantOwnership(original, tenant, "Package");

    if (!isAdminTenant(tenant)) {
      const [plan, packageCount] = await Promise.all([
        planLimitService.getPlanByPhotographerId(original.photographerId),
        countActivePackagesForService(original.photographerId, original.serviceId),
      ]);
      if (planLimitService.isLimitReached({ used: packageCount, max: plan.maxPackages })) {
        await planLimitService.throwLimitReached({
          metric: "packagesPerService",
          used: packageCount,
          plan,
          contextLabel: original?.service?.name || "this service",
        });
      }
    }

    const duplicated = await prisma.package.create({
      data: {
        photographerId: original.photographerId,
        serviceId: original.serviceId,
        name: name || `${original.name} Copy`,
        description: original.description,
        priceCents: original.priceCents,
        currency: original.currency,
        durationLabel: original.durationLabel,
        features: original.features,
        status: original.status,
        isPopular: false,
        displayOrder: original.displayOrder + 1,
      },
    });

    return { package: duplicated };
  },

  async deletePackage(tenant, packageId) {
    const existing = await prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true, photographerId: true },
    });
    ensureTenantOwnership(existing, tenant, "Package");

    await prisma.package.delete({ where: { id: packageId } });
    return { deleted: true };
  },

  async listPortfolioItems(tenant, query) {
    const { page, limit, skip, take } = getPagination(query);

    const where = {
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.featured !== undefined
        ? { isFeatured: [true, "true", 1, "1"].includes(query.featured) }
        : {}),
    };

    const scopedQuery = applyTenantFilter({ where }, tenant);
    const [items, total] = await Promise.all([
      prisma.portfolioItem.findMany({
        ...scopedQuery,
        skip,
        take,
        include: { asset: true },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      }),
      prisma.portfolioItem.count(scopedQuery),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        imageUrl: resolveAssetDeliveryUrl(item.asset, "web"),
        serviceId: item.serviceId,
        category: item.category,
        featured: item.isFeatured,
        views: item.viewsCount,
        createdAt: item.createdAt,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },

  async createPortfolioItem(tenant, data) {
    const photographerId = requireTenantPhotographerId(tenant);

    if (!isAdminTenant(tenant)) {
      const [plan, portfolioImageCount] = await Promise.all([
        planLimitService.getPlanByPhotographerId(photographerId),
        prisma.portfolioItem.count({
          where: { photographerId },
        }),
      ]);
      if (planLimitService.isLimitReached({ used: portfolioImageCount, max: plan.maxPortfolioImages })) {
        await planLimitService.throwLimitReached({
          metric: "portfolioImages",
          used: portfolioImageCount,
          plan,
        });
      }
    }

    if (data.serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: data.serviceId },
        select: { id: true, photographerId: true },
      });
      ensureTenantOwnership(service, tenant, "Service");
    }

    const asset = await prisma.asset.findUnique({
      where: { id: data.imageAssetId },
      select: {
        id: true,
        photographerId: true,
        uploadedById: true,
        status: true,
        deletedAt: true,
        objectKey: true,
        cdnUrl: true,
      },
    });
    if (!asset || asset.deletedAt) throw new ApiError(404, "Asset not found");
    if (asset.status !== "READY") throw new ApiError(400, "Asset upload is not complete");

    if (
      !isAdminTenant(tenant) &&
      asset.photographerId !== photographerId &&
      asset.uploadedById !== tenant.userId
    ) {
      throw new ApiError(403, "Access denied");
    }

    const imageUrl = resolveAssetDeliveryUrl(asset, "web");

    const item = await prisma.portfolioItem.create({
      data: {
        photographerId,
        serviceId: data.serviceId || null,
        category: data.category || null,
        assetId: data.imageAssetId,
        isFeatured: Boolean(data.featured),
      },
    });
    return {
      item: {
        ...item,
        imageUrl,
        featured: item.isFeatured,
        views: item.viewsCount,
      },
    };
  },

  async updatePortfolioItem(tenant, itemId, data) {
    const existing = await prisma.portfolioItem.findUnique({
      where: { id: itemId },
      select: { id: true, photographerId: true },
    });
    ensureTenantOwnership(existing, tenant, "Portfolio item");

    if (data.serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: data.serviceId },
        select: { id: true, photographerId: true },
      });
      ensureTenantOwnership(service, tenant, "Service");
    }

    const item = await prisma.portfolioItem.update({
      where: { id: itemId },
      include: { asset: true },
      data: {
        ...(data.serviceId !== undefined ? { serviceId: data.serviceId } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.featured !== undefined ? { isFeatured: data.featured } : {}),
      },
    });

    return {
      item: {
        ...item,
        imageUrl: resolveAssetDeliveryUrl(item.asset, "web"),
        featured: item.isFeatured,
        views: item.viewsCount,
      },
    };
  },

  async setPortfolioFeatured(tenant, itemId, featured) {
    return this.updatePortfolioItem(tenant, itemId, { featured });
  },

  async deletePortfolioItem(tenant, itemId) {
    const existing = await prisma.portfolioItem.findUnique({
      where: { id: itemId },
      select: { id: true, photographerId: true, assetId: true },
    });
    ensureTenantOwnership(existing, tenant, "Portfolio item");

    const cleanupContext = await prisma.$transaction(async (tx) => {
      await tx.portfolioItem.delete({ where: { id: itemId } });

      if (!existing.assetId) {
        return { shouldPurge: false, asset: null };
      }

      const [[remainingPortfolioItems, serviceThumbnailRefs, avatarRefs, bannerRefs], assetRows] =
        await Promise.all([
          getAssetReferenceCounts(tx, existing.assetId),
          tx.$queryRaw`
            SELECT "id", "bucket", "objectKey", "status", "deletedAt"
            FROM "Asset"
            WHERE "id" = ${existing.assetId}::uuid
            LIMIT 1
          `,
        ]);
      const asset = assetRows?.[0] || null;

      const totalReferences =
        remainingPortfolioItems + serviceThumbnailRefs + avatarRefs + bannerRefs;

      const shouldPurge =
        Boolean(asset) &&
        totalReferences === 0 &&
        !asset.deletedAt &&
        !["DELETED", "PURGED"].includes(asset.status);

      return { shouldPurge, asset };
    });

    if (cleanupContext.shouldPurge && cleanupContext.asset?.objectKey) {
      const client = getR2Client();
      if (!client) {
        logger.warn(
          { assetId: cleanupContext.asset.id },
          "R2 client not configured; skipping asset purge"
        );
      } else if (!env.r2.bucket && !cleanupContext.asset.bucket) {
        logger.warn(
          { assetId: cleanupContext.asset.id },
          "R2 bucket missing; skipping asset purge"
        );
      } else {
        try {
          await client.send(
            new DeleteObjectCommand({
              Bucket: cleanupContext.asset.bucket || env.r2.bucket,
              Key: cleanupContext.asset.objectKey,
            })
          );

          await prisma.$transaction(async (tx) => {
            const [remainingPortfolioItems, serviceThumbnailRefs, avatarRefs, bannerRefs] =
              await getAssetReferenceCounts(tx, cleanupContext.asset.id);
            const totalReferences =
              remainingPortfolioItems + serviceThumbnailRefs + avatarRefs + bannerRefs;

            if (totalReferences > 0) {
              return;
            }

            await tx.asset.update({
              where: { id: cleanupContext.asset.id },
              data: {
                status: "PURGED",
                deletedAt: new Date(),
              },
            });
          });
        } catch (error) {
          logger.error(
            {
              err: error,
              assetId: cleanupContext.asset.id,
              objectKey: cleanupContext.asset.objectKey,
            },
            "Failed to purge portfolio asset from R2"
          );
        }
      }
    }

    return { deleted: true };
  },

  async getAvailability(tenant, month) {
    const { target, start, end } = monthRange(month);

    const days = await prisma.availability.findMany(
      applyTenantFilter(
        {
          where: {
            date: { gte: start, lt: end },
          },
          orderBy: { date: "asc" },
        },
        tenant
      )
    );

    return {
      month: target,
      days: days.map((d) => ({ date: d.date, status: toNormalizedAvailabilityDayStatus(d.status) })),
    };
  },

  async patchAvailability(tenant, updates) {
    const photographerId = requireTenantPhotographerId(tenant);
    const todayKey = toUtcDateKey(new Date());

    let updatedCount = 0;
    for (const change of updates) {
      const changeDate = new Date(change.date);
      if (Number.isNaN(changeDate.getTime())) {
        throw new ApiError(400, "Invalid availability date");
      }

      const dateKey = toUtcDateKey(changeDate);
      if (dateKey < todayKey) {
        throw new ApiError(400, "Past dates cannot be updated");
      }

      const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const normalizedStatus = normalizeAvailabilityStatusValue(change.status);

      if (normalizedStatus === "AVAILABLE") {
        const existingBooking = await prisma.booking.findFirst({
          where: {
            photographerId,
            preferredDate: { gte: dayStart, lt: dayEnd },
            status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
          },
          select: { id: true },
        });

        if (existingBooking) {
          throw new ApiError(409, "Booked dates with active inquiries cannot be marked available");
        }
      }

      await prisma.availability.upsert({
        where: {
          photographerId_date: {
            photographerId,
            date: dayStart,
          },
        },
        update: {
          status: normalizedStatus,
        },
        create: {
          photographerId,
          date: dayStart,
          status: normalizedStatus,
        },
      });
      updatedCount += 1;
    }

    return {
      month: updates[0]?.date?.slice(0, 7) || new Date().toISOString().slice(0, 7),
      updatedCount,
    };
  },

  async analyticsOverview(tenant) {
    const photographerId = requireTenantPhotographerId(tenant);
    await planLimitService.assertAnalyticsToolsAccessByPhotographerId(photographerId);
    const now = new Date();
    const trafficDays = 7;
    const metricsDays = 30;
    const trafficStart = addDays(startOfDay(now), -(trafficDays - 1));
    const metricsStart = addDays(startOfDay(now), -(metricsDays - 1));

    const [trafficRows, sourceRows, metricGroups, visitorGroups, categorySeries] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where: {
          photographerId,
          eventType: "PAGE_VIEW",
          createdAt: { gte: trafficStart },
        },
        select: { createdAt: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["source"],
        where: {
          photographerId,
          eventType: "PAGE_VIEW",
          createdAt: { gte: metricsStart },
        },
        _count: { _all: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["eventType"],
        where: {
          photographerId,
          createdAt: { gte: metricsStart },
        },
        _count: { _all: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["visitorId"],
        where: {
          photographerId,
          visitorId: { not: null },
          createdAt: { gte: metricsStart },
        },
      }),
      getPortfolioViewCategorySeries(photographerId),
    ]);

    const trafficBuckets = Array.from({ length: trafficDays }, (_, index) => {
      const date = addDays(trafficStart, index);
      return {
        key: dayKey(date),
        name: date.toLocaleString("en-US", { weekday: "short" }),
        views: 0,
      };
    });
    const trafficMap = new Map(trafficBuckets.map((bucket) => [bucket.key, bucket]));

    for (const row of trafficRows) {
      const key = dayKey(row.createdAt);
      const bucket = trafficMap.get(key);
      if (bucket) {
        bucket.views += 1;
      }
    }

    const metricsMap = new Map(metricGroups.map((row) => [row.eventType, Number(row._count?._all || 0)]));
    const portfolioViews = metricsMap.get("PORTFOLIO_VIEW") || 0;
    const inquiries = metricsMap.get("BOOKING_INTENT") || 0;
    const conversionRate = portfolioViews > 0 ? Number(((inquiries / portfolioViews) * 100).toFixed(2)) : 0;
    const sourceTotals = new Map();
    for (const row of sourceRows) {
      const label = sourceLabel(row.source);
      sourceTotals.set(label, (sourceTotals.get(label) || 0) + Number(row._count?._all || 0));
    }

    const sourceBreakdown = Array.from(sourceTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        id: `source-${index + 1}`,
        name,
        value,
      }));

    return {
      stats: {
        portfolioViews,
        profileClicks: metricsMap.get("PROFILE_CLICK") || 0,
        whatsappClicks: metricsMap.get("WHATSAPP_CLICK") || 0,
        inquiries,
        conversionRate,
        monthlyVisitors: visitorGroups.length,
      },
      trafficSeries: trafficBuckets.map(({ key: _key, ...rest }) => rest),
      categorySeries,
      sourceBreakdown,
    };
  },

  async analyticsActivity(tenant, query) {
    const photographerId = requireTenantPhotographerId(tenant);
    await planLimitService.assertAnalyticsToolsAccessByPhotographerId(photographerId);
    const { page, limit, skip, take } = getPagination(query);

    const scoped = applyTenantFilter({}, tenant);
    const [items, total] = await Promise.all([
      prisma.analyticsEvent.findMany({
        ...scoped,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.analyticsEvent.count(scoped),
    ]);

    return {
      items: items.map((item) => ({
        at: item.createdAt,
        action: item.eventType,
        portfolio: item.portfolioItemId,
        source: item.source,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },
};

