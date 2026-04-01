import { prisma } from "./prisma.js";

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

  if (problems.length > 0) {
    throw new Error(
      `Database schema is out of date: ${problems.join("; ")}. Run "npx prisma migrate deploy" before starting the server.`
    );
  }
};
