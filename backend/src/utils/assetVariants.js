import { buildPublicAssetUrl } from "./assetUrl.js";

const toSafeString = (value) => String(value || "").trim();

const readVariant = (asset, variantName) => {
  const variants = asset?.metadata?.variants;
  if (!variants || typeof variants !== "object") return null;
  const variant = variants[variantName];
  if (!variant || typeof variant !== "object") return null;
  return variant;
};

export const buildVariantObjectKey = (originalObjectKey, variantName) => {
  const safeOriginalKey = toSafeString(originalObjectKey).replace(/^\/+/, "");
  const safeVariant = toSafeString(variantName).toLowerCase();
  if (!safeOriginalKey || !safeVariant) {
    return safeOriginalKey;
  }

  const extMatch = safeOriginalKey.match(/\.[a-zA-Z0-9]+$/);
  const extension = extMatch?.[0] || "";
  const withoutExt = extension ? safeOriginalKey.slice(0, -extension.length) : safeOriginalKey;
  return `${withoutExt}-${safeVariant}.webp`;
};

export const resolveAssetUrl = (asset, preferredVariant = "web") => {
  const preferred = toSafeString(preferredVariant).toLowerCase() || "web";
  const variantOrder = [
    preferred,
    preferred === "thumb" ? "web" : "thumb",
    "original",
  ];

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

  const assetUrl = toSafeString(asset?.cdnUrl);
  if (assetUrl) return assetUrl;
  const objectKey = toSafeString(asset?.objectKey);
  return buildPublicAssetUrl(objectKey) || null;
};

export const hasProcessedVariants = (asset) => {
  const web = readVariant(asset, "web");
  const thumb = readVariant(asset, "thumb");
  const hasWeb = Boolean(toSafeString(web?.objectKey || web?.cdnUrl || web?.url));
  const hasThumb = Boolean(toSafeString(thumb?.objectKey || thumb?.cdnUrl || thumb?.url));
  return hasWeb && hasThumb;
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
