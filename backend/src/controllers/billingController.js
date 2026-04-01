import { billingService } from "../services/billingService.js";
import { chipService } from "../services/chipService.js";
import { stripeService } from "../services/stripeService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { ApiError } from "../utils/apiError.js";
import { env } from "../config/env.js";

const looksLikeStripeWebhook = (payload) => stripeService.isStripeWebhookEvent(payload);

export const billingController = {
  plans: asyncHandler(async (_req, res) => {
    const data = await billingService.listPlans();
    return sendSuccess(res, data);
  }),

  subscription: asyncHandler(async (req, res) => {
    const data = await billingService.currentSubscription(req.auth.sub);
    return sendSuccess(res, data);
  }),

  changePlan: asyncHandler(async (req, res) => {
    const data = await billingService.changePlan(req.auth.sub, req.body);
    return sendSuccess(res, data, 200);
  }),

  cancelSubscription: asyncHandler(async (req, res) => {
    const data = await billingService.cancelSubscription(req.auth.sub, req.body);
    return sendSuccess(res, data, 200);
  }),

  resumeSubscription: asyncHandler(async (req, res) => {
    const data = await billingService.resumeSubscription(req.auth.sub);
    return sendSuccess(res, data, 200);
  }),

  mockCheckoutSession: asyncHandler(async (req, res) => {
    const data = await billingService.getMockCheckoutSession(req.auth.sub, req.params.sessionId);
    return sendSuccess(res, data);
  }),

  mockCheckoutComplete: asyncHandler(async (req, res) => {
    const data = await billingService.completeMockCheckout(req.auth.sub, req.params.sessionId, req.body);
    return sendSuccess(res, data, 200);
  }),

  portalSession: asyncHandler(async (req, res) => {
    const data = await billingService.createPortalSession(req.auth.sub, req.body.returnUrl);
    return sendSuccess(res, data, 201);
  }),

  transactions: asyncHandler(async (req, res) => {
    const data = await billingService.listTransactions(req.auth.sub, req.query);
    return sendSuccess(res, data);
  }),

  webhook: asyncHandler(async (req, res) => {
    const stripeSignature = req.headers["stripe-signature"] || "";
    const chipSignature = req.headers["x-chip-signature"] || req.headers["x-signature"] || "";
    const isStripeWebhook = Boolean(stripeSignature) || looksLikeStripeWebhook(req.body);
    const rawBody = typeof req.rawBody === "string" ? req.rawBody : "";
    const chipRawBody = rawBody || JSON.stringify(req.body);

    if (isStripeWebhook) {
      if (!String(process.env.STRIPE_WEBHOOK_SECRET || "").trim()) {
        throw new ApiError(503, "Webhook secret is not configured");
      }

      if (!rawBody) {
        throw new ApiError(400, "Stripe webhook raw body is required");
      }

      if (stripeService.verifyWebhook(rawBody, stripeSignature) === false) {
        throw new ApiError(401, "Invalid webhook signature");
      }

      const normalizedPayload = await stripeService.normalizeWebhookPayload(req.body);
      const data = await billingService.handlePaymentWebhook(normalizedPayload);
      return sendSuccess(res, data);
    }

    if (!env.chip.webhookSecret) {
      throw new ApiError(503, "Webhook secret is not configured");
    }

    if (chipService.verifyWebhook(chipRawBody, chipSignature) === false) {
      throw new ApiError(401, "Invalid webhook signature");
    }

    const data = await billingService.handlePaymentWebhook(req.body);
    return sendSuccess(res, data);
  }),
};

