import { prisma } from "../../config/prisma.js";
import { getPagination, buildPagination } from "../../utils/pagination.js";
import { ApiError } from "../../utils/apiError.js";
import { MODERATION_IMAGE_ACTIONS, MODERATION_REPORT_ACTIONS } from "./adminService.constants.js";
import {
  moderationAbuseLabel,
  moderationImageReason,
  moderationSeverityFromCount,
  normalizeModerationToken,
  resolveModerationImageStatuses,
  startOfDay,
} from "./adminService.utils.js";

export const adminModerationService = {
  async moderationOverview() {
    const startToday = startOfDay(new Date());
    const pendingPortfolioWhere = {
      type: "IMAGE",
      purpose: "PORTFOLIO",
      status: "PENDING",
      photographerId: { not: null },
    };

    const [pendingReportGroups, flaggedImages, suspendedAccounts, abuseGroups, reviewedToday] = await Promise.all([
      prisma.asset.groupBy({
        by: ["photographerId"],
        where: pendingPortfolioWhere,
        _count: { _all: true },
      }),
      prisma.asset.count({
        where: pendingPortfolioWhere,
      }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.asset.groupBy({
        by: ["purpose"],
        where: {
          type: "IMAGE",
          status: "PENDING",
        },
        _count: { _all: true },
      }),
      prisma.adminLog.count({
        where: {
          createdAt: { gte: startToday },
          action: { startsWith: "PATCH /admin/moderation/" },
        },
      }),
    ]);

    return {
      stats: {
        pendingReports: pendingReportGroups.length,
        reviewedToday,
        suspendedAccounts,
        flaggedImages,
      },
      abuseTypes: abuseGroups
        .map((group) => ({
          type: moderationAbuseLabel(group.purpose),
          count: Number(group._count._all || 0),
        }))
        .sort((a, b) => b.count - a.count),
    };
  },

  async moderationReports(query) {
    const { page, limit, skip, take } = getPagination(query);

    const severityFilter = normalizeModerationToken(query.severity);
    const statusFilter = normalizeModerationToken(query.status);
    const search = String(query.search || query.q || "").trim().toLowerCase();

    const pendingGroups = await prisma.asset.groupBy({
      by: ["photographerId"],
      where: {
        type: "IMAGE",
        purpose: "PORTFOLIO",
        status: "PENDING",
        photographerId: { not: null },
      },
      _count: { _all: true },
    });

    const photographerIds = pendingGroups.map((group) => group.photographerId).filter(Boolean);
    const photographers =
      photographerIds.length > 0
        ? await prisma.photographer.findMany({
            where: { id: { in: photographerIds } },
            select: {
              id: true,
              username: true,
              studioName: true,
              status: true,
              user: {
                select: {
                  fullName: true,
                  status: true,
                },
              },
            },
          })
        : [];
    const photographerById = new Map(photographers.map((photographer) => [photographer.id, photographer]));

    let items = pendingGroups.map((group) => {
      const photographer = photographerById.get(group.photographerId);
      const reports = Number(group._count._all || 0);
      const severity = moderationSeverityFromCount(reports);
      const isSuspended = photographer?.status === "SUSPENDED" || photographer?.user?.status === "SUSPENDED";

      return {
        reportId: group.photographerId,
        photographer:
          photographer?.studioName ||
          photographer?.user?.fullName ||
          (photographer?.username ? `@${photographer.username}` : "Unknown photographer"),
        reports,
        reason:
          reports === 1
            ? "Flagged portfolio image pending moderation"
            : "Flagged portfolio images pending moderation",
        severity,
        status: isSuspended ? "SUSPENDED" : "PENDING",
      };
    });

    if (severityFilter && severityFilter !== "ALL") {
      items = items.filter((item) => item.severity === severityFilter);
    }

    if (statusFilter && statusFilter !== "ALL") {
      items = items.filter((item) => item.status === statusFilter);
    }

    if (search) {
      items = items.filter((item) =>
        [item.photographer, item.reason, item.status, item.severity].join(" ").toLowerCase().includes(search)
      );
    }

    items.sort((a, b) => {
      if (b.reports !== a.reports) return b.reports - a.reports;
      return String(a.photographer).localeCompare(String(b.photographer));
    });

    const total = items.length;
    const paginatedItems = items.slice(skip, skip + take);

    return {
      items: paginatedItems,
      pagination: buildPagination(page, limit, total),
    };
  },

  async moderationPatchReport(reportId, action) {
    const normalizedAction = String(action || "").trim().toLowerCase();
    if (!MODERATION_REPORT_ACTIONS.has(normalizedAction)) {
      throw new ApiError(400, "Unsupported moderation action");
    }

    const photographer = await prisma.photographer.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        userId: true,
      },
    });
    if (!photographer) throw new ApiError(404, "Report not found");

    if (normalizedAction === "approve") {
      await prisma.asset.updateMany({
        where: {
          photographerId: photographer.id,
          type: "IMAGE",
          purpose: "PORTFOLIO",
          status: "PENDING",
        },
        data: {
          status: "READY",
          deletedAt: null,
        },
      });

      return {
        reportId,
        status: "APPROVED",
        action: normalizedAction,
      };
    }

    if (normalizedAction === "suspend") {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: photographer.userId },
          data: { status: "SUSPENDED" },
        });

        await tx.photographer.update({
          where: { id: photographer.id },
          data: { status: "SUSPENDED" },
        });

        await tx.notification.create({
          data: {
            userId: photographer.userId,
            type: "ADMIN",
            title: "Account suspended",
            body: "Your account has been suspended by the admin team due to moderation review.",
            actionUrl: "/dashboard/settings",
          },
        });
      });

      return {
        reportId,
        status: "SUSPENDED",
        action: normalizedAction,
      };
    }

    return {
      reportId,
      status: "ESCALATED",
      action: normalizedAction,
    };
  },

  async flaggedImages(query) {
    const { page, limit, skip, take } = getPagination(query);
    const imageStatuses = resolveModerationImageStatuses(query.status);
    const search = String(query.search || query.q || "").trim();

    const where = {
      type: "IMAGE",
      purpose: "PORTFOLIO",
      ...(imageStatuses ? { status: { in: imageStatuses } } : {}),
      ...(search
        ? {
            OR: [
              { objectKey: { contains: search, mode: "insensitive" } },
              { originalFileName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          cdnUrl: true,
          objectKey: true,
          photographer: {
            select: {
              studioName: true,
              username: true,
              user: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        imageReportId: item.id,
        photographer:
          item.photographer?.studioName ||
          item.photographer?.user?.fullName ||
          (item.photographer?.username ? `@${item.photographer.username}` : "Unknown photographer"),
        reason: moderationImageReason(item.status),
        reports: 1,
        date: item.createdAt,
        imageUrl: item.cdnUrl || null,
      })),
      pagination: buildPagination(page, limit, total),
    };
  },

  async patchFlaggedImage(imageReportId, action) {
    const normalizedAction = String(action || "").trim().toLowerCase();
    if (!MODERATION_IMAGE_ACTIONS.has(normalizedAction)) {
      throw new ApiError(400, "Unsupported flagged image action");
    }

    const asset = await prisma.asset.findUnique({
      where: { id: imageReportId },
      select: {
        id: true,
        type: true,
        purpose: true,
        status: true,
      },
    });

    if (!asset || asset.type !== "IMAGE" || asset.purpose !== "PORTFOLIO") {
      throw new ApiError(404, "Flagged image not found");
    }

    if (normalizedAction === "approve") {
      if (asset.status === "PURGED") {
        throw new ApiError(409, "Purged image cannot be approved");
      }

      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          status: "READY",
          deletedAt: null,
        },
      });

      return {
        imageReportId,
        status: "APPROVED",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.portfolioItem.deleteMany({
        where: {
          assetId: asset.id,
        },
      });

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
        },
      });
    });

    return {
      imageReportId,
      status: "REMOVED",
    };
  },
};

