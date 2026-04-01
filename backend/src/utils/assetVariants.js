import { buildPublicAssetUrl } from "./assetUrl.js";

const toSafeString = (value) => String(value || "").trim();
const normalizeVariantName = (value) => toSafeString(value).toLowerCase();

const VARIANT_FALLBACKS = {
  original: ["original"],
  thumbnail: ["thumbnail", "thumb", "preview", "display", "web"],
  thumb: ["thumbnail", "thumb", "preview", "display", "web"],
  preview: ["preview", "display", "web"],
  display: ["display", "preview", "web"],
  web: ["display", "preview", "web"],
};

const readVariant = (asset, variantName) => {
  const variants = asset?.metadata?.variants;
  if (!variants || typeof variants !== "object") return null;
  const variant = variants[variantName];
  if (!variant || typeof variant !== "object") return null;
  return variant;
};

const getVariantOrder = (preferredVariant = "web") => {
  const normalized = normalizeVariantName(preferredVariant) || "web";
  const fallbackOrder = VARIANT_FALLBACKS[normalized] || VARIANT_FALLBACKS.web;
  return Array.from(new Set([...fallbackOrder, "original"]));
};

const hasReadableVariant = (asset, variantNames) =>
  variantNames.some((variantName) => {
    const variant = readVariant(asset, variantName);
    return Boolean(toSafeString(variant?.cdnUrl || variant?.url || variant?.objectKey));
  });

export const buildVariantObjectKey = (originalObjectKey, variantName) => {
  const safeOriginalKey = toSafeString(originalObjectKey).replace(/^\/+/, "");
  const safeVariant = normalizeVariantName(variantName);
  if (!safeOriginalKey || !safeVariant) {
    return safeOriginalKey;
  }

  const extMatch = safeOriginalKey.match(/\.[a-zA-Z0-9]+$/);
  const extension = extMatch?.[0] || "";
  const withoutExt = extension ? safeOriginalKey.slice(0, -extension.length) : safeOriginalKey;
  return `${withoutExt}-${safeVariant}.webp`;
};

export const resolveAssetUrl = (asset, preferredVariant = "web") => {
  const variantOrder = getVariantOrder(preferredVariant);
  const processingStatus = normalizeVariantName(asset?.metadata?.imageProcessing?.status);
  const assetUrl = toSafeString(asset?.cdnUrl);

  // Passthrough metadata may include synthetic variant URLs that do not exist physically.
  // In that mode, trust the persisted asset CDN URL first.
  if (processingStatus === "passthrough" && assetUrl) {
    return assetUrl;
  }

  for (const variantName of variantOrder) {
    const variant = readVariant(asset, variantName);
    if (!variant) continue;
    const variantUrl = toSafeString(variant.cdnUrl || variant.url);
    if (variantUrl) return variantUrl;
    const variantKey = toSafeString(variant.objectKey);
    if (variantKey) {
      const built = buildPublicAssetUrl(variantKey);
      if (built) return built;
    }
  }

  if (assetUrl) return assetUrl;
  const objectKey = toSafeString(asset?.objectKey);
  return buildPublicAssetUrl(objectKey) || null;
};

export const hasProcessedVariants = (asset) => {
  return hasReadableVariant(asset, ["thumbnail", "thumb", "preview", "display", "web"]);
};

export const listAssetObjectKeys = (asset) => {
  const keys = new Set();
  const originalKey = toSafeString(asset?.objectKey);
  if (originalKey) keys.add(originalKey);

  const variants = asset?.metadata?.variants;
  if (variants && typeof variants === "object") {
    for (const variant of Object.values(variants)) {
      if (!variant || typeof variant !== "object") continue;
      const variantKey = toSafeString(variant.objectKey);
      if (variantKey) keys.add(variantKey);
    }
  }

  return Array.from(keys);
};

