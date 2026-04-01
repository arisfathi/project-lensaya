import { prisma } from "../../config/prisma.js";
import { ensureTenantOwnership, applyTenantFilter, isAdminTenant } from "../../utils/tenantQuery.js";
import { planLimitService } from "../planLimitService.js";
import {
  normalizePackageFeatures,
  enforcePackageFeatureLimit,
  requireTenantPhotographerId,
} from "./photographerService.utils.js";

const countActivePackagesForService = (photographerId, serviceId) =>
  prisma.package.count({
    where: {
      photographerId,
      serviceId,
      status: { not: "ARCHIVED" },
    },
  });

export const photographerPackagesService = {
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

    if (isAdminTenant(tenant)) {
      return { items };
    }

    const photographerId = requireTenantPhotographerId(tenant);
    const plan = await planLimitService.getPlanByPhotographerId(photographerId);
    const limits = planLimitService.mapPlanLimits(plan);

    return { items, limits: { packageFeatures: Number(limits.packageFeatures ?? limits.maxPackageFeatures ?? 5) } };
  },

  async createPackage(tenant, data) {
    const photographerId = requireTenantPhotographerId(tenant);
    const normalizedFeatures = normalizePackageFeatures(data.features);

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

      enforcePackageFeatureLimit({ plan, features: normalizedFeatures });
    }

    const pkg = await prisma.package.create({
      data: {
        photographerId,
        serviceId: data.serviceId,
        name: data.name,
        priceCents: Math.round(Number(data.price) * 100),
        durationLabel: data.duration,
        features: normalizedFeatures,
        isPopular: Boolean(data.popular),
      },
    });
    return { package: pkg };
  },

  async updatePackage(tenant, packageId, data) {
    const normalizedFeatures = data.features !== undefined ? normalizePackageFeatures(data.features) : undefined;
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

    if (!isAdminTenant(tenant) && normalizedFeatures !== undefined) {
      const plan = await planLimitService.getPlanByPhotographerId(existing.photographerId);
      enforcePackageFeatureLimit({ plan, features: normalizedFeatures });
    }

    const pkg = await prisma.package.update({
      where: { id: packageId },
      data: {
        ...(data.serviceId !== undefined ? { serviceId: data.serviceId } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.price !== undefined ? { priceCents: Math.round(Number(data.price) * 100) } : {}),
        ...(data.duration !== undefined ? { durationLabel: data.duration } : {}),
        ...(normalizedFeatures !== undefined ? { features: normalizedFeatures } : {}),
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
};
