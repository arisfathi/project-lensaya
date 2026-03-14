import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

let client = null;

export const getR2Client = () => {
  if (client) return client;

  if (!env.r2.accountId || !env.r2.accessKeyId || !env.r2.secretAccessKey) {
    return null;
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
  });

  return client;
};