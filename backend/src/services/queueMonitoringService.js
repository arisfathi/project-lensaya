import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { redis, isRedisConfigured } from "../config/redis.js";
import { captureException } from "../config/sentry.js";
import { isQueueAvailable } from "../jobs/queueFactory.js";
import { WORKER_HEARTBEAT_REGISTRY_KEY } from "../jobs/workerHeartbeat.js";
import { ANALYTICS_QUEUE_NAME, analyticsQueue } from "../jobs/analyticsQueue.js";
import { EMAIL_QUEUE_NAME, emailQueue } from "../jobs/emailQueue.js";
import { IMAGE_PROCESSING_QUEUE_NAME, imageProcessingQueue } from "../jobs/imageProcessingQueue.js";
import { NOTIFICATION_QUEUE_NAME, notificationQueue } from "../jobs/notificationQueue.js";
import { ASSET_CLEANUP_QUEUE_NAME, assetCleanupQueue } from "../jobs/assetCleanupQueue.js";
import { BILLING_MAINTENANCE_QUEUE_NAME, billingMaintenanceQueue } from "../jobs/billingMaintenanceQueue.js";

const QUEUE_COUNT_KEYS = ["waiting", "active", "delayed", "failed", "paused", "prioritized"];

const MONITORED_QUEUES = [
  { queueName: ANALYTICS_QUEUE_NAME, queue: analyticsQueue, workerType: "analytics" },
  { queueName: EMAIL_QUEUE_NAME, queue: emailQueue, workerType: "email" },
  { queueName: IMAGE_PROCESSING_QUEUE_NAME, queue: imageProcessingQueue, workerType: "image-processing" },
  { queueName: NOTIFICATION_QUEUE_NAME, queue: notificationQueue, workerType: "notification" },
  { queueName: ASSET_CLEANUP_QUEUE_NAME, queue: assetCleanupQueue, workerType: "asset-cleanup" },
  { queueName: BILLING_MAINTENANCE_QUEUE_NAME, queue: billingMaintenanceQueue, workerType: "billing-maintenance" },
];

const nowIso = () => new Date().toISOString();

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const toIsoOrNull = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const summarizeQueueCounts = (counts = {}) => {
  const waiting = asNumber(counts.waiting);
  const delayed = asNumber(counts.delayed);
  const prioritized = asNumber(counts.prioritized);
  const active = asNumber(counts.active);
  const failed = asNumber(counts.failed);
  const paused = asNumber(counts.paused);

  return {
    waiting,
    delayed,
    prioritized,
    active,
    failed,
    paused,
    backlog: waiting + delayed + prioritized,
  };
};

const safeQueueCounts = async ({ queueName, queue }) => {
  if (!isQueueAvailable || !queue || typeof queue.getJobCounts !== "function") {
    return {
      queueName,
      counts: summarizeQueueCounts(),
      status: "disabled",
      error: null,
    };
  }

  try {
    const counts = await queue.getJobCounts(...QUEUE_COUNT_KEYS);
    return {
      queueName,
      counts: summarizeQueueCounts(counts),
      status: "ok",
      error: null,
    };
  } catch (error) {
    logger.error({ err: error, queue: queueName }, "Failed to fetch queue backlog counts");
    captureException(error, {
      queue: queueName,
      action: "queue-counts",
    });
    return {
      queueName,
      counts: summarizeQueueCounts(),
      status: "error",
      error: String(error?.message || "Queue metrics unavailable"),
    };
  }
};

const parseWorkerSnapshot = (raw) => {
  if (!raw || typeof raw !== "string") return null;

  try {
    const parsed = JSON.parse(raw);
    return {
      workerId: String(parsed.workerId || ""),
      workerType: String(parsed.workerType || "worker"),
      queue: String(parsed.queue || ""),
      mode: String(parsed.mode || "queue"),
      hostname: String(parsed.hostname || ""),
      pid: asNumber(parsed.pid, null),
      startedAt: toIsoOrNull(parsed.startedAt),
      lastHeartbeatAt: toIsoOrNull(parsed.lastHeartbeatAt),
    };
  } catch {
    return null;
  }
};

const loadWorkerHeartbeats = async () => {
  if (!isRedisConfigured || !redis) {
    return {
      redisEnabled: false,
      workers: [],
      staleWorkers: 0,
      liveWorkers: 0,
      errors: [],
    };
  }

  try {
    const heartbeatKeys = await redis.smembers(WORKER_HEARTBEAT_REGISTRY_KEY);
    if (!Array.isArray(heartbeatKeys) || heartbeatKeys.length === 0) {
      return {
        redisEnabled: true,
        workers: [],
        staleWorkers: 0,
        liveWorkers: 0,
        errors: [],
      };
    }

    const pipeline = redis.multi();
    heartbeatKeys.forEach((key) => {
      pipeline.get(key);
    });
    const results = await pipeline.exec();
    const invalidKeys = [];
    const now = Date.now();
    const workers = [];
    const ttlSeconds = env.monitoring.workerHeartbeatTtlSec;

    for (let index = 0; index < heartbeatKeys.length; index += 1) {
      const key = heartbeatKeys[index];
      const [error, value] = results?.[index] || [];

      if (error || !value) {
        invalidKeys.push(key);
        continue;
      }

      const parsed = parseWorkerSnapshot(value);
      if (!parsed || !parsed.workerId || !parsed.queue) {
        invalidKeys.push(key);
        continue;
      }

      const heartbeatDate = parsed.lastHeartbeatAt ? new Date(parsed.lastHeartbeatAt) : null;
      const heartbeatMs =
        heartbeatDate && !Number.isNaN(heartbeatDate.getTime()) ? heartbeatDate.getTime() : now - ttlSeconds * 1000;
      const heartbeatAgeSeconds = Math.max(0, Math.floor((now - heartbeatMs) / 1000));
      const isLive = heartbeatAgeSeconds <= ttlSeconds;

      workers.push({
        ...parsed,
        heartbeatAgeSeconds,
        isLive,
      });
    }

    if (invalidKeys.length > 0) {
      await redis.srem(WORKER_HEARTBEAT_REGISTRY_KEY, ...invalidKeys);
    }

    const liveWorkers = workers.filter((worker) => worker.isLive).length;
    const staleWorkers = Math.max(0, workers.length - liveWorkers);

    workers.sort((a, b) => {
      if (a.queue !== b.queue) return a.queue.localeCompare(b.queue);
      return a.workerId.localeCompare(b.workerId);
    });

    return {
      redisEnabled: true,
      workers,
      staleWorkers,
      liveWorkers,
      errors: [],
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to load worker heartbeats");
    captureException(error, { action: "worker-heartbeats" });
    return {
      redisEnabled: true,
      workers: [],
      staleWorkers: 0,
      liveWorkers: 0,
      errors: [String(error?.message || "Worker heartbeat metrics unavailable")],
    };
  }
};

const buildQueueStatus = ({ queueMeta, queueCounts, workers }) => {
  const matchingWorkers = workers.filter((worker) => worker.queue === queueMeta.queueName);
  const liveWorkers = matchingWorkers.filter((worker) => worker.isLive);
  const staleWorkers = matchingWorkers.filter((worker) => !worker.isLive);
  const counts = queueCounts.counts;
  const warnThreshold = env.monitoring.workerBacklogWarnThreshold;

  let status = "ok";
  let reason = "healthy";

  if (queueCounts.status === "disabled") {
    status = "disabled";
    reason = "queue-disabled";
  } else if (queueCounts.status === "error") {
    status = "degraded";
    reason = "queue-metrics-unavailable";
  } else if (counts.backlog >= warnThreshold && liveWorkers.length === 0) {
    status = "degraded";
    reason = "backlog-without-live-worker";
  } else if (counts.backlog > 0 && liveWorkers.length === 0) {
    status = "degraded";
    reason = "backlog-without-worker";
  } else if (staleWorkers.length > 0 && liveWorkers.length === 0) {
    status = "degraded";
    reason = "worker-heartbeat-stale";
  } else if (liveWorkers.length === 0) {
    status = "idle";
    reason = "no-live-worker-detected";
  }

  return {
    queue: queueMeta.queueName,
    workerType: queueMeta.workerType,
    status,
    reason,
    backlog: counts.backlog,
    counts: {
      waiting: counts.waiting,
      delayed: counts.delayed,
      prioritized: counts.prioritized,
      active: counts.active,
      failed: counts.failed,
      paused: counts.paused,
    },
    workers: {
      live: liveWorkers.length,
      stale: staleWorkers.length,
      total: matchingWorkers.length,
      items: matchingWorkers,
    },
    error: queueCounts.error,
  };
};

const buildOverallStatus = ({ redisEnabled, queueDetails, workerMetrics }) => {
  const degradedQueues = queueDetails.filter((queue) => queue.status === "degraded");
  const disabledQueues = queueDetails.filter((queue) => queue.status === "disabled");
  const backlogJobs = queueDetails.reduce((total, queue) => total + asNumber(queue.backlog), 0);

  let status = "ok";
  if (!redisEnabled) {
    status = "degraded";
  }
  if (degradedQueues.length > 0) {
    status = "degraded";
  }
  if (disabledQueues.length === queueDetails.length && queueDetails.length > 0) {
    status = "degraded";
  }

  return {
    status,
    summary: {
      queueBacklog: backlogJobs,
      queueCount: queueDetails.length,
      degradedQueues: degradedQueues.length,
      disabledQueues: disabledQueues.length,
      liveWorkers: workerMetrics.liveWorkers,
      staleWorkers: workerMetrics.staleWorkers,
      redisEnabled,
    },
  };
};

export const queueMonitoringService = {
  async getWorkerHealth() {
    const checkedAt = nowIso();
    const [workerMetrics, queueMetrics] = await Promise.all([
      loadWorkerHeartbeats(),
      Promise.all(MONITORED_QUEUES.map((queueMeta) => safeQueueCounts(queueMeta))),
    ]);

    const queueDetails = MONITORED_QUEUES.map((queueMeta) => {
      const counts = queueMetrics.find((item) => item.queueName === queueMeta.queueName) || {
        queueName: queueMeta.queueName,
        counts: summarizeQueueCounts(),
        status: "error",
        error: "Queue metrics unavailable",
      };

      return buildQueueStatus({
        queueMeta,
        queueCounts: counts,
        workers: workerMetrics.workers,
      });
    });

    const overall = buildOverallStatus({
      redisEnabled: workerMetrics.redisEnabled,
      queueDetails,
      workerMetrics,
    });

    return {
      checkedAt,
      status: overall.status,
      summary: overall.summary,
      queues: queueDetails,
      workers: {
        ttlSeconds: env.monitoring.workerHeartbeatTtlSec,
        intervalMs: env.monitoring.workerHeartbeatIntervalMs,
        items: workerMetrics.workers,
      },
      errors: workerMetrics.errors,
    };
  },

  async getPublicHealthSummary() {
    const report = await this.getWorkerHealth();
    return {
      status: report.status,
      checkedAt: report.checkedAt,
      queueBacklog: report.summary.queueBacklog,
      degradedQueues: report.summary.degradedQueues,
      liveWorkers: report.summary.liveWorkers,
      staleWorkers: report.summary.staleWorkers,
      redisEnabled: report.summary.redisEnabled,
    };
  },
};
