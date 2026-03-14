import { prisma } from "../../config/prisma.js";
import { logger } from "../../config/logger.js";

const normalizeType = (value) => {
  const normalized = String(value || "SYSTEM").trim().toUpperCase();
  return normalized || "SYSTEM";
};

const normalizeRow = (payload = {}) => {
  const userId = String(payload.userId || "").trim();
  const title = String(payload.title || "").trim();
  const body = String(payload.body || "").trim();

  if (!userId || !title || !body) {
    return null;
  }

  return {
    userId,
    type: normalizeType(payload.type),
    title: title.slice(0, 191),
    body,
    actionUrl: payload.actionUrl || null,
    bookingId: payload.bookingId || null,
    subscriptionId: payload.subscriptionId || null,
  };
};

export const processNotificationCreateJob = async (payload = {}, context = {}) => {
  const row = normalizeRow(payload);
  if (!row) {
    return { skipped: true, reason: "invalid-payload" };
  }

  const created = await prisma.notification.create({
    data: row,
  });

  logger.debug(
    {
      queue: context.queue || null,
      jobId: context.jobId || null,
      requestId: payload?.requestId || null,
      notificationId: created.id,
      userId: row.userId,
    },
    "Notification job processed"
  );

  return { processed: true, notificationId: created.id };
};

export const processNotificationCreateManyJob = async (payload = {}, context = {}) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) {
    return { skipped: true, reason: "empty-items" };
  }

  const rows = items.map((item) => normalizeRow(item)).filter(Boolean);
  if (!rows.length) {
    return { skipped: true, reason: "invalid-items" };
  }

  const result = await prisma.notification.createMany({
    data: rows,
  });

  logger.debug(
    {
      queue: context.queue || null,
      jobId: context.jobId || null,
      requestId: payload?.requestId || null,
      count: result.count,
    },
    "Notification batch job processed"
  );

  return { processed: true, count: result.count };
};
