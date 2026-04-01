import { prisma } from "../../config/prisma.js";
import {
  DEFAULT_PUBLIC_PRICING_CONTENT,
  PUBLIC_PRICING_CONTENT_SETTING_KEY,
  normalizePublicPricingContent,
} from "../../utils/publicPricingContent.js";
import { ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY, EMAIL_NOTIFICATION_DEFAULTS } from "./adminService.constants.js";
import { normalizeEmailNotificationSettings, nowIso } from "./adminService.utils.js";

let ensureAdminSettingsInitializedPromise = null;

const ensureAdminSettingsInitialized = async () => {
  if (ensureAdminSettingsInitializedPromise) return ensureAdminSettingsInitializedPromise;

  ensureAdminSettingsInitializedPromise = (async () => {
    const existing = await prisma.platformSetting.findUnique({
      where: { key: ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY },
      select: { key: true },
    });

    if (existing) return;

    await prisma.platformSetting.create({
      data: {
        key: ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY,
        value: { ...EMAIL_NOTIFICATION_DEFAULTS },
      },
    });
  })().catch((error) => {
    ensureAdminSettingsInitializedPromise = null;
    throw error;
  });

  return ensureAdminSettingsInitializedPromise;
};

const readAdminSettingsStore = async () => {
  await ensureAdminSettingsInitialized();
  const row = await prisma.platformSetting.findUnique({
    where: { key: ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY },
    select: { value: true, updatedAt: true },
  });

  return {
    emailNotifications: normalizeEmailNotificationSettings(row?.value || null),
    updatedAt: row?.updatedAt || null,
  };
};

const writeAdminSettingsStore = async (settings) => {
  await ensureAdminSettingsInitialized();
  await prisma.platformSetting.upsert({
    where: { key: ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY },
    update: {
      value: settings?.emailNotifications || { ...EMAIL_NOTIFICATION_DEFAULTS },
    },
    create: {
      key: ADMIN_EMAIL_NOTIFICATIONS_SETTING_KEY,
      value: settings?.emailNotifications || { ...EMAIL_NOTIFICATION_DEFAULTS },
    },
  });
};

const readPublicPricingContentStore = async () => {
  const row = await prisma.platformSetting.findUnique({
    where: { key: PUBLIC_PRICING_CONTENT_SETTING_KEY },
    select: { value: true, updatedAt: true },
  });

  const normalized = normalizePublicPricingContent(row?.value || null, DEFAULT_PUBLIC_PRICING_CONTENT);
  return {
    ...normalized,
    updatedAt: row?.updatedAt || null,
  };
};

const writePublicPricingContentStore = async (payload = {}) => {
  const current = await readPublicPricingContentStore();
  const merged = normalizePublicPricingContent(
    {
      bullets: payload?.bullets !== undefined ? payload.bullets : current.bullets,
      compareRows: payload?.compareRows !== undefined ? payload.compareRows : current.compareRows,
    },
    DEFAULT_PUBLIC_PRICING_CONTENT
  );

  await prisma.platformSetting.upsert({
    where: { key: PUBLIC_PRICING_CONTENT_SETTING_KEY },
    update: { value: merged },
    create: {
      key: PUBLIC_PRICING_CONTENT_SETTING_KEY,
      value: merged,
    },
  });

  return readPublicPricingContentStore();
};

export const adminSettingsService = {
  async getSettings({ getPlanLimits }) {
    const adminSettings = await readAdminSettingsStore();
    return {
      planLimits: await getPlanLimits(),
      emailNotifications: normalizeEmailNotificationSettings(adminSettings?.emailNotifications),
    };
  },

  async updateEmailNotifications(payload) {
    const current = await readAdminSettingsStore();
    const emailNotifications = normalizeEmailNotificationSettings(payload);
    await writeAdminSettingsStore({
      ...current,
      emailNotifications,
      updatedAt: nowIso(),
    });

    return { saved: true, ...emailNotifications };
  },

  async updateSettingsPlanLimits(payload, { updatePlanLimits }) {
    const result = await updatePlanLimits(payload);
    return { saved: true, limits: result.limits };
  },

  async getPublicPricingContent() {
    return readPublicPricingContentStore();
  },

  async updatePublicPricingContent(payload = {}) {
    const result = await writePublicPricingContentStore(payload || {});
    return {
      saved: true,
      ...result,
    };
  },
};
