import { Router } from "express";
import { photographerController } from "../controllers/photographerController.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { validate } from "../middleware/validate.js";
import {
  bookingStatusSchema,
  bookingNotesPatchSchema,
  bookingIdParamSchema,
  monthQuerySchema,
  bookingListQuerySchema,
} from "../utils/validationSchemas.js";

const router = Router();

router.get(
  "/bookings",
  requireAuth,
  tenantContext,
  validate(bookingListQuerySchema, "query"),
  photographerController.bookingList
);
router.get(
  "/bookings/export",
  requireAuth,
  tenantContext,
  validate(bookingListQuerySchema, "query"),
  photographerController.exportBookingLeads
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
router.patch(
  "/bookings/:bookingId",
  requireAuth,
  tenantContext,
  validate(bookingIdParamSchema, "params"),
  validate(bookingNotesPatchSchema),
  photographerController.updateBookingNotes
);

export default router;
