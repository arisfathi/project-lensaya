import { Router } from "express";
import { billingController } from "../controllers/billingController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import {
  basicListQuerySchema,
  cancelSubscriptionSchema,
  changePlanSchema,
  checkoutSessionIdParamSchema,
  emptySchema,
  mockCheckoutCompleteSchema,
  portalSchema,
  webhookPayloadSchema,
} from "../utils/validationSchemas.js";

const router = Router();

// Middleware to prevent mock checkout routes in production
const blockMockCheckoutInProduction = (_req, _res, next) => {
  if (env.isProduction) {
    throw new ApiError(421, "Mock checkout is not available in production");
  }
  next();
};

router.get("/billing/plans", validate(emptySchema), billingController.plans);
router.post("/billing/webhook", validate(webhookPayloadSchema), billingController.webhook);
router.post("/webhooks/payments", validate(webhookPayloadSchema), billingController.webhook);

router.get("/billing/subscription", requireAuth, validate(emptySchema), billingController.subscription);
router.post("/billing/change-plan", requireAuth, validate(changePlanSchema), billingController.changePlan);
router.post(
  "/billing/subscription/cancel",
  requireAuth,
  validate(cancelSubscriptionSchema),
  billingController.cancelSubscription
);
router.post("/billing/subscription/resume", requireAuth, validate(emptySchema), billingController.resumeSubscription);
router.post("/billing/portal-session", requireAuth, validate(portalSchema), billingController.portalSession);
router.get("/billing/transactions", requireAuth, validate(basicListQuerySchema, "query"), billingController.transactions);
router.get(
  "/billing/mock/checkout/:sessionId",
  requireAuth,
  blockMockCheckoutInProduction,
  validate(checkoutSessionIdParamSchema, "params"),
  validate(emptySchema, "query"),
  billingController.mockCheckoutSession
);
router.post(
  "/billing/mock/checkout/:sessionId/complete",
  requireAuth,
  blockMockCheckoutInProduction,
  validate(checkoutSessionIdParamSchema, "params"),
  validate(mockCheckoutCompleteSchema),
  billingController.mockCheckoutComplete
);

export default router;
