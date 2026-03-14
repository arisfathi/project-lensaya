import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { chipService } from "./chipService.js";

const normalizeProvider = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["chip", "mock"].includes(normalized) ? normalized : "mock";
};

const getFrontendBaseUrl = () => {
  const candidate = String(env.appUrl || env.publicAppUrl || env.frontendUrl || "").trim();
  if (!candidate) {
    throw new ApiError(500, "APP_URL is not configured for billing redirects");
  }

  try {
    return new URL(candidate).toString().replace(/\/+$/, "");
  } catch {
    throw new ApiError(500, "APP_URL is invalid for billing redirects");
  }
};

const buildMockCheckoutUrl = (sessionId) => {
  if (!sessionId) {
    throw new ApiError(500, "Mock checkout session id is required");
  }

  const checkoutPath =
    String(env.billing?.mockCheckoutPath || "/dashboard/billing/mock-checkout").trim() ||
    "/dashboard/billing/mock-checkout";
  const normalizedPath = checkoutPath.startsWith("/") ? checkoutPath : `/${checkoutPath}`;
  const url = new URL(`${getFrontendBaseUrl()}${normalizedPath}`);
  url.searchParams.set("session", sessionId);
  return url.toString();
};

const mapRuntimeProvider = (rawProvider, providerSubscriptionId = "") => {
  const normalizedProvider = String(rawProvider || "").trim().toUpperCase();
  const subscriptionId = String(providerSubscriptionId || "").trim().toLowerCase();

  if (normalizedProvider === "CHIP") return "chip";
  if (normalizedProvider === "OTHER" && subscriptionId.startsWith("mock_")) return "mock";
  if (normalizedProvider === "MANUAL") return "manual";
  if (normalizedProvider === "STRIPE") return "stripe";
  if (normalizedProvider === "OTHER") return "other";
  return "manual";
};

export const billingProviderService = {
  resolveConfiguredProvider() {
    return normalizeProvider(env.billing?.provider);
  },

  isMockMode() {
    return this.resolveConfiguredProvider() === "mock";
  },

  mapRuntimeProvider,

  async createCheckoutSession({
    sessionId,
    targetPlanId,
    amountCents,
    currency,
    successUrl,
    cancelUrl,
    metadata = {},
  }) {
    const provider = this.resolveConfiguredProvider();

    if (provider === "chip") {
      const result = await chipService.createCheckoutSession({
        targetPlanId,
        amountCents,
        currency,
        successUrl,
        cancelUrl,
        metadata,
      });

      return {
        provider,
        checkoutUrl: result.checkoutUrl,
        sessionId: result.sessionId,
      };
    }

    return {
      provider: "mock",
      checkoutUrl: buildMockCheckoutUrl(sessionId),
      sessionId,
    };
  },
};
