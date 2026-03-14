import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CHIP_WEBHOOK_SECRET = process.env.CHIP_WEBHOOK_SECRET || "chip-webhook-secret";

const { app } = await import("../src/app.js");
const { queueMonitoringService } = await import("../src/services/queueMonitoringService.js");
const { adminService } = await import("../src/services/adminService.js");
const { signAccessToken } = await import("../src/utils/jwt.js");

const makeToken = (sub, role = "PHOTOGRAPHER") =>
  signAccessToken({
    sub,
    role,
    email: `${sub}@example.com`,
    username: sub,
  });

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

test("GET /health returns worker monitoring summary", async () => {
  await withMethodPatches(
    [
      {
        target: queueMonitoringService,
        method: "getPublicHealthSummary",
        fn: async () => ({
          status: "ok",
          checkedAt: "2026-03-12T00:00:00.000Z",
          queueBacklog: 3,
          degradedQueues: 0,
          liveWorkers: 4,
          staleWorkers: 1,
          redisEnabled: true,
        }),
      },
    ],
    async () => {
      const res = await request(app).get("/health");

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, "ok");
      assert.equal(res.body.data.workers.liveWorkers, 4);
      assert.equal(res.body.data.workers.queueBacklog, 3);
    }
  );
});

test("GET /health degrades gracefully when worker monitoring fails", async () => {
  await withMethodPatches(
    [
      {
        target: queueMonitoringService,
        method: "getPublicHealthSummary",
        fn: async () => {
          throw new Error("monitoring unavailable");
        },
      },
    ],
    async () => {
      const res = await request(app).get("/health");

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, "degraded");
      assert.equal(res.body.data.workers.status, "degraded");
    }
  );
});

test("GET /api/v1/admin/system/worker-health returns detailed worker metrics for internal admin ops", async () => {
  await withMethodPatches(
    [
      {
        target: adminService,
        method: "workerHealth",
        fn: async () => ({
          checkedAt: "2026-03-12T00:00:00.000Z",
          status: "degraded",
          summary: {
            queueBacklog: 42,
            queueCount: 6,
            degradedQueues: 2,
            disabledQueues: 0,
            liveWorkers: 2,
            staleWorkers: 1,
            redisEnabled: true,
          },
          queues: [
            {
              queue: "imageProcessingQueue",
              status: "degraded",
              reason: "backlog-without-live-worker",
              backlog: 42,
              counts: {
                waiting: 40,
                delayed: 2,
                prioritized: 0,
                active: 0,
                failed: 1,
                paused: 0,
              },
              workers: {
                live: 0,
                stale: 1,
                total: 1,
                items: [],
              },
              error: null,
            },
          ],
          workers: {
            ttlSeconds: 120,
            intervalMs: 30000,
            items: [],
          },
          errors: [],
        }),
      },
    ],
    async () => {
      const res = await request(app)
        .get("/api/v1/admin/system/worker-health")
        .set("Authorization", `Bearer ${makeToken("admin-user", "ADMIN")}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, "degraded");
      assert.equal(res.body.data.summary.queueBacklog, 42);
      assert.equal(res.body.data.queues[0].queue, "imageProcessingQueue");
    }
  );
});
