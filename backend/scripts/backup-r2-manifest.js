import dotenv from "dotenv";
import path from "node:path";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const DEFAULT_MANIFEST_DIR = "data/backups/r2-manifests";
const DEFAULT_BATCH_SIZE = 1000;
const ACTIVE_ASSET_STATUSES = ["PENDING", "READY"];
const backupDatabaseUrl = String(process.env.R2_BACKUP_DATABASE_URL || process.env.DATABASE_URL || "").trim();
if (!backupDatabaseUrl) {
  throw new Error("DATABASE_URL (or R2_BACKUP_DATABASE_URL) is required for R2 manifest backup");
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: backupDatabaseUrl,
  max: 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: ["error"],
});

const formatTimestampUtc = (date) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

const sha256 = (content) => createHash("sha256").update(content).digest("hex");

const escapeCsv = (value) => {
  const text = String(value ?? "");
  if (!/[,"\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
};

const writeFileWithChecksum = async (directory, fileName, content) => {
  const filePath = path.join(directory, fileName);
  const checksumPath = `${filePath}.sha256`;
  const digest = sha256(content);

  await fs.writeFile(filePath, content, "utf8");
  await fs.writeFile(checksumPath, `${digest}  ${fileName}\n`, "utf8");

  return { filePath, checksumPath, digest };
};

const fetchActiveAssets = async (batchSize = DEFAULT_BATCH_SIZE) => {
  const items = [];
  let cursorId = null;

  try {
    while (true) {
      const batch = await prisma.asset.findMany({
        where: {
          deletedAt: null,
          status: { in: ACTIVE_ASSET_STATUSES },
        },
        select: {
          id: true,
          photographerId: true,
          bucket: true,
          objectKey: true,
          status: true,
          purpose: true,
          type: true,
          sizeBytes: true,
          createdAt: true,
          updatedAt: true,
        },
        take: batchSize,
        orderBy: { id: "asc" },
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });

      if (batch.length === 0) {
        break;
      }

      items.push(...batch);
      cursorId = batch[batch.length - 1].id;
    }
  } catch (error) {
    if (error?.code === "EACCES") {
      throw new Error(
        "Database user lacks read access required for Asset manifest backup. Set R2_BACKUP_DATABASE_URL with backup-read privileges."
      );
    }
    throw error;
  }

  return items;
};

const buildCsv = (items) => {
  const header = [
    "assetId",
    "photographerId",
    "bucket",
    "objectKey",
    "status",
    "purpose",
    "type",
    "sizeBytes",
    "createdAt",
    "updatedAt",
  ];

  const rows = items.map((item) => [
    item.id,
    item.photographerId || "",
    item.bucket,
    item.objectKey,
    item.status,
    item.purpose,
    item.type,
    String(item.sizeBytes || 0),
    item.createdAt instanceof Date ? item.createdAt.toISOString() : "",
    item.updatedAt instanceof Date ? item.updatedAt.toISOString() : "",
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
    .join("\n")
    .concat("\n");
};

const buildJsonManifest = (items, generatedAt) => {
  const totalBytes = items.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);

  return {
    schemaVersion: 1,
    generatedAt,
    totalAssets: items.length,
    totalBytes,
    assets: items.map((item) => ({
      id: item.id,
      photographerId: item.photographerId || null,
      bucket: item.bucket,
      objectKey: item.objectKey,
      status: item.status,
      purpose: item.purpose,
      type: item.type,
      sizeBytes: Number(item.sizeBytes || 0),
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : null,
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : null,
    })),
  };
};

const main = async () => {
  const outputDir = path.resolve(
    process.cwd(),
    process.env.R2_BACKUP_MANIFEST_DIR || DEFAULT_MANIFEST_DIR
  );
  const generatedAt = new Date();
  const timestamp = formatTimestampUtc(generatedAt);

  await fs.mkdir(outputDir, { recursive: true });
  const assets = await fetchActiveAssets();

  const jsonManifest = buildJsonManifest(assets, generatedAt.toISOString());
  const jsonContent = JSON.stringify(jsonManifest, null, 2).concat("\n");
  const csvContent = buildCsv(assets);

  const jsonResult = await writeFileWithChecksum(outputDir, `r2-manifest-${timestamp}.json`, jsonContent);
  const csvResult = await writeFileWithChecksum(outputDir, `r2-manifest-${timestamp}.csv`, csvContent);

  console.log("[backup:r2manifest] Completed");
  console.log(`[backup:r2manifest] Assets: ${assets.length}`);
  console.log(`[backup:r2manifest] JSON: ${jsonResult.filePath}`);
  console.log(`[backup:r2manifest] JSON SHA256: ${jsonResult.checksumPath}`);
  console.log(`[backup:r2manifest] CSV: ${csvResult.filePath}`);
  console.log(`[backup:r2manifest] CSV SHA256: ${csvResult.checksumPath}`);
};

main()
  .catch((error) => {
    console.error(`[backup:r2manifest] Failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  });
