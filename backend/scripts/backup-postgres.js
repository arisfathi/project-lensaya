import dotenv from "dotenv";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import pg from "pg";

dotenv.config();

const DEFAULT_RETENTION_DAYS = 14;
const DEFAULT_BACKUP_DIR = "data/backups/postgres";

const formatTimestampUtc = (date) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const quoteIdentifier = (identifier = "") => `"${String(identifier).replace(/"/g, "\"\"")}"`;

const runPgDump = ({ binary, databaseUrl, outputFile }) =>
  new Promise((resolve, reject) => {
    const args = [
      `--dbname=${databaseUrl}`,
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      `--file=${outputFile}`,
    ];

    let stderr = "";

    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      if (error?.code === "ENOENT") {
        reject(
          new Error(
            `pg_dump binary not found: "${binary}". Install PostgreSQL client tools or set PG_DUMP_BIN.`
          )
        );
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const message = stderr.trim() || `pg_dump exited with code ${code}`;
      reject(new Error(message));
    });
  });

const hashFileSha256 = async (filePath) => {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
};

const runJsonSnapshotBackup = async ({ databaseUrl, outputFile }) => {
  const { Pool } = pg;
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const tableResult = await pool.query(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename ASC
    `);

    const snapshot = {
      schemaVersion: 1,
      format: "json-snapshot-fallback",
      generatedAt: new Date().toISOString(),
      tables: {},
    };

    for (const row of tableResult.rows) {
      const tableName = String(row.tablename || "").trim();
      if (!tableName) continue;

      const [columnsResult, countResult, rowsResult] = await Promise.all([
        pool.query(
          `
            SELECT
              column_name AS "columnName",
              data_type AS "dataType",
              is_nullable AS "isNullable",
              column_default AS "columnDefault"
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position ASC
          `,
          [tableName]
        ),
        pool.query(`SELECT COUNT(*)::bigint AS "count" FROM public.${quoteIdentifier(tableName)}`),
        pool.query(`SELECT * FROM public.${quoteIdentifier(tableName)}`),
      ]);

      snapshot.tables[tableName] = {
        rowCount: Number(countResult.rows?.[0]?.count || 0),
        columns: columnsResult.rows || [],
        rows: rowsResult.rows || [],
      };
    }

    await fs.writeFile(outputFile, JSON.stringify(snapshot), "utf8");
  } finally {
    await pool.end().catch(() => {});
  }
};

const pruneExpiredBackups = async ({ backupDir, retentionDays }) => {
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;

  const entries = await fs.readdir(backupDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const isManagedBackup = entry.name.endsWith(".dump") || entry.name.endsWith(".snapshot.json");
    if (!isManagedBackup) continue;

    const dumpPath = path.join(backupDir, entry.name);
    const stat = await fs.stat(dumpPath);
    if (stat.mtimeMs >= cutoffMs) continue;

    await fs.rm(dumpPath, { force: true });
    await fs.rm(`${dumpPath}.sha256`, { force: true });
    removed += 1;
  }

  return removed;
};

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for backup");
  }

  const retentionDays = parsePositiveInt(process.env.PG_BACKUP_RETENTION_DAYS, DEFAULT_RETENTION_DAYS);
  const backupDir = path.resolve(process.cwd(), process.env.PG_BACKUP_DIR || DEFAULT_BACKUP_DIR);
  const pgDumpBinary = String(process.env.PG_DUMP_BIN || "pg_dump").trim() || "pg_dump";
  const timestamp = formatTimestampUtc(new Date());

  await fs.mkdir(backupDir, { recursive: true });

  let baseName = `lensaya-${timestamp}.dump`;
  let dumpPath = path.join(backupDir, baseName);
  let backupMode = "pg_dump";

  console.log(`[backup:postgres] Creating dump: ${dumpPath}`);
  try {
    await runPgDump({
      binary: pgDumpBinary,
      databaseUrl,
      outputFile: dumpPath,
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("pg_dump binary not found")) {
      throw error;
    }

    backupMode = "json-snapshot-fallback";
    baseName = `lensaya-${timestamp}.snapshot.json`;
    dumpPath = path.join(backupDir, baseName);

    console.warn(
      `[backup:postgres] pg_dump unavailable, falling back to JSON snapshot backup: ${dumpPath}`
    );
    await runJsonSnapshotBackup({
      databaseUrl,
      outputFile: dumpPath,
    });
  }

  const checksumPath = `${dumpPath}.sha256`;

  const digest = await hashFileSha256(dumpPath);
  await fs.writeFile(checksumPath, `${digest}  ${baseName}\n`, "utf8");

  const removed = await pruneExpiredBackups({ backupDir, retentionDays });

  console.log(`[backup:postgres] Completed`);
  console.log(`[backup:postgres] Mode: ${backupMode}`);
  console.log(`[backup:postgres] Dump: ${dumpPath}`);
  console.log(`[backup:postgres] SHA256: ${checksumPath}`);
  console.log(`[backup:postgres] Pruned old backups: ${removed}`);
};

main().catch((error) => {
  console.error(`[backup:postgres] Failed: ${error.message}`);
  process.exitCode = 1;
});
