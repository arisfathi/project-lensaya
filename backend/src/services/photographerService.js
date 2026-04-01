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
import { FREE_ANALYTICS_ACTIVITY_PREVIEW_LIMIT, USERNAME_PREVIEW_MIN_LENGTH } from "./photographer/photographerService.constants.js";
import { photographerServicesService } from "./photographer/photographerServicesService.js";
import { photographerPackagesService } from "./photographer/photographerPackagesService.js";
import { photographerAvailabilityService } from "./photographer/photographerAvailabilityService.js";
import { photographerAnalyticsService } from "./photographer/photographerAnalyticsService.js";
import { photographerProfileService, resolveAssetDeliveryUrl, scheduleVariantBackfill } from "./photographer/photographerProfileService.js";
import { photographerDashboardService } from "./photographer/photographerDashboardService.js";
import {
  addDays,
  buildAnalyticsAccess,
  dayKey,
  getPortfolioViewCategorySeries,
  loadAnalyticsRollupSnapshot,
  normalizeFacebookSlug,
  normalizeInstagramHandle,
  normalizeTeamMembers,
  normalizeTiktokHandle,
  normalizeWhatsappNumber,
  rankCategorySeries,
  requireTenantPhotographerId,
  sourceLabel,
  startOfDay,
  toNullableText,
} from "./photographer/photographerService.utils.js";










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
    return photographerDashboardService.dashboardOverview(userId);
  },

  async websiteSummary(userId) {
    return photographerDashboardService.websiteSummary(userId);
  },

  async getProfile(userId) {
    return photographerProfileService.getProfile(userId);
  },

  async previewUsername(userId, studioName) {
    return photographerProfileService.previewUsername(userId, studioName);
  },

  async updateProfile(userId, data) {
    return photographerProfileService.updateProfile(userId, data);
  },

  async updateHero(userId, data) {
    return photographerProfileService.updateHero(userId, data);
  },

  async listServices(tenant) {
    return photographerServicesService.listServices(tenant, { resolveAssetDeliveryUrl });
  },

  async createService(tenant, data) {
    return photographerServicesService.createService(tenant, data);
  },

  async updateService(tenant, serviceId, data) {
    return photographerServicesService.updateService(tenant, serviceId, data);
  },

  async deleteService(tenant, serviceId) {
    return photographerServicesService.deleteService(tenant, serviceId);
  },

  async listPackages(tenant, query) {
    return photographerPackagesService.listPackages(tenant, query);
  },

  async createPackage(tenant, data) {
    return photographerPackagesService.createPackage(tenant, data);
  },

  async updatePackage(tenant, packageId, data) {
    return photographerPackagesService.updatePackage(tenant, packageId, data);
  },

  async duplicatePackage(tenant, packageId, name) {
    return photographerPackagesService.duplicatePackage(tenant, packageId, name);
  },

  async deletePackage(tenant, packageId) {
    return photographerPackagesService.deletePackage(tenant, packageId);
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
    return photographerAvailabilityService.getAvailability(tenant, month);
  },

  async patchAvailability(tenant, updates) {
    return photographerAvailabilityService.patchAvailability(tenant, updates);
  },

  async analyticsOverview(tenant, query) {
    return photographerAnalyticsService.analyticsOverview(tenant, query);
  },

  async updateAnalyticsGoal(tenant, data) {
    return photographerAnalyticsService.updateAnalyticsGoal(tenant, data);
  },

  async analyticsActivity(tenant, query) {
    return photographerAnalyticsService.analyticsActivity(tenant, query);
  },
};




















