import { Router } from "express";
import { photographerController } from "../controllers/photographerController.js";
import { uploadController } from "../controllers/uploadController.js";
import { userController } from "../controllers/userController.js";
import { billingController } from "../controllers/billingController.js";
import { referralController } from "../controllers/referralController.js";
import { notificationController } from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { validate } from "../middleware/validate.js";
import {
  emptySchema,
  changePasswordSchema,
  deleteAccountSchema,
  basicListQuerySchema,
  monthQuerySchema,
  packageIdParamSchema,
  itemIdParamSchema,
  assetIdParamSchema,
  notificationReadSchema,
  paginationQuerySchema,
  profilePatchSchema,
  usernamePreviewQuerySchema,
  heroPatchSchema,
  customDomainConnectSchema,
  packageCreateSchema,
  packagePatchSchema,
  packageDuplicateSchema,
  portfolioCreateSchema,
  portfolioPatchSchema,
  featureSchema,
  availabilityPatchSchema,
  uploadPresignSchema,
  uploadCompleteSchema,
  checkoutSessionIdParamSchema,
  changePlanSchema,
  cancelSubscriptionSchema,
  portalSchema,
  mockCheckoutCompleteSchema,
} from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth);

router.get("/dashboard/overview", validate(emptySchema), photographerController.dashboardOverview);
router.get("/dashboard/website-summary", validate(emptySchema), photographerController.websiteSummary);

router.get("/profile", validate(emptySchema), photographerController.getProfile);
router.get("/profile/username-preview", validate(usernamePreviewQuerySchema, "query"), photographerController.previewUsername);
router.patch("/profile", validate(profilePatchSchema), photographerController.updateProfile);
router.patch("/photographer/hero", validate(heroPatchSchema), photographerController.updateHero);
router.get("/profile/custom-domain", validate(emptySchema), photographerController.getCustomDomain);
router.put("/profile/custom-domain", validate(customDomainConnectSchema), photographerController.saveCustomDomain);
router.post("/profile/custom-domain/verify", validate(emptySchema), photographerController.verifyCustomDomain);
router.delete("/profile/custom-domain", validate(emptySchema), photographerController.disconnectCustomDomain);
router.post("/users/change-password", validate(changePasswordSchema), userController.changePassword);
router.delete("/users/account", validate(deleteAccountSchema), userController.deleteAccount);
router.post("/users/avatar", userController.uploadAvatar);
router.delete("/users/avatar", validate(emptySchema), uploadController.clearAvatar);

router.use(["/packages", "/portfolio", "/availability", "/uploads", "/analytics"], tenantContext);

router.get("/packages", validate(basicListQuerySchema, "query"), photographerController.listPackages);
router.post("/packages", validate(packageCreateSchema), photographerController.createPackage);
router.patch("/packages/:packageId", validate(packageIdParamSchema, "params"), validate(packagePatchSchema), photographerController.updatePackage);
router.post("/packages/:packageId/duplicate", validate(packageIdParamSchema, "params"), validate(packageDuplicateSchema), photographerController.duplicatePackage);
router.delete("/packages/:packageId", validate(packageIdParamSchema, "params"), photographerController.deletePackage);

router.get("/portfolio/items", validate(basicListQuerySchema, "query"), photographerController.listPortfolioItems);
router.post("/portfolio/items", validate(portfolioCreateSchema), photographerController.createPortfolioItem);
router.patch("/portfolio/items/:itemId", validate(itemIdParamSchema, "params"), validate(portfolioPatchSchema), photographerController.updatePortfolioItem);
router.patch("/portfolio/items/:itemId/feature", validate(itemIdParamSchema, "params"), validate(featureSchema), photographerController.featurePortfolioItem);
router.delete("/portfolio/items/:itemId", validate(itemIdParamSchema, "params"), photographerController.deletePortfolioItem);

router.get("/availability", validate(monthQuerySchema, "query"), photographerController.getAvailability);
router.patch("/availability", validate(availabilityPatchSchema), photographerController.patchAvailability);

router.get("/analytics/overview", validate(basicListQuerySchema, "query"), photographerController.analyticsOverview);
router.get("/analytics/categories", validate(emptySchema), photographerController.analyticsCategories);
router.get("/analytics/activity", validate(paginationQuerySchema, "query"), photographerController.analyticsActivity);

router.post("/uploads/presign", validate(uploadPresignSchema), uploadController.presign);
router.post("/uploads/complete", validate(uploadCompleteSchema), uploadController.complete);
router.delete("/uploads/:assetId", validate(assetIdParamSchema, "params"), uploadController.remove);

router.get("/billing/subscription", validate(emptySchema), billingController.subscription);
router.post("/billing/change-plan", validate(changePlanSchema), billingController.changePlan);
router.post("/billing/subscription/cancel", validate(cancelSubscriptionSchema), billingController.cancelSubscription);
router.post("/billing/subscription/resume", validate(emptySchema), billingController.resumeSubscription);
router.get("/billing/mock/checkout/:sessionId", validate(checkoutSessionIdParamSchema, "params"), billingController.mockCheckoutSession);
router.post("/billing/mock/checkout/:sessionId/complete", validate(checkoutSessionIdParamSchema, "params"), validate(mockCheckoutCompleteSchema), billingController.mockCheckoutComplete);
router.post("/billing/portal-session", validate(portalSchema), billingController.portalSession);
router.get("/billing/transactions", validate(basicListQuerySchema, "query"), billingController.transactions);

// Authenticated referral data for the current photographer.
router.get("/referrals/me", validate(emptySchema), referralController.me);
router.get("/referrals/me/events", validate(paginationQuerySchema, "query"), referralController.myEvents);

router.get("/notifications", validate(basicListQuerySchema, "query"), notificationController.list);
router.post("/notifications/read", validate(notificationReadSchema), notificationController.readPost);

export default router;



