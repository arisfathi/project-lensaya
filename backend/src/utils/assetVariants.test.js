import assert from "node:assert/strict";
import test from "node:test";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/lensaya_test";
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret";
}
if (!process.env.R2_PUBLIC_URL) {
  process.env.R2_PUBLIC_URL = "https://cdn.example.test";
}

const {
  buildVariantObjectKey,
  hasProcessedVariants,
  listAssetObjectKeys,
  resolveAssetUrl,
} = await import("./assetVariants.js");

const makeAsset = (variants = {}, extra = {}) => ({
  objectKey: "uploads/photographer/image.jpg",
  cdnUrl: "https://cdn.example.test/uploads/photographer/image.jpg",
  metadata: {
    variants,
  },
  ...extra,
});

test("buildVariantObjectKey keeps the original path and appends the variant name", () => {
  assert.equal(
    buildVariantObjectKey("uploads/photographer/image.jpg", "thumbnail"),
    "uploads/photographer/image-thumbnail.webp"
  );
  assert.equal(
    buildVariantObjectKey("uploads/photographer/image.jpg", "display"),
    "uploads/photographer/image-display.webp"
  );
});

test("resolveAssetUrl prefers the requested new variant names", () => {
  const asset = makeAsset({
    original: { objectKey: "uploads/photographer/image.jpg" },
    thumbnail: { objectKey: "uploads/photographer/image-thumbnail.webp" },
    preview: { objectKey: "uploads/photographer/image-preview.webp" },
    display: { objectKey: "uploads/photographer/image-display.webp" },
  });

  assert.equal(
    resolveAssetUrl(asset, "thumb"),
    "https://cdn.example.test/uploads/photographer/image-thumbnail.webp"
  );
  assert.equal(
    resolveAssetUrl(asset, "preview"),
    "https://cdn.example.test/uploads/photographer/image-preview.webp"
  );
  assert.equal(
    resolveAssetUrl(asset, "web"),
    "https://cdn.example.test/uploads/photographer/image-display.webp"
  );
});

test("resolveAssetUrl falls back to legacy variant names", () => {
  const asset = makeAsset({
    original: { objectKey: "uploads/photographer/image.jpg" },
    thumb: { objectKey: "uploads/photographer/image-thumb.webp" },
    web: { objectKey: "uploads/photographer/image-web.webp" },
  });

  assert.equal(
    resolveAssetUrl(asset, "thumbnail"),
    "https://cdn.example.test/uploads/photographer/image-thumb.webp"
  );
  assert.equal(resolveAssetUrl(asset, "display"), "https://cdn.example.test/uploads/photographer/image-web.webp");
});

test("hasProcessedVariants recognises old and new payload shapes", () => {
  assert.equal(
    hasProcessedVariants(
      makeAsset({
        original: { objectKey: "uploads/photographer/image.jpg" },
      })
    ),
    false
  );

  assert.equal(
    hasProcessedVariants(
      makeAsset({
        original: { objectKey: "uploads/photographer/image.jpg" },
        thumb: { objectKey: "uploads/photographer/image-thumb.webp" },
        web: { objectKey: "uploads/photographer/image-web.webp" },
      })
    ),
    true
  );

  assert.equal(
    hasProcessedVariants(
      makeAsset({
        original: { objectKey: "uploads/photographer/image.jpg" },
        thumbnail: { objectKey: "uploads/photographer/image-thumbnail.webp" },
        preview: { objectKey: "uploads/photographer/image-preview.webp" },
      })
    ),
    true
  );
});

test("listAssetObjectKeys deduplicates alias object keys", () => {
  const keys = listAssetObjectKeys(
    makeAsset({
      original: { objectKey: "uploads/photographer/image.jpg" },
      thumbnail: { objectKey: "uploads/photographer/image-thumbnail.webp" },
      thumb: { objectKey: "uploads/photographer/image-thumbnail.webp" },
      display: { objectKey: "uploads/photographer/image-display.webp" },
      web: { objectKey: "uploads/photographer/image-display.webp" },
    })
  ).sort();

  assert.deepEqual(
    keys,
    [
      "uploads/photographer/image-display.webp",
      "uploads/photographer/image-thumbnail.webp",
      "uploads/photographer/image.jpg",
    ].sort()
  );
});
