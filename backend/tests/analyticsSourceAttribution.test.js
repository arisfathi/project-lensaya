import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { prisma } = await import("../src/config/prisma.js");
const { analyticsService } = await import("../src/services/analyticsService.js");

const withMethodPatches = async (patches, callback) => {
  const originals = patches.map((patch) => ({
    target: patch.target,
    method: patch.method,
    original: patch.target[patch.method],
  }));

  for (const patch of patches) {
    patch.target[patch.method] = patch.fn;
  }

  try {
    await callback();
  } finally {
    for (const original of originals) {
      original.target[original.method] = original.original;
    }
  }
};

const ingestAndCapture = async (eventOverrides = {}) => {
  let capturedData = null;

  await withMethodPatches(
    [
      {
        target: prisma.analyticsEvent,
        method: "create",
        fn: async ({ data }) => {
          capturedData = data;
          return { id: 1n, ...data, createdAt: new Date("2026-04-01T00:00:00.000Z") };
        },
      },
    ],
    async () => {
      await analyticsService.ingest({
        eventType: "OTHER",
        photographerId: "11111111-1111-4111-8111-111111111111",
        ...eventOverrides,
      });
    }
  );

  return capturedData;
};

test("analytics ingest resolves source from utm_source query and prioritizes it over payload source", async () => {
  const data = await ingestAndCapture({
    source: "direct",
    pageUrl: "https://studio.example/p/jane?utm_source=instagram&utm_medium=social",
    path: "/p/jane?utm_source=instagram&utm_medium=social",
  });

  assert.equal(data.source, "instagram");
});

test("analytics ingest resolves source from source query param", async () => {
  const data = await ingestAndCapture({
    pageUrl: "https://studio.example/p/jane?source=facebook_ads",
    path: "/p/jane?source=facebook_ads",
  });

  assert.equal(data.source, "facebook");
});

test("analytics ingest maps click-id query params to canonical sources", async () => {
  const cases = [
    { label: "gclid", pageUrl: "https://studio.example/p/jane?gclid=abc123", expected: "search" },
    { label: "fbclid", pageUrl: "https://studio.example/p/jane?fbclid=abc123", expected: "facebook" },
    { label: "ttclid", pageUrl: "https://studio.example/p/jane?ttclid=abc123", expected: "tiktok" },
  ];

  for (const item of cases) {
    const data = await ingestAndCapture({
      pageUrl: item.pageUrl,
      path: item.pageUrl.replace("https://studio.example", ""),
    });

    assert.equal(data.source, item.expected, `Expected ${item.label} to map to ${item.expected}`);
  }
});

test("analytics ingest resolves referral-style query signals", async () => {
  const data = await ingestAndCapture({
    pageUrl: "https://studio.example/p/jane?ref=REF-ABC123",
    path: "/p/jane?ref=REF-ABC123",
  });

  assert.equal(data.source, "referral");
});

test("analytics ingest classifies external referrer host", async () => {
  const data = await ingestAndCapture({
    referrer: "https://www.instagram.com/stories/some-account",
    requestHost: "studio.example",
    pageUrl: "https://studio.example/p/jane",
  });

  assert.equal(data.source, "instagram");
});

test("analytics ingest treats same-site referrer as direct", async () => {
  const data = await ingestAndCapture({
    referrer: "https://studio.example/gallery",
    requestHost: "studio.example",
    pageUrl: "https://studio.example/p/jane",
  });

  assert.equal(data.source, "direct");
});

test("analytics ingest falls back to direct without any attribution context", async () => {
  const data = await ingestAndCapture({});

  assert.equal(data.source, "direct");
});

test("analytics ingest normalizes unknown source labels to other", async () => {
  const data = await ingestAndCapture({
    source: "My Custom Channel",
  });

  assert.equal(data.source, "other");
});
