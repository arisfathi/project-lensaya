import { Router } from "express";
import { adminController } from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { adminAuditLogger } from "../middleware/adminAudit.js";
import { validate } from "../middleware/validate.js";
import {
  idParamSchema,
  planIdParamSchema,
  emptyQuerySchema,
  basicListQuerySchema,
  paginationQuerySchema,
  adminStatusSchema,
  reportIdParamSchema,
  imageReportIdParamSchema,
  moderationReportActionSchema,
  moderationImageActionSchema,
  emailSettingsSchema,
  planLimitsSchema,
  subscriptionPlanPutSchema,
  slugParamSchema,
  legalPatchSchema,
} from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));
router.use(adminAuditLogger);

router.get("/admin/dashboard/overview", validate(emptyQuerySchema, "query"), adminController.dashboardOverview);

router.get("/admin/photographers", validate(basicListQuerySchema, "query"), adminController.photographers);
router.get("/admin/photographers/export", validate(basicListQuerySchema, "query"), adminController.photographersExport);
router.get("/admin/photographers/:id", validate(idParamSchema, "params"), adminController.photographerDetail);
router.patch("/admin/photographers/:id/status", validate(idParamSchema, "params"), validate(adminStatusSchema), adminController.photographerStatus);

router.get("/admin/subscriptions/overview", validate(emptyQuerySchema, "query"), adminController.subscriptionsOverview);
router.get("/admin/plans", validate(emptyQuerySchema, "query"), adminController.plansList);
router.put("/admin/plans/:planId", validate(planIdParamSchema, "params"), validate(subscriptionPlanPutSchema), adminController.planPut);
router.get("/admin/subscriptions/plan-limits", validate(emptyQuerySchema, "query"), adminController.planLimitsGet);
router.patch("/admin/subscriptions/plan-limits", validate(planLimitsSchema), adminController.planLimitsPatch);
router.get("/admin/subscriptions/changes", validate(paginationQuerySchema, "query"), adminController.subscriptionChanges);

router.get("/admin/revenue/overview", validate(emptyQuerySchema, "query"), adminController.revenueOverview);
router.get("/admin/revenue/monthly", validate(basicListQuerySchema, "query"), adminController.revenueMonthly);
router.get("/admin/revenue/by-plan", validate(basicListQuerySchema, "query"), adminController.revenueByPlan);
router.get("/admin/revenue/transactions", validate(basicListQuerySchema, "query"), adminController.revenueTransactions);

router.get("/admin/storage/overview", validate(emptyQuerySchema, "query"), adminController.storageOverview);
router.get("/admin/storage/r2-overview", validate(emptyQuerySchema, "query"), adminController.storageR2Overview);
router.get("/admin/storage/by-plan", validate(emptyQuerySchema, "query"), adminController.storageByPlan);
router.get("/admin/storage/uploads", validate(basicListQuerySchema, "query"), adminController.storageUploads);
router.get("/admin/storage/top-users", validate(paginationQuerySchema, "query"), adminController.storageTopUsers);

router.get("/admin/moderation/overview", validate(emptyQuerySchema, "query"), adminController.moderationOverview);
router.get("/admin/moderation/reports", validate(basicListQuerySchema, "query"), adminController.moderationReports);
router.patch(
  "/admin/moderation/reports/:reportId",
  validate(reportIdParamSchema, "params"),
  validate(moderationReportActionSchema),
  adminController.moderationPatchReport
);
router.get("/admin/moderation/flagged-images", validate(basicListQuerySchema, "query"), adminController.flaggedImages);
router.patch(
  "/admin/moderation/flagged-images/:imageReportId",
  validate(imageReportIdParamSchema, "params"),
  validate(moderationImageActionSchema),
  adminController.patchFlaggedImage
);

router.get("/admin/referrals/overview", validate(emptyQuerySchema, "query"), adminController.referralsOverview);
router.get("/admin/referrals/top-referrers", validate(paginationQuerySchema, "query"), adminController.topReferrers);

router.get("/admin/analytics/overview", validate(basicListQuerySchema, "query"), adminController.analyticsOverview);
router.get("/admin/system-logs", validate(basicListQuerySchema, "query"), adminController.systemLogs);
// Internal-only admin ops endpoint. Keep out of the public frontend API contract.
router.get("/admin/system/worker-health", validate(emptyQuerySchema, "query"), adminController.workerHealth);

router.get("/admin/settings", validate(emptyQuerySchema, "query"), adminController.settingsGet);
router.patch("/admin/settings/email-notifications", validate(emailSettingsSchema), adminController.settingsEmailPatch);
router.patch("/admin/settings/plan-limits", validate(planLimitsSchema), adminController.settingsPlanPatch);

router.get("/admin/legal-pages", validate(emptyQuerySchema, "query"), adminController.legalPages);
router.get("/admin/legal-pages/:slug", validate(slugParamSchema, "params"), adminController.legalPage);
router.patch("/admin/legal-pages/:slug", validate(slugParamSchema, "params"), validate(legalPatchSchema), adminController.legalPagePatch);

export default router;
