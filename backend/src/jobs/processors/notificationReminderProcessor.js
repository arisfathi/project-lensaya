import { prisma } from "../../config/prisma.js";
import { logger } from "../../config/logger.js";
import { env } from "../../config/env.js";

const HOURS_24_MS = 24 * 60 * 60 * 1000;
const HOURS_72_MS = 72 * 60 * 60 * 1000;
const REMINDER_24_TITLE = "Pending booking follow-up (24h)";
const REMINDER_72_TITLE = "Pending booking follow-up (72h)";

const buildReminderPayload = (booking, level) => {
  if (!booking?.photographer?.userId) return null;

  const reminderTitle = level === 72 ? REMINDER_72_TITLE : REMINDER_24_TITLE;
  const clientName = String(booking.clientName || "Client").trim() || "Client";
  const preferredDate = booking.preferredDate ? new Date(booking.preferredDate).toLocaleDateString("en-US") : "No date";

  return {
    userId: booking.photographer.userId,
    type: "BOOKING",
    title: reminderTitle,
    body: `${clientName} inquiry is still pending (${level}h). Preferred date: ${preferredDate}.`,
    actionUrl: "/dashboard/availability",
    bookingId: booking.id,
  };
};

const hasReminderTitle = (notifications = [], title) =>
  notifications.some((item) => String(item?.title || "").trim() === title);

export const processNotificationReminderScanJob = async (payload = {}, context = {}) => {
  const now = new Date();
  const nowMs = now.getTime();
  const batchSize = Number.parseInt(String(payload?.batchSize ?? env.notificationReminders.scanBatchSize), 10);
  const take = Number.isFinite(batchSize) && batchSize > 0 ? batchSize : env.notificationReminders.scanBatchSize;

  const bookings = await prisma.booking.findMany({
    where: {
      status: "PENDING",
    },
    orderBy: {
      createdAt: "asc",
    },
    take,
    include: {
      photographer: {
        select: {
          userId: true,
        },
      },
      notifications: {
        where: {
          type: "BOOKING",
          title: {
            in: [REMINDER_24_TITLE, REMINDER_72_TITLE],
          },
        },
        select: {
          title: true,
        },
      },
    },
  });

  const notificationsToCreate = [];
  let stale24h = 0;
  let stale72h = 0;

  for (const booking of bookings) {
    const createdAtMs = new Date(booking.createdAt).getTime();
    const ageMs = nowMs - createdAtMs;

    if (ageMs >= HOURS_72_MS) {
      stale72h += 1;
      if (!hasReminderTitle(booking.notifications, REMINDER_72_TITLE)) {
        const payload72 = buildReminderPayload(booking, 72);
        if (payload72) notificationsToCreate.push(payload72);
      }
      continue;
    }

    if (ageMs >= HOURS_24_MS) {
      stale24h += 1;
      if (!hasReminderTitle(booking.notifications, REMINDER_24_TITLE)) {
        const payload24 = buildReminderPayload(booking, 24);
        if (payload24) notificationsToCreate.push(payload24);
      }
    }
  }

  let created = 0;
  if (notificationsToCreate.length > 0) {
    const result = await prisma.notification.createMany({
      data: notificationsToCreate,
    });
    created = result.count || 0;
  }

  logger.info(
    {
      queue: context.queue || null,
      jobId: context.jobId || null,
      mode: context.mode || "queue",
      scanned: bookings.length,
      stale24h,
      stale72h,
      created,
    },
    "Notification reminder scan completed"
  );

  return {
    processed: true,
    scanned: bookings.length,
    stale24h,
    stale72h,
    created,
  };
};
