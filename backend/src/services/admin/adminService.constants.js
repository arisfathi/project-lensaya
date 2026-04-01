export const PLAN_TIERS = ["FREE", "PRO", "STUDIO"];

export const PLAN_KEY_BY_NAME = {
  FREE: "free",
  PRO: "pro",
  STUDIO: "studio",
};

export const PLAN_NAME_BY_KEY = {
  free: "FREE",
  pro: "PRO",
  studio: "STUDIO",
};

export const BILLING_ACTIVE_STATUSES = new Set(["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"]);

export const R2_UPLOADS_PREFIX = "uploads/";

export const ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY = "admin_email_notifications";
export const ADMIN_STORAGE_R2_SNAPSHOT_KEY = "admin_storage_r2_snapshot";
export const ADMIN_STORAGE_R2_CACHE_KEY = "cache:admin:storage-r2-overview:v1";
export const ADMIN_STORAGE_R2_CACHE_TTL_SECONDS = 60;

export const CMS_SECTIONS = ["RESOURCES", "HELP_CENTER", "BLOG", "GUIDES", "ABOUT", "CONTACT", "LEGAL"];
export const CMS_STATUSES = ["DRAFT", "PUBLISHED"];

export const EMAIL_NOTIFICATION_DEFAULTS = Object.freeze({
  newSignup: true,
  subscription: true,
  abuse: true,
  dailyReport: false,
  weeklyReport: true,
});

export const MODERATION_REPORT_ACTIONS = new Set(["approve", "suspend", "escalate"]);
export const MODERATION_IMAGE_ACTIONS = new Set(["approve", "remove"]);
