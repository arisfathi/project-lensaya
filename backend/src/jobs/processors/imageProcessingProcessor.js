import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { logger } from "../../config/logger.js";
import { getR2Client } from "../../config/r2.js";
import { buildPublicAssetUrl } from "../../utils/assetUrl.js";
import { buildVariantObjectKey } from "../../utils/assetVariants.js";
import { redisCache } from "../../utils/redisCache.js";

const ACTIVE_SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"];
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);
const WATERMARKABLE_PURPOSES = new Set(["PORTFOLIO", "SERVICE_THUMBNAIL"]);
const STORAGE_USAGE_CACHE_PREFIX = "cache:upload:storage-usage:v1:";

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};
const MAX_SOURCE_IMAGE_BYTES = Math.max(toPositiveInt(env.media?.maxSourceBytes, 30 * 1024 * 1024), 1);
const MEDIA_VARIANT_CONFIG = {
  thumbnail: {
    maxWidth: Math.max(toPositiveInt(env.media.variants?.thumbnail?.maxWidth, 400), 1),
    quality: Math.min(Math.max(toPositiveInt(env.media.variants?.thumbnail?.quality, 70), 1), 100),
  },
  preview: {
    maxWidth: Math.max(toPositiveInt(env.media.variants?.preview?.maxWidth, 1600), 1),
    quality: Math.min(Math.max(toPositiveInt(env.media.variants?.preview?.quality, 78), 1), 100),
  },
  display: {
    quality: Math.min(Math.max(toPositiveInt(env.media.variants?.display?.quality, 80), 1), 100),
  },
};

const toBuffer = async (body) => {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;

  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const escapeXml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const makeWatermarkSvg = ({ width, height, text, opacity }) => {
  const safeWidth = Math.max(toPositiveInt(width, 1), 1);
  const safeHeight = Math.max(toPositiveInt(height, 1), 1);
  const shortSide = Math.max(Math.min(safeWidth, safeHeight), 1);
  const fontSize = Math.max(Math.round(shortSide / 14), 18);
  const paddingX = Math.max(Math.round(fontSize * 0.6), 12);
  const paddingY = Math.max(Math.round(fontSize * 0.35), 8);
  const boxWidth = Math.max(Math.round(fontSize * (text.length * 0.66 + 1.8)), 140);
  const boxHeight = Math.round(fontSize * 1.8);
  const x = Math.max(safeWidth - boxWidth - paddingX, 0);
  const y = Math.max(safeHeight - boxHeight - paddingY, 0);
  const radius = Math.max(Math.round(fontSize * 0.25), 6);
  const safeOpacity = Math.max(Math.min(Number(opacity || 0.35), 1), 0.05);

  return `
<svg width="${safeWidth}" height="${safeHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${radius}" fill="rgba(0,0,0,${Math.min(
    safeOpacity + 0.08,
    0.7
  )})" />
  <text
    x="${x + boxWidth / 2}"
    y="${y + boxHeight / 2}"
    fill="rgba(255,255,255,${Math.min(safeOpacity + 0.45, 0.98)})"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    dominant-baseline="central"
    text-anchor="middle"
  >${escapeXml(text)}</text>
</svg>`;
};

const resolvePlanForAsset = async (asset) => {
  if (!asset?.photographerId) return "FREE";

  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      photographerId: asset.photographerId,
      status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    select: { plan: true },
  });

  return String(activeSubscription?.plan || "FREE").toUpperCase();
};

const shouldWatermark = ({ planName, purpose }) =>
  planName === "FREE" && WATERMARKABLE_PURPOSES.has(String(purpose || "").toUpperCase());

const buildVariantRecord = ({ objectKey, mimeType, sizeBytes, width, height, watermarked = false }) => ({
  objectKey,
  url: buildPublicAssetUrl(objectKey) || null,
  mimeType,
  sizeBytes,
  width: Number.isFinite(width) ? width : null,
  height: Number.isFinite(height) ? height : null,
  watermarked: Boolean(watermarked),
});

const buildOriginalVariantRecord = ({ asset, width, height, sizeBytes = null }) => ({
  objectKey: asset.objectKey,
  url: asset.cdnUrl || buildPublicAssetUrl(asset.objectKey) || null,
  mimeType: asset.mimeType || null,
  sizeBytes: Number(sizeBytes ?? asset.sizeBytes ?? 0),
  width: Number.isFinite(width) ? width : null,
  height: Number.isFinite(height) ? height : null,
  watermarked: false,
});

const sumVariantBytes = (variants = {}) =>
  Object.values(variants).reduce((total, variant) => total + Number(variant?.sizeBytes || 0), 0);

const invalidatePhotographerStorageUsageCache = async (photographerId) => {
  const normalized = String(photographerId || "").trim();
  if (!normalized) return;
  await redisCache.del(`${STORAGE_USAGE_CACHE_PREFIX}${normalized}`);
};

const buildPassthroughMetadata = ({ asset, planName, context, reason }) => {
  const generatedAt = new Date().toISOString();
  const variants = asset?.metadata?.variants || {};
  const original = buildOriginalVariantRecord({
    asset,
    width: asset.width ?? variants?.original?.width ?? null,
    height: asset.height ?? variants?.original?.height ?? null,
  });

  return {
    ...(asset.metadata || {}),
    variants: {
      ...variants,
      original,
      thumbnail: variants.thumbnail || variants.thumb || original,
      thumb: variants.thumb || variants.thumbnail || original,
      preview: variants.preview || variants.display || variants.web || original,
      display: variants.display || variants.preview || variants.web || original,
      web: variants.web || variants.display || variants.preview || original,
    },
    imageProcessing: {
      ...(asset.metadata?.imageProcessing || {}),
      queuedAt: generatedAt,
      generatedAt,
      status: "passthrough",
      mode: context.mode || "queue",
      reason,
      plan: planName,
      watermarkApplied: false,
      transformEnabled: Boolean(env.media.enableTransform),
      generatedVariants: [],
    },
  };
};

const resolveDisplayMaxWidth = (planName) => {
  const normalizedPlan = String(planName || "FREE").trim().toUpperCase() || "FREE";
  const widths = env.media.variants?.display?.maxWidthByPlan || {};
  const fallback = Math.max(toPositiveInt(widths.FREE, 1600), 1);
  const configuredWidth = widths[normalizedPlan] ?? widths.FREE ?? fallback;
  return Math.max(toPositiveInt(configuredWidth, fallback), 1);
};

const renderVariant = async ({
  sourceBuffer,
  maxWidth,
  quality,
  withWatermark,
  watermarkText,
  watermarkOpacity,
}) => {
  const resized = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });

  if (!withWatermark) {
    return {
      buffer: resized.data,
      info: resized.info,
      watermarked: false,
    };
  }

  const watermarkSvg = makeWatermarkSvg({
    width: resized.info.width,
    height: resized.info.height,
    text: watermarkText,
    opacity: watermarkOpacity,
  });

  const watermarked = await sharp(resized.data, { failOn: "none" })
    .composite([{ input: Buffer.from(watermarkSvg), left: 0, top: 0 }])
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: watermarked.data,
    info: watermarked.info,
    watermarked: true,
  };
};

export const processImageResizeJob = async (payload = {}, context = {}) => {
  const assetId = payload?.assetId;
  if (!assetId) {
    return { skipped: true, reason: "missing-asset-id" };
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      bucket: true,
      metadata: true,
      objectKey: true,
      cdnUrl: true,
      photographerId: true,
      purpose: true,
      status: true,
      type: true,
      mimeType: true,
      sizeBytes: true,
      width: true,
      height: true,
      deletedAt: true,
    },
  });

  if (!asset) {
    return { skipped: true, reason: "asset-not-found" };
  }

  if (asset.deletedAt || ["DELETED", "PURGED"].includes(String(asset.status || ""))) {
    return { skipped: true, reason: "asset-deleted" };
  }

  if (String(asset.type || "").toUpperCase() !== "IMAGE") {
    return { skipped: true, reason: "asset-not-image" };
  }

  const planName = await resolvePlanForAsset(asset);
  const transformEnabled = Boolean(env.media.enableTransform);
  const mimeType = String(asset.mimeType || "").toLowerCase();
  const supportedMimeType = SUPPORTED_IMAGE_MIME_TYPES.has(mimeType);
  const bucket = asset.bucket || env.r2.bucket || "";
  const client = getR2Client();

  if (!transformEnabled || !supportedMimeType || !bucket || !client) {
    const reason = !transformEnabled
      ? "transform-disabled"
      : !supportedMimeType
        ? "unsupported-mime-type"
        : !bucket
          ? "missing-bucket"
          : "missing-r2-client";

    logger.info(
      {
        assetId,
        plan: planName,
        mode: context.mode || "queue",
        reason,
      },
      "Image processing skipped, using passthrough metadata"
    );

    const metadata = buildPassthroughMetadata({
      asset,
      planName,
      context,
      reason,
    });

    await prisma.asset.update({
      where: { id: asset.id },
      data: { metadata },
    });

    return { processed: true, mode: "passthrough", assetId, reason };
  }

  const generatedAt = new Date().toISOString();
  const watermarkText = String(env.media.watermarkText || "Lensaya").trim().slice(0, 64) || "Lensaya";
  const watermarkOpacity = Number(env.media.watermarkOpacity || 0.35);
  const applyWatermark = shouldWatermark({ planName, purpose: asset.purpose });
  const variantDefinitions = [
    {
      name: "thumbnail",
      maxWidth: MEDIA_VARIANT_CONFIG.thumbnail.maxWidth,
      quality: MEDIA_VARIANT_CONFIG.thumbnail.quality,
    },
    {
      name: "preview",
      maxWidth: MEDIA_VARIANT_CONFIG.preview.maxWidth,
      quality: MEDIA_VARIANT_CONFIG.preview.quality,
    },
    {
      name: "display",
      maxWidth: resolveDisplayMaxWidth(planName),
      quality: MEDIA_VARIANT_CONFIG.display.quality,
    },
  ];
  const uploadedVariantKeys = [];

  if (Number(asset.sizeBytes || 0) > MAX_SOURCE_IMAGE_BYTES) {
    const reason = "source-too-large";
    logger.info(
      {
        assetId,
        plan: planName,
        mode: context.mode || "queue",
        reason,
        sizeBytes: Number(asset.sizeBytes || 0),
        maxSourceBytes: MAX_SOURCE_IMAGE_BYTES,
      },
      "Image processing skipped due to oversized source"
    );

    const metadata = buildPassthroughMetadata({
      asset,
      planName,
      context,
      reason,
    });

    await prisma.asset.update({
      where: { id: asset.id },
      data: { metadata },
    });

    return { processed: true, mode: "passthrough", assetId, reason };
  }

  try {
    const sourceObject = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: asset.objectKey,
      })
    );
    const sourceBuffer = await toBuffer(sourceObject.Body);
    if (sourceBuffer.length > MAX_SOURCE_IMAGE_BYTES) {
      throw new Error("Source image exceeds worker size safety limit");
    }
    if (!sourceBuffer.length) {
      throw new Error("Source image is empty");
    }

    const originalInfo = await sharp(sourceBuffer, { failOn: "none" }).metadata();
    const generatedVariants = {};

    for (const variantDefinition of variantDefinitions) {
      const variantResult = await renderVariant({
        sourceBuffer,
        maxWidth: variantDefinition.maxWidth,
        quality: variantDefinition.quality,
        withWatermark: applyWatermark,
        watermarkText,
        watermarkOpacity,
      });
      const objectKey = buildVariantObjectKey(asset.objectKey, variantDefinition.name);

      logger.info(
        {
          assetId: asset.id,
          plan: planName,
          variant: variantDefinition.name,
          targetMaxWidth: variantDefinition.maxWidth,
          quality: variantDefinition.quality,
          sourceWidth: originalInfo.width ?? asset.width ?? null,
          sourceHeight: originalInfo.height ?? asset.height ?? null,
          outputWidth: variantResult.info.width ?? null,
          outputHeight: variantResult.info.height ?? null,
          bytes: variantResult.buffer.length,
          watermarked: variantResult.watermarked,
        },
        "Image resized"
      );

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: variantResult.buffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
      uploadedVariantKeys.push(objectKey);
      generatedVariants[variantDefinition.name] = buildVariantRecord({
        objectKey,
        mimeType: "image/webp",
        sizeBytes: variantResult.buffer.length,
        width: variantResult.info.width,
        height: variantResult.info.height,
        watermarked: variantResult.watermarked,
      });

      logger.info(
        {
          assetId: asset.id,
          plan: planName,
          variant: variantDefinition.name,
          objectKey,
          bytes: variantResult.buffer.length,
          watermarked: variantResult.watermarked,
        },
        "Variant generated"
      );
    }

    const keepOriginal = planName !== "FREE";
    const existingVariants = asset?.metadata?.variants || {};
    const original = buildOriginalVariantRecord({
      asset,
      width: originalInfo.width ?? asset.width ?? null,
      height: originalInfo.height ?? asset.height ?? null,
      sizeBytes: sourceBuffer.length,
    });

    if (!keepOriginal) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: asset.objectKey,
        })
      );
    }

    const variantBytes = sumVariantBytes(generatedVariants);
    const keptSizeBytes = keepOriginal ? Number(sourceBuffer.length || 0) + variantBytes : variantBytes;
    const displayVariant = generatedVariants.display || generatedVariants.preview || generatedVariants.thumbnail || null;

    const metadata = {
      ...(asset.metadata || {}),
      variants: keepOriginal
        ? {
            ...existingVariants,
            original,
            thumbnail:
              generatedVariants.thumbnail ||
              existingVariants.thumbnail ||
              existingVariants.thumb ||
              original,
            thumb:
              generatedVariants.thumbnail ||
              existingVariants.thumb ||
              existingVariants.thumbnail ||
              original,
            preview:
              generatedVariants.preview ||
              existingVariants.preview ||
              existingVariants.display ||
              existingVariants.web ||
              original,
            display:
              generatedVariants.display ||
              existingVariants.display ||
              existingVariants.preview ||
              existingVariants.web ||
              original,
            web:
              generatedVariants.display ||
              existingVariants.web ||
              existingVariants.display ||
              existingVariants.preview ||
              original,
          }
        : {
            thumbnail: generatedVariants.thumbnail || existingVariants.thumbnail || existingVariants.thumb || null,
            thumb: generatedVariants.thumbnail || existingVariants.thumb || existingVariants.thumbnail || null,
            preview:
              generatedVariants.preview ||
              generatedVariants.display ||
              existingVariants.preview ||
              existingVariants.display ||
              existingVariants.web ||
              null,
            display:
              generatedVariants.display ||
              generatedVariants.preview ||
              existingVariants.display ||
              existingVariants.preview ||
              existingVariants.web ||
              null,
            web:
              generatedVariants.display ||
              generatedVariants.preview ||
              existingVariants.web ||
              existingVariants.display ||
              existingVariants.preview ||
              null,
          },
      imageProcessing: {
        ...(asset.metadata?.imageProcessing || {}),
        queuedAt: generatedAt,
        generatedAt,
        status: "processed",
        mode: context.mode || "queue",
        plan: planName,
        watermarkApplied: Boolean(applyWatermark),
        transformEnabled: true,
        generatedVariants: Object.keys(generatedVariants),
      },
    };

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        metadata,
        sizeBytes: keptSizeBytes,
        width: Number.isFinite(originalInfo.width) ? originalInfo.width : null,
        height: Number.isFinite(originalInfo.height) ? originalInfo.height : null,
        cdnUrl:
          displayVariant?.url ||
          (keepOriginal ? buildPublicAssetUrl(asset.objectKey) || asset.cdnUrl || null : null),
      },
    });

    await invalidatePhotographerStorageUsageCache(asset.photographerId);

    logger.info(
      {
        queue: context.queue || null,
        jobId: context.jobId || null,
        requestId: payload?.requestId || null,
        assetId,
        mode: context.mode || "queue",
        plan: planName,
        generatedVariants: Object.keys(generatedVariants),
        watermarkApplied: Boolean(applyWatermark),
      },
      "Image processing job completed"
    );

    return {
      processed: true,
      assetId,
      displayObjectKey: generatedVariants.display?.objectKey || null,
      previewObjectKey: generatedVariants.preview?.objectKey || null,
      thumbnailObjectKey: generatedVariants.thumbnail?.objectKey || null,
      webObjectKey: generatedVariants.display?.objectKey || null,
      thumbObjectKey: generatedVariants.thumbnail?.objectKey || null,
      generatedVariants: Object.keys(generatedVariants),
      watermarkApplied: Boolean(applyWatermark),
    };
  } catch (error) {
    if (bucket && client && uploadedVariantKeys.length > 0) {
      await Promise.allSettled(
        uploadedVariantKeys.map((objectKey) =>
          client.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: objectKey,
            })
          )
        )
      );
    }

    logger.error(
      {
        err: error,
        queue: context.queue || null,
        jobId: context.jobId || null,
        requestId: payload?.requestId || null,
        assetId,
        plan: planName,
      },
      "Image processing transform failed, falling back to passthrough metadata"
    );

    const metadata = buildPassthroughMetadata({
      asset,
      planName,
      context,
      reason: "transform-failed",
    });

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        metadata,
      },
    });

    return { processed: true, mode: "passthrough", reason: "transform-failed", assetId };
  }
};


