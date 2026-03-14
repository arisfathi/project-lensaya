import { Router } from "express";
import { photographerController } from "../controllers/photographerController.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { validate } from "../middleware/validate.js";
import {
  bookingStatusSchema,
  bookingIdParamSchema,
  monthQuerySchema,
  basicListQuerySchema,
} from "../utils/validationSchemas.js";

const router = Router();

router.get(
  "/bookings",
  requireAuth,
  tenantContext,
  validate(basicListQuerySchema, "query"),
  photographerController.bookingList
);
router.get(
  "/bookings/calendar",
  requireAuth,
  tenantContext,
  validate(monthQuerySchema, "query"),
  photographerController.bookingCalendar
);
router.patch(
  "/bookings/:bookingId/status",
  requireAuth,
  tenantContext,
  validate(bookingIdParamSchema, "params"),
  validate(bookingStatusSchema),
  photographerController.updateBookingStatus
);

export default router;
