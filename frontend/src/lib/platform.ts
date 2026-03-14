type EnvBag = Record<string, string | boolean | undefined>;

const env = import.meta.env as EnvBag;
const RESERVED_PLATFORM_SUBDOMAINS = new Set(["www", "app", "admin", "api"]);

const readEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const normalizeOrigin = (value: string, fallback: string) => {
  try {
    return new URL(value || fallback).origin;
  } catch {
    return fallback;
  }
};

const normalizePath = (value: string) => (value.startsWith("/") ? value : `/${value}`);

const isIpv4 = (host: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);

export const normalizeHost = (value: string | null | undefined) => {
  const raw = String(value || "").trim().toLowerCase().replace(/\.+$/, "");
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

const isLocalLikeHost = (host: string) => {
  const normalized = normalizeHost(host);
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    isIpv4(normalized) ||
    normalized.includes(":")
  );
};

const getBaseDomain = () => {
  const configured = readEnv("VITE_APP_BASE_DOMAIN", "APP_BASE_DOMAIN")
    .toLowerCase()
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
  if (configured) return configured;

  let hostname = "localhost";
  try {
    hostname = new URL(PUBLIC_APP_URL).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    hostname = "localhost";
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost") || isIpv4(hostname)) {
    return hostname.replace(/^(app|admin|www)\./, "");
  }

  return hostname.replace(/^(app|admin)\./, "");
};

const defaultAppOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

export const APP_URL = normalizeOrigin(readEnv("VITE_APP_URL", "APP_URL"), defaultAppOrigin);
export const PUBLIC_APP_URL = normalizeOrigin(readEnv("VITE_PUBLIC_APP_URL", "PUBLIC_APP_URL"), APP_URL);
export const ADMIN_APP_URL = normalizeOrigin(readEnv("VITE_ADMIN_APP_URL", "ADMIN_APP_URL"), APP_URL);
export const PUBLIC_APP_DOMAIN = getBaseDomain();

const getPublicProtocol = () => {
  try {
    return new URL(PUBLIC_APP_URL).protocol || "https:";
  } catch {
    return APP_URL.startsWith("https://") ? "https:" : "http:";
  }
};

const PUBLIC_APP_PROTOCOL = getPublicProtocol();

export const toAbsoluteWebsiteUrl = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return `${PUBLIC_APP_PROTOCOL}//${PUBLIC_APP_DOMAIN}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `${PUBLIC_APP_PROTOCOL}//${trimmed}`;
};

export const buildAppUrl = (path = "/") => new URL(normalizePath(path), APP_URL).toString();
export const buildPublicAppUrl = (path = "/") => new URL(normalizePath(path), PUBLIC_APP_URL).toString();
export const buildAdminAppUrl = (path = "/") => new URL(normalizePath(path), ADMIN_APP_URL).toString();

export const buildPlatformRouteUrl = (
  path = "/",
  target: "app" | "public" | "admin" = "app"
) => {
  if (target === "public") {
    return buildPublicAppUrl(path);
  }
  if (target === "admin") {
    return buildAdminAppUrl(path);
  }
  return buildAppUrl(path);
};

export const buildPublicStudioHost = (username?: string | null, fallback = "yourstudio") => {
  const normalized = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "");
  return `${normalized || fallback}.${PUBLIC_APP_DOMAIN}`;
};

export const buildPublicStudioUrl = (username?: string | null, path = "/", fallback = "yourstudio") =>
  new URL(normalizePath(path), toAbsoluteWebsiteUrl(buildPublicStudioHost(username, fallback))).toString();

export const getPreviewHost = () => {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return normalizeHost(params.get("previewHost"));
};

export const getRuntimeWindowHost = () => {
  if (typeof window === "undefined") return "";
  return normalizeHost(window.location.host || window.location.hostname);
};

export const getRuntimePublicHost = () => getPreviewHost() || getRuntimeWindowHost();

export const getRuntimePublicHostType = (host = getRuntimePublicHost()) => {
  const normalized = normalizeHost(host);
  if (!normalized) return "unknown" as const;

  if (
    normalized === PUBLIC_APP_DOMAIN ||
    normalized === `www.${PUBLIC_APP_DOMAIN}` ||
    normalized === `app.${PUBLIC_APP_DOMAIN}` ||
    normalized === `admin.${PUBLIC_APP_DOMAIN}` ||
    normalized === `api.${PUBLIC_APP_DOMAIN}`
  ) {
    return "platform" as const;
  }

  if (normalized.endsWith(`.${PUBLIC_APP_DOMAIN}`)) {
    const label = normalized.slice(0, -(`.${PUBLIC_APP_DOMAIN}`.length));
    if (label && !label.includes(".")) {
      if (RESERVED_PLATFORM_SUBDOMAINS.has(label)) {
        return "platform" as const;
      }
      return "managed_subdomain" as const;
    }
  }

  if (isLocalLikeHost(normalized)) {
    return "platform" as const;
  }

  return "custom_domain" as const;
};

export const isPublicSiteHostCandidate = (host = getRuntimePublicHost()) => {
  const hostType = getRuntimePublicHostType(host);
  return hostType === "managed_subdomain" || hostType === "custom_domain";
};

export const isActualPublicSiteHostCandidate = () => isPublicSiteHostCandidate(getRuntimeWindowHost());

const getRuntimePublicProtocol = (host: string) => {
  if (typeof window !== "undefined" && !getPreviewHost()) {
    return window.location.protocol || PUBLIC_APP_PROTOCOL;
  }
  return isLocalLikeHost(host) ? "http:" : PUBLIC_APP_PROTOCOL;
};

export const buildRuntimePublicUrl = (path = "/") => {
  const host = getRuntimePublicHost();
  if (!host) return buildAppUrl(path);
  return new URL(normalizePath(path), `${getRuntimePublicProtocol(host)}//${host}`).toString();
};

