import { referralService } from "../services/referralService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

export const referralController = {
  me: asyncHandler(async (req, res) => {
    const data = await referralService.me(req.auth.sub);
    return sendSuccess(res, data);
  }),

  myEvents: asyncHandler(async (req, res) => {
    const data = await referralService.myEvents(req.auth.sub, req.query);
    return sendSuccess(res, data);
  }),

  track: asyncHandler(async (req, res) => {
    const data = await referralService.track(req.body);
    return sendSuccess(res, data, 201);
  }),
};