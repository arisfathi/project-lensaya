import { adminService } from "../services/adminService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

export const adminController = {
  dashboardOverview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.dashboardOverview(req.query))),
  photographers: asyncHandler(async (req, res) => sendSuccess(res, await adminService.listPhotographers(req.query))),
  photographerDetail: asyncHandler(async (req, res) => sendSuccess(res, await adminService.photographerDetail(req.params.id))),
  photographerStatus: asyncHandler(async (req, res) => sendSuccess(res, await adminService.setPhotographerStatus(req.params.id, req.body.status))),
  photographersExport: asyncHandler(async (req, res) => sendSuccess(res, await adminService.exportPhotographers(req.query))),

  subscriptionsOverview: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.subscriptionsOverview())),
  plansList: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.listPlans())),
  planPut: asyncHandler(async (req, res) => sendSuccess(res, await adminService.updatePlan(req.params.planId, req.body))),
  planLimitsGet: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.getPlanLimits())),
  planLimitsPatch: asyncHandler(async (req, res) => sendSuccess(res, await adminService.updatePlanLimits(req.body))),
  subscriptionChanges: asyncHandler(async (req, res) => sendSuccess(res, await adminService.subscriptionChanges(req.query))),
  publicPricingContentGet: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.getPublicPricingContent())),
  publicPricingContentPatch: asyncHandler(async (req, res) => sendSuccess(res, await adminService.updatePublicPricingContent(req.body))),

  revenueOverview: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.revenueOverview())),
  revenueMonthly: asyncHandler(async (req, res) => sendSuccess(res, await adminService.monthlyRevenue(req.query))),
  revenueByPlan: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.revenueByPlan())),
  revenueTransactions: asyncHandler(async (req, res) => sendSuccess(res, await adminService.revenueTransactions(req.query))),

  storageOverview: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.storageOverview())),
  storageR2Overview: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.storageR2Overview())),
  storageByPlan: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.storageByPlan())),
  storageUploads: asyncHandler(async (req, res) => sendSuccess(res, await adminService.storageUploads(req.query))),
  storageTopUsers: asyncHandler(async (req, res) => sendSuccess(res, await adminService.storageTopUsers(req.query))),

  moderationOverview: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.moderationOverview())),
  moderationReports: asyncHandler(async (req, res) => sendSuccess(res, await adminService.moderationReports(req.query))),
  moderationPatchReport: asyncHandler(async (req, res) => sendSuccess(res, await adminService.moderationPatchReport(req.params.reportId, req.body.action))),
  flaggedImages: asyncHandler(async (req, res) => sendSuccess(res, await adminService.flaggedImages(req.query))),
  patchFlaggedImage: asyncHandler(async (req, res) => sendSuccess(res, await adminService.patchFlaggedImage(req.params.imageReportId, req.body.action))),

  referralsOverview: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.referralsOverview())),
  topReferrers: asyncHandler(async (req, res) => sendSuccess(res, await adminService.topReferrers(req.query))),

  analyticsOverview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.analyticsOverview(req.query))),

  systemLogs: asyncHandler(async (req, res) => sendSuccess(res, await adminService.systemLogs(req.query))),
  workerHealth: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.workerHealth())),

  settingsGet: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.getSettings())),
  settingsEmailPatch: asyncHandler(async (req, res) => sendSuccess(res, await adminService.updateEmailNotifications(req.body))),
  settingsPlanPatch: asyncHandler(async (req, res) => sendSuccess(res, await adminService.updateSettingsPlanLimits(req.body))),

  contentList: asyncHandler(async (req, res) => sendSuccess(res, await adminService.contentList(req.query))),
  contentGet: asyncHandler(async (req, res) => sendSuccess(res, await adminService.contentGet(req.params.contentId))),
  contentCreate: asyncHandler(async (req, res) => sendSuccess(res, await adminService.contentCreate(req.body), 201)),
  contentPatch: asyncHandler(async (req, res) => sendSuccess(res, await adminService.contentPatch(req.params.contentId, req.body))),
  contentDelete: asyncHandler(async (req, res) => sendSuccess(res, await adminService.contentDelete(req.params.contentId))),
};

