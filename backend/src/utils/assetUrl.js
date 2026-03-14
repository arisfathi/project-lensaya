import { env } from "../config/env.js";

export const buildPublicAssetUrl = (objectKey) => {
  const base = (env.r2.publicBaseUrl || "").replace(/\/+$/, "");
  const key = String(objectKey || "").replace(/^\/+/, "");
  if (!base || !key) {
    return null;
  }
  return `${base}/${key}`;
};
