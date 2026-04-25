import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { stripeService } from "./stripeService.js";

const normalizeProvider = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["mock", "stripe"].includes(normalized) ? normalized : "mock";
};

const normalizeConfiguredProvider = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["mock", "stripe", "auto"].includes(normalized) ? normalized : "";
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

  if (normalizedProvider === "OTHER" && subscriptionId.startsWith("mock_")) return "mock";
  if (normalizedProvider === "MANUAL") return "manual";
  if (normalizedProvider === "STRIPE") return "stripe";
  if (normalizedProvider === "OTHER") return "other";
  return "manual";
};

export const billingProviderService = {
  resolveConfiguredProvider() {
    const explicitConfiguredProvider = normalizeConfiguredProvider(process.env.BILLING_PROVIDER);
    if (explicitConfiguredProvider && explicitConfiguredProvider !== "auto") {
      return normalizeProvider(explicitConfiguredProvider);
    }

    const envConfiguredProvider = normalizeConfiguredProvider(env.billing?.provider);
    if (envConfiguredProvider && envConfiguredProvider !== "auto") {
      return normalizeProvider(envConfiguredProvider);
    }

    return "stripe";
  },

  resolveCheckoutProvider({ country = "", requestedProvider = "" } = {}) {
    const configuredProvider = normalizeConfiguredProvider(process.env.BILLING_PROVIDER);
    if (["stripe", "mock"].includes(configuredProvider)) {
      return configuredProvider;
    }

    const normalizedRequestedProvider = normalizeConfiguredProvider(requestedProvider);
    if (["stripe"].includes(normalizedRequestedProvider)) {
      return normalizedRequestedProvider;
    }

    return "stripe";
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
    provider,
    metadata = {},
  }) {
    const resolvedProvider = normalizeProvider(provider || this.resolveConfiguredProvider());

    if (resolvedProvider === "stripe") {
      const result = await stripeService.createCheckoutSession({
        targetPlanId,
        amountCents,
        currency,
        successUrl,
        cancelUrl,
        metadata,
      });

      return {
        provider: resolvedProvider,
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
