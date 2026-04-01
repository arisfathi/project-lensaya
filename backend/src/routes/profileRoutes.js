import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { customDomainService } from "../services/customDomainService.js";
import { photographerController } from "../controllers/photographerController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  emptySchema,
  profilePatchSchema,
  usernamePreviewQuerySchema,
  heroPatchSchema,
  customDomainConnectSchema,
} from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth);

router.get("/profile", validate(emptySchema, "query"), photographerController.getProfile);
router.patch("/profile", validate(profilePatchSchema), photographerController.updateProfile);
router.get("/profile/username-preview", validate(usernamePreviewQuerySchema, "query"), photographerController.previewUsername);
router.patch("/photographer/hero", validate(heroPatchSchema), photographerController.updateHero);
router.get(
  "/profile/custom-domain",
  validate(emptySchema, "query"),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await customDomainService.getState(req.auth.sub));
  })
);
router.put(
  "/profile/custom-domain",
  validate(customDomainConnectSchema),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await customDomainService.save(req.auth.sub, req.body.domain));
  })
);
router.post(
  "/profile/custom-domain/verify",
  validate(emptySchema),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await customDomainService.verify(req.auth.sub));
  })
);
router.delete(
  "/profile/custom-domain",
  validate(emptySchema),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await customDomainService.disconnect(req.auth.sub));
  })
);

export default router;