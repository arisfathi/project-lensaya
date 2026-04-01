import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/apiError.js";
import { resolveAssetUrl, hasProcessedVariants } from "../../utils/assetVariants.js";
import { planLimitService } from "../planLimitService.js";
import { enqueueImageProcessing } from "../../jobs/imageProcessingQueue.js";
import { normalizeUsernameSeed, isReservedUsername } from "../../utils/generateUsername.js";
import { USERNAME_PREVIEW_MIN_LENGTH } from "./photographerService.constants.js";
import {
  normalizeFacebookSlug,
  normalizeInstagramHandle,
  normalizeTeamMembers,
  normalizeTiktokHandle,
  normalizeWhatsappNumber,
  toNullableText,
} from "./photographerService.utils.js";

const getPhotographerByUserId = async (userId) => {
  const photographer = await prisma.photographer.findUnique({ where: { userId } });
  if (!photographer) throw new ApiError(404, "Photographer profile not found");
  return photographer;
};

const scheduleVariantBackfill = (asset) => {
  if (!asset?.id || hasProcessedVariants(asset)) return;
  void enqueueImageProcessing({
    assetId: asset.id,
    jobId: `asset:${asset.id}`,
  });
};

const resolveAssetDeliveryUrl = (asset, preferredVariant = "web") => {
  if (!asset) return null;
  scheduleVariantBackfill(asset);
  return resolveAssetUrl(asset, preferredVariant);
};

const resolveUsernamePreview = async ({ photographer, studioName, db = prisma }) => {
  const normalizedStudioName = String(studioName || "").trim();
  const username = normalizeUsernameSeed(normalizedStudioName);

  if (!username) {
    return {
      studioName: normalizedStudioName,
      username: "",
      available: false,
      reason: "invalid",
    };
  }

  if (username.length < USERNAME_PREVIEW_MIN_LENGTH) {
    return {
      studioName: normalizedStudioName,
      username,
      available: false,
      reason: "too_short",
    };
  }

  if (isReservedUsername(username)) {
    return {
      studioName: normalizedStudioName,
      username,
      available: false,
      reason: "reserved",
    };
  }

  const [existingPhotographer, existingUser] = await Promise.all([
    db.photographer.findFirst({
      where: {
        id: { not: photographer.id },
        username: { equals: username, mode: "insensitive" },
      },
      select: { id: true },
    }),
    db.user.findFirst({
      where: {
        id: { not: photographer.userId },
        username: { equals: username, mode: "insensitive" },
      },
      select: { id: true },
    }),
  ]);

  return {
    studioName: normalizedStudioName,
    username,
    available: !existingPhotographer && !existingUser,
    reason: existingPhotographer || existingUser ? "taken" : null,
  };
};

export const photographerProfileService = {
  async getProfile(userId) {
    const [photographer, plan] = await Promise.all([
      prisma.photographer.findUnique({
        where: { userId },
        include: {
          user: true,
          avatarAsset: true,
          bannerAsset: true,
        },
      }),
      planLimitService.getPlanByUserId(userId),
    ]);
    if (!photographer) throw new ApiError(404, "Photographer profile not found");

    const canHideBranding = String(plan?.name || "FREE").toUpperCase() !== "FREE";
    const planLimits = planLimitService.mapPlanLimits(plan);

    return {
      studioName: photographer.studioName,
      bio: photographer.bio,
      email: photographer.user.email,
      username: photographer.username,
      avatarUrl: resolveAssetDeliveryUrl(photographer.avatarAsset, "thumb"),
      bannerUrl: resolveAssetDeliveryUrl(photographer.bannerAsset, "web"),
      heroTitle: photographer.heroTitle,
      heroSubtitle: photographer.heroSubtitle,
      heroImageUrl: photographer.heroImageUrl || resolveAssetDeliveryUrl(photographer.bannerAsset, "web"),
      showHero: photographer.showHero,
      teamSection: {
        enabled: Boolean(photographer.showTeamSection),
        canManage: Boolean(planLimits.teamSectionTools),
        members: normalizeTeamMembers(photographer.teamMembers),
      },
      location: photographer.location,
      city: photographer.city,
      country: photographer.country,
      specialty: photographer.specialty,
      style: photographer.style,
      hideBranding: canHideBranding ? Boolean(photographer.hideBranding) : false,
      canHideBranding,
      socialLinks: {
        instagram: photographer.instagramHandle,
        facebook: photographer.facebookUrl,
        tiktok: photographer.tiktokHandle,
        whatsapp: photographer.whatsappNumber,
      },
      themeColor: photographer.themeColor,
    };
  },

  async previewUsername(userId, studioName) {
    const photographer = await getPhotographerByUserId(userId);
    return resolveUsernamePreview({ photographer, studioName });
  },

  async updateProfile(userId, data) {
    const photographer = await getPhotographerByUserId(userId);
    const plan = await planLimitService.getPlanByUserId(userId);
    const canHideBranding = String(plan?.name || "FREE").toUpperCase() !== "FREE";
    const planLimits = planLimitService.mapPlanLimits(plan);
    if (data.teamSection !== undefined && !Boolean(planLimits.teamSectionTools)) {
      throw new ApiError(403, "Our Team is not available on your current plan.");
    }
    if (data.hideBranding === true && !canHideBranding) {
      throw new ApiError(403, "Branding can only be hidden on Pro or Studio plans");
    }

    const normalizedInstagram = normalizeInstagramHandle(data.socialLinks?.instagram);
    const normalizedFacebook = normalizeFacebookSlug(data.socialLinks?.facebook);
    const normalizedTiktok = normalizeTiktokHandle(data.socialLinks?.tiktok);
    const normalizedWhatsapp = normalizeWhatsappNumber(data.socialLinks?.whatsapp);
    const normalizedTeamMembers = data.teamSection?.members !== undefined ? normalizeTeamMembers(data.teamSection.members) : undefined;
    const nextStudioName =
      data.studioName !== undefined ? toNullableText(data.studioName, 191) : undefined;
    const studioNameChanged =
      nextStudioName !== undefined && nextStudioName !== String(photographer.studioName || "");

    if (data.studioName !== undefined && !nextStudioName) {
      throw new ApiError(400, "Studio name is required");
    }

    const usernamePreview = studioNameChanged
      ? await resolveUsernamePreview({ photographer, studioName: nextStudioName })
      : null;

    if (usernamePreview && !usernamePreview.available) {
      if (usernamePreview.reason === "too_short") {
        throw new ApiError(400, "Studio name must generate a username with at least 3 characters");
      }
      if (usernamePreview.reason === "reserved") {
        throw new ApiError(400, "This studio name generates a reserved username");
      }
      if (usernamePreview.reason === "taken") {
        throw new ApiError(409, "This studio name generates a username that is already taken");
      }
      throw new ApiError(400, "Unable to generate a valid username from the studio name");
    }

    const nextUsername = studioNameChanged ? usernamePreview?.username || null : null;
    const usernameChanged =
      studioNameChanged &&
      Boolean(nextUsername) &&
      nextUsername !== String(photographer.username || "").toLowerCase();
    const shouldSyncDefaultWebsiteUrl =
      usernameChanged &&
      (!photographer.websiteUrl ||
        photographer.websiteUrl === `${photographer.username}.${env.publicAppDomain}`);

    const userUpdateData = {
      ...(data.email ? { email: data.email } : {}),
      ...(usernameChanged ? { username: nextUsername } : {}),
    };
    const photographerUpdateData = {
      ...(nextStudioName !== undefined ? { studioName: nextStudioName } : {}),
      bio: data.bio,
      instagramHandle: normalizedInstagram,
      facebookUrl: normalizedFacebook,
      tiktokHandle: normalizedTiktok,
      whatsappNumber: normalizedWhatsapp,
      themeColor: data.themeColor,
      ...(data.teamSection?.enabled !== undefined
        ? { showTeamSection: Boolean(data.teamSection.enabled) }
        : {}),
      ...(normalizedTeamMembers !== undefined ? { teamMembers: normalizedTeamMembers } : {}),
      ...(data.location !== undefined ? { location: toNullableText(data.location, 191) } : {}),
      ...(data.city !== undefined ? { city: toNullableText(data.city, 128) } : {}),
      ...(data.country !== undefined ? { country: toNullableText(data.country, 128) } : {}),
      ...(data.specialty !== undefined ? { specialty: toNullableText(data.specialty, 128) } : {}),
      ...(data.style !== undefined ? { style: toNullableText(data.style, 128) } : {}),
      ...(data.hideBranding !== undefined
        ? { hideBranding: canHideBranding ? Boolean(data.hideBranding) : false }
        : {}),
      ...(usernameChanged ? { username: nextUsername } : {}),
      ...(shouldSyncDefaultWebsiteUrl ? { websiteUrl: `${nextUsername}.${env.publicAppDomain}` } : {}),
    };

    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (Object.keys(userUpdateData).length > 0) {
          await tx.user.update({
            where: { id: photographer.userId },
            data: userUpdateData,
          });
        }

        return tx.photographer.update({
          where: { id: photographer.id },
          data: photographerUpdateData,
        });
      });

      return { profile: updated };
    } catch (error) {
      if (String(error?.code || "") === "P2002") {
        const targets = Array.isArray(error?.meta?.target)
          ? error.meta.target.map((item) => String(item))
          : [];
        if (
          usernameChanged &&
          (targets.length === 0 || targets.some((target) => /username/i.test(target)))
        ) {
          throw new ApiError(409, "This studio name generates a username that is already taken");
        }
        if (targets.some((target) => /email/i.test(target))) {
          throw new ApiError(409, "Email is already in use");
        }
      }
      throw error;
    }
  },

  async updateHero(userId, data) {
    const photographer = await getPhotographerByUserId(userId);

    const updated = await prisma.photographer.update({
      where: { id: photographer.id },
      data: {
        ...(data.heroSubtitle !== undefined ? { heroSubtitle: toNullableText(data.heroSubtitle) } : {}),
        ...(data.heroImageUrl !== undefined ? { heroImageUrl: toNullableText(data.heroImageUrl) } : {}),
        ...(data.showHero !== undefined ? { showHero: Boolean(data.showHero) } : {}),
      },
    });

    return {
      hero: {
        heroSubtitle: updated.heroSubtitle,
        heroImageUrl: updated.heroImageUrl,
        showHero: updated.showHero,
      },
    };
  },
};

export { scheduleVariantBackfill, resolveAssetDeliveryUrl };
