import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/apiError.js";
import { hmacSha256 } from "../utils/crypto.js";
import crypto from "node:crypto";

const CHIP_RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const CHIP_RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

const isLikelyConfiguredApiKey = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return !/replace[-_ ]with[-_ ]chip[-_ ]key/i.test(normalized);
};

const wait = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const isAbortError = (error) =>
  error?.name === "AbortError" ||
  error?.code === "ABORT_ERR" ||
  String(error?.message || "").toLowerCase().includes("aborted");

const toNetworkCode = (error) => String(error?.cause?.code || error?.code || "").toUpperCase();

const isRetryableChipError = (error) => {
  if (!(error instanceof ApiError)) return false;
  if (CHIP_RETRYABLE_STATUS_CODES.has(error.statusCode)) return true;
  const networkCode = String(error?.details?.networkCode || "").toUpperCase();
  return error.statusCode === 502 && CHIP_RETRYABLE_NETWORK_CODES.has(networkCode);
};

const jsonRequestOnce = async (url, options) => {
  const timeoutMs = Math.max(100, Number(env.chip.requestTimeoutMs || 10000));
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let response = null;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
  } catch (error) {
    const networkCode = toNetworkCode(error);
    if (isAbortError(error)) {
      throw new ApiError(504, "Payment provider request timed out", {
        timeoutMs,
      });
    }
    throw new ApiError(502, "Payment provider request failed", {
      networkCode: networkCode || null,
      reason: String(error?.message || "network error"),
    });
  } finally {
    clearTimeout(timeoutHandle);
  }

  const text = await response.text();
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const looksLikeHtml = text.trim().startsWith("<");
      const responseTypeHint = looksLikeHtml ? "HTML" : contentType || "unknown content-type";
      throw new ApiError(
        502,
        `Payment provider returned an invalid ${responseTypeHint} response`,
        {
          upstreamStatus: response.status,
          preview: text.slice(0, 280),
        }
      );
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.message || "CHIP API request failed", {
      ...(data && typeof data === "object" ? data : {}),
      retryable: CHIP_RETRYABLE_STATUS_CODES.has(response.status),
      upstreamStatus: response.status,
    });
  }

  return data;
};

const jsonRequest = async (url, options) => {
  const maxRetries = Math.max(0, Number(env.chip.maxRetries || 0));
  const baseDelayMs = Math.max(1, Number(env.chip.retryBaseDelayMs || 300));
  const maxDelayMs = Math.max(baseDelayMs, Number(env.chip.retryMaxDelayMs || 2000));

  let retryAttempt = 0;
  while (true) {
    try {
      return await jsonRequestOnce(url, options);
    } catch (error) {
      const shouldRetry = retryAttempt < maxRetries && isRetryableChipError(error);
      if (!shouldRetry) {
        throw error;
      }

      const retryDelayMs = Math.min(baseDelayMs * 2 ** retryAttempt, maxDelayMs);
      logger.warn(
        {
          retryAttempt: retryAttempt + 1,
          maxRetries,
          retryDelayMs,
          statusCode: error?.statusCode || null,
          networkCode: error?.details?.networkCode || null,
        },
        "Retrying CHIP API request after transient failure"
      );
      await wait(retryDelayMs);
      retryAttempt += 1;
    }
  }
};

export const chipService = {
  async createCheckoutSession({
    targetPlanId,
    amountCents = null,
    currency = "USD",
    successUrl,
    cancelUrl,
    metadata = {},
  }) {
    if (!isLikelyConfiguredApiKey(env.chip.apiKey)) {
      throw new ApiError(503, "Billing checkout is not configured. Set a valid CHIP_API_KEY.");
    }

    const payload = {
      brand_id: targetPlanId,
      success_redirect: successUrl || env.chip.successUrl,
      failure_redirect: cancelUrl || env.chip.cancelUrl,
      metadata,
    };
    if (Number.isFinite(Number(amountCents)) && Number(amountCents) > 0) {
      payload.amount = Math.round(Number(amountCents));
      payload.currency = String(currency || "USD").toUpperCase();
    }

    const data = await jsonRequest(`${env.chip.apiBaseUrl.replace(/\/$/, "")}/purchase/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.chip.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    return {
      checkoutUrl: data?.checkout_url || data?.url || null,
      sessionId: data?.id || data?.purchase_id || null,
      raw: data,
    };
  },

  verifyWebhook(rawBody, signature) {
    if (!env.chip.webhookSecret) {
      return false;
    }

    const incoming =
      (Array.isArray(signature) ? signature[0] : signature || "")
        .toString()
        .trim()
        .replace(/^sha256=/i, "")
        .toLowerCase() || "";

    if (!incoming) return false;

    const expected = hmacSha256(rawBody || "", env.chip.webhookSecret).toLowerCase();

    const incomingBuffer = Buffer.from(incoming, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (incomingBuffer.length !== expectedBuffer.length) return false;

    return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
  },
};
