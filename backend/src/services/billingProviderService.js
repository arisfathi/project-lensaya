import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { chipService } from "./chipService.js";
import { stripeService } from "./stripeService.js";

const normalizeProvider = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["chip", "mock", "stripe"].includes(normalized) ? normalized : "mock";
};

const normalizeCountryCode = (value = "") => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "";
  if (normalized === "MALAYSIA") return "MY";
  return normalized;
};

const normalizeConfiguredProvider = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["chip", "mock", "stripe", "auto"].includes(normalized) ? normalized : "";
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
    const explicitConfiguredProvider = normalizeConfiguredProvider(process.env.BILLING_PROVIDER);
    if (explicitConfiguredProvider && explicitConfiguredProvider !== "auto") {
      return normalizeProvider(explicitConfiguredProvider);
    }

    const envConfiguredProvider = normalizeConfiguredProvider(env.billing?.provider);
    if (envConfiguredProvider && envConfiguredProvider !== "auto") {
      return normalizeProvider(envConfiguredProvider);
    }

    return "mock";
  },

  resolveCheckoutProvider({ country = "", requestedProvider = "" } = {}) {
    const normalizedRequestedProvider = normalizeConfiguredProvider(requestedProvider);
    if (["chip", "stripe"].includes(normalizedRequestedProvider)) {
      return normalizedRequestedProvider;
    }

    const configuredProvider = normalizeConfiguredProvider(process.env.BILLING_PROVIDER);
    if (["chip", "stripe", "mock"].includes(configuredProvider)) {
      return configuredProvider;
    }

    const countryCode = normalizeCountryCode(country);
    return countryCode === "MY" ? "chip" : "stripe";
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

    if (resolvedProvider === "chip") {
      const result = await chipService.createCheckoutSession({
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
