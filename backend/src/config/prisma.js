import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { env } from "./env.js";
import { getTenantContext } from "../utils/tenantStore.js";
import { applyTenantFilter, isAdminTenant } from "../utils/tenantQuery.js";

const globalForPrisma = globalThis;
const { Pool } = pg;
const processEntry = String(process.argv?.[1] || "").toLowerCase();
const isWorkerProcess = processEntry.includes("/workers/") || processEntry.includes("\\workers\\");
const resolvedPoolMax =
  env.databasePool.maxOverride > 0
    ? env.databasePool.maxOverride
    : isWorkerProcess
      ? env.databasePool.maxWorker
      : env.databasePool.maxApi;
const tenantScopedModels = new Set([
  "Service",
  "Package",
  "PortfolioItem",
  "Booking",
  "Availability",
  "Asset",
  "AnalyticsEvent",
  "AnalyticsDailyEventRollup",
  "AnalyticsDailyServiceRollup",
  "AnalyticsDailyVisitorRollup",
  "CustomDomain",
]);
const isTenantScopedModel = (model) =>
  Boolean(model) &&
  (tenantScopedModels.has(model) ||
    tenantScopedModels.has(`${model.slice(0, 1).toUpperCase()}${model.slice(1)}`));

const basePrismaPool =
  globalForPrisma.basePrismaPool ||
  new Pool({
    connectionString: env.databaseUrl,
    max: resolvedPoolMax,
    idleTimeoutMillis: env.databasePool.idleTimeoutMs,
    connectionTimeoutMillis: env.databasePool.connectionTimeoutMs,
  });

const basePrismaAdapter =
  globalForPrisma.basePrismaAdapter ||
  new PrismaPg(basePrismaPool);

const basePrisma =
  globalForPrisma.basePrisma ||
  new PrismaClient({
    adapter: basePrismaAdapter,
    log: env.isProduction ? ["error"] : ["query", "info", "warn", "error"],
  });

export const prisma =
  globalForPrisma.prisma ||
  basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenant = getTenantContext();
          if (!tenant || isAdminTenant(tenant) || !isTenantScopedModel(model)) {
            return query(args);
          }

          const nextArgs = args || {};
          const readWithWhereOperations = new Set([
            "findMany",
            "findFirst",
            "findFirstOrThrow",
            "count",
            "aggregate",
            "groupBy",
            "updateMany",
            "deleteMany",
          ]);

          if (readWithWhereOperations.has(operation)) {
            return query(applyTenantFilter(nextArgs, tenant));
          }

          if (operation === "create" && nextArgs?.data && !nextArgs.data.photographerId) {
            return query({
              ...nextArgs,
              data: {
                ...nextArgs.data,
                photographerId: tenant.photographerId,
              },
            });
          }

          if (operation === "createMany" && nextArgs?.data) {
            const data = Array.isArray(nextArgs.data)
              ? nextArgs.data.map((item) =>
                  item?.photographerId ? item : { ...item, photographerId: tenant.photographerId }
                )
              : nextArgs.data?.photographerId
                ? nextArgs.data
                : { ...nextArgs.data, photographerId: tenant.photographerId };

            return query({
              ...nextArgs,
              data,
            });
          }

          if (operation === "upsert" && nextArgs?.create && !nextArgs.create.photographerId) {
            return query({
              ...nextArgs,
              create: {
                ...nextArgs.create,
                photographerId: tenant.photographerId,
              },
            });
          }

          return query(nextArgs);
        },
      },
    },
  });

if (!env.isProduction) {
  globalForPrisma.basePrismaPool = basePrismaPool;
  globalForPrisma.basePrismaAdapter = basePrismaAdapter;
  globalForPrisma.basePrisma = basePrisma;
  globalForPrisma.prisma = prisma;
}

