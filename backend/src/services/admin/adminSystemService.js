import { prisma } from "../../config/prisma.js";
import { getPagination, buildPagination } from "../../utils/pagination.js";
import { queueMonitoringService } from "../queueMonitoringService.js";
import { parseLogRangeStart } from "./adminService.utils.js";

export const adminSystemService = {
  async systemLogs(query) {
    const { page, limit, skip, take } = getPagination(query);
    const rangeStart = parseLogRangeStart(query.range);
    const eventType = query.eventType ? String(query.eventType).trim() : "";
    const where = {
      ...(query.q
        ? {
            OR: [
              { action: { contains: query.q, mode: "insensitive" } },
              { resourceType: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(eventType
        ? {
            action: {
              contains: eventType,
              mode: "insensitive",
            },
          }
        : {}),
      ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.adminLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.adminLog.count({ where }),
    ]);

    return {
      items: items.map((log) => ({
        id: log.id.toString(),
        timestamp: log.createdAt,
        event: log.action,
        user: log.actorUserId,
        ip: log.ipAddress,
        status: log.level,
        details: log.details,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },

  async workerHealth() {
    return queueMonitoringService.getWorkerHealth();
  },
};

