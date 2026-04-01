import crypto from "node:crypto";
import { ApiError } from "../utils/apiError.js";
import { hmacSha256 } from "../utils/crypto.js";

const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";
const STRIPE_EVENT_PREFIXES = ["checkout.", "invoice.", "customer.subscription."];

const cleanString = (value = "") => String(value || "").trim();

const isLikelyConfiguredApiKey = (value = "") => {
  const normalized = cleanString(value);
  if (!normalized) return false;
  return !/replace[-_ ]with[-_ ]stripe[-_ ]key/i.test(normalized);
};

const getStripeConfig = () => ({
  apiKey: cleanString(process.env.STRIPE_API_KEY),
  apiBaseUrl: cleanString(process.env.STRIPE_API_BASE_URL) || STRIPE_API_BASE_URL,
  webhookSecret: cleanString(process.env.STRIPE_WEBHOOK_SECRET),
  successUrl: cleanString(process.env.STRIPE_SUCCESS_URL),
  cancelUrl: cleanString(process.env.STRIPE_CANCEL_URL),
  requestTimeoutMs: Math.max(100, Number.parseInt(String(process.env.STRIPE_REQUEST_TIMEOUT_MS || "10000"), 10) || 10000),
});

const wait = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const isAbortError = (error) =>
  error?.name === "AbortError" ||
  error?.code === "ABORT_ERR" ||
  String(error?.message || "").toLowerCase().includes("aborted");

const isStripeEventType = (value = "") => STRIPE_EVENT_PREFIXES.some((prefix) => String(value || "").startsWith(prefix));

const normalizeCurrency = (value = "USD") => String(value || "USD").trim().toLowerCase() || "usd";

const normalizeInterval = (billingCycle = "monthly") => {
  const token = String(billingCycle || "").trim().toLowerCase();
  return token === "yearly" ? "year" : "month";
};

const flattenMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};

  return Object.entries(metadata).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    const normalizedKey = String(key || "").trim();
    const normalizedValue = typeof value === "string" ? value : JSON.stringify(value);
    if (!normalizedKey || !normalizedValue) return acc;
    acc[normalizedKey] = normalizedValue;
    return acc;
  }, {});
};

const parseSignatureHeader = (signatureHeader = "") => {
  const header = String(Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader || "").trim();
  if (!header) return { timestamp: "", signatures: [] };

  const parts = header.split(",").map((part) => part.trim()).filter(Boolean);
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) || "";
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3).trim().toLowerCase())
    .filter(Boolean);

  return { timestamp, signatures };
};

const timingSafeHexEqual = (left = "", right = "") => {
  const leftBuffer = Buffer.from(String(left || "").toLowerCase(), "utf8");
  const rightBuffer = Buffer.from(String(right || "").toLowerCase(), "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const requestStripe = async (path, { method = "GET", body = null } = {}) => {
  const config = getStripeConfig();
  const timeoutMs = config.requestTimeoutMs;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let response = null;
  try {
    response = await fetch(`${config.apiBaseUrl.replace(/\/$/, "")}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new ApiError(504, "Payment provider request timed out", { timeoutMs });
    }

    throw new ApiError(502, "Payment provider request failed", {
      reason: String(error?.message || "network error"),
    });
  } finally {
    clearTimeout(timeoutHandle);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(502, "Payment provider returned an invalid response", {
        upstreamStatus: response.status,
        preview: text.slice(0, 280),
      });
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.message || data?.message || "Stripe API request failed", {
      ...(data && typeof data === "object" ? data : {}),
      upstreamStatus: response.status,
    });
  }

  return data;
};

const fetchStripeSubscription = async (subscriptionId) => {
  const normalizedSubscriptionId = cleanString(subscriptionId);
  if (!normalizedSubscriptionId) return null;

  try {
    return await requestStripe(`/subscriptions/${encodeURIComponent(normalizedSubscriptionId)}`);
  } catch {
    return null;
  }
};

const resolveStripeTransactionId = (object = {}) =>
  cleanString(object.payment_intent || object.latest_charge || object.id || "") || null;

const resolveStripeSubscriptionId = (object = {}) => cleanString(object.subscription || object.id || "") || null;

const resolveStripeAmountCents = (object = {}) => {
  const candidates = [object.amount_paid, object.amount_total, object.amount_due, object.amount, object.total];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return Math.round(numeric);
    }
  }
  return 0;
};

const resolveStripeStatus = (eventType = "", object = {}) => {
  const normalizedType = String(eventType || "").trim().toLowerCase();
  if (normalizedType === "invoice.paid") return "paid";
  if (normalizedType === "invoice.payment_failed") return "failed";
  if (normalizedType === "checkout.session.completed") return "pending";
  if (normalizedType === "checkout.session.expired") return "canceled";
  if (normalizedType === "customer.subscription.deleted") return "canceled";
  if (normalizedType === "customer.subscription.updated") {
    return String(object.status || "").toLowerCase() === "canceled" ? "canceled" : "pending";
  }
  return String(object.payment_status || object.status || "pending").toLowerCase();
};

const resolveStripeMetadata = async (eventType, object) => {
  const metadata = flattenMetadata(object.metadata || {});
  const subscriptionId = resolveStripeSubscriptionId(object);
  if (!isStripeEventType(eventType) || !subscriptionId) {
    return metadata;
  }

  if (Object.keys(metadata).length > 0 && metadata.userId && metadata.planId) {
    return metadata;
  }

  const subscription = await fetchStripeSubscription(subscriptionId);
  const subscriptionMetadata = flattenMetadata(subscription?.metadata || {});
  return {
    ...subscriptionMetadata,
    ...metadata,
  };
};

export const stripeService = {
  async createCheckoutSession({
    targetPlanId,
    amountCents,
    currency,
    successUrl,
    cancelUrl,
    metadata = {},
  }) {
    const config = getStripeConfig();
    if (!isLikelyConfiguredApiKey(config.apiKey)) {
      throw new ApiError(503, "Billing checkout is not configured. Set a valid STRIPE_API_KEY.");
    }

    const resolvedSuccessUrl = cleanString(successUrl || config.successUrl);
    const resolvedCancelUrl = cleanString(cancelUrl || config.cancelUrl);
    if (!resolvedSuccessUrl || !resolvedCancelUrl) {
      throw new ApiError(500, "Stripe checkout redirects are not configured");
    }

    const numericAmount = Math.max(Math.round(Number(amountCents || 0)), 0);
    if (numericAmount <= 0) {
      throw new ApiError(400, "Stripe checkout requires a positive amount");
    }

    const normalizedMetadata = flattenMetadata({
      ...metadata,
      provider: "STRIPE",
    });
    const planLabel = cleanString(normalizedMetadata.planName || normalizedMetadata.planTier || targetPlanId || "Lensaya plan");
    const billingInterval = normalizeInterval(normalizedMetadata.billingCycle || normalizedMetadata.planInterval);
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", resolvedSuccessUrl);
    params.set("cancel_url", resolvedCancelUrl);
    params.set("client_reference_id", cleanString(normalizedMetadata.userId || ""));
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", normalizeCurrency(currency));
    params.set("line_items[0][price_data][unit_amount]", String(numericAmount));
    params.set("line_items[0][price_data][product_data][name]", planLabel);
    params.set("line_items[0][price_data][recurring][interval]", billingInterval);

    for (const [key, value] of Object.entries(normalizedMetadata)) {
      params.set(`metadata[${key}]`, value);
      params.set(`subscription_data[metadata][${key}]`, value);
    }

    const data = await requestStripe("/checkout/sessions", {
      method: "POST",
      body: params,
    });

    return {
      checkoutUrl: data?.url || data?.redirect_url || null,
      sessionId: data?.id || null,
      raw: data,
    };
  },

  verifyWebhook(rawBody, signatureHeader) {
    const config = getStripeConfig();
    if (!config.webhookSecret) return false;
    if (typeof rawBody !== "string" || rawBody.length === 0) return false;

    const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
    if (!timestamp || signatures.length === 0) return false;

    const expected = hmacSha256(`${timestamp}.${rawBody}`, config.webhookSecret).toLowerCase();
    return signatures.some((signature) => timingSafeHexEqual(signature, expected));
  },

  isStripeWebhookEvent(payload) {
    return Boolean(payload && typeof payload === "object" && isStripeEventType(payload.type) && payload.data?.object);
  },

  async normalizeWebhookPayload(payload) {
    if (!this.isStripeWebhookEvent(payload)) {
      throw new ApiError(400, "Invalid Stripe webhook payload");
    }

    const eventType = String(payload.type || "").trim();
    const object = payload.data?.object && typeof payload.data.object === "object" ? payload.data.object : {};
    const metadata = await resolveStripeMetadata(eventType, object);
    const transactionId = resolveStripeTransactionId(object) || cleanString(payload.id || "") || null;
    const subscriptionId = resolveStripeSubscriptionId(object) || null;

    return {
      id: payload.id || object.id || transactionId || subscriptionId || null,
      transaction_id: transactionId,
      purchase_id: subscriptionId,
      status: resolveStripeStatus(eventType, object),
      amount: resolveStripeAmountCents(object),
      currency: String(object.currency || metadata.planCurrency || "USD").toUpperCase(),
      metadata: {
        ...metadata,
        provider: "STRIPE",
        stripeEventType: eventType,
      },
      provider: "STRIPE",
      stripeEventType: eventType,
      stripeObjectType: String(object.object || "event").trim() || "event",
    };
  },
};


