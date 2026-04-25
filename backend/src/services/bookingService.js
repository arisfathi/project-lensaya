import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { emailService } from "./emailService.js";
import { enqueueBookingConfirmationEmail } from "../jobs/emailQueue.js";
import { notificationService } from "./notificationService.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { applyTenantFilter, ensureTenantOwnership } from "../utils/tenantQuery.js";
import { planLimitService } from "./planLimitService.js";

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

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parsePreferredDate = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const date = DATE_ONLY_PATTERN.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const normalizePreferredTime = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return TIME_24H_PATTERN.test(raw) ? raw : null;
};

const formatTimeForSummary = (value) => {
  const raw = String(value || "").trim();
  if (!TIME_24H_PATTERN.test(raw)) return null;
  const [hoursToken, minutesToken] = raw.split(":");
  const hours = Number(hoursToken);
  const minutes = Number(minutesToken);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
};

const formatPreferredScheduleForSummary = (dateValue, timeValue) => {
  const dateLabel = formatDateForSummary(dateValue);
  const timeLabel = formatTimeForSummary(timeValue);
  return timeLabel ? `${dateLabel} at ${timeLabel}` : dateLabel;
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
const BOOKED_BOOKING_STATUSES = ["CONFIRMED", "COMPLETED"];

const buildBookedSlotConflictWhere = ({ photographerId, dayStart, dayEnd, preferredTime, excludeBookingId = null }) => ({
  photographerId,
  preferredDate: { gte: dayStart, lt: dayEnd },
  status: { in: BOOKED_BOOKING_STATUSES },
  ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
  ...(preferredTime
    ? {
        OR: [{ preferredTime }, { preferredTime: null }],
      }
    : {}),
});

const resolveBookingConflictMessage = (preferredTime) =>
  preferredTime ? "Selected time is already booked" : "Selected date is already booked";

const LEAD_FILTERS_LOCKED_MESSAGE = "Inquiry filters are not enabled on your current plan.";
const LEAD_EXPORT_LOCKED_MESSAGE = "Inquiry export is not enabled on your current plan.";
const normalizeDateQuery = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid date filter");
  }
  return date;
};

const normalizeBookingNotes = (value) => {
  if (value === undefined) return undefined;
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized.slice(0, 5000);
};

const getLeadHistoryCutoff = (historyDays) => {
  const normalizedHistoryDays = Number(historyDays);
  if (!Number.isFinite(normalizedHistoryDays) || normalizedHistoryDays < 0) return null;

  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - normalizedHistoryDays);
  return cutoff;
};

const clampLeadDateFilters = ({ fromDate, toDate, historyCutoff }) => {
  const hasHistoryCutoff = historyCutoff instanceof Date && !Number.isNaN(historyCutoff.getTime());
  const effectiveFrom = hasHistoryCutoff
    ? fromDate && fromDate > historyCutoff
      ? fromDate
      : historyCutoff
    : fromDate;

  return {
    fromDate: effectiveFrom || null,
    toDate: toDate || null,
    isHistoryClamped: Boolean(hasHistoryCutoff && (!fromDate || fromDate < historyCutoff)),
    historyCutoff: hasHistoryCutoff ? historyCutoff : null,
  };
};

const buildLeadWhere = ({ query, requestedFilters, fromDate, toDate }) => ({
  ...(query.status ? { status: query.status } : {}),
  ...(requestedFilters.source ? { source: requestedFilters.source } : {}),
  ...(fromDate || toDate
    ? {
        createdAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        },
      }
    : {}),
  ...(requestedFilters.search
    ? {
        OR: [
          { clientName: { contains: requestedFilters.search, mode: "insensitive" } },
          { clientEmail: { contains: requestedFilters.search, mode: "insensitive" } },
          { clientPhone: { contains: requestedFilters.search, mode: "insensitive" } },
          { message: { contains: requestedFilters.search, mode: "insensitive" } },
        ],
      }
    : {}),
});

const scoreLeadIntent = (message) => {
  const text = String(message || "").toLowerCase();
  if (!text) return 0;

  let score = 0;
  const highIntentKeywords = ["book", "confirm", "deposit", "available", "price", "package", "slot", "date", "urgent"];
  const mediumIntentKeywords = ["interested", "inquiry", "details", "quotation", "quote", "portfolio", "location"];

  for (const keyword of highIntentKeywords) {
    if (text.includes(keyword)) score += 6;
  }
  for (const keyword of mediumIntentKeywords) {
    if (text.includes(keyword)) score += 3;
  }

  return Math.min(25, score);
};

const computeLeadScore = (item, sourceConversionMap = new Map()) => {
  let score = 10;
  const status = String(item?.status || "PENDING").toUpperCase();

  if (status === "PENDING") score += 30;
  else if (status === "CONFIRMED") score += 20;
  else if (status === "COMPLETED") score += 8;

  const createdAtMs = new Date(item?.createdAt || 0).getTime();
  const ageHours = Number.isFinite(createdAtMs) ? Math.max(0, Math.floor((Date.now() - createdAtMs) / (1000 * 60 * 60))) : 9999;
  if (ageHours <= 1) score += 25;
  else if (ageHours <= 24) score += 18;
  else if (ageHours <= 72) score += 10;
  else if (ageHours <= 168) score += 4;

  score += scoreLeadIntent(item?.message);

  if (item?.clientPhone) score += 5;
  if (item?.clientEmail) score += 3;

  const source = String(item?.source || "OTHER").toUpperCase();
  const sourceConversionRate = Number(sourceConversionMap.get(source) || 0);
  if (Number.isFinite(sourceConversionRate) && sourceConversionRate > 0) {
    score += Math.min(12, Math.round(sourceConversionRate * 30));
  }

  if (item?.preferredDate) score += 5;
  if (item?.preferredTime) score += 3;

  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const temperature = normalizedScore >= 75 ? "HOT" : normalizedScore >= 45 ? "WARM" : "COLD";

  return {
    leadScore: normalizedScore,
    leadTemperature: temperature,
  };
};

const toLeadItem = (item, options = {}) => ({
  id: item.id,
  status: item.status,
  source: item.source,
  clientName: item.clientName,
  clientEmail: item.clientEmail,
  clientPhone: item.clientPhone,
  message: item.message,
  notes: item.notes,
  preferredDate: item.preferredDate,
  preferredTime: item.preferredTime,
  createdAt: item.createdAt,
  service: item.service ? { id: item.service.id, name: item.service.name } : null,
  package: item.package ? { id: item.package.id, name: item.package.name } : null,
  ...computeLeadScore(item, options.sourceConversionMap),
});

const escapeCsvCell = (value) => {
  const text = String(value ?? "");
  if (!text) return "";
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const buildDailyTrendSeries = (rows, days) => {
  const dayCount = Number(days) > 0 ? Number(days) : 30;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const dayMap = new Map();
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - i);
    const key = date.toISOString().slice(0, 10);
    dayMap.set(key, {
      date: key,
      leads: 0,
      converted: 0,
    });
  }

  for (const row of rows) {
    const key = new Date(row.createdAt).toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (!bucket) continue;
    bucket.leads += 1;
    if (row.status === "CONFIRMED" || row.status === "COMPLETED") {
      bucket.converted += 1;
    }
  }

  return Array.from(dayMap.values());
};

const buildLeadCsv = (items) => {
  const columns = [
    "ID",
    "Status",
    "Source",
    "Client Name",
    "Client Email",
    "Client Phone",
    "Service",
    "Package",
    "Preferred Date",
    "Preferred Time",
    "Submitted At",
    "Message",
    "Notes",
  ];

  const rows = items.map((item) =>
    [
      item.id,
      item.status,
      item.source || "",
      item.clientName || "",
      item.clientEmail || "",
      item.clientPhone || "",
      item.service?.name || "",
      item.package?.name || "",
      item.preferredDate ? new Date(item.preferredDate).toISOString().slice(0, 10) : "",
      item.preferredTime || "",
      item.createdAt ? new Date(item.createdAt).toISOString() : "",
      item.message || "",
      item.notes || "",
    ]
      .map((cell) => escapeCsvCell(cell))
      .join(",")
  );

  return [columns.join(","), ...rows].join("\n");
};

const buildLeadUpgradeNudges = (insights, leadFeatures) => {
  const scoredNudges = [];
  const addNudge = (nudge, score) => {
    scoredNudges.push({
      ...nudge,
      _score: Number(score) || 0,
    });
  };

  if (!leadFeatures?.advancedAnalytics) {
    addNudge(
      {
        id: "unlock-advanced-analytics",
        type: "upgrade",
        title: "Unlock advanced lead analytics",
        body: `Upgrade to ${leadFeatures?.upgradeTarget || "PRO"} to unlock source ROI, trends, and response benchmarks.`,
      },
      90
    );
  }

  const pendingLeads = Number(insights?.totals?.pending || 0);
  if (pendingLeads >= 5) {
    addNudge(
      {
        id: "pending-followup-pressure",
        type: "followup",
        title: "Pending leads are stacking",
        body: "Follow up quickly to prevent lead drop-off and improve close rate.",
      },
      100 + pendingLeads
    );
  }

  const totalLeads = Number(insights?.totals?.leads || 0);
  const conversionRate = Number(insights?.rates?.conversionRate || 0);
  if (totalLeads >= 10 && conversionRate < 0.2) {
    const conversionGapScore = Math.round((0.2 - conversionRate) * 100);
    addNudge(
      {
        id: "conversion-low",
        type: "conversion",
        title: "Conversion is below target",
        body: "Use follow-up templates and faster replies to lift conversion.",
      },
      80 + conversionGapScore
    );
  }

  const averageResponseMinutes = Number(insights?.responseTime?.averageMinutes || 0);
  if (averageResponseMinutes > 180) {
    const delayScore = Math.min(60, Math.round((averageResponseMinutes - 180) / 15));
    addNudge(
      {
        id: "response-slow",
        type: "response",
        title: "Response time is slow",
        body: "Leads convert better when replied within the first hour.",
      },
      70 + delayScore
    );
  }

  return scoredNudges
    .sort((a, b) => b._score - a._score)
    .slice(0, 3)
    .map(({ _score, ...nudge }) => nudge);
};
const lockAdvancedInsights = (insights = {}, leadFeatures = {}) => ({
  ...insights,
  responseTime: {
    averageMinutes: null,
    sampledCount: 0,
    sampleLimited: false,
  },
  sourceBreakdown: [],
  trends: {
    daily7d: [],
    daily30d: [],
  },
  locked: {
    advancedAnalytics: true,
    upgradeTarget: leadFeatures?.upgradeTarget || "PRO",
  },
});

const calculateLeadInsights = async ({ scoped }) => {
  const trendsWindowStart = new Date();
  trendsWindowStart.setUTCHours(0, 0, 0, 0);
  trendsWindowStart.setUTCDate(trendsWindowStart.getUTCDate() - 29);

  const [statusGroups, sourceGroups, handledSamples, trendRows] = await Promise.all([
    prisma.booking.groupBy({
      by: ["status"],
      ...scoped,
      _count: { _all: true },
    }),
    prisma.booking.groupBy({
      by: ["source", "status"],
      ...scoped,
      _count: { _all: true },
    }),
    prisma.booking.findMany({
      ...scoped,
      where: {
        ...(scoped.where || {}),
        status: { in: ["CONFIRMED", "COMPLETED", "DECLINED", "CANCELED", "EXPIRED"] },
      },
      select: { createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.booking.findMany({
      ...scoped,
      where: {
        ...(scoped.where || {}),
        createdAt: {
          ...(scoped?.where?.createdAt || {}),
          gte: trendsWindowStart,
        },
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
      take: 10000,
    }),
  ]);

  const statusCountMap = statusGroups.reduce((acc, row) => {
    acc[row.status] = Number(row?._count?._all || 0);
    return acc;
  }, {});

  const total = Object.values(statusCountMap).reduce((sum, value) => sum + Number(value || 0), 0);
  const pending = Number(statusCountMap.PENDING || 0);
  const confirmed = Number(statusCountMap.CONFIRMED || 0);
  const completed = Number(statusCountMap.COMPLETED || 0);
  const declined = Number(statusCountMap.DECLINED || 0);
  const canceled = Number(statusCountMap.CANCELED || 0);
  const expired = Number(statusCountMap.EXPIRED || 0);
  const converted = confirmed + completed;
  const responded = total - pending;

  const responseDurationsMinutes = handledSamples
    .map((item) => {
      const created = new Date(item.createdAt).getTime();
      const updated = new Date(item.updatedAt).getTime();
      if (!Number.isFinite(created) || !Number.isFinite(updated) || updated <= created) return null;
      return Math.round((updated - created) / (1000 * 60));
    })
    .filter((value) => Number.isFinite(value));

  const avgResponseMinutes = responseDurationsMinutes.length
    ? Math.round(responseDurationsMinutes.reduce((sum, value) => sum + Number(value), 0) / responseDurationsMinutes.length)
    : null;

  const sourceMap = new Map();
  for (const row of sourceGroups) {
    const key = String(row.source || "OTHER");
    const count = Number(row?._count?._all || 0);
    const current = sourceMap.get(key) || { total: 0, converted: 0 };
    current.total += count;
    if (row.status === "CONFIRMED" || row.status === "COMPLETED") {
      current.converted += count;
    }
    sourceMap.set(key, current);
  }

  const sourceBreakdown = Array.from(sourceMap.entries())
    .map(([source, counts]) => ({
      source,
      leads: counts.total,
      converted: counts.converted,
      conversionRate: counts.total > 0 ? Number((counts.converted / counts.total).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.leads - a.leads);

  const dailyTrends30d = buildDailyTrendSeries(trendRows, 30);
  const dailyTrends7d = dailyTrends30d.slice(-7);

  return {
    totals: {
      leads: total,
      pending,
      confirmed,
      completed,
      declined,
      canceled,
      expired,
      converted,
      responded,
    },
    rates: {
      conversionRate: total > 0 ? Number((converted / total).toFixed(4)) : 0,
      responseRate: total > 0 ? Number((responded / total).toFixed(4)) : 0,
    },
    responseTime: {
      averageMinutes: avgResponseMinutes,
      sampledCount: responseDurationsMinutes.length,
      sampleLimited: handledSamples.length >= 5000,
    },
    sourceBreakdown,
    trends: {
      daily7d: dailyTrends7d,
      daily30d: dailyTrends30d,
    },
  };
};

const acquireTransactionLock = async (tx, lockToken) => {
  if (!lockToken || typeof tx?.$executeRaw !== "function") return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockToken}))`;
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

    const preferredDate = parsePreferredDate(payload.preferredDate);
    if (payload.preferredDate && !preferredDate) {
      throw new ApiError(400, "Invalid preferred date");
    }

    const preferredTime = normalizePreferredTime(payload.preferredTime);
    if (payload.preferredTime && !preferredTime) {
      throw new ApiError(400, "Invalid preferred time");
    }

    const cleanClientName = normalizeText(payload.name, 191);
    const cleanClientEmail = normalizeText(payload.email, 320);
    const cleanClientPhone = normalizeText(payload.phone, 32);
    const cleanMessage = normalizeText(payload.message, 5000);
    const sourceToken = String(payload.source || "WEBSITE").toUpperCase();
    const safeSource = ["WEBSITE", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "TIKTOK", "DIRECT", "OTHER"].includes(sourceToken)
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
            where: buildBookedSlotConflictWhere({
              photographerId: photographer.id,
              dayStart,
              dayEnd,
              preferredTime,
            }),
            select: { id: true },
          }),
        ]);

        if (availabilityDay && availabilityDay.status !== "AVAILABLE") {
          throw new ApiError(409, "Selected date is already booked");
        }
        if (existingBooking) {
          throw new ApiError(409, resolveBookingConflictMessage(preferredTime));
        }
      }

      return tx.booking.create({
        data: {
          photographerId: photographer.id,
          serviceId: resolvedServiceId,
          packageId: packageRecord?.id || payload.packageId || null,
          preferredDate,
          preferredTime,
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

    const summarySchedule = formatPreferredScheduleForSummary(booking.preferredDate, booking.preferredTime);
    const summary = [
      `Studio: ${photographer.studioName}`,
      `Service: ${booking.service?.name || "N/A"}`,
      `Package: ${booking.package?.name || "N/A"}`,
      `Preferred Schedule: ${summarySchedule}`,
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

    if (!emailJob && !env.isProduction) {
      await emailService.sendBookingNotification(photographer.user.email, summary);
    }

    const photographerWa = String(photographer.whatsappNumber || "").replace(/\D/g, "");
    const whatsappText = [
      `Hi ${photographer.studioName || ""}, I came from Lensaya.`,
      //`Booking ID: ${booking.id}`,
      `Client: ${booking.clientName || "N/A"}`,
      `Email: ${booking.clientEmail || "N/A"}`,
      booking.clientPhone ? `Phone: ${booking.clientPhone}` : null,
      `Service: ${booking.service?.name || "N/A"}`,
      `Package: ${booking.package?.name || "N/A"}`,
      `Preferred Schedule: ${summarySchedule}`,
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
            status: { in: BOOKED_BOOKING_STATUSES },
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
      select: { id: true, photographerId: true, preferredDate: true, preferredTime: true },
    });
    ensureTenantOwnership(booking, tenant, "Booking");

    let updated = null;

    if (status === "CONFIRMED" && booking.preferredDate) {
      updated = await prisma.$transaction(async (tx) => {
        const { dayStart, dayEnd } = toUtcDayRange(booking.preferredDate);
        const lockToken = buildBookingLockToken(booking.photographerId, dayStart);
        await acquireTransactionLock(tx, lockToken);

        const [availabilityDay, conflictingBooking] = await Promise.all([
          tx.availability.findFirst({
            where: {
              photographerId: booking.photographerId,
              date: { gte: dayStart, lt: dayEnd },
            },
            select: { status: true },
          }),
          tx.booking.findFirst({
            where: buildBookedSlotConflictWhere({
              photographerId: booking.photographerId,
              dayStart,
              dayEnd,
              preferredTime: booking.preferredTime,
              excludeBookingId: booking.id,
            }),
            select: { id: true },
          }),
        ]);

        if (availabilityDay && availabilityDay.status !== "AVAILABLE") {
          throw new ApiError(409, "Selected date is not available");
        }
        if (conflictingBooking) {
          throw new ApiError(409, resolveBookingConflictMessage(booking.preferredTime));
        }

        return tx.booking.update({
          where: { id: bookingId },
          data: { status },
        });
      });
    } else {
      updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { status },
      });
    }

    return {
      bookingId: updated.id,
      status: updated.status.toLowerCase(),
      updatedAt: updated.updatedAt,
    };
  },

  async updateNotes(tenant, bookingId, notes) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, photographerId: true },
    });
    ensureTenantOwnership(booking, tenant, "Booking");

    const normalizedNotes = normalizeBookingNotes(notes);
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        ...(normalizedNotes !== undefined ? { notes: normalizedNotes } : {}),
      },
      select: {
        id: true,
        notes: true,
        updatedAt: true,
      },
    });

    return {
      bookingId: updated.id,
      notes: updated.notes,
      updatedAt: updated.updatedAt,
    };
  },

  async listForPhotographer(tenant, query) {
    const { page, limit, skip, take } = getPagination(query);

    const requestedFilters = {
      search: String(query.search || "").trim(),
      source: String(query.source || "").trim().toUpperCase(),
      from: query.from || null,
      to: query.to || null,
    };
    const isUsingLeadFilters =
      Boolean(requestedFilters.search) ||
      Boolean(requestedFilters.source) ||
      Boolean(requestedFilters.from) ||
      Boolean(requestedFilters.to);

    let leadFeatures = {
      plan: "STUDIO",
      filters: true,
      export: true,
      reminders: true,
      historyDays: -1,
      maxVisibleLeads: -1,
      advancedAnalytics: true,
      templatePack: "studio",
      templateLimit: -1,
      channels: {
        whatsapp: true,
        email: true,
      },
      upgradeTarget: null,
    };

    if (tenant?.photographerId) {
      const plan = await planLimitService.getPlanByPhotographerId(tenant.photographerId);
      leadFeatures = planLimitService.getLeadFeatureAccess(plan);
    }

    if (isUsingLeadFilters && !leadFeatures.filters) {
      const upgradeLabel = leadFeatures?.upgradeTarget ? ` Upgrade to ${leadFeatures.upgradeTarget} to unlock this.` : "";
      throw new ApiError(403, `${LEAD_FILTERS_LOCKED_MESSAGE}${upgradeLabel}`);
    }

    const rawFromDate = normalizeDateQuery(requestedFilters.from);
    const rawToDate = normalizeDateQuery(requestedFilters.to);
    const historyCutoff = getLeadHistoryCutoff(leadFeatures.historyDays);
    const { fromDate, toDate, isHistoryClamped } = clampLeadDateFilters({
      fromDate: rawFromDate,
      toDate: rawToDate,
      historyCutoff,
    });

    const where = buildLeadWhere({
      query,
      requestedFilters,
      fromDate,
      toDate,
    });

    const scoped = applyTenantFilter(
      {
        where,
      },
      tenant
    );

    const [total, rawInsights] = await Promise.all([
      prisma.booking.count(scoped),
      calculateLeadInsights({ scoped }),
    ]);

    const maxVisibleLeads = Number(leadFeatures.maxVisibleLeads);
    const hasVisibleCap = Number.isFinite(maxVisibleLeads) && maxVisibleLeads >= 0;
    const visibleLimit = hasVisibleCap ? maxVisibleLeads : -1;
    const effectiveTake = hasVisibleCap ? Math.max(0, Math.min(take, Math.max(0, visibleLimit - skip))) : take;

    const items = effectiveTake > 0
      ? await prisma.booking.findMany({
          ...scoped,
          skip,
          take: effectiveTake,
          orderBy: { createdAt: "desc" },
          include: {
            service: { select: { id: true, name: true } },
            package: { select: { id: true, name: true } },
          },
        })
      : [];

    const exposedTotal = hasVisibleCap ? Math.min(total, visibleLimit) : total;
    const followUpTemplates = planLimitService.getLeadFollowUpTemplates(leadFeatures.plan || "FREE");
    const leadInsights = leadFeatures.advancedAnalytics
      ? rawInsights
      : lockAdvancedInsights(rawInsights, leadFeatures);
    const upgradeNudges = buildLeadUpgradeNudges(rawInsights, leadFeatures);
    const sourceConversionMap = new Map((rawInsights?.sourceBreakdown || []).map((row) => [String(row.source || "OTHER").toUpperCase(), Number(row.conversionRate || 0)]));

    return {
      items: items.map((item) => toLeadItem(item, { sourceConversionMap })),
      pagination: buildPagination(page, limit, exposedTotal),
      leadFeatures,
      followUpTemplates,
      upgradeNudges,
      leadWindow: {
        historyDays: leadFeatures.historyDays,
        historyStart: historyCutoff ? historyCutoff.toISOString() : null,
        isHistoryClamped,
        isVisibleClamped: Boolean(hasVisibleCap && total > visibleLimit),
        maxVisibleLeads: hasVisibleCap ? visibleLimit : -1,
        effectiveFrom: fromDate ? fromDate.toISOString() : null,
        effectiveTo: toDate ? toDate.toISOString() : null,
      },
      leadInsights,
    };
  },

  async exportForPhotographer(tenant, query) {
    let leadFeatures = {
      plan: "STUDIO",
      filters: true,
      export: true,
      reminders: true,
      historyDays: -1,
      maxVisibleLeads: -1,
      advancedAnalytics: true,
      templatePack: "studio",
      templateLimit: -1,
      channels: {
        whatsapp: true,
        email: true,
      },
      upgradeTarget: null,
    };

    if (tenant?.photographerId) {
      const plan = await planLimitService.getPlanByPhotographerId(tenant.photographerId);
      leadFeatures = planLimitService.getLeadFeatureAccess(plan);
    }

    if (!leadFeatures.export) {
      const upgradeLabel = leadFeatures?.upgradeTarget ? ` Upgrade to ${leadFeatures.upgradeTarget} to unlock this.` : "";
      throw new ApiError(403, `${LEAD_EXPORT_LOCKED_MESSAGE}${upgradeLabel}`);
    }

    const requestedFilters = {
      search: String(query.search || "").trim(),
      source: String(query.source || "").trim().toUpperCase(),
      from: query.from || null,
      to: query.to || null,
    };

    const rawFromDate = normalizeDateQuery(requestedFilters.from);
    const rawToDate = normalizeDateQuery(requestedFilters.to);
    const historyCutoff = getLeadHistoryCutoff(leadFeatures.historyDays);
    const { fromDate, toDate } = clampLeadDateFilters({
      fromDate: rawFromDate,
      toDate: rawToDate,
      historyCutoff,
    });

    const where = buildLeadWhere({
      query,
      requestedFilters,
      fromDate,
      toDate,
    });

    const scoped = applyTenantFilter(
      {
        where,
      },
      tenant
    );

    const items = await prisma.booking.findMany({
      ...scoped,
      orderBy: { createdAt: "desc" },
      include: {
        service: { select: { id: true, name: true } },
        package: { select: { id: true, name: true } },
      },
      take: 5000,
    });

    const csv = buildLeadCsv(items.map(toLeadItem));
    const dateStamp = new Date().toISOString().slice(0, 10);

    return {
      csv,
      filename: `lead-export-${dateStamp}.csv`,
      count: items.length,
      truncated: items.length >= 5000,
      leadFeatures,
    };
  },
};






