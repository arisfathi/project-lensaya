import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { getR2Client } from "../config/r2.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { randomCode } from "../utils/crypto.js";
import { ensureTenantOwnership, isAdminTenant } from "../utils/tenantQuery.js";
import { buildPublicAssetUrl } from "../utils/assetUrl.js";
import { resolveAssetUrl } from "../utils/assetVariants.js";
import { redisCache } from "../utils/redisCache.js";
import { planLimitService } from "./planLimitService.js";

const purposeToAssetPurpose = {
  portfolio: "PORTFOLIO",
  avatar: "AVATAR",
  banner: "BANNER",
};

const STORAGE_USAGE_CACHE_TTL_SECONDS = 30;
const STORAGE_USAGE_CACHE_PREFIX = "cache:upload:storage-usage:v1:";
const BYTES_PER_GB = 1024 * 1024 * 1024;

const toStorageUsageCacheKey = (photographerId) => {
  const normalized = String(photographerId || "").trim();
  if (!normalized) return null;
  return `${STORAGE_USAGE_CACHE_PREFIX}${normalized}`;
};

const getPhotographerStorageUsageBytes = async (photographerId) => {
  const cacheKey = toStorageUsageCacheKey(photographerId);
  if (cacheKey) {
    const cached = await redisCache.getJson(cacheKey);
    const cachedBytes = Number(cached?.usedBytes);
    if (Number.isFinite(cachedBytes) && cachedBytes >= 0) {
      return cachedBytes;
    }
  }

  const storageUsage = await prisma.asset.aggregate({
    where: {
      photographerId,
      status: { in: ["PENDING", "READY"] },
      deletedAt: null,
    },
    _sum: { sizeBytes: true },
  });

  const usedBytes = Number(storageUsage?._sum?.sizeBytes || 0);
  if (cacheKey) {
    await redisCache.setJson(cacheKey, { usedBytes }, STORAGE_USAGE_CACHE_TTL_SECONDS);
  }

  return usedBytes;
};

const bumpPhotographerStorageUsageCache = async (photographerId, deltaBytes) => {
  const cacheKey = toStorageUsageCacheKey(photographerId);
  if (!cacheKey) return;

  const delta = Number(deltaBytes || 0);
  if (!Number.isFinite(delta) || delta <= 0) return;

  const cached = await redisCache.getJson(cacheKey);
  const current = Number(cached?.usedBytes);
  if (!Number.isFinite(current) || current < 0) return;

  await redisCache.setJson(
    cacheKey,
    { usedBytes: current + delta },
    STORAGE_USAGE_CACHE_TTL_SECONDS
  );
};

const invalidatePhotographerStorageUsageCache = async (photographerId) => {
  const cacheKey = toStorageUsageCacheKey(photographerId);
  if (!cacheKey) return;
  await redisCache.del(cacheKey);
};

const toStorageLimitBytes = (storageGb) => {
  const parsed = Number(storageGb);
  if (!Number.isFinite(parsed) || parsed < 0) return -1;
  return Math.floor(parsed * BYTES_PER_GB);
};

const toUploadBytes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
};

export const uploadService = {
  async createPresignedUpload({ userId, tenant, photographerId, fileName, mimeType, size, purpose }) {
    const client = getR2Client();
    if (!client) {
      throw new ApiError(500, "R2 configuration is incomplete");
    }
    if (!env.r2.bucket) {
      throw new ApiError(500, "R2_BUCKET not configured");
    }

    let resolvedPhotographerId = photographerId || tenant?.photographerId || null;
    if (!resolvedPhotographerId && userId) {
      const photographer = await prisma.photographer.findUnique({ where: { userId } });
      resolvedPhotographerId = photographer?.id || null;
    }

    if (tenant && !isAdminTenant(tenant) && resolvedPhotographerId !== tenant.photographerId) {
      throw new ApiError(403, "Access denied");
    }

    const assetPurpose = purposeToAssetPurpose[purpose] || "OTHER";

    if (resolvedPhotographerId && tenant && !isAdminTenant(tenant)) {
      const plan = await planLimitService.getPlanByPhotographerId(resolvedPhotographerId);
      const incomingUploadBytes = toUploadBytes(size);

      if (assetPurpose === "PORTFOLIO") {
        const portfolioPhotoCount = await prisma.portfolioItem.count({
          where: {
            photographerId: resolvedPhotographerId,
          },
        });
        if (planLimitService.isLimitReached({ used: portfolioPhotoCount, max: plan.maxPortfolioImages })) {
          await planLimitService.throwLimitReached({
            metric: "portfolioImages",
            used: portfolioPhotoCount,
            plan,
          });
        }
      }

      const storageLimitBytes = toStorageLimitBytes(plan.storageGB);
      if (storageLimitBytes >= 0) {
        const usedStorageBytes = await getPhotographerStorageUsageBytes(resolvedPhotographerId);
        const projectedStorageBytes = usedStorageBytes + incomingUploadBytes;
        if (projectedStorageBytes > storageLimitBytes) {
          await planLimitService.throwLimitReached({
            metric: "storage",
            used: Number((projectedStorageBytes / BYTES_PER_GB).toFixed(3)),
            plan,
          });
        }
      }
    }

    const key = `uploads/${resolvedPhotographerId || "common"}/${Date.now()}-${randomCode()}-${fileName}`;

    const asset = await prisma.asset.create({
      data: {
        photographerId: resolvedPhotographerId || null,
        uploadedById: userId || null,
        type: mimeType.startsWith("image/") ? "IMAGE" : "OTHER",
        purpose: assetPurpose,
        status: "PENDING",
        bucket: env.r2.bucket,
        objectKey: key,
        mimeType,
        originalFileName: fileName,
        sizeBytes: toUploadBytes(size),
        cdnUrl: buildPublicAssetUrl(key),
      },
    });

    if (resolvedPhotographerId) {
      await bumpPhotographerStorageUsageCache(resolvedPhotographerId, toUploadBytes(size));
    }

    const command = new PutObjectCommand({
      Bucket: env.r2.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });

    return {
      assetId: asset.id,
      uploadUrl,
      publicUrl: asset.cdnUrl,
      headers: {
        "Content-Type": mimeType,
      },
    };
  },

  async markUploadComplete(assetId, tenant = null) {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, photographerId: true, objectKey: true, type: true },
    });
    ensureTenantOwnership(asset, tenant, "Asset");

    const publicUrl = buildPublicAssetUrl(asset?.objectKey);

    const updated = await prisma.asset.update({
      where: { id: assetId },
      data: {
        status: "READY",
        ...(publicUrl ? { cdnUrl: publicUrl } : {}),
      },
      select: {
        id: true,
        status: true,
        type: true,
        cdnUrl: true,
        objectKey: true,
        metadata: true,
      },
    });

    return {
      assetId: updated.id,
      status: updated.status.toLowerCase(),
      url: resolveAssetUrl(updated, "web"),
      shouldProcessImage: updated.type === "IMAGE",
    };
  },

  async deleteAsset(assetId, tenant = null) {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, photographerId: true },
    });
    ensureTenantOwnership(asset, tenant, "Asset");

    await prisma.asset.update({
      where: { id: assetId },
      data: { status: "DELETED", deletedAt: new Date() },
    });

    await invalidatePhotographerStorageUsageCache(asset?.photographerId || null);

    return { deleted: true };
  },

  async assignAvatar(userId, assetId) {
    const photographer = await prisma.photographer.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!photographer) {
      throw new ApiError(404, "Photographer profile not found");
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        photographerId: true,
        uploadedById: true,
        purpose: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!asset || asset.deletedAt) {
      throw new ApiError(404, "Avatar asset not found");
    }

    if (asset.status !== "READY") {
      throw new ApiError(400, "Avatar upload is not complete");
    }

    if (asset.photographerId !== photographer.id && asset.uploadedById !== userId) {
      throw new ApiError(403, "Access denied");
    }

    await prisma.$transaction([
      prisma.asset.update({
        where: { id: asset.id },
        data: {
          photographerId: photographer.id,
          purpose: "AVATAR",
          status: "READY",
        },
      }),
      prisma.photographer.update({
        where: { id: photographer.id },
        data: {
          avatarAssetId: asset.id,
        },
      }),
    ]);

    const updated = await prisma.photographer.findUnique({
      where: { id: photographer.id },
      include: { avatarAsset: true },
    });

    return {
      avatarAssetId: updated?.avatarAssetId || null,
      avatarUrl: resolveAssetUrl(updated?.avatarAsset, "thumb"),
    };
  },

  async removeAvatar(userId) {
    const photographer = await prisma.photographer.findUnique({
      where: { userId },
      select: { id: true, avatarAssetId: true },
    });

    if (!photographer) {
      throw new ApiError(404, "Photographer profile not found");
    }

    if (!photographer.avatarAssetId) {
      return {
        removed: true,
        avatarUrl: null,
      };
    }

    const avatarAsset = await prisma.asset.findUnique({
      where: { id: photographer.avatarAssetId },
      select: { id: true, bucket: true, objectKey: true },
    });

    if (avatarAsset?.bucket && avatarAsset?.objectKey) {
      const client = getR2Client();
      if (!client) {
        throw new ApiError(500, "R2 configuration is incomplete");
      }

      await client.send(
        new DeleteObjectCommand({
          Bucket: avatarAsset.bucket,
          Key: avatarAsset.objectKey,
        })
      );
    }

    await prisma.$transaction([
      prisma.photographer.update({
        where: { id: photographer.id },
        data: { avatarAssetId: null },
      }),
      prisma.asset.updateMany({
        where: { id: photographer.avatarAssetId },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
        },
      }),
    ]);

    await invalidatePhotographerStorageUsageCache(photographer.id);

    return {
      removed: true,
      avatarUrl: null,
    };
  },
};

