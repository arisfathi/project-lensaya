import dotenv from "dotenv";
import path from "node:path";
import { promises as fs } from "node:fs";
import pg from "pg";

dotenv.config();

const quoteIdentifier = (identifier = "") => `"${String(identifier).replace(/"/g, "\"\"")}"`;
const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const resolveSnapshotPath = () => {
  const cliPath = process.argv[2] || "";
  const envPath = process.env.PG_SNAPSHOT_FILE || "";
  const selected = String(cliPath || envPath).trim();
  if (!selected) {
    throw new Error("Snapshot file path is required. Pass it as an argument or set PG_SNAPSHOT_FILE.");
  }
  return path.resolve(process.cwd(), selected);
};

const validateSnapshotPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Snapshot payload must be a JSON object");
  }
  if (!payload.tables || typeof payload.tables !== "object") {
    throw new Error("Snapshot payload is missing tables object");
  }
};

const resolveLiveTables = async (client) => {
  const result = await client.query(`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename ASC
  `);
  return result.rows.map((row) => String(row.tablename));
};

const resolveForeignKeyDependencies = async (client, tableSet) => {
  const result = await client.query(`
    SELECT
      tc.table_name AS child_table,
      ccu.table_name AS parent_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `);

  const adjacency = new Map();
  const indegree = new Map();
  for (const table of tableSet) {
    adjacency.set(table, new Set());
    indegree.set(table, 0);
  }

  for (const row of result.rows) {
    const child = String(row.child_table || "");
    const parent = String(row.parent_table || "");
    if (!tableSet.has(child) || !tableSet.has(parent)) continue;
    if (child === parent) continue;

    const siblings = adjacency.get(parent);
    if (!siblings || siblings.has(child)) continue;

    siblings.add(child);
    indegree.set(child, Number(indegree.get(child) || 0) + 1);
  }

  const ready = Array.from(indegree.entries())
    .filter(([, degree]) => degree === 0)
    .map(([table]) => table)
    .sort();
  const ordered = [];

  while (ready.length > 0) {
    const table = ready.shift();
    ordered.push(table);

    const children = Array.from(adjacency.get(table) || []).sort();
    for (const child of children) {
      const nextDegree = Number(indegree.get(child) || 0) - 1;
      indegree.set(child, nextDegree);
      if (nextDegree === 0) {
        ready.push(child);
        ready.sort();
      }
    }
  }

  if (ordered.length < tableSet.size) {
    const unresolved = Array.from(tableSet).filter((table) => !ordered.includes(table));
    return [...ordered, ...unresolved.sort()];
  }

  return ordered;
};

const restoreTableRows = async (client, tableName, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  let inserted = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }

    const columns = Object.keys(row);
    if (columns.length === 0) {
      await client.query(`INSERT INTO public.${quoteIdentifier(tableName)} DEFAULT VALUES`);
      inserted += 1;
      continue;
    }

    const quotedColumns = columns.map((column) => quoteIdentifier(column)).join(", ");
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const values = columns.map((column) => {
      const value = row[column];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return JSON.stringify(value);
      }
      return value;
    });

    await client.query(
      `INSERT INTO public.${quoteIdentifier(tableName)} (${quotedColumns}) VALUES (${placeholders})`,
      values
    );
    inserted += 1;
  }

  return inserted;
};

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for restore");
  }

  const snapshotPath = resolveSnapshotPath();
  const allowPartial = parseBoolean(process.env.PG_SNAPSHOT_ALLOW_PARTIAL, false);

  const snapshotText = await fs.readFile(snapshotPath, "utf8");
  const snapshot = JSON.parse(snapshotText);
  validateSnapshotPayload(snapshot);

  const snapshotTables = Object.keys(snapshot.tables).sort();
  if (snapshotTables.length === 0) {
    throw new Error("Snapshot contains no tables");
  }

  const { Pool } = pg;
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  const client = await pool.connect();
  try {
    const liveTables = await resolveLiveTables(client);
    const liveSet = new Set(liveTables);
    const restorableTables = snapshotTables.filter((table) => liveSet.has(table));
    const missingFromSnapshot = liveTables.filter((table) => !snapshotTables.includes(table));

    if (!allowPartial && missingFromSnapshot.length > 0) {
      throw new Error(
        `Snapshot is missing live tables (${missingFromSnapshot.join(", ")}). Set PG_SNAPSHOT_ALLOW_PARTIAL=true to override.`
      );
    }

    if (restorableTables.length === 0) {
      throw new Error("No snapshot tables match the current database schema");
    }

    const restoreOrder = await resolveForeignKeyDependencies(client, new Set(restorableTables));
    const truncateTargets = restorableTables.map((table) => `public.${quoteIdentifier(table)}`).join(", ");

    await client.query("BEGIN");
    await client.query(`TRUNCATE TABLE ${truncateTargets} RESTART IDENTITY CASCADE`);

    let totalInserted = 0;
    for (const tableName of restoreOrder) {
      const tablePayload = snapshot.tables[tableName];
      const tableRows = Array.isArray(tablePayload?.rows) ? tablePayload.rows : [];
      const inserted = await restoreTableRows(client, tableName, tableRows);
      totalInserted += inserted;
      console.log(`[restore:snapshot] ${tableName}: restored ${inserted} row(s)`);
    }

    await client.query("COMMIT");
    console.log("[restore:snapshot] Completed");
    console.log(`[restore:snapshot] Source: ${snapshotPath}`);
    console.log(`[restore:snapshot] Tables: ${restoreOrder.length}`);
    console.log(`[restore:snapshot] Rows: ${totalInserted}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
};

main().catch((error) => {
  console.error(`[restore:snapshot] Failed: ${error.message}`);
  process.exitCode = 1;
});
