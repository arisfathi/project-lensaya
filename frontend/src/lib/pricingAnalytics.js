const normalizePlan = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "FREE" || normalized === "PRO" || normalized === "STUDIO") {
    return normalized;
  }
  return null;
};

const normalizeString = (value, max = 120) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, max) : null;
};

const normalizeNumber = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (!Number.isFinite(value)) return null;
  return Number(value);
};

export const buildPricingAnalyticsMetadata = (input) => {
  const metadata = {
    event_name: input.eventName,
    page_context: normalizeString(input.pageContext, 120) || "unknown",
    current_plan: normalizePlan(input.currentPlan),
    target_plan: normalizePlan(input.targetPlan),
    feature_key: normalizeString(input.featureKey, 80),
    current_usage: normalizeNumber(input.currentUsage),
    allowed_limit: normalizeNumber(input.allowedLimit),
  };

  for (const [key, value] of Object.entries(input.metadata || {})) {
    if (value === undefined) continue;
    metadata[key] = value;
  }

  return metadata;
};

export const trackPricingEvent = async (input) => {
  const { analyticsApi } = await import("./api");

  await analyticsApi.track({
    eventType: "OTHER",
    photographerId: normalizeString(input.photographerId, 64),
    source: normalizeString(input.source, 64) || "pricing",
    sessionId: normalizeString(input.sessionId, 128),
    visitorId: normalizeString(input.visitorId, 128),
    path: normalizeString(input.path, 512),
    pageUrl: normalizeString(input.pageUrl, 2048),
    referrer: normalizeString(input.referrer, 1024),
    metadata: buildPricingAnalyticsMetadata(input),
  });
};

export const trackPricingEventSafe = (input) => {
  void trackPricingEvent(input).catch(() => {
    // Tracking should never block product flows.
  });
};
