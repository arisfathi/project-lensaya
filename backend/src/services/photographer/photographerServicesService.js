import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/apiError.js";
import { applyTenantFilter, ensureTenantOwnership, isAdminTenant } from "../../utils/tenantQuery.js";
import { planLimitService } from "../planLimitService.js";
import { requireTenantPhotographerId } from "./photographerService.utils.js";

export const photographerServicesService = {
  async listServices(tenant, { resolveAssetDeliveryUrl }) {
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
};
