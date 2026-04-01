import { verifyToken } from "../utils/jwt.js";
import { ApiError } from "../utils/apiError.js";
import { prisma } from "../config/prisma.js";

const extractToken = (header = "") => {
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
};

const isAccessToken = (decoded) => {
  if (!decoded || typeof decoded !== "object") return false;
  return String(decoded.type || "").toLowerCase() !== "refresh";
};

const tokenFromRequest = (req) => {
  const bearerToken = extractToken(req.headers.authorization || "");
  if (bearerToken) return bearerToken;
  return req.cookies?.accessToken || null;
};

export const requireAuth = (req, _res, next) => {
  const token = tokenFromRequest(req);
  if (!token) {
    return next(new ApiError(401, "Unauthorized"));
  }

  try {
    const decoded = verifyToken(token);
    if (!isAccessToken(decoded)) {
      return next(new ApiError(401, "Invalid or expired token"));
    }
    req.auth = decoded;
    return next();
  } catch (_error) {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return next(new ApiError(403, "Forbidden"));
  }
  return next();
};

export const requireVerifiedEmail = async (req, _res, next) => {
  if (!req.auth?.sub) {
    return next(new ApiError(401, "Unauthorized"));
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.sub },
    select: { status: true },
  });

  if (!user) {
    return next(new ApiError(401, "Unauthorized"));
  }

  if (user.status === "SUSPENDED" || user.status === "DELETED") {
    return next(new ApiError(403, "Account is not allowed to log in"));
  }

  return next();
};

export const optionalAuth = (req, _res, next) => {
  const token = tokenFromRequest(req);
  if (!token) {
    return next();
  }
  try {
    const decoded = verifyToken(token);
    req.auth = isAccessToken(decoded) ? decoded : null;
  } catch (_error) {
    req.auth = null;
  }
  return next();
};
