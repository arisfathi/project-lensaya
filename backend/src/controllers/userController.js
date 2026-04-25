import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import bcrypt from "bcryptjs";
import formidable from "formidable";
import { createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { getR2Client } from "../config/r2.js";
import { randomCode } from "../utils/crypto.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACTIVE_SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"];

const toSafeAvatarFileName = (name, mimeType) => {
  const baseName = (name || "avatar")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 80) || "avatar";

  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `${baseName}.${extension}`;
};

const parseAvatarFile = (req) =>
  new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      maxFiles: 1,
      maxFileSize: MAX_AVATAR_BYTES,
      allowEmptyFiles: false,
      filter: ({ name, mimetype }) =>
        name === "avatar" && typeof mimetype === "string" && mimetype.startsWith("image/"),
    });

    form.parse(req, (parseError, _fields, files) => {
      if (parseError) {
        const isTooLarge = parseError.httpCode === 413 || parseError.code === 1009;
        reject(new ApiError(isTooLarge ? 413 : 400, isTooLarge ? "Avatar image must be 5MB or smaller" : "Invalid avatar upload payload"));
        return;
      }

      const avatarFile = Array.isArray(files.avatar) ? files.avatar[0] : files.avatar;
      if (!avatarFile) {
        reject(new ApiError(400, "Avatar file is required"));
        return;
      }

      resolve(avatarFile);
    });
  });

const cleanupTempFile = async (filePath) => {
  if (!filePath) {
    return;
  }
  await unlink(filePath).catch(() => {});
};

const toDeletedEmail = (email = "") => {
  const localPart = String(email || "user")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 48) || "user";
  return `${localPart}.deleted.${Date.now()}.${randomCode().slice(0, 8)}@deleted.lensaya.local`;
};

export const userController = {
  changePassword: asyncHandler(async (req, res) => {
    const currentPassword = req.body.currentPassword || "";
    const newPassword = req.body.newPassword || "";

    const user = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.passwordHash) {
      if (!currentPassword) {
        throw new ApiError(400, "Current password is required");
      }

      const validCurrentPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validCurrentPassword) {
        throw new ApiError(401, "Current password is incorrect");
      }

      const sameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
      if (sameAsCurrent) {
        throw new ApiError(400, "New password must be different from current password");
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    return sendSuccess(res, { message: "Password changed successfully" });
  }),

  deleteAccount: asyncHandler(async (req, res) => {
    const password = req.body.password || "";
    const now = new Date();

    const user = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.passwordHash) {
      if (!password) {
        throw new ApiError(400, "Password is required to delete your account");
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        throw new ApiError(401, "Password is incorrect");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: "DELETED",
          email: toDeletedEmail(user.email),
          fullName: "Deleted User",
          username: null,
          passwordHash: null,
          googleId: null,
          appleId: null,
          emailVerifiedAt: null,
        },
      });

      await tx.photographer.updateMany({
        where: { userId: user.id },
        data: {
          status: "SUSPENDED",
          isDirectoryVisible: false,
          phone: null,
          whatsappNumber: null,
          instagramHandle: null,
          facebookUrl: null,
          tiktokHandle: null,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });

      await tx.subscription.updateMany({
        where: {
          userId: user.id,
          status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
        },
        data: {
          status: "CANCELED",
          cancelAtPeriodEnd: false,
          canceledAt: now,
          currentPeriodEnd: now,
        },
      });
    });

    return sendSuccess(res, { deleted: true, message: "Account deleted successfully" });
  }),

  uploadAvatar: asyncHandler(async (req, res) => {
    if (!String(req.headers["content-type"] || "").toLowerCase().includes("multipart/form-data")) {
      throw new ApiError(400, "Content-Type must be multipart/form-data");
    }

    const client = getR2Client();
    if (!client) {
      throw new ApiError(500, "R2 configuration is incomplete");
    }
    if (!env.r2.bucket) {
      throw new ApiError(500, "R2_BUCKET not configured");
    }

    const photographer = await prisma.photographer.findUnique({
      where: { userId: req.auth.sub },
      select: {
        id: true,
        avatarAssetId: true,
        avatarAsset: {
          select: {
            id: true,
            bucket: true,
            objectKey: true,
          },
        },
      },
    });

    if (!photographer) {
      throw new ApiError(404, "Photographer profile not found");
    }

    const avatarFile = await parseAvatarFile(req);
    const mimeType = avatarFile.mimetype || "";
    const fileSize = Number(avatarFile.size || 0);

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      await cleanupTempFile(avatarFile.filepath);
      throw new ApiError(400, "Only JPG, PNG, and WEBP images are supported");
    }

    if (!fileSize || fileSize > MAX_AVATAR_BYTES) {
      await cleanupTempFile(avatarFile.filepath);
      throw new ApiError(413, "Avatar image must be 5MB or smaller");
    }

    const fileName = toSafeAvatarFileName(avatarFile.originalFilename || "avatar", mimeType);
    const objectKey = `uploads/${photographer.id}/avatar/${Date.now()}-${randomCode()}-${fileName}`;
    const cdnBase = env.r2.publicBaseUrl ? env.r2.publicBaseUrl.replace(/\/+$/, "") : "";
    const avatarUrl = cdnBase ? `${cdnBase}/${objectKey}` : null;

    await client.send(
      new PutObjectCommand({
        Bucket: env.r2.bucket,
        Key: objectKey,
        Body: createReadStream(avatarFile.filepath),
        ContentType: mimeType,
        ContentLength: fileSize,
      })
    );

    let createdAssetId = null;
    try {
      const createdAsset = await prisma.asset.create({
        data: {
          photographerId: photographer.id,
          uploadedById: req.auth.sub,
          type: "IMAGE",
          purpose: "AVATAR",
          status: "READY",
          bucket: env.r2.bucket,
          objectKey,
          mimeType,
          originalFileName: avatarFile.originalFilename || fileName,
          sizeBytes: fileSize,
          cdnUrl: avatarUrl,
        },
        select: { id: true, cdnUrl: true },
      });
      createdAssetId = createdAsset.id;

      const tx = [
        prisma.photographer.update({
          where: { id: photographer.id },
          data: { avatarAssetId: createdAsset.id },
        }),
      ];

      if (photographer.avatarAssetId) {
        tx.push(
          prisma.asset.updateMany({
            where: { id: photographer.avatarAssetId },
            data: {
              status: "DELETED",
              deletedAt: new Date(),
            },
          })
        );
      }

      await prisma.$transaction(tx);

      if (photographer.avatarAsset?.bucket && photographer.avatarAsset?.objectKey) {
        await client
          .send(
            new DeleteObjectCommand({
              Bucket: photographer.avatarAsset.bucket,
              Key: photographer.avatarAsset.objectKey,
            })
          )
          .catch(() => {});
      }

      return sendSuccess(res, { avatarUrl: createdAsset.cdnUrl || avatarUrl });
    } catch (error) {
      await client
        .send(
          new DeleteObjectCommand({
            Bucket: env.r2.bucket,
            Key: objectKey,
          })
        )
        .catch(() => {});

      if (createdAssetId) {
        await prisma.asset
          .updateMany({
            where: { id: createdAssetId },
            data: {
              status: "DELETED",
              deletedAt: new Date(),
            },
          })
          .catch(() => {});
      }

      throw error;
    } finally {
      await cleanupTempFile(avatarFile.filepath);
    }
  }),
};



