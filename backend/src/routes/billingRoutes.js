import { Router } from "express";
import { billingController } from "../controllers/billingController.js";
import { validate } from "../middleware/validate.js";
import { emptySchema, webhookPayloadSchema } from "../utils/validationSchemas.js";

const router = Router();

router.get("/billing/plans", validate(emptySchema), billingController.plans);

router.post("/billing/webhook", validate(webhookPayloadSchema), billingController.webhook);
router.post("/webhooks/payments", validate(webhookPayloadSchema), billingController.webhook);

export default router;
