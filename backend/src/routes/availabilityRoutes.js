import { Router } from "express";
import { photographerController } from "../controllers/photographerController.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { validate } from "../middleware/validate.js";
import { availabilityPatchSchema, monthQuerySchema } from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth, tenantContext);

router.get("/availability", validate(monthQuerySchema, "query"), photographerController.getAvailability);
router.patch("/availability", validate(availabilityPatchSchema), photographerController.patchAvailability);

export default router;
