import { Router } from "express";
import { adminController } from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  adminStatusSchema,
  basicListQuerySchema,
  cmsContentCreateSchema,
  cmsContentIdParamSchema,
  cmsContentPatchSchema,
  cmsContentQuerySchema,
  emailSettingsSchema,
  emptyQuerySchema,
  emptySchema,
  imageReportIdParamSchema,
  idParamSchema,
  moderationImageActionSchema,
  moderationReportActionSchema,
  planIdParamSchema,
  planLimitsSchema,
  publicPricingContentPatchSchema,
  reportIdParamSchema,
  subscriptionPlanPutSchema,
} from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/admin/dashboard", validate(emptyQuerySchema, "query"), adminController.dashboardOverview);
router.get("/admin/dashboard/overview", validate(emptyQuerySchema, "query"), adminController.dashboardOverview);

router.get("/admin/photographers", validate(basicListQuerySchema, "query"), adminController.photographers);
router.get(
  "/admin/photographers/export",
  validate(basicListQuerySchema, "query"),
  adminController.photographersExport
);
router.get("/admin/photographers/:id", validate(idParamSchema, "params"), adminController.photographerDetail);
router.patch(
  "/admin/photographers/:id/status",
  validate(idParamSchema, "params"),
  validate(adminStatusSchema),
  adminController.photographerStatus
);

router.get("/admin/subscriptions", validate(emptyQuerySchema, "query"), adminController.subscriptionsOverview);
router.get("/admin/subscriptions/overview", validate(emptyQuerySchema, "query"), adminController.subscriptionsOverview);
router.get("/admin/subscriptions/plan-limits", validate(emptyQuerySchema, "query"), adminController.planLimitsGet);
router.patch("/admin/subscriptions/plan-limits", validate(planLimitsSchema), adminController.planLimitsPatch);
router.get("/admin/subscriptions/changes", validate(basicListQuerySchema, "query"), adminController.subscriptionChanges);
router.get("/admin/subscriptions/public-pricing", validate(emptyQuerySchema, "query"), adminController.publicPricingContentGet);
router.patch("/admin/subscriptions/public-pricing", validate(publicPricingContentPatchSchema), adminController.publicPricingContentPatch);

router.get("/admin/plans", validate(emptyQuerySchema, "query"), adminController.plansList);
router.put(
  "/admin/plans/:planId",
  validate(planIdParamSchema, "params"),
  validate(subscriptionPlanPutSchema),
  adminController.planPut
);

router.get("/admin/revenue", validate(emptyQuerySchema, "query"), adminController.revenueOverview);
router.get("/admin/revenue/overview", validate(emptyQuerySchema, "query"), adminController.revenueOverview);
router.get("/admin/revenue/monthly", validate(emptyQuerySchema, "query"), adminController.revenueMonthly);
router.get("/admin/revenue/by-plan", validate(emptyQuerySchema, "query"), adminController.revenueByPlan);
router.get("/admin/revenue/transactions", validate(basicListQuerySchema, "query"), adminController.revenueTransactions);

router.get("/admin/storage", validate(emptyQuerySchema, "query"), adminController.storageOverview);
router.get("/admin/storage/overview", validate(emptyQuerySchema, "query"), adminController.storageOverview);
router.get("/admin/storage/r2-overview", validate(emptyQuerySchema, "query"), adminController.storageR2Overview);
router.get("/admin/storage/by-plan", validate(emptyQuerySchema, "query"), adminController.storageByPlan);
router.get("/admin/storage/uploads", validate(basicListQuerySchema, "query"), adminController.storageUploads);
router.get("/admin/storage/top-users", validate(basicListQuerySchema, "query"), adminController.storageTopUsers);

router.get("/admin/moderation", validate(emptyQuerySchema, "query"), adminController.moderationOverview);
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

router.get("/admin/referrals", validate(emptyQuerySchema, "query"), adminController.referralsOverview);
router.get("/admin/referrals/overview", validate(emptyQuerySchema, "query"), adminController.referralsOverview);
router.get("/admin/referrals/top-referrers", validate(basicListQuerySchema, "query"), adminController.topReferrers);

router.get("/admin/analytics", validate(emptyQuerySchema, "query"), adminController.analyticsOverview);
router.get("/admin/analytics/overview", validate(emptyQuerySchema, "query"), adminController.analyticsOverview);

router.get("/admin/logs", validate(basicListQuerySchema, "query"), adminController.systemLogs);
router.get("/admin/system-logs", validate(basicListQuerySchema, "query"), adminController.systemLogs);
router.get("/admin/worker-health", validate(emptyQuerySchema, "query"), adminController.workerHealth);
router.get("/admin/system/worker-health", validate(emptyQuerySchema, "query"), adminController.workerHealth);

router.get("/admin/settings", validate(emptyQuerySchema, "query"), adminController.settingsGet);
router.patch("/admin/settings/email-notifications", validate(emailSettingsSchema), adminController.settingsEmailPatch);
router.patch("/admin/settings/plan-limits", validate(planLimitsSchema), adminController.settingsPlanPatch);

router.get("/admin/content", validate(cmsContentQuerySchema, "query"), adminController.contentList);
router.post("/admin/content", validate(cmsContentCreateSchema), adminController.contentCreate);
router.get("/admin/content/:contentId", validate(cmsContentIdParamSchema, "params"), adminController.contentGet);
router.patch(
  "/admin/content/:contentId",
  validate(cmsContentIdParamSchema, "params"),
  validate(cmsContentPatchSchema),
  adminController.contentPatch
);
router.delete("/admin/content/:contentId", validate(cmsContentIdParamSchema, "params"), adminController.contentDelete);

export default router;


