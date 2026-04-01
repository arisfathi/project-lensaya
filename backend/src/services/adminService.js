import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { redisCache } from "../utils/redisCache.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { ApiError } from "../utils/apiError.js";
import { planLimitService } from "./planLimitService.js";
import { queueMonitoringService } from "./queueMonitoringService.js";
import {
  ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY,
  ADMIN_STORAGE_R2_CACHE_KEY,
  ADMIN_STORAGE_R2_CACHE_TTL_SECONDS,
  ADMIN_STORAGE_R2_SNAPSHOT_KEY,
  BILLING_ACTIVE_STATUSES,
  EMAIL_NOTIFICATION_DEFAULTS,
  MODERATION_IMAGE_ACTIONS,
  MODERATION_REPORT_ACTIONS,
  PLAN_KEY_BY_NAME,
  PLAN_NAME_BY_KEY,
  PLAN_TIERS,
  R2_UPLOADS_PREFIX,
} from "./admin/adminService.constants.js";

import {
  addDays,
  addMonths,
  buildDailySeries,
  buildMonthlySeries,
  buildPhotographerUserWhereSql,
  centsToAmount,
  chunkArray,
  csvEscape,
  decimalToNumber,
  defaultPackageFeatureLimit,
  formatPercentChange,
  groupReadyAssetsByPhotographer,
  mapCmsContentItem,
  mapUserPlan,
  moderationAbuseLabel,
  moderationImageReason,
  moderationSeverityFromCount,
  normalizeCmsSection,
  normalizeCmsStatus,
  normalizeEmailNotificationSettings,
  normalizeModerationToken,
  nowIso,
  parseLogRangeStart,
  parseWindowSize,
  resolveModerationImageStatuses,
  resolveSearchTerm,
  slugifyCms,
  sourceLabel,
  startOfDay,
  startOfMonth,
  toNullableExcerpt,
  toPlanLimitRecord,
  toPlanDto,
  toPlanTier,
  toSafeDate,
} from "./admin/adminService.utils.js";
import { adminContentService } from "./admin/adminContentService.js";
import { adminPhotographersService } from "./admin/adminPhotographersService.js";
import { adminRevenueService } from "./admin/adminRevenueService.js";
import { adminStorageService } from "./admin/adminStorageService.js";
import { adminSubscriptionsService } from "./admin/adminSubscriptionsService.js";
import { adminModerationService } from "./admin/adminModerationService.js";
import { adminDashboardService } from "./admin/adminDashboardService.js";
import { adminAnalyticsService } from "./admin/adminAnalyticsService.js";
import { adminSettingsService } from "./admin/adminSettingsService.js";
import { adminPhotographerActionsService } from "./admin/adminPhotographerActionsService.js";
import { adminReferralsService } from "./admin/adminReferralsService.js";
import { adminSystemService } from "./admin/adminSystemService.js";

export const adminService = {
  async dashboardOverview(query = {}) {
    return adminDashboardService.dashboardOverview(query);
  },

  async listPhotographers(query) {
    return adminPhotographersService.listPhotographers(query);
  },

  async photographerDetail(id) {
    return adminPhotographersService.photographerDetail(id);
  },

  async setPhotographerStatus(id, status) {
    return adminPhotographerActionsService.setPhotographerStatus(id, status);
  },

  async exportPhotographers(query = {}) {
    return adminPhotographersService.exportPhotographers(query);
  },

  async subscriptionsOverview() {
    return adminSubscriptionsService.subscriptionsOverview();
  },

  async getPlanLimits() {
    return adminSubscriptionsService.getPlanLimits();
  },

  async updatePlanLimits(limits) {
    return adminSubscriptionsService.updatePlanLimits(limits, {
      getPlanLimits: () => this.getPlanLimits(),
    });
  },

  async listPlans() {
    return adminSubscriptionsService.listPlans();
  },

  async updatePlan(planId, payload) {
    return adminSubscriptionsService.updatePlan(planId, payload);
  },

  async subscriptionChanges(query) {
    return adminSubscriptionsService.subscriptionChanges(query);
  },

  async revenueOverview() {
    return adminRevenueService.revenueOverview();
  },

  async monthlyRevenue(query = {}) {
    return adminRevenueService.monthlyRevenue(query);
  },

  async revenueByPlan(query = {}) {
    return adminRevenueService.revenueByPlan(query);
  },

  async revenueTransactions(query) {
    return adminRevenueService.revenueTransactions(query);
  },

  async storageOverview() {
    return adminStorageService.storageOverview();
  },

  async storageR2Overview() {
    return adminStorageService.storageR2Overview();
  },

  async storageByPlan() {
    return adminStorageService.storageByPlan();
  },

  async storageUploads(query = {}) {
    return adminStorageService.storageUploads(query);
  },

  async storageTopUsers(query) {
    return adminStorageService.storageTopUsers(query);
  },

  async moderationOverview() {
    return adminModerationService.moderationOverview();
  },

  async moderationReports(query) {
    return adminModerationService.moderationReports(query);
  },

  async moderationPatchReport(reportId, action) {
    return adminModerationService.moderationPatchReport(reportId, action);
  },

  async flaggedImages(query) {
    return adminModerationService.flaggedImages(query);
  },

  async patchFlaggedImage(imageReportId, action) {
    return adminModerationService.patchFlaggedImage(imageReportId, action);
  },

  async referralsOverview() {
    return adminReferralsService.referralsOverview();
  },

  async topReferrers(query) {
    return adminReferralsService.topReferrers(query);
  },

  async analyticsOverview(query = {}) {
    return adminAnalyticsService.analyticsOverview(query);
  },

  async systemLogs(query) {
    return adminSystemService.systemLogs(query);
  },

  async workerHealth() {
    return adminSystemService.workerHealth();
  },

  async getSettings() {
    return adminSettingsService.getSettings({ getPlanLimits: () => this.getPlanLimits() });
  },

  async updateEmailNotifications(payload) {
    return adminSettingsService.updateEmailNotifications(payload);
  },

  async updateSettingsPlanLimits(payload) {
    return adminSettingsService.updateSettingsPlanLimits(payload, {
      updatePlanLimits: (nextPayload) => this.updatePlanLimits(nextPayload),
    });
  },

  async getPublicPricingContent() {
    return adminSettingsService.getPublicPricingContent();
  },

  async updatePublicPricingContent(payload = {}) {
    return adminSettingsService.updatePublicPricingContent(payload);
  },

  async contentList(query = {}) {
    return adminContentService.contentList(query);
  },

  async contentGet(contentId) {
    return adminContentService.contentGet(contentId);
  },

  async contentCreate(payload) {
    return adminContentService.contentCreate(payload);
  },

  async contentPatch(contentId, payload) {
    return adminContentService.contentPatch(contentId, payload);
  },

  async contentDelete(contentId) {
    return adminContentService.contentDelete(contentId);
  },
};

