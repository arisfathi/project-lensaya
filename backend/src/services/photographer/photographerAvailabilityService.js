import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/apiError.js";
import { applyTenantFilter } from "../../utils/tenantQuery.js";
import {
  monthRange,
  normalizeAvailabilityStatusValue,
  requireTenantPhotographerId,
  toNormalizedAvailabilityDayStatus,
  toUtcDateKey,
} from "./photographerService.utils.js";

export const photographerAvailabilityService = {
  async getAvailability(tenant, month) {
    const { target, start, end } = monthRange(month);

    const days = await prisma.availability.findMany(
      applyTenantFilter(
        {
          where: {
            date: { gte: start, lt: end },
          },
          orderBy: { date: "asc" },
        },
        tenant
      )
    );

    return {
      month: target,
      days: days.map((d) => ({ date: d.date, status: toNormalizedAvailabilityDayStatus(d.status) })),
    };
  },

  async patchAvailability(tenant, updates) {
    const photographerId = requireTenantPhotographerId(tenant);
    const todayKey = toUtcDateKey(new Date());

    let updatedCount = 0;
    for (const change of updates) {
      const changeDate = new Date(change.date);
      if (Number.isNaN(changeDate.getTime())) {
        throw new ApiError(400, "Invalid availability date");
      }

      const dateKey = toUtcDateKey(changeDate);
      if (dateKey < todayKey) {
        throw new ApiError(400, "Past dates cannot be updated");
      }

      const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const normalizedStatus = normalizeAvailabilityStatusValue(change.status);

      await prisma.availability.upsert({
        where: {
          photographerId_date: {
            photographerId,
            date: dayStart,
          },
        },
        update: {
          status: normalizedStatus,
        },
        create: {
          photographerId,
          date: dayStart,
          status: normalizedStatus,
        },
      });
      updatedCount += 1;
    }

    return {
      month: updates[0]?.date?.slice(0, 7) || new Date().toISOString().slice(0, 7),
      updatedCount,
    };
  },
};
