import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { enqueueNotificationCreate, enqueueNotificationCreateMany } from "../jobs/notificationQueue.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { ApiError } from "../utils/apiError.js";

const mapNotification = (record) => ({
  id: record.id,
  type: record.type.toLowerCase(),
  title: record.title,
  body: record.body,
  read: Boolean(record.readAt),
  createdAt: record.createdAt,
});

const normalizeNotificationPayload = (payload = {}) => {
  const userId = String(payload.userId || "").trim();
  const title = String(payload.title || "").trim();
  const body = String(payload.body || "").trim();

  if (!userId || !title || !body) {
    return null;
  }

  return {
    userId,
    type: String(payload.type || "SYSTEM").toUpperCase(),
    title: title.slice(0, 191),
    body,
    actionUrl: payload.actionUrl || null,
    bookingId: payload.bookingId || null,
    subscriptionId: payload.subscriptionId || null,
    requestId: payload.requestId || null,
  };
};

const normalizeNotificationRows = (payloads = []) =>
  (Array.isArray(payloads) ? payloads : [])
    .map((item) => normalizeNotificationPayload(item))
    .filter(Boolean);

const createDirect = async (payload) => {
  const row = normalizeNotificationPayload(payload);
  if (!row) return null;

  const { requestId: _requestId, ...data } = row;
  return prisma.notification.create({ data });
};

const createManyDirect = async (payloads = []) => {
  const rows = normalizeNotificationRows(payloads).map((row) => {
    const { requestId: _requestId, ...data } = row;
    return data;
  });

  if (rows.length === 0) {
    return { count: 0 };
  }

  return prisma.notification.createMany({
    data: rows,
  });
};

export const notificationService = {
  async create(payload, options = {}) {
    const row = normalizeNotificationPayload(payload);
    if (!row) return null;

    try {
      const job = await enqueueNotificationCreate(row);
      if (job) return job;
    } catch (error) {
      logger.error({ err: error, requestId: row.requestId || null }, "Failed to dispatch notification create job");
      captureException(error, {
        service: "notificationService",
        action: "create",
        requestId: row.requestId || null,
      });
    }

    if (options.requirePersistence !== false) {
      return createDirect(row);
    }

    return null;
  },

  async createMany(payloads = [], options = {}) {
    const rows = normalizeNotificationRows(payloads);
    if (!rows.length) return { count: 0 };

    try {
      const job = await enqueueNotificationCreateMany({ items: rows });
      if (job) return job;
    } catch (error) {
      logger.error({ err: error }, "Failed to dispatch notification batch job");
      captureException(error, {
        service: "notificationService",
        action: "createMany",
      });
    }

    if (options.requirePersistence !== false) {
      return createManyDirect(rows);
    }

    return { count: 0 };
  },

  async createAsync(payload, options = {}) {
    return this.create(payload, {
      requirePersistence: options.requirePersistence === true,
    });
  },

  async createManyAsync(payloads = [], options = {}) {
    return this.createMany(payloads, {
      requirePersistence: options.requirePersistence === true,
    });
  },

  async list(userId, query) {
    const { page, limit, skip, take } = getPagination(query);
    const unreadOnly =
      query.unreadOnly === true ||
      query.unreadOnly === "true" ||
      query.unreadOnly === 1 ||
      query.unreadOnly === "1";

    const where = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      items: items.map(mapNotification),
      unreadCount,
      pagination: buildPagination(page, limit, total),
    };
  },

  async markRead(userId, id) {
    const updated = await prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (!updated.count) throw new ApiError(404, "Notification not found");

    return { id, read: true };
  },

  async markReadByPayload(userId, payload = {}) {
    const now = new Date();
    const normalizedIds = Array.from(
      new Set(
        [payload.id, ...(Array.isArray(payload.ids) ? payload.ids : [])]
          .filter(Boolean)
          .map((id) => String(id))
      )
    );

    if (payload.all === true) {
      const updated = await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: now },
      });
      return { read: true, markedCount: updated.count };
    }

    if (normalizedIds.length === 0) {
      throw new ApiError(400, "Notification id is required");
    }

    const updated = await prisma.notification.updateMany({
      where: {
        userId,
        id: { in: normalizedIds },
      },
      data: { readAt: now },
    });

    if (!updated.count) {
      throw new ApiError(404, "Notification not found");
    }

    if (normalizedIds.length === 1) {
      return { id: normalizedIds[0], read: true, markedCount: updated.count };
    }

    return { ids: normalizedIds, read: true, markedCount: updated.count };
  },
};
