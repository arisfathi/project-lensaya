import { Router } from "express";
import { referralController } from "../controllers/referralController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { basicListQuerySchema, emptySchema } from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth);

router.get("/referrals/me", validate(emptySchema), referralController.me);
router.get("/referrals/me/events", validate(basicListQuerySchema, "query"), referralController.myEvents);

export default router;
