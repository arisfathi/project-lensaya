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

export const processAnalyticsEventJob = async (payload = {}, context = {}) => {
  const eventId = toEventId(payload?.eventId);
  if (!eventId) {
    return { skipped: true, reason: "Missing eventId" };
  }

  const event = await prisma.analyticsEvent.findUnique({
    where: { id: eventId },
    select: { id: true, eventType: true, photographerId: true, createdAt: true },
  });

  if (!event) {
    return { skipped: true, reason: "Event not found" };
  }

  logger.info(
    {
      queue: context.queue || null,
      jobId: context.jobId || null,
      requestId: payload?.requestId || null,
      mode: context.mode || "queue",
      analyticsEventId: event.id.toString(),
      eventType: event.eventType,
      photographerId: event.photographerId || null,
    },
    "Analytics event processed"
  );

  return { processed: true, analyticsEventId: event.id.toString() };
};

