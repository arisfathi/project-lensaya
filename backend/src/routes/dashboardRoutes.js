import { Router } from "express";
import { photographerController } from "../controllers/photographerController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { emptySchema } from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth);

router.get("/dashboard/overview", validate(emptySchema), photographerController.dashboardOverview);
router.get("/dashboard/website-summary", validate(emptySchema), photographerController.websiteSummary);

export default router;