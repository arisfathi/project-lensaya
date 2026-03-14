import os from "node:os";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { redis, isRedisConfigured } from "../config/redis.js";
import { captureException } from "../config/sentry.js";

export const WORKER_HEARTBEAT_REGISTRY_KEY = "lensaya:worker:registry";
export const WORKER_HEARTBEAT_KEY_PREFIX = "lensaya:worker:heartbeat";

const nowIso = () => new Date().toISOString();

const safeDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date;
};

const toHeartbeatPayload = (state) => {
  const now = nowIso();
  state.lastHeartbeatAt = now;

  return {
    workerId: state.workerId,
    workerType: state.workerType,
    queue: state.queue,
    mode: state.mode,
    hostname: state.hostname,
    pid: state.pid,
    startedAt: state.startedAt,
    lastHeartbeatAt: state.lastHeartbeatAt,
  };
};

const publishHeartbeat = async (state) => {
  if (!isRedisConfigured || !redis) return false;

  const payload = toHeartbeatPayload(state);
  await redis
    .multi()
    .set(state.redisKey, JSON.stringify(payload), "EX", state.ttlSeconds)
    .sadd(WORKER_HEARTBEAT_REGISTRY_KEY, state.redisKey)
    .exec();

  return true;
};

const removeHeartbeat = async (state) => {
  if (!isRedisConfigured || !redis) return;

  await redis.multi().del(state.redisKey).srem(WORKER_HEARTBEAT_REGISTRY_KEY, state.redisKey).exec();
};

export const startWorkerHeartbeat = async ({ queue, workerType, mode = "queue" }) => {
  const state = {
    workerId: `${workerType || queue || "worker"}:${process.pid}:${randomUUID()}`,
    workerType: String(workerType || "worker"),
    queue: String(queue || ""),
    mode: String(mode || "queue"),
    hostname: os.hostname(),
    pid: process.pid,
    startedAt: nowIso(),
    lastHeartbeatAt: nowIso(),
    intervalMs: env.monitoring.workerHeartbeatIntervalMs,
    ttlSeconds: env.monitoring.workerHeartbeatTtlSec,
  };
  state.redisKey = `${WORKER_HEARTBEAT_KEY_PREFIX}:${state.workerId}`;

  let timer = null;
  let stopped = false;

  const safePublish = async (action) => {
    if (stopped) return false;
    try {
      return await publishHeartbeat(state);
    } catch (error) {
      logger.error(
        {
          err: error,
          workerId: state.workerId,
          queue: state.queue,
          workerType: state.workerType,
          action,
        },
        "Failed to publish worker heartbeat"
      );
      captureException(error, {
        workerId: state.workerId,
        queue: state.queue,
        workerType: state.workerType,
        action,
      });
      return false;
    }
  };

  await safePublish("start");

  if (isRedisConfigured && redis) {
    timer = setInterval(() => {
      void safePublish("heartbeat");
    }, state.intervalMs);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }

  return {
    workerId: state.workerId,
    async touch(action = "touch") {
      return safePublish(action);
    },
    async setMode(nextMode) {
      state.mode = String(nextMode || state.mode || "queue");
      return safePublish("mode-update");
    },
    async stop() {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      try {
        await removeHeartbeat(state);
      } catch (error) {
        logger.error(
          {
            err: error,
            workerId: state.workerId,
            queue: state.queue,
            workerType: state.workerType,
          },
          "Failed to remove worker heartbeat"
        );
        captureException(error, {
          workerId: state.workerId,
          queue: state.queue,
          workerType: state.workerType,
          action: "stop",
        });
      }
    },
    getSnapshot() {
      const startedAt = safeDate(state.startedAt)?.toISOString() || nowIso();
      const lastHeartbeatAt = safeDate(state.lastHeartbeatAt)?.toISOString() || nowIso();
      return {
        workerId: state.workerId,
        workerType: state.workerType,
        queue: state.queue,
        mode: state.mode,
        hostname: state.hostname,
        pid: state.pid,
        startedAt,
        lastHeartbeatAt,
      };
    },
  };
};
