import { Router } from "express";
import { photographerController } from "../controllers/photographerController.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { validate } from "../middleware/validate.js";
import {
  serviceCreateSchema,
  servicePatchSchema,
  serviceIdParamSchema,
  emptySchema,
} from "../utils/validationSchemas.js";

const router = Router();

// Scope auth + tenant resolution to service endpoints only.
router.use("/services", requireAuth, tenantContext);

router.get("/services", validate(emptySchema), photographerController.listServices);
router.post("/services", validate(serviceCreateSchema), photographerController.createService);
router.patch(
  "/services/:serviceId",
  validate(serviceIdParamSchema, "params"),
  validate(servicePatchSchema),
  photographerController.updateService
);
router.delete("/services/:serviceId", validate(serviceIdParamSchema, "params"), photographerController.deleteService);

export default router;
