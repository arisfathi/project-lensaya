import {
  DEFAULT_THEME_COLOR,
  TIME_24H_PATTERN,
} from "./constants";
import type {
  AvailabilityDayStatus,
  PublicPackage,
} from "./types";

export const normalizeThemeColor = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw) ? raw : DEFAULT_THEME_COLOR;
};

export const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "").trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return `rgba(6, 182, 212, ${alpha})`;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

export const mixHexColors = (baseHex: string, overlayHex: string, overlayRatio: number) => {
  const sanitizeHex = (value: string) => {
    const normalized = String(value || "").replace("#", "").trim();
    const expanded =
      normalized.length === 3
        ? normalized
            .split("")
            .map((char) => `${char}${char}`)
            .join("")
        : normalized;
    return /^[0-9a-fA-F]{6}$/.test(expanded) ? expanded : null;
  };

  const base = sanitizeHex(baseHex);
  const overlay = sanitizeHex(overlayHex);
  if (!base || !overlay) return DEFAULT_THEME_COLOR;

  const ratio = Math.max(0, Math.min(1, Number(overlayRatio) || 0));
  const mixChannel = (baseChannel: number, overlayChannel: number) =>
    Math.round(baseChannel * (1 - ratio) + overlayChannel * ratio);

  const br = Number.parseInt(base.slice(0, 2), 16);
  const bg = Number.parseInt(base.slice(2, 4), 16);
  const bb = Number.parseInt(base.slice(4, 6), 16);

  const or = Number.parseInt(overlay.slice(0, 2), 16);
  const og = Number.parseInt(overlay.slice(2, 4), 16);
  const ob = Number.parseInt(overlay.slice(4, 6), 16);

  const mixed = [mixChannel(br, or), mixChannel(bg, og), mixChannel(bb, ob)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");

  return `#${mixed}`;
};

export const formatPackagePrice = (pkg: PublicPackage) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: pkg.currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pkg.price || 0);

export const toDateKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const normalizeAvailabilityStatus = (value: unknown): AvailabilityDayStatus => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "booked" || normalized === "unavailable" || normalized === "blocked"
    ? "booked"
    : "available";
};

export const isBookedAvailabilityStatus = (value: AvailabilityDayStatus) => value === "booked";
export const toAvailabilityStatusLabel = (value: AvailabilityDayStatus) => (value === "booked" ? "Booked" : "Available");

export const formatDateLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not selected";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

export const formatTimeLabel = (timeValue: string) => {
  const raw = String(timeValue || "").trim();
  if (!TIME_24H_PATTERN.test(raw)) return "Not selected";
  const [hoursToken, minutesToken] = raw.split(":");
  const date = new Date();
  date.setHours(Number(hoursToken), Number(minutesToken), 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

export const todayLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toInstagramUrl = (value: string | null | undefined) => {
  const username = String(value || "").trim();
  if (!username) return null;
  return `https://instagram.com/${encodeURIComponent(username)}`;
};

export const toFacebookUrl = (value: string | null | undefined) => {
  const slug = String(value || "").trim();
  if (!slug) return null;
  return `https://facebook.com/${encodeURIComponent(slug)}`;
};

export const toTiktokUrl = (value: string | null | undefined) => {
  const handle = String(value || "").trim().replace(/^@+/, "");
  if (!handle) return null;
  return `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
};

export const toWhatsAppUrl = (value: string | null | undefined, message: string) => {
  const text = encodeURIComponent(message);
  const raw = String(value || "").replace(/\D/g, "");
  return raw ? `https://wa.me/${raw}?text=${text}` : `https://wa.me/?text=${text}`;
};

export const createId = (prefix: string) => {
  const random = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `${prefix}_${stamp}_${random}`;
};

export const getOrCreateStorageValue = (storage: Storage, key: string, prefix: string) => {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const generated = createId(prefix);
  storage.setItem(key, generated);
  return generated;
};

export const classifySource = (rawValue: string) => {
  const value = String(rawValue || "").trim().toLowerCase();
  if (!value) return "";
  if (value.includes("instagram") || value === "ig") return "instagram";
  if (value.includes("facebook") || value === "fb") return "facebook";
  if (value.includes("tiktok") || value === "tt") return "tiktok";
  if (value.includes("whatsapp") || value === "wa") return "whatsapp";
  if (value.includes("youtube") || value.includes("youtu")) return "youtube";
  if (value === "x" || value.includes("twitter") || value.includes("x.com") || value.includes("t.co")) return "x";
  if (value.includes("google") || value.includes("search")) return "search";
  if (value.includes("ref") || value.includes("affiliate")) return "referral";
  if (value.includes("direct")) return "direct";
  return "other";
};

export const sourceFromReferrer = (referrer: string) => {
  const value = String(referrer || "").trim();
  if (!value) return "direct";

  try {
    const host = new URL(value).hostname.toLowerCase();
    if (!host || host === window.location.hostname) return "direct";
    const classified = classifySource(host);
    if (!classified || classified === "other") return "referral";
    return classified;
  } catch {
    return "referral";
  }
};

export const resolveInitialSource = () => {
  const params = new URLSearchParams(window.location.search);
  const explicitSource =
    params.get("utm_source") ||
    params.get("source") ||
    (params.get("ref") ? "referral" : "") ||
    (params.get("gclid") ? "search" : "") ||
    (params.get("fbclid") ? "facebook" : "") ||
    (params.get("ttclid") ? "tiktok" : "") ||
    "";

  const classified = classifySource(explicitSource);
  if (classified) return classified;
  return sourceFromReferrer(document.referrer || "");
};
