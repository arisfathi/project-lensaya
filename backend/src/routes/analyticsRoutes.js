import { Router } from "express";
import { photographerController } from "../controllers/photographerController.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { validate } from "../middleware/validate.js";
import { analyticsGoalUpdateSchema, analyticsOverviewQuerySchema, basicListQuerySchema, emptySchema } from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth, tenantContext);

router.get("/analytics/overview", validate(analyticsOverviewQuerySchema, "query"), photographerController.analyticsOverview);
router.patch("/analytics/goal", validate(analyticsGoalUpdateSchema), photographerController.updateAnalyticsGoal);
router.get("/analytics/activity", validate(basicListQuerySchema, "query"), photographerController.analyticsActivity);
router.get("/analytics/categories", validate(emptySchema), photographerController.analyticsCategories);

export default router;
