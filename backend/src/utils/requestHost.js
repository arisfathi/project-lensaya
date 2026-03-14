import { env } from "../config/env.js";

const RESERVED_PLATFORM_SUBDOMAINS = new Set(["www", "app", "admin", "api"]);
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const splitFirstHeaderValue = (value = "") => String(value || "").split(",")[0].trim();

export const normalizeHostname = (value = "") => {
  const raw = splitFirstHeaderValue(value).replace(/\.+$/, "").toLowerCase();
  if (!raw) return "";

  if (raw.startsWith("[")) {
    const closingBracket = raw.indexOf("]");
    if (closingBracket >= 0) {
      return raw.slice(1, closingBracket);
    }
  }

  const colonCount = (raw.match(/:/g) || []).length;
  if (colonCount === 1 && /:\d+$/.test(raw)) {
    return raw.replace(/:\d+$/, "");
  }

  return raw;
};

const isIpv4Address = (value = "") => IPV4_PATTERN.test(String(value || ""));
const isLocalLikeHost = (host = "") => {
  const normalized = normalizeHostname(host);
  if (!normalized) return false;
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    isIpv4Address(normalized) ||
    normalized.includes(":")
  );
};

const resolveHostCandidate = (req, { includeTenantHeader = true } = {}) => {
  const candidates = [
    ...(includeTenantHeader ? [{ source: "x-tenant-host", value: req.headers["x-tenant-host"] }] : []),
    { source: "x-forwarded-host", value: req.headers["x-forwarded-host"] },
    { source: "host", value: req.headers.host },
  ];

  for (const candidate of candidates) {
    const normalized = normalizeHostname(candidate.value);
    if (!normalized) continue;
    return {
      host: normalized,
      source: candidate.source,
    };
  }

  return {
    host: "",
    source: "none",
  };
};

const buildHostContext = ({ host, source }) => {
  const baseDomain = normalizeHostname(env.publicAppDomain);
  const platformHosts = new Set(
    [
      baseDomain,
      baseDomain ? `www.${baseDomain}` : "",
      baseDomain ? `app.${baseDomain}` : "",
      baseDomain ? `admin.${baseDomain}` : "",
      baseDomain ? `api.${baseDomain}` : "",
    ].filter(Boolean)
  );

  let hostType = "unknown";
  let usernameCandidate = null;

  if (!host) {
    hostType = "unknown";
  } else if (platformHosts.has(host)) {
    hostType = "platform";
  } else if (baseDomain && host.endsWith(`.${baseDomain}`)) {
    const label = host.slice(0, -(`.${baseDomain}`.length));
    if (label && !label.includes(".")) {
      if (RESERVED_PLATFORM_SUBDOMAINS.has(label)) {
        hostType = "platform";
      } else {
        hostType = "managed_subdomain";
        usernameCandidate = label;
      }
    } else if (isLocalLikeHost(host)) {
      hostType = "platform";
    }
  } else if (isLocalLikeHost(host)) {
    hostType = "platform";
  } else {
    hostType = "custom_domain";
  }

  return {
    host,
    source,
    hostType,
    usernameCandidate,
    baseDomain,
    isPublicSiteCandidate: hostType === "managed_subdomain" || hostType === "custom_domain",
  };
};

export const getRequestHostContext = (req, options = {}) =>
  buildHostContext(resolveHostCandidate(req, { includeTenantHeader: options.includeTenantHeader !== false }));

export const getDirectRequestHostContext = (req) =>
  getRequestHostContext(req, { includeTenantHeader: false });
