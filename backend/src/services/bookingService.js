import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { emailService } from "./emailService.js";
import { enqueueBookingConfirmationEmail } from "../jobs/emailQueue.js";
import { notificationService } from "./notificationService.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { applyTenantFilter, ensureTenantOwnership } from "../utils/tenantQuery.js";

const normalizeText = (value, maxLength = 10000) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const formatDateForSummary = (value) => {
  if (!value) return "Not specified";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not specified";
  return date.toISOString().slice(0, 10);
};

const toUtcDayRange = (date) => {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
};

const buildBookingLockToken = (photographerId, dayStart) =>
  `booking:${photographerId}:${dayStart.toISOString().slice(0, 10)}`;

const acquireTransactionLock = async (tx, lockToken) => {
  if (!lockToken || typeof tx?.$queryRaw !== "function") return;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockToken}))`;
};

export const bookingService = {
  async createPublicBooking(payload, context = {}) {
    const photographer = await prisma.photographer.findUnique({
      where: { username: payload.photographerUsername },
      include: { user: true },
    });
    if (!photographer) throw new ApiError(404, "Photographer not found");

    const packageRecord = payload.packageId
      ? await prisma.package.findUnique({
          where: { id: payload.packageId },
          select: {
            id: true,
            photographerId: true,
            serviceId: true,
            name: true,
            priceCents: true,
            currency: true,
          },
        })
      : null;

    if (payload.packageId && !packageRecord) throw new ApiError(404, "Package not found");
    if (packageRecord && packageRecord.photographerId !== photographer.id) throw new ApiError(403, "Access denied");

    const resolvedServiceId = payload.serviceId || packageRecord?.serviceId || null;

    if (resolvedServiceId) {
      const service = await prisma.service.findUnique({
        where: { id: resolvedServiceId },
        select: { id: true, photographerId: true },
      });
      if (!service) throw new ApiError(404, "Service not found");
      if (service.photographerId !== photographer.id) throw new ApiError(403, "Access denied");
      if (packageRecord && packageRecord.serviceId !== service.id) {
        throw new ApiError(400, "Selected package does not match the selected service");
      }
    }

    const preferredDate = payload.preferredDate ? new Date(payload.preferredDate) : null;
    if (preferredDate && Number.isNaN(preferredDate.getTime())) {
      throw new ApiError(400, "Invalid preferred date");
    }

    const cleanClientName = normalizeText(payload.name, 191);
    const cleanClientEmail = normalizeText(payload.email, 320);
    const cleanClientPhone = normalizeText(payload.phone, 32);
    const cleanMessage = normalizeText(payload.message, 5000);
    const sourceToken = String(payload.source || "WEBSITE").toUpperCase();
    const safeSource = ["WEBSITE", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "DIRECT", "OTHER"].includes(sourceToken)
      ? sourceToken
      : "WEBSITE";

    const booking = await prisma.$transaction(async (tx) => {
      if (preferredDate) {
        const { dayStart, dayEnd } = toUtcDayRange(preferredDate);
        const lockToken = buildBookingLockToken(photographer.id, dayStart);
        await acquireTransactionLock(tx, lockToken);

        const [availabilityDay, existingBooking] = await Promise.all([
          tx.availability.findFirst({
            where: {
              photographerId: photographer.id,
              date: { gte: dayStart, lt: dayEnd },
            },
            select: { status: true },
          }),
          tx.booking.findFirst({
            where: {
              photographerId: photographer.id,
              preferredDate: { gte: dayStart, lt: dayEnd },
              status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
            },
            select: { id: true },
          }),
        ]);

        if (availabilityDay && availabilityDay.status !== "AVAILABLE") {
          throw new ApiError(409, "Selected date is already booked");
        }
        if (existingBooking) {
          throw new ApiError(409, "Selected date is already booked");
        }
      }

      return tx.booking.create({
        data: {
          photographerId: photographer.id,
          serviceId: resolvedServiceId,
          packageId: packageRecord?.id || payload.packageId || null,
          preferredDate,
          clientName: cleanClientName,
          clientEmail: cleanClientEmail,
          clientPhone: cleanClientPhone,
          message: cleanMessage,
          source: safeSource,
          quotedPriceCents: packageRecord?.priceCents || null,
          currency: packageRecord?.currency || "USD",
        },
        include: {
          service: true,
          package: true,
        },
      });
    });

    const summaryDate = formatDateForSummary(booking.preferredDate);
    const summary = [
      `Studio: ${photographer.studioName}`,
      `Service: ${booking.service?.name || "N/A"}`,
      `Package: ${booking.package?.name || "N/A"}`,
      `Date: ${summaryDate}`,
      `Client: ${booking.clientName || "N/A"}`,
      `Email: ${booking.clientEmail || "N/A"}`,
      booking.clientPhone ? `Phone: ${booking.clientPhone}` : null,
      booking.message ? `Message: ${booking.message}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const emailJob = await enqueueBookingConfirmationEmail({
      email: photographer.user.email,
      bookingId: booking.id,
      summary,
      requestId: context.requestId || null,
    });

    if (!emailJob) {
      await emailService.sendBookingNotification(photographer.user.email, summary);
    }

    const photographerWa = String(photographer.whatsappNumber || "").replace(/\D/g, "");
    const whatsappText = [
      `Hi ${photographer.studioName || ""}, new inquiry from Lensaya.`,
      `Booking ID: ${booking.id}`,
      `Client: ${booking.clientName || "N/A"}`,
      `Email: ${booking.clientEmail || "N/A"}`,
      booking.clientPhone ? `Phone: ${booking.clientPhone}` : null,
      `Service: ${booking.service?.name || "N/A"}`,
      `Package: ${booking.package?.name || "N/A"}`,
      `Preferred Date: ${summaryDate}`,
      booking.message ? `Message: ${booking.message}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const whatsappUrl = photographerWa
      ? `https://wa.me/${photographerWa}?text=${encodeURIComponent(whatsappText)}`
      : null;

    await prisma.booking.update({
      where: { id: booking.id },
      data: { whatsappUrl },
    });

    await notificationService.create({
      userId: photographer.userId,
      bookingId: booking.id,
      type: "BOOKING",
      title: "New booking inquiry",
      body: `${booking.clientName || "A client"} submitted an inquiry for ${booking.package?.name || booking.service?.name || "your service"}.`,
      actionUrl: "/dashboard/availability",
      requestId: context.requestId || null,
    });

    return {
      bookingId: booking.id,
      status: booking.status.toLowerCase(),
      whatsappUrl,
      summary,
    };
  },

  async calendarForUser(tenant, month) {
    const target = month || new Date().toISOString().slice(0, 7);
    const start = new Date(`${target}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const bookings = await prisma.booking.findMany(
      applyTenantFilter(
        {
          where: {
            preferredDate: { gte: start, lt: end },
            status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
          },
          select: { preferredDate: true },
        },
        tenant
      )
    );

    // Lock only dates that have real booking records, not manual availability toggles.
    const bookedDates = bookings
      .map((booking) => booking.preferredDate)
      .filter(Boolean);

    return {
      month: target,
      bookedDates,
      totals: {
        booked: bookedDates.length,
      },
    };
  },

  async updateStatus(tenant, bookingId, status) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, photographerId: true },
    });
    ensureTenantOwnership(booking, tenant, "Booking");

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });

    return {
      bookingId: updated.id,
      status: updated.status.toLowerCase(),
      updatedAt: updated.updatedAt,
    };
  },

  async listForPhotographer(tenant, query) {
    const { page, limit, skip, take } = getPagination(query);
    const scoped = applyTenantFilter(
      {
        where: {
          ...(query.status ? { status: query.status } : {}),
        },
      },
      tenant
    );

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        ...scoped,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          service: { select: { id: true, name: true } },
          package: { select: { id: true, name: true } },
        },
      }),
      prisma.booking.count(scoped),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        clientName: item.clientName,
        clientEmail: item.clientEmail,
        clientPhone: item.clientPhone,
        message: item.message,
        preferredDate: item.preferredDate,
        createdAt: item.createdAt,
        service: item.service ? { id: item.service.id, name: item.service.name } : null,
        package: item.package ? { id: item.package.id, name: item.package.name } : null,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },
};

