import { env } from "../config/env.js";
import { getDirectRequestHostContext } from "../utils/requestHost.js";

const PUBLIC_HOST_ALLOWED_PATTERNS = [
  /^\/public(?:\/|$)/i,
  /^\/analytics\/events(?:\/|$)/i,
  /^\/billing\/plans(?:\/|$)/i,
];

const ADMIN_ROUTE_PATTERN = /^\/admin(?:\/|$)/i;

export const publicHostApiGuard = (req, res, next) => {
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  const directHostContext = getDirectRequestHostContext(req);
  if (!directHostContext.isPublicSiteCandidate) {
    next();
    return;
  }

  const path = String(req.path || "/");
  if (PUBLIC_HOST_ALLOWED_PATTERNS.some((pattern) => pattern.test(path))) {
    next();
    return;
  }

  const routeTarget = ADMIN_ROUTE_PATTERN.test(path) ? "admin" : "app";
  const redirectUrl = routeTarget === "admin" ? env.adminAppUrl : env.appUrl;

  res.status(421).json({
    success: false,
    data: {
      host: directHostContext.host || null,
      hostType: directHostContext.hostType,
      routeTarget,
      redirectUrl,
    },
    error: "This API route is not available on public photographer hosts. Use the Lensaya workspace host instead.",
  });
};
