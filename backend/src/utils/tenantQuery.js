import { ApiError } from "./apiError.js";

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

export const isAdminTenant = (tenant) => tenant?.isAdmin || tenant?.role === "ADMIN";

export const applyTenantFilter = (query = {}, tenant) => {
  if (isAdminTenant(tenant) || !tenant?.photographerId) {
    return query;
  }

  const nextQuery = isObject(query) ? { ...query } : {};
  if (nextQuery.where) {
    nextQuery.where = {
      AND: [nextQuery.where, { photographerId: tenant.photographerId }],
    };
    return nextQuery;
  }

  nextQuery.where = { photographerId: tenant.photographerId };
  return nextQuery;
};

export const ensureTenantOwnership = (resource, tenant, resourceLabel = "Resource") => {
  if (!resource) {
    throw new ApiError(404, `${resourceLabel} not found`);
  }

  if (isAdminTenant(tenant)) {
    return resource;
  }

  if (!tenant?.photographerId || resource.photographerId !== tenant.photographerId) {
    throw new ApiError(403, "Access denied");
  }

  return resource;
};
