import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";

const AUDIT_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
let auditFailureMutedUntil = 0;

const isPrismaAuditFailure = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const name = String(error?.name || "");
  return (
    name.includes("Prisma") ||
    ["EACCES", "P1001", "P1002", "P1008", "P1017", "P2021", "P2022"].includes(code)
  );
};

export const adminAuditLogger = (req, res, next) => {
  if (env.nodeEnv === "test") {
    next();
    return;
  }

  res.on("finish", async () => {
    if (!req.auth?.sub) return;
    if (auditFailureMutedUntil > Date.now()) return;
    try {
      const method = String(req.method || "").toUpperCase();
      const routePath = (req.originalUrl || req.path || "").split("?")[0] || req.path;
      const isAdminMutation =
        ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
        res.statusCode >= 200 &&
        res.statusCode < 400;

      await prisma.adminLog.create({
        data: {
          actorUserId: req.auth.sub,
          level: res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARNING" : "INFO",
          action: `${req.method} ${req.path}`,
          resourceType: req.baseUrl || "admin",
          resourceId: null,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] || null,
          statusCode: res.statusCode,
          details: {
            query: req.query,
          },
        },
      });

      if (isAdminMutation) {
        await prisma.notification.create({
          data: {
            userId: req.auth.sub,
            type: "ADMIN",
            title: "Admin action recorded",
            body: `${method} ${routePath} completed successfully.`,
            actionUrl: routePath || "/admin",
          },
        });
      }
    } catch (error) {
      if (isPrismaAuditFailure(error)) {
        auditFailureMutedUntil = Date.now() + AUDIT_FAILURE_COOLDOWN_MS;
        logger.warn(
          {
            code: error?.code || null,
            name: error?.name || null,
            mutedUntil: new Date(auditFailureMutedUntil).toISOString(),
          },
          "Temporarily disabling admin audit writes due to database/audit schema error"
        );
      }
    }
  });

  next();
};
