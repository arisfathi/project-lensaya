import { prisma } from "./prisma.js";

const isConnectionError = (error) => {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  return (
    code.toUpperCase() === "ECONNREFUSED" ||
    code.toUpperCase() === "P1001" ||
    /ECONNREFUSED/i.test(message) ||
    /Can't reach database server/i.test(message) ||
    /Connection refused/i.test(message)
  );
};

const REQUIRED_COLUMNS = {
  Photographer: ["location", "city", "country", "specialty", "style", "hideBranding"],
  Booking: ["preferredTime", "notes"],
  Subscription: ["chipPurchaseId", "billingInterval", "pendingPlan", "pendingBillingInterval"],
  PlatformSetting: ["key", "value"],
};

const REQUIRED_ENUM_VALUES = {
  AnalyticsEventType: ["PACKAGE_VIEW", "PORTFOLIO_SHARE"],
};

const readColumnsForTable = async (db, tableName) => {
  const rows = await db.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ${tableName}
  `;
  return new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => String(row?.column_name || "").trim())
      .filter(Boolean)
  );
};

const readEnumValues = async (db, enumName) => {
  const rows = await db.$queryRaw`
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = ${enumName}
  `;

  return new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => String(row?.enumlabel || "").trim())
      .filter(Boolean)
  );
};

export const assertSchemaCompatibility = async (db = prisma) => {
  const problems = [];

  try {
    await db.$connect();
  } catch (error) {
    if (isConnectionError(error)) {
      throw new Error(
        'Cannot connect to Postgres using DATABASE_URL. Make sure Postgres is running and DATABASE_URL points to the right host/port.\n\n' +
          'Local dev (Windows/macOS/Linux): start a local Postgres (Docker or native) and confirm it listens on localhost:5432.\n' +
          'Production (Docker Compose): DATABASE_URL should usually use "db" as the hostname (e.g. postgresql://...@db:5432/...).\n\n' +
          'Then run migrations: "npx prisma migrate deploy" (or "npm run prisma:migrate").'
      );
    }
    throw error;
  }

  try {
    for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
      const existingColumns = await readColumnsForTable(db, tableName);
      const missing = requiredColumns.filter((column) => !existingColumns.has(column));
      if (missing.length > 0) {
        problems.push(`${tableName}: missing columns ${missing.join(", ")}`);
      }
    }

    for (const [enumName, requiredValues] of Object.entries(REQUIRED_ENUM_VALUES)) {
      const existingValues = await readEnumValues(db, enumName);
      const missing = requiredValues.filter((value) => !existingValues.has(value));
      if (missing.length > 0) {
        problems.push(`${enumName}: missing enum values ${missing.join(", ")}`);
      }
    }
  } catch (error) {
    if (isConnectionError(error)) {
      throw new Error(
        'Lost connection to Postgres while checking schema compatibility. Verify DATABASE_URL and that Postgres is reachable, then run "npx prisma migrate deploy".'
      );
    }
    throw error;
  }

  if (problems.length > 0) {
    throw new Error(
      `Database schema is out of date: ${problems.join("; ")}. Run "npx prisma migrate deploy" before starting the server.`
    );
  }
};
