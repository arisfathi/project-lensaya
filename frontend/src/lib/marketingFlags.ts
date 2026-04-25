const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return fallback;
};

export const PUBLIC_DIRECTORY_ENABLED = toBoolean(import.meta.env.VITE_PUBLIC_DIRECTORY_ENABLED, false);

