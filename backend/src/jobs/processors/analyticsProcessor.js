import { prisma } from "../../config/prisma.js";
import { logger } from "../../config/logger.js";

const toEventId = (value) => {
  if (value === undefined || value === null || value === "") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const toUtcDateOnly = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const normalizeSource = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || "direct";
};

export const processAnalyticsEventJob = async (payload = {}, context = {}) => {
  const eventId = toEventId(payload?.eventId);
  if (!eventId) {
    return { skipped: true, reason: "Missing eventId" };
  }

  const event = await prisma.analyticsEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      eventType: true,
      photographerId: true,
      serviceId: true,
      visitorId: true,
      source: true,
      createdAt: true,
    },
  });

  if (!event) {
    return { skipped: true, reason: "Event not found" };
  }

  if (!event.photographerId) {
    return { skipped: true, reason: "Missing photographerId" };
  }

  const dayDate = toUtcDateOnly(event.createdAt);
  if (!dayDate) {
    return { skipped: true, reason: "Invalid createdAt" };
  }

  const source = normalizeSource(event.source);
  const visitorId = String(event.visitorId || "").trim();

  await prisma.$transaction(async (tx) => {
    await tx.analyticsDailyEventRollup.upsert({
      where: {
        photographerId_date_eventType_source: {
          photographerId: event.photographerId,
          date: dayDate,
          eventType: event.eventType,
          source,
        },
      },
      update: {
        eventCount: { increment: 1 },
      },
      create: {
        photographerId: event.photographerId,
        date: dayDate,
        eventType: event.eventType,
        source,
        eventCount: 1,
      },
    });

    if (event.serviceId) {
      await tx.analyticsDailyServiceRollup.upsert({
        where: {
          photographerId_date_serviceId_eventType: {
            photographerId: event.photographerId,
            date: dayDate,
            serviceId: event.serviceId,
            eventType: event.eventType,
          },
        },
        update: {
          eventCount: { increment: 1 },
        },
        create: {
          photographerId: event.photographerId,
          date: dayDate,
          serviceId: event.serviceId,
          eventType: event.eventType,
          eventCount: 1,
        },
      });
    }

    if (visitorId) {
      await tx.analyticsDailyVisitorRollup.upsert({
        where: {
          photographerId_date_visitorId: {
            photographerId: event.photographerId,
            date: dayDate,
            visitorId,
          },
        },
        update: {},
        create: {
          photographerId: event.photographerId,
          date: dayDate,
          visitorId,
        },
      });
    }
  });

  logger.info(
    {
      queue: context.queue || null,
      jobId: context.jobId || null,
      requestId: payload?.requestId || null,
      mode: context.mode || "queue",
      analyticsEventId: event.id.toString(),
      eventType: event.eventType,
      photographerId: event.photographerId,
      rollupDate: dayDate.toISOString().slice(0, 10),
    },
    "Analytics event processed"
  );

  return { processed: true, analyticsEventId: event.id.toString() };
};
