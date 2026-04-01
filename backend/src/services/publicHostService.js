import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { planLimitService } from "./planLimitService.js";
import { redisCache } from "../utils/redisCache.js";

const BROKEN_DOMAIN_STATUSES = new Set(["FAILED", "BROKEN"]);
const INACTIVE_DOMAIN_STATUSES = new Set(["PENDING", "AWAITING_DNS", "VERIFYING"]);
const PUBLIC_HOST_CACHE_TTL_SECONDS = 30;
const PUBLIC_HOST_CACHE_PREFIX = "cache:public-host:v1:";

const PUBLIC_PROTOCOL = (() => {
  try {
    return new URL(env.publicAppUrl).protocol.replace(/:$/, "") || (env.isProduction ? "https" : "http");
  } catch {
    return env.isProduction ? "https" : "http";
  }
})();

const toApiStatus = (value) => (value ? String(value).trim().toLowerCase() : null);
const toApiSslStatus = (value) => (value ? String(value).trim().toLowerCase() : null);
const normalizePath = (value = "/") => (value.startsWith("/") ? value : `/${value}`);
const buildUrl = (host, path = "/") => `${PUBLIC_PROTOCOL}://${host}${normalizePath(path)}`;
const buildFallbackHost = (username) => `${username}.${env.publicAppDomain}`;
const buildFallbackUrls = (username) => {
  const host = buildFallbackHost(username);
  return {
    fallbackUrl: buildUrl(host, "/"),
    fallbackGalleryUrl: buildUrl(host, "/gallery"),
  };
};

const toPublicHostCacheKey = (hostContext) => {
  const host = String(hostContext?.host || "").trim().toLowerCase();
  const hostType = String(hostContext?.hostType || "unknown").trim().toLowerCase();
  const username = String(hostContext?.usernameCandidate || "").trim().toLowerCase();
  if (!host || !hostContext?.isPublicSiteCandidate) return null;
  return `${PUBLIC_HOST_CACHE_PREFIX}${hostType}:${host}:${username}`;
};

const applyHostContextMetadata = (response, hostContext) => ({
  ...response,
  host: hostContext?.host || response?.host || null,
  hostSource: hostContext?.source || null,
  hostType: hostContext?.hostType || response?.hostType || "unknown",
});

const buildResponse = ({
  hostContext,
  resolutionStatus,
  message = null,
  photographer = null,
  domainRecord = null,
  siteUrl = null,
  galleryUrl = null,
  isCustomDomain = false,
}) => {
  const fallback = photographer?.username
    ? buildFallbackUrls(photographer.username)
    : { fallbackUrl: null, fallbackGalleryUrl: null };

  return {
    host: hostContext?.host || null,
    hostSource: hostContext?.source || null,
    hostType: hostContext?.hostType || "unknown",
    resolutionStatus,
    message,
    photographer: photographer
      ? {
          username: photographer.username,
          studioName: photographer.studioName,
        }
      : null,
    domain:
      domainRecord?.domain ||
      (resolutionStatus === "resolved" && hostContext?.host ? hostContext.host : null),
    domainStatus: toApiStatus(domainRecord?.status),
    sslStatus: toApiSslStatus(domainRecord?.sslStatus),
    failureReason: domainRecord?.failureReason || null,
    siteUrl,
    galleryUrl,
    fallbackUrl: fallback.fallbackUrl,
    fallbackGalleryUrl: fallback.fallbackGalleryUrl,
    isCustomDomain,
  };
};

const resolveManagedSubdomain = async (hostContext) => {
  const photographer = await prisma.photographer.findFirst({
    where: {
      username: hostContext.usernameCandidate,
      status: "ACTIVE",
    },
    select: {
      id: true,
      username: true,
      studioName: true,
      status: true,
    },
  });

  if (!photographer) {
    return buildResponse({
      hostContext,
      resolutionStatus: "not_found",
      message: "This Lensaya site could not be found.",
    });
  }

  return buildResponse({
    hostContext,
    resolutionStatus: "resolved",
    photographer,
    siteUrl: buildUrl(hostContext.host, "/"),
    galleryUrl: buildUrl(hostContext.host, "/gallery"),
    isCustomDomain: false,
  });
};

const toInactiveMessage = (domainRecord) => {
  const status = String(domainRecord?.status || "").trim().toUpperCase();
  if (status === "VERIFYING") {
    return "This custom domain is still being verified. Please try again shortly.";
  }
  if (INACTIVE_DOMAIN_STATUSES.has(status)) {
    return "This custom domain is not live yet. Finish DNS setup and verify it in Lensaya Settings.";
  }
  return "This custom domain is not currently serving a public site.";
};

const resolveCustomDomain = async (hostContext) => {
  const domainRecord = await prisma.customDomain.findUnique({
    where: { domain: hostContext.host },
    include: {
      photographer: {
        select: {
          id: true,
          username: true,
          studioName: true,
          status: true,
        },
      },
    },
  });

  if (!domainRecord?.photographer) {
    return buildResponse({
      hostContext,
      resolutionStatus: "not_found",
      message: "This domain is not connected to a Lensaya site.",
      isCustomDomain: true,
    });
  }

  const photographer = domainRecord.photographer;
  if (photographer.status !== "ACTIVE") {
    return buildResponse({
      hostContext,
      resolutionStatus: "inactive",
      message: "This photographer site is not currently active.",
      photographer,
      domainRecord,
      isCustomDomain: true,
    });
  }

  const currentPlan = await planLimitService.getPlanByPhotographerId(photographer.id);
  if (!currentPlan?.customDomain) {
    return buildResponse({
      hostContext,
      resolutionStatus: "upgrade_required",
      message: "This custom domain is no longer active on the current plan. Use the Lensaya fallback URL below.",
      photographer,
      domainRecord,
      isCustomDomain: true,
    });
  }

  const normalizedStatus = String(domainRecord.status || "").trim().toUpperCase();
  if (normalizedStatus === "ACTIVE") {
    return buildResponse({
      hostContext,
      resolutionStatus: "resolved",
      photographer,
      domainRecord,
      siteUrl: buildUrl(hostContext.host, "/"),
      galleryUrl: buildUrl(hostContext.host, "/gallery"),
      isCustomDomain: true,
    });
  }

  if (BROKEN_DOMAIN_STATUSES.has(normalizedStatus)) {
    return buildResponse({
      hostContext,
      resolutionStatus: "broken",
      message: domainRecord.failureReason || "This custom domain is currently unavailable.",
      photographer,
      domainRecord,
      isCustomDomain: true,
    });
  }

  return buildResponse({
    hostContext,
    resolutionStatus: "inactive",
    message: toInactiveMessage(domainRecord),
    photographer,
    domainRecord,
    isCustomDomain: true,
  });
};

export const publicHostService = {
  async resolve(hostContext) {
    if (!hostContext?.isPublicSiteCandidate) {
      return buildResponse({
        hostContext,
        resolutionStatus: "not_public_host",
        message: "This host does not serve a public photographer site.",
      });
    }

    const cacheKey = toPublicHostCacheKey(hostContext);
    if (cacheKey) {
      const cached = await redisCache.getJson(cacheKey);
      if (cached && typeof cached === "object") {
        return applyHostContextMetadata(cached, hostContext);
      }
    }

    let resolved;
    if (hostContext.hostType === "managed_subdomain") {
      resolved = await resolveManagedSubdomain(hostContext);
    } else if (hostContext.hostType === "custom_domain") {
      resolved = await resolveCustomDomain(hostContext);
    } else {
      resolved = buildResponse({
        hostContext,
        resolutionStatus: "not_public_host",
        message: "This host does not serve a public photographer site.",
      });
    }

    if (cacheKey) {
      await redisCache.setJson(cacheKey, resolved, PUBLIC_HOST_CACHE_TTL_SECONDS);
    }

    return resolved;
  },
};
