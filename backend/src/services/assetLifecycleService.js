import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { getR2Client } from "../config/r2.js";
import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { listAssetObjectKeys } from "../utils/assetVariants.js";

const HOURS_TO_MS = 60 * 60 * 1000;

const resolveCutoff = (hours) => new Date(Date.now() - hours * HOURS_TO_MS);

const resolveAssetBucket = (asset) => asset.bucket || env.r2.bucket || "";

export const assetLifecycleService = {
  async purgeDeletedAssets(options = {}) {
    const olderThanHours = Number(options.olderThanHours || 24);
    const take = Number(options.take || 500);
    const cutoff = resolveCutoff(olderThanHours);

    const assets = await prisma.asset.findMany({
      where: {
        status: "DELETED",
        deletedAt: { lt: cutoff },
      },
      select: {
        id: true,
        bucket: true,
        objectKey: true,
        metadata: true,
      },
      orderBy: { deletedAt: "asc" },
      take,
    });

    if (assets.length === 0) {
      return {
        scanned: 0,
        purged: 0,
        failed: 0,
        cutoff,
      };
    }

    const client = getR2Client();
    if (!client) {
      throw new Error("R2 configuration is incomplete");
    }

    let purged = 0;
    let failed = 0;

    for (const asset of assets) {
      const bucket = resolveAssetBucket(asset);
      const objectKeys = listAssetObjectKeys(asset);

      if (!bucket || objectKeys.length === 0) {
        failed += 1;
        logger.warn(
          {
            assetId: asset.id,
            bucket: bucket || null,
            objectKeys,
          },
          "Skipping asset purge due to missing bucket/object key"
        );
        continue;
      }

      try {
        for (const objectKey of objectKeys) {
          await client.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: objectKey,
            })
          );
        }

        const updateResult = await prisma.asset.updateMany({
          where: {
            id: asset.id,
            status: "DELETED",
          },
          data: {
            status: "PURGED",
          },
        });

        if (updateResult.count > 0) {
          purged += 1;
        }
      } catch (error) {
        failed += 1;
        logger.error(
          {
            err: error,
            assetId: asset.id,
            bucket,
            objectKeys,
          },
          "Failed to purge deleted asset"
        );
      }
    }

    return {
      scanned: assets.length,
      purged,
      failed,
      cutoff,
    };
  },
};
