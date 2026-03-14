import { resolveCname } from "node:dns/promises";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { planLimitService } from "./planLimitService.js";

const SUPPORTED_HOST = "www";
const FALLBACK_PROTOCOL = "https";
const MOCK_FAILURE_TOKENS = ["fail", "broken", "invalid"];
const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

const normalizeDomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.+$/, "");

const normalizeDnsValue = (value) => String(value || "").trim().toLowerCase().replace(/\.+$/, "");
const toApiStatus = (value) => (value ? String(value).trim().toLowerCase() : null);
const toApiSslStatus = (value) => (value ? String(value).trim().toLowerCase() : null);
const isLikelyIpAddress = (value) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(String(value || ""));
const shouldUseMockFailure = (value) => {
  const normalized = normalizeDomain(value);
  return MOCK_FAILURE_TOKENS.some((token) => normalized.includes(token));
};

const buildFallbackUrl = (username) => `${FALLBACK_PROTOCOL}://${username}.${env.publicAppDomain}`;
const buildDnsInstructions = (host) => ({
  type: "CNAME",
  host: host || SUPPORTED_HOST,
  value: env.customDomains.cnameTarget,
});

const getPhotographerContext = async (userId) => {
  const [photographer, plan] = await Promise.all([
    prisma.photographer.findUnique({
      where: { userId },
      select: {
        id: true,
        username: true,
        studioName: true,
        customDomain: true,
      },
    }),
    planLimitService.getPlanByUserId(userId),
  ]);

  if (!photographer) {
    throw new ApiError(404, "Photographer profile not found");
  }

  return { photographer, plan };
};

const assertEntitled = (plan) => {
  if (!plan?.customDomain) {
    throw new ApiError(403, "Custom domains are available on Pro and Studio plans");
  }
};

const normalizeRequestedDomain = (value) => {
  const normalized = normalizeDomain(value);
  if (!normalized) {
    throw new ApiError(400, "Enter a domain to connect");
  }
  if (isLikelyIpAddress(normalized) || normalized === "localhost" || normalized.endsWith(".localhost")) {
    throw new ApiError(400, "Enter a valid public domain such as www.raystudio.com");
  }
  if (normalized === env.publicAppDomain || normalized.endsWith(`.${env.publicAppDomain}`)) {
    throw new ApiError(400, "Use your own domain, not a Lensaya subdomain");
  }

  const recommendedDomain = normalized.split(".").length === 2 ? `${SUPPORTED_HOST}.${normalized}` : normalized;
  if (!DOMAIN_PATTERN.test(recommendedDomain)) {
    throw new ApiError(400, "Enter a valid domain such as www.raystudio.com");
  }

  const labels = recommendedDomain.split(".");
  if (labels[0] !== SUPPORTED_HOST) {
    throw new ApiError(400, "Use the www version of your domain for this setup");
  }

  return {
    domain: recommendedDomain,
    host: labels[0],
    apexDomain: labels.slice(1).join("."),
  };
};

const mapState = ({ photographer, plan, record, deleted = false }) => ({
  deleted,
  eligible: Boolean(plan?.customDomain),
  currentPlan: String(plan?.name || "FREE").toUpperCase(),
  domain: record?.domain || null,
  status: toApiStatus(record?.status),
  sslStatus: toApiSslStatus(record?.sslStatus),
  failureReason: record?.failureReason || null,
  lastCheckedAt: record?.lastCheckedAt?.toISOString?.() || null,
  verifiedAt: record?.verifiedAt?.toISOString?.() || null,
  fallbackUrl: buildFallbackUrl(photographer.username),
  dnsInstructions: record ? buildDnsInstructions(record.host) : null,
  verificationMode: env.customDomains.verificationMode,
});

const withLookupTimeout = async (promiseFactory) => {
  let timeoutId = null;

  try {
    return await Promise.race([
      promiseFactory(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("CUSTOM_DOMAIN_LOOKUP_TIMEOUT")), env.customDomains.lookupTimeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const buildFailureResult = ({ currentStatus, failureReason }) => ({
  status: currentStatus === "ACTIVE" ? "BROKEN" : "FAILED",
  sslStatus: "ERROR",
  failureReason,
});

export const customDomainService = {
  async getState(userId) {
    const { photographer, plan } = await getPhotographerContext(userId);
    return mapState({ photographer, plan, record: photographer.customDomain || null });
  },

  async save(userId, domain) {
    const { photographer, plan } = await getPhotographerContext(userId);
    assertEntitled(plan);

    const normalized = normalizeRequestedDomain(domain);
    const existing = photographer.customDomain || null;
    if (existing?.domain === normalized.domain && existing.status === "ACTIVE") {
      return mapState({ photographer, plan, record: existing });
    }

    const claimedByAnotherUser = await prisma.customDomain.findFirst({
      where: {
        domain: normalized.domain,
        photographerId: { not: photographer.id },
      },
      select: { id: true },
    });
    if (claimedByAnotherUser) {
      throw new ApiError(409, "This domain is already connected to another account");
    }

    const data = {
      domain: normalized.domain,
      apexDomain: normalized.apexDomain,
      host: normalized.host,
      status: "AWAITING_DNS",
      sslStatus: "PENDING",
      failureReason: null,
      lastCheckedAt: null,
      verifiedAt: null,
    };

    try {
      const record = existing
        ? await prisma.customDomain.update({
            where: { photographerId: photographer.id },
            data,
          })
        : await prisma.customDomain.create({
            data: {
              photographerId: photographer.id,
              ...data,
            },
          });

      return mapState({ photographer, plan, record });
    } catch (error) {
      if (String(error?.code || "") === "P2002") {
        throw new ApiError(409, "This domain is already connected to another account");
      }
      throw error;
    }
  },

  async runVerification({ domain, currentStatus }) {
    if (env.customDomains.verificationMode === "mock") {
      if (shouldUseMockFailure(domain)) {
        return buildFailureResult({
          currentStatus,
          failureReason:
            "We could not find the required CNAME record yet. Double-check the host, target, and whether DNS has finished propagating.",
        });
      }

      return {
        status: "ACTIVE",
        sslStatus: "ISSUED",
        failureReason: null,
      };
    }

    try {
      const resolvedValues = await withLookupTimeout(() => resolveCname(domain));
      const normalizedValues = Array.isArray(resolvedValues)
        ? resolvedValues.map((value) => normalizeDnsValue(value)).filter(Boolean)
        : [];
      const expectedTarget = normalizeDnsValue(env.customDomains.cnameTarget);

      if (normalizedValues.some((value) => value === expectedTarget)) {
        return {
          status: "ACTIVE",
          sslStatus: "ISSUED",
          failureReason: null,
        };
      }

      const receivedTargets = normalizedValues.length > 0 ? normalizedValues.join(", ") : "none";
      return buildFailureResult({
        currentStatus,
        failureReason: `Expected a CNAME record pointing to ${expectedTarget}, but received ${receivedTargets}.`,
      });
    } catch (error) {
      const code = String(error?.code || error?.message || "").toUpperCase();
      if (code.includes("ENODATA") || code.includes("ENOTFOUND") || code.includes("NOTFOUND")) {
        return buildFailureResult({
          currentStatus,
          failureReason:
            "We could not find the required CNAME record yet. Double-check the host, target, and whether DNS has finished propagating.",
        });
      }
      if (code.includes("TIMEOUT")) {
        return buildFailureResult({
          currentStatus,
          failureReason: "DNS lookup timed out. Please try verification again in a few minutes.",
        });
      }

      return buildFailureResult({
        currentStatus,
        failureReason: "We could not verify this domain right now. Please try again shortly.",
      });
    }
  },

  async verify(userId) {
    const { photographer, plan } = await getPhotographerContext(userId);
    assertEntitled(plan);

    const existing = photographer.customDomain || null;
    if (!existing) {
      throw new ApiError(404, "No custom domain is connected yet");
    }

    await prisma.customDomain.update({
      where: { photographerId: photographer.id },
      data: {
        status: "VERIFYING",
        sslStatus: "PENDING",
        failureReason: null,
      },
    });

    const verificationResult = await this.runVerification({
      domain: existing.domain,
      currentStatus: existing.status,
    });
    const checkedAt = new Date();
    const shouldKeepVerifiedAt = verificationResult.status !== "ACTIVE" && existing.status === "ACTIVE";
    const record = await prisma.customDomain.update({
      where: { photographerId: photographer.id },
      data: {
        status: verificationResult.status,
        sslStatus: verificationResult.sslStatus,
        failureReason: verificationResult.failureReason,
        lastCheckedAt: checkedAt,
        verifiedAt:
          verificationResult.status === "ACTIVE"
            ? checkedAt
            : shouldKeepVerifiedAt
              ? existing.verifiedAt
              : null,
      },
    });

    return mapState({ photographer, plan, record });
  },

  async disconnect(userId) {
    const { photographer, plan } = await getPhotographerContext(userId);
    const existing = photographer.customDomain || null;

    if (!existing) {
      return mapState({ photographer, plan, record: null, deleted: false });
    }

    await prisma.customDomain.delete({
      where: { photographerId: photographer.id },
    });

    return mapState({ photographer, plan, record: null, deleted: true });
  },
};
