import { billingService } from "../../services/billingService.js";

const normalizePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const processBillingMaintenanceJob = async (payload = {}, context = {}) => {
  const batchSize = normalizePositiveInt(payload?.batchSize, undefined);
  const now = payload?.now ? new Date(payload.now) : undefined;
  const reason = String(payload?.reason || context?.mode || "scheduled").trim() || "scheduled";

  const result = await billingService.runLifecycleMaintenance({
    batchSize,
    now: now && !Number.isNaN(now.getTime()) ? now : undefined,
    reason,
  });

  return {
    processed: true,
    ...result,
  };
};
