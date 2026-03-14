import { Router } from "express";
import { publicController } from "../controllers/publicController.js";
import { referralController } from "../controllers/referralController.js";
import { photographerController } from "../controllers/photographerController.js";
import { optionalAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  referralTrackSchema,
  publicBookingCreateSchema,
  analyticsEventSchema,
  clientErrorSchema,
  usernameParamSchema,
  basicListQuerySchema,
  monthQuerySchema,
  publicGalleryQuerySchema,
  emptySchema,
} from "../utils/validationSchemas.js";

const router = Router();

router.get("/public/site", validate(emptySchema, "query"), publicController.siteContext);
router.get("/public/photographers/featured", validate(basicListQuerySchema, "query"), publicController.featured);
router.get("/public/photographers", validate(basicListQuerySchema, "query"), publicController.directory);
router.get("/public/photographer/:username", validate(usernameParamSchema, "params"), validate(emptySchema, "query"), publicController.photographer);
router.get("/public/photographers/:username", validate(usernameParamSchema, "params"), validate(emptySchema, "query"), publicController.profile);
router.get("/public/photographers/:username/services", validate(usernameParamSchema, "params"), validate(emptySchema, "query"), publicController.services);
router.get("/public/photographers/:username/portfolio", validate(usernameParamSchema, "params"), validate(basicListQuerySchema, "query"), publicController.portfolio);
router.get("/public/photographers/:username/gallery", validate(usernameParamSchema, "params"), validate(publicGalleryQuerySchema, "query"), publicController.gallery);
router.get("/public/photographers/:username/packages", validate(usernameParamSchema, "params"), validate(basicListQuerySchema, "query"), publicController.packages);
router.get("/public/photographers/:username/availability", validate(usernameParamSchema, "params"), validate(monthQuerySchema, "query"), publicController.availability);
router.post("/public/bookings", validate(publicBookingCreateSchema), publicController.createBooking);
router.post("/public/client-errors", validate(clientErrorSchema), publicController.clientError);

// Public endpoint to attribute a visitor click to a referral code.
router.post("/public/referrals/track", validate(referralTrackSchema), referralController.track);
router.post("/analytics/events", optionalAuth, validate(analyticsEventSchema), photographerController.ingestAnalyticsEvent);

export default router;


