export type UsernamePreviewReason = "invalid" | "too_short" | "reserved" | "taken" | null;

export const USERNAME_PREVIEW_MIN_LENGTH = 3;

export const normalizeUsernameSeed = (value: string | null | undefined) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 64);

export const getUsernamePreviewReasonMessage = (reason: UsernamePreviewReason) => {
  if (reason === "too_short") {
    return "Use a studio name that generates at least 3 letters or numbers.";
  }
  if (reason === "reserved") {
    return "This studio name generates a reserved pages username.";
  }
  if (reason === "taken") {
    return "This studio name generates a pages username that is already taken.";
  }
  if (reason === "invalid") {
    return "Enter a studio name to generate a pages username.";
  }
  return null;
};
