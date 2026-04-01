import { DEFAULT_THEME_COLOR } from "./constants";

export const toWhatsAppUrl = (value: string | null | undefined, message: string) => {
  const text = encodeURIComponent(message);
  const raw = String(value || "").replace(/\D/g, "");
  return raw ? `https://wa.me/${raw}?text=${text}` : `https://wa.me/?text=${text}`;
};

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
