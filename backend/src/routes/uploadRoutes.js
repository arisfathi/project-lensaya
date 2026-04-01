import { Router } from "express";
import { uploadController } from "../controllers/uploadController.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { validate } from "../middleware/validate.js";
import { emptySchema, uploadPresignSchema, uploadCompleteSchema, assetIdParamSchema } from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth, tenantContext);

router.post("/uploads/presign", validate(uploadPresignSchema), uploadController.presign);
router.post("/uploads/complete", validate(uploadCompleteSchema), uploadController.complete);
router.delete("/uploads/:assetId", validate(assetIdParamSchema, "params"), validate(emptySchema), uploadController.remove);

export default router;
