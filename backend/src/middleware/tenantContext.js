import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { runWithTenantContext } from "../utils/tenantStore.js";

export const tenantContext = async (req, _res, next) => {
  try {
    if (!req.auth?.sub) {
      return next(new ApiError(401, "Unauthorized"));
    }

    const userId = req.auth.sub;
    const role = req.auth.role || "PHOTOGRAPHER";

    if (role === "ADMIN") {
      req.tenant = {
        photographerId: null,
        userId,
        role,
        isAdmin: true,
      };

      return runWithTenantContext(req.tenant, () => next());
    }

    const photographer = await prisma.photographer.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!photographer) {
      return next(new ApiError(404, "Photographer tenant not found"));
    }

    req.tenant = {
      photographerId: photographer.id,
      userId,
      role,
      isAdmin: false,
    };

    return runWithTenantContext(req.tenant, () => next());
  } catch (error) {
    return next(error);
  }
};
