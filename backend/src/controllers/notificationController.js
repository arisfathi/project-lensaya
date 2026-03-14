import { notificationService } from "../services/notificationService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    const data = await notificationService.list(req.auth.sub, req.query);
    return sendSuccess(res, data);
  }),

  readPost: asyncHandler(async (req, res) => {
    const data = await notificationService.markReadByPayload(req.auth.sub, req.body);
    return sendSuccess(res, data);
  }),
};
