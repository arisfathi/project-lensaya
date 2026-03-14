import crypto from "node:crypto";

export const randomCode = (prefix = "") => `${prefix}${crypto.randomBytes(8).toString("hex")}`;

export const hashIp = (value = "") => {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
};

export const sha256 = (value = "") => crypto.createHash("sha256").update(value).digest("hex");

export const hmacSha256 = (payload, secret) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");
