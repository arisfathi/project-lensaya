export const formatNumber = (value: number) => Number(value || 0).toLocaleString();
export const normalizePlanId = (value: string | null | undefined) => String(value || "FREE").trim().toUpperCase();
export const isUnlimited = (value: number) => Number(value) < 0;

export const toUsagePercent = (used: number, limit: number) => {
  if (isUnlimited(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
};

export const formatUsageLimit = (limit: number, unit?: string) => {
  if (isUnlimited(limit)) return "Unlimited";
  return unit ? `${limit} ${unit}` : `${limit}`;
};
