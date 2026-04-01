import { photographerService } from "../services/photographerService.js";
import { customDomainService } from "../services/customDomainService.js";
import { bookingService } from "../services/bookingService.js";
import { analyticsService } from "../services/analyticsService.js";
import { enqueueAnalyticsEventProcessing } from "../jobs/analyticsQueue.js";
import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

export const photographerController = {
  dashboardOverview: asyncHandler(async (req, res) => {
    const data = await photographerService.dashboardOverview(req.auth.sub);
    return sendSuccess(res, data);
  }),

  websiteSummary: asyncHandler(async (req, res) => {
    const data = await photographerService.websiteSummary(req.auth.sub);
    return sendSuccess(res, data);
  }),

  getProfile: asyncHandler(async (req, res) => {
    const data = await photographerService.getProfile(req.auth.sub);
    return sendSuccess(res, data);
  }),

  previewUsername: asyncHandler(async (req, res) => {
    const data = await photographerService.previewUsername(req.auth.sub, req.query.studioName);
    return sendSuccess(res, data);
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const data = await photographerService.updateProfile(req.auth.sub, req.body);
    return sendSuccess(res, data);
  }),

  updateHero: asyncHandler(async (req, res) => {
    const data = await photographerService.updateHero(req.auth.sub, req.body);
    return sendSuccess(res, data);
  }),

  getCustomDomain: asyncHandler(async (req, res) => {
    const data = await customDomainService.getState(req.auth.sub);
    return sendSuccess(res, data);
  }),

  saveCustomDomain: asyncHandler(async (req, res) => {
    const data = await customDomainService.save(req.auth.sub, req.body.domain);
    return sendSuccess(res, data);
  }),

  verifyCustomDomain: asyncHandler(async (req, res) => {
    const data = await customDomainService.verify(req.auth.sub);
    return sendSuccess(res, data);
  }),

  disconnectCustomDomain: asyncHandler(async (req, res) => {
    const data = await customDomainService.disconnect(req.auth.sub);
    return sendSuccess(res, data);
  }),

  listServices: asyncHandler(async (req, res) => {
    const data = await photographerService.listServices(req.tenant);
    return sendSuccess(res, data);
  }),

  createService: asyncHandler(async (req, res) => {
    const data = await photographerService.createService(req.tenant, req.body);
    return sendSuccess(res, data, 201);
  }),

  updateService: asyncHandler(async (req, res) => {
    const data = await photographerService.updateService(req.tenant, req.params.serviceId, req.body);
    return sendSuccess(res, data);
  }),

  deleteService: asyncHandler(async (req, res) => {
    const data = await photographerService.deleteService(req.tenant, req.params.serviceId);
    return sendSuccess(res, data);
  }),

  listPackages: asyncHandler(async (req, res) => {
    const data = await photographerService.listPackages(req.tenant, req.query);
    return sendSuccess(res, data);
  }),

  createPackage: asyncHandler(async (req, res) => {
    const data = await photographerService.createPackage(req.tenant, req.body);
    return sendSuccess(res, data, 201);
  }),

  updatePackage: asyncHandler(async (req, res) => {
    const data = await photographerService.updatePackage(req.tenant, req.params.packageId, req.body);
    return sendSuccess(res, data);
  }),

  duplicatePackage: asyncHandler(async (req, res) => {
    const data = await photographerService.duplicatePackage(req.tenant, req.params.packageId, req.body.name);
    return sendSuccess(res, data, 201);
  }),

  deletePackage: asyncHandler(async (req, res) => {
    const data = await photographerService.deletePackage(req.tenant, req.params.packageId);
    return sendSuccess(res, data);
  }),

  listPortfolioItems: asyncHandler(async (req, res) => {
    const data = await photographerService.listPortfolioItems(req.tenant, req.query);
    return sendSuccess(res, data);
  }),

  createPortfolioItem: asyncHandler(async (req, res) => {
    const data = await photographerService.createPortfolioItem(req.tenant, req.body);
    return sendSuccess(res, data, 201);
  }),

  updatePortfolioItem: asyncHandler(async (req, res) => {
    const data = await photographerService.updatePortfolioItem(req.tenant, req.params.itemId, req.body);
    return sendSuccess(res, data);
  }),

  featurePortfolioItem: asyncHandler(async (req, res) => {
    const data = await photographerService.setPortfolioFeatured(req.tenant, req.params.itemId, req.body.featured);
    return sendSuccess(res, data);
  }),

  deletePortfolioItem: asyncHandler(async (req, res) => {
    const data = await photographerService.deletePortfolioItem(req.tenant, req.params.itemId);
    return sendSuccess(res, data);
  }),

  getAvailability: asyncHandler(async (req, res) => {
    const data = await photographerService.getAvailability(req.tenant, req.query.month);
    return sendSuccess(res, data);
  }),

  patchAvailability: asyncHandler(async (req, res) => {
    const data = await photographerService.patchAvailability(req.tenant, req.body.updates || []);
    return sendSuccess(res, data);
  }),

  analyticsOverview: asyncHandler(async (req, res) => {
    const data = await photographerService.analyticsOverview(req.tenant, req.query);
    return sendSuccess(res, data);
  }),

  updateAnalyticsGoal: asyncHandler(async (req, res) => {
    const data = await photographerService.updateAnalyticsGoal(req.tenant, req.body);
    return sendSuccess(res, data);
  }),

  analyticsCategories: asyncHandler(async (req, res) => {
    const data = await analyticsService.categoriesByPhotographer(req.tenant);
    return sendSuccess(res, data);
  }),

  analyticsActivity: asyncHandler(async (req, res) => {
    const data = await photographerService.analyticsActivity(req.tenant, req.query);
    return sendSuccess(res, data);
  }),

  ingestAnalyticsEvent: asyncHandler(async (req, res) => {
    const data = await analyticsService.ingest(
      {
        ...req.body,
        userId: req.auth?.sub || null,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        referrer: req.headers.referer || req.body?.referrer || null,
        path: req.body?.path || req.path,
        pageUrl: req.body?.pageUrl || null,
        requestHost: req.hostContext?.host || req.headers.host || null,
      },
      req.tenant || null
    );

    void enqueueAnalyticsEventProcessing({
      eventId: data.id.toString(),
      eventType: data.eventType,
      photographerId: data.photographerId || null,
      requestId: req.id || null,
    }).catch((error) => {
      logger.error(
        {
          err: error,
          requestId: req.id || null,
          eventId: data.id.toString(),
        },
        "Failed to dispatch analytics event processing job"
      );
      captureException(error, {
        controller: "photographerController",
        action: "ingestAnalyticsEvent",
        requestId: req.id || null,
        eventId: data.id.toString(),
      });
    });

    return sendSuccess(res, { eventId: data.id.toString(), accepted: true }, 201);
  }),

  bookingCalendar: asyncHandler(async (req, res) => {
    const data = await bookingService.calendarForUser(req.tenant, req.query.month);
    return sendSuccess(res, data);
  }),

  bookingList: asyncHandler(async (req, res) => {
    const data = await bookingService.listForPhotographer(req.tenant, req.query);
    return sendSuccess(res, data);
  }),

  exportBookingLeads: asyncHandler(async (req, res) => {
    const data = await bookingService.exportForPhotographer(req.tenant, req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${data.filename}\"`);
    return res.status(200).send(data.csv);
  }),

  updateBookingStatus: asyncHandler(async (req, res) => {
    const data = await bookingService.updateStatus(req.tenant, req.params.bookingId, req.body.status);
    return sendSuccess(res, data);
  }),

  updateBookingNotes: asyncHandler(async (req, res) => {
    const data = await bookingService.updateNotes(req.tenant, req.params.bookingId, req.body.notes);
    return sendSuccess(res, data);
  }),
};

