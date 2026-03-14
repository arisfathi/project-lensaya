import { z } from "zod";

export const emptySchema = z.object({}).passthrough();
export const emptyQuerySchema = z.object({}).passthrough();

export const idParamSchema = z.object({ id: z.string().uuid() });
export const usernameParamSchema = z.object({ username: z.string().min(2).max(64) });
export const serviceIdParamSchema = z.object({ serviceId: z.string().min(1).max(64) });
export const packageIdParamSchema = z.object({ packageId: z.string().min(1).max(64) });
export const itemIdParamSchema = z.object({ itemId: z.string().min(1).max(64) });
export const bookingIdParamSchema = z.object({ bookingId: z.string().min(1).max(64) });
export const assetIdParamSchema = z.object({ assetId: z.string().min(1).max(64) });
export const planIdParamSchema = z.object({ planId: z.string().uuid() });
export const checkoutSessionIdParamSchema = z.object({ sessionId: z.string().uuid() });
export const slugParamSchema = z.object({ slug: z.string().min(2).max(128) });
export const reportIdParamSchema = z.object({ reportId: z.string().uuid() });
export const imageReportIdParamSchema = z.object({ imageReportId: z.string().uuid() });
export const notificationReadSchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    ids: z.array(z.string().min(1).max(64)).max(100).optional(),
    all: z.boolean().optional(),
  })
  .refine(
    (value) => Boolean(value.all || value.id || (Array.isArray(value.ids) && value.ids.length > 0)),
    {
      message: "id, ids, or all=true is required",
    }
  );

export const monthQuerySchema = z.object({ month: z.string().min(1).max(32).optional() }).passthrough();
export const publicGalleryQuerySchema = z.object({ category: z.string().max(64).optional() }).passthrough();

export const uuidParam = z.object({
  serviceId: z.string().uuid().optional(),
  packageId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  reportId: z.string().optional(),
  imageReportId: z.string().optional(),
  slug: z.string().optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const basicListQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().max(191).optional(),
    q: z.string().max(191).optional(),
    status: z.string().max(64).optional(),
    city: z.string().max(128).optional(),
    specialty: z.string().max(128).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
  })
  .passthrough();

export const signupSchema = z.object({
  fullName: z.string().min(2).max(191),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  referralCode: z.string().min(3).max(64).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const googleSchema = z.object({
  idToken: z.string().min(10),
  referralCode: z.string().min(3).max(64).optional(),
});

export const forgotSchema = z.object({ email: z.string().email() });
export const resetSchema = z.object({ token: z.string().min(6), newPassword: z.string().min(8).max(128) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: z.string().min(8).max(128),
});
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128).optional(),
  confirmation: z.literal("DELETE"),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(10).optional() }).passthrough();

export const bookingStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "DECLINED", "COMPLETED", "CANCELED", "EXPIRED"]),
});

export const usernamePreviewQuerySchema = z.object({
  studioName: z.string().max(191),
}).passthrough();

export const profilePatchSchema = z.object({
  studioName: z.string().trim().min(2).max(191).optional(),
  bio: z.string().max(10000).optional(),
  email: z.string().email().optional(),
  location: z.string().max(191).optional(),
  city: z.string().max(128).optional(),
  country: z.string().max(128).optional(),
  specialty: z.string().max(128).optional(),
  style: z.string().max(128).optional(),
  hideBranding: z.boolean().optional(),
  socialLinks: z
    .object({
      instagram: z.string().max(191).optional(),
      facebook: z.string().max(255).optional(),
      tiktok: z.string().max(191).optional(),
      whatsapp: z.string().max(32).optional(),
    })
    .optional(),
  themeColor: z.string().max(16).optional(),
});

export const heroPatchSchema = z.object({
  heroSubtitle: z.string().max(10000).optional(),
  heroImageUrl: z.string().max(1024).optional(),
  showHero: z.boolean().optional(),
});

export const customDomainConnectSchema = z.object({
  domain: z.string().trim().min(1).max(255),
});

export const serviceCreateSchema = z.object({
  name: z.string().min(1).max(191),
  description: z.string().max(10000).optional(),
  emoji: z.string().max(32).optional(),
  thumbnailAssetId: z.string().uuid().optional(),
  order: z.number().int().min(0).optional(),
});

export const servicePatchSchema = serviceCreateSchema.partial();

export const packageCreateSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string().min(1).max(191),
  price: z.number().nonnegative(),
  duration: z.string().max(64),
  features: z.array(z.string().max(255)).default([]),
  popular: z.boolean().optional(),
});

export const packagePatchSchema = packageCreateSchema.partial();
export const packageDuplicateSchema = z.object({ name: z.string().max(191).optional() });

export const portfolioCreateSchema = z.object({
  serviceId: z.string().uuid().optional(),
  category: z.string().max(64).optional(),
  imageAssetId: z.string().uuid(),
  featured: z.boolean().optional(),
});

export const portfolioPatchSchema = z.object({
  serviceId: z.string().uuid().optional(),
  category: z.string().max(64).optional(),
  featured: z.boolean().optional(),
});

export const featureSchema = z.object({ featured: z.boolean() });

export const availabilityPatchSchema = z.object({
  updates: z.array(
    z.object({
      date: z.string().datetime(),
      status: z.enum(["AVAILABLE", "BOOKED"]),
    })
  ),
});

export const analyticsEventSchema = z.object({
  eventType: z.enum([
    "PAGE_VIEW",
    "PORTFOLIO_VIEW",
    "PROFILE_CLICK",
    "PACKAGE_VIEW",
    "WHATSAPP_CLICK",
    "BOOKING_INTENT",
    "PORTFOLIO_SHARE",
    "SERVICE_SELECT",
    "PACKAGE_SELECT",
    "SEARCH",
    "FILTER",
    "OTHER",
  ]),
  photographerId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  packageId: z.string().uuid().optional(),
  portfolioItemId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  sessionId: z.string().max(128).optional(),
  visitorId: z.string().max(128).optional(),
  source: z.string().max(64).optional(),
  metadata: z.any().optional(),
});

export const portfolioViewSchema = z.object({
  photographerId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  packageId: z.string().uuid().optional(),
  portfolioItemId: z.string().uuid().optional(),
  sessionId: z.string().max(128).optional(),
  visitorId: z.string().max(128).optional(),
  path: z.string().min(1).max(512),
  source: z.string().min(1).max(64),
  metadata: z.any().optional(),
});

export const uploadPresignSchema = z.object({
  fileName: z.string().max(255),
  mimeType: z.string().max(191),
  size: z.number().int().positive(),
  purpose: z.enum(["portfolio", "avatar", "banner"]),
});

export const uploadCompleteSchema = z.object({ assetId: z.string().uuid() });
export const avatarUpdateSchema = z.object({ assetId: z.string().uuid() });

export const changePlanSchema = z.object({
  targetPlanId: z.enum(["FREE", "PRO", "STUDIO"]),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  referralCode: z.string().max(64).optional(),
  forceCheckout: z.boolean().optional(),
});
export const cancelSubscriptionSchema = z.object({
  atPeriodEnd: z.boolean().optional(),
});

export const portalSchema = z.object({ returnUrl: z.string().url().optional() });
export const mockCheckoutCompleteSchema = z.object({
  outcome: z.enum(["succeeded", "failed", "canceled", "trial"]).optional(),
});

export const referralTrackSchema = z.object({
  referralCode: z.string().min(3).max(64),
  visitorId: z.string().min(3).max(191),
});

export const publicBookingCreateSchema = z.object({
  photographerUsername: z.string().min(2).max(64),
  serviceId: z.string().uuid().optional(),
  packageId: z.string().uuid().optional(),
  preferredDate: z.string().datetime().optional(),
  name: z.string().min(2).max(191),
  email: z.string().email(),
  phone: z.string().max(32).optional(),
  message: z.string().max(5000).optional(),
  source: z.enum(["WEBSITE", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "DIRECT", "OTHER"]).optional(),
});

const webhookIdentifierSchema = z.union([z.string(), z.number()]).optional();

const webhookCorePayloadSchema = z
  .object({
    id: webhookIdentifierSchema,
    transaction_id: webhookIdentifierSchema,
    transactionId: webhookIdentifierSchema,
    purchase_id: webhookIdentifierSchema,
    purchaseId: webhookIdentifierSchema,
    status: z.string().trim().min(1).max(64),
    amount: z.coerce.number().finite().nonnegative().optional(),
    currency: z.string().trim().min(2).max(16).optional(),
    metadata: z.record(z.string(), z.any()).nullable().optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const hasIdentifier = [
      value.id,
      value.transaction_id,
      value.transactionId,
      value.purchase_id,
      value.purchaseId,
    ].some((item) => item !== undefined && item !== null && String(item).trim() !== "");

    if (!hasIdentifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Webhook payload requires at least one identifier field",
      });
    }
  });

export const webhookPayloadSchema = z
  .union([
    webhookCorePayloadSchema,
    z.object({ data: webhookCorePayloadSchema }).passthrough(),
  ])
  .transform((value) => {
    if (value && typeof value === "object" && "data" in value && value.data) {
      return {
        ...value.data,
        _envelope: value,
      };
    }

    return value;
  });

export const clientErrorSchema = z.object({
  type: z.enum(["error", "unhandledrejection"]).optional(),
  message: z.string().max(2000),
  stack: z.string().max(12000).optional(),
  source: z.string().max(1024).optional(),
  url: z.string().max(2048).optional(),
  userAgent: z.string().max(1024).optional(),
  timestamp: z.string().datetime().optional(),
  context: z.record(z.string(), z.any()).optional(),
}).passthrough();

export const adminStatusSchema = z.object({ status: z.enum(["active", "suspended"]) });
export const adminActionSchema = z.object({ action: z.string().min(3).max(64), note: z.string().max(1000).optional() });
export const moderationReportActionSchema = z.object({
  action: z.enum(["approve", "suspend", "escalate"]),
  note: z.string().max(1000).optional(),
});
export const moderationImageActionSchema = z.object({
  action: z.enum(["approve", "remove"]),
  note: z.string().max(1000).optional(),
});

export const emailSettingsSchema = z.object({
  newSignup: z.boolean(),
  subscription: z.boolean(),
  abuse: z.boolean(),
  dailyReport: z.boolean(),
  weeklyReport: z.boolean(),
});

export const planLimitsSchema = z.object({
  free: z.any().optional(),
  pro: z.any().optional(),
  studio: z.any().optional(),
});

export const subscriptionPlanPutSchema = z
  .object({
    name: z.string().min(2).max(64).optional(),
    price: z.coerce.number().min(0).max(1000000).optional(),
    yearlyPrice: z.coerce.number().min(0).max(1000000).optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3)
      .optional(),
    trialDays: z.coerce.number().int().min(0).max(3650).optional(),
    referralReward: z.coerce.number().min(0).max(1000000).optional(),
    storageCostPerGB: z.coerce.number().min(0).max(1000000).optional(),
    maxServices: z.number().int().min(-1).max(100000).optional(),
    maxPortfolioImages: z.number().int().min(-1).max(1000000).optional(),
    maxPackages: z.number().int().min(-1).max(100000).optional(),
    storageGB: z.number().int().min(-1).max(100000).optional(),
    customDomain: z.boolean().optional(),
    analyticsTools: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const legalPatchSchema = z.object({
  title: z.string().max(191).optional(),
  content: z.string().max(200000),
});


