import { publicService } from "../services/publicService.js";
import { bookingService } from "../services/bookingService.js";
import { publicHostService } from "../services/publicHostService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

export const publicController = {
  pricingContent: asyncHandler(async (_req, res) => {
    const data = await publicService.pricingContent();
    return sendSuccess(res, data);
  }),

  content: asyncHandler(async (req, res) => {
    const data = await publicService.content(req.query);
    return sendSuccess(res, data);
  }),

  featured: asyncHandler(async (req, res) => {
    const data = await publicService.featured(req.query);
    return sendSuccess(res, data);
  }),

  siteContext: asyncHandler(async (req, res) => {
    const data = await publicHostService.resolve(req.hostContext);
    return sendSuccess(res, data);
  }),

  directory: asyncHandler(async (req, res) => {
    const data = await publicService.directory(req.query);
    return sendSuccess(res, data);
  }),

  profile: asyncHandler(async (req, res) => {
    const data = await publicService.profileByUsername(req.params.username);
    return sendSuccess(res, data);
  }),

  photographer: asyncHandler(async (req, res) => {
    const photographer = await publicService.profileByUsername(req.params.username);
    return sendSuccess(res, { photographer });
  }),

  services: asyncHandler(async (req, res) => {
    const data = await publicService.services(req.params.username, req.query);
    return sendSuccess(res, data);
  }),

  portfolio: asyncHandler(async (req, res) => {
    const data = await publicService.portfolio(req.params.username, req.query);
    return sendSuccess(res, data);
  }),

  gallery: asyncHandler(async (req, res) => {
    const data = await publicService.gallery(req.params.username, req.query);
    return sendSuccess(res, data);
  }),

  packages: asyncHandler(async (req, res) => {
    const data = await publicService.packages(req.params.username, req.query);
    return sendSuccess(res, data);
  }),

  availability: asyncHandler(async (req, res) => {
    const data = await publicService.availability(req.params.username, req.query.month);
    return sendSuccess(res, data);
  }),

  createBooking: asyncHandler(async (req, res) => {
    const data = await bookingService.createPublicBooking(req.body, {
      requestId: req.id || null,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      referrer: req.headers.referer || null,
    });
    return sendSuccess(res, data, 201);
  }),

  clientError: asyncHandler(async (req, res) => {
    if (env.monitoring.logClientErrors) {
      logger.error(
        {
          requestId: req.id || null,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] || null,
          clientError: {
            type: req.body?.type || "error",
            message: req.body?.message || "",
            source: req.body?.source || "",
            url: req.body?.url || "",
            stack: req.body?.stack || "",
            context: req.body?.context || null,
            timestamp: req.body?.timestamp || null,
          },
        },
        "Client runtime error reported"
      );
    }

    return sendSuccess(res, { accepted: true }, 202);
  }),
};

