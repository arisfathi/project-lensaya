import { uploadService } from "../services/uploadService.js";
import { enqueueImageProcessing } from "../jobs/imageProcessingQueue.js";
import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

export const uploadController = {
  presign: asyncHandler(async (req, res) => {
    const data = await uploadService.createPresignedUpload({
      userId: req.auth.sub,
      tenant: req.tenant || null,
      fileName: req.body.fileName,
      mimeType: req.body.mimeType,
      size: req.body.size,
      purpose: req.body.purpose,
    });
    return sendSuccess(res, data, 201);
  }),

  complete: asyncHandler(async (req, res) => {
    const data = await uploadService.markUploadComplete(req.body.assetId, req.tenant || null);

    if (data.shouldProcessImage) {
      void enqueueImageProcessing({
        assetId: req.body.assetId,
        requestId: req.id || null,
        jobId: `asset:${req.body.assetId}`,
      }).catch((error) => {
        logger.error(
          {
            err: error,
            requestId: req.id || null,
            assetId: req.body.assetId,
          },
          "Failed to dispatch image processing after upload completion"
        );
        captureException(error, {
          controller: "uploadController",
          action: "complete",
          requestId: req.id || null,
          assetId: req.body.assetId,
        });
      });
    }

    return sendSuccess(res, data);
  }),

  remove: asyncHandler(async (req, res) => {
    const data = await uploadService.deleteAsset(req.params.assetId, req.tenant || null);
    return sendSuccess(res, data);
  }),

  setAvatar: asyncHandler(async (req, res) => {
    const data = await uploadService.assignAvatar(req.auth.sub, req.body.assetId);
    return sendSuccess(res, data);
  }),

  clearAvatar: asyncHandler(async (req, res) => {
    const data = await uploadService.removeAvatar(req.auth.sub);
    return sendSuccess(res, data);
  }),
};
