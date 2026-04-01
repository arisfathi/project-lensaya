import { Router } from "express";
import { photographerController } from "../controllers/photographerController.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { validate } from "../middleware/validate.js";
import {
  basicListQuerySchema,
  emptySchema,
  packageCreateSchema,
  packageDuplicateSchema,
  packageIdParamSchema,
  packagePatchSchema,
} from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth, tenantContext);

router.get("/packages", validate(basicListQuerySchema, "query"), photographerController.listPackages);
router.post("/packages", validate(packageCreateSchema), photographerController.createPackage);
router.patch(
  "/packages/:packageId",
  validate(packageIdParamSchema, "params"),
  validate(packagePatchSchema),
  photographerController.updatePackage
);
router.post(
  "/packages/:packageId/duplicate",
  validate(packageIdParamSchema, "params"),
  validate(packageDuplicateSchema),
  photographerController.duplicatePackage
);
router.delete(
  "/packages/:packageId",
  validate(packageIdParamSchema, "params"),
  validate(emptySchema),
  photographerController.deletePackage
);

export default router;
