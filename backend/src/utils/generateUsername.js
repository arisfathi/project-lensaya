import { ApiError } from "./apiError.js";
import { randomCode } from "./crypto.js";

const RESERVED_USERNAMES = new Set(["www", "app", "admin", "api"]);

export const normalizeUsernameSeed = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 64);

export const isReservedUsername = (value = "") => RESERVED_USERNAMES.has(String(value || "").toLowerCase());

export const generateUsername = async (seed, db) => {
  if (!db?.photographer?.findUnique) {
    throw new ApiError(500, "Username generator requires a valid database client");
  }

  let base = normalizeUsernameSeed(seed);
  if (!base) {
    base = `studio${randomCode().slice(0, 6)}`;
  }

  if (isReservedUsername(base)) {
    base = `${base}${randomCode().slice(0, 2)}`;
  }

  let candidate = base;
  let attempt = 1;

  while (await db.photographer.findUnique({ where: { username: candidate }, select: { id: true } })) {
    const suffix = String(attempt);
    candidate = `${base.slice(0, Math.max(3, 64 - suffix.length))}${suffix}`;
    attempt += 1;
    if (attempt > 500) {
      throw new ApiError(500, "Unable to generate unique username");
    }
  }

  return candidate;
};
