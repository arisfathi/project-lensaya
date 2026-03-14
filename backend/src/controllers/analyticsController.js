import { analyticsService } from "../services/analyticsService.js";
import { portfolioViewSchema } from "../utils/validationSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";

export const analyticsController = {
  trackPortfolioView: asyncHandler(async (req, res) => {
    const result = portfolioViewSchema.safeParse(req.body);

    if (!result.success) {
      throw new ApiError(400, result.error.issues?.[0]?.message || "Validation failed");
    }

    await analyticsService.recordEvent({
      ...result.data,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    return res.status(200).json({
      success: true,
      message: "Portfolio view tracked",
    });
  }),
};
