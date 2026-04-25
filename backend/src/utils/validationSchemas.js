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
export const reportIdParamSchema = z.object({ reportId: z.string().uuid() });
export const imageReportIdParamSchema = z.object({ imageReportId: z.string().uuid() });
export const cmsContentIdParamSchema = z.object({ contentId: z.string().uuid() });
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
export const publicGalleryQuerySchema = z
  .object({
    category: z.string().max(64).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  })
  .passthrough();

export const publicServicesQuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().max(100).optional(),
    previewLimit: z.coerce.number().int().positive().max(300).optional(),
  })
  .passthrough();

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

export const analyticsOverviewQuerySchema = z
  .object({
    windowDays: z.coerce.number().int().positive().optional(),
  })
  .passthrough();

export const analyticsGoalUpdateSchema = z.object({
  inquiryGoalTarget: z.coerce.number().int().positive().max(100000),
});

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

export const appleSchema = z
  .object({
    idToken: z.string().min(10).optional(),
    code: z.string().min(6).optional(),
    fullName: z.string().min(2).max(191).optional(),
    referralCode: z.string().min(3).max(64).optional(),
  })
  .refine((value) => Boolean(value.idToken || value.code), {
    message: "Either idToken or code is required",
  });

export const forgotSchema = z.object({ email: z.string().email() });
export const resetSchema = z.object({ token: z.string().min(6), newPassword: z.string().min(8).max(128) });
export const verifyEmailSchema = z.object({ token: z.string().min(6) });
export const resendVerificationSchema = z
  .object({
    email: z.string().email().optional(),
  })
  .passthrough();
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

export const bookingNotesPatchSchema = z.object({
  notes: z.string().max(5000).nullable().optional(),
});

export const bookingListQuerySchema = paginationQuerySchema
  .extend({
    status: z.enum(["PENDING", "CONFIRMED", "DECLINED", "COMPLETED", "CANCELED", "EXPIRED"]).optional(),
    source: z.enum(["WEBSITE", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "TIKTOK", "DIRECT", "OTHER"]).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    search: z.string().max(191).optional(),
  })
  .passthrough();

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
  teamSection: z
    .object({
      enabled: z.boolean().optional(),
      members: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(191),
            role: z.string().trim().min(1).max(191),
            image: z.string().trim().url().max(1024),
          })
        )
        .max(12)
        .optional(),
    })
    .optional(),
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
  path: z.string().min(1).max(512).optional(),
  pageUrl: z.string().max(2048).optional(),
  referrer: z.string().max(1024).optional(),
  metadata: z.any().optional(),
}).superRefine((value, ctx) => {
  if (value.eventType !== "OTHER") return;
  if (value.metadata === undefined || value.metadata === null) return;

  if (typeof value.metadata !== "object" || Array.isArray(value.metadata)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["metadata"],
      message: "metadata must be an object when eventType is OTHER",
    });
    return;
  }

  const metadata = value.metadata;
  const allowedKinds = new Set(["analytics_upgrade_cta", "analytics_insight_action_click"]);
  const allowedInsightActions = new Set(["improve_portfolio_experience", "refine_service_setup", "optimize_packages"]);

  if (metadata.kind !== undefined) {
    if (typeof metadata.kind !== "string" || !allowedKinds.has(metadata.kind)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metadata", "kind"],
        message: "metadata.kind must be one of: analytics_upgrade_cta, analytics_insight_action_click",
      });
      return;
    }
  }

  if (metadata.kind === "analytics_insight_action_click") {
    if (typeof metadata.action !== "string" || !allowedInsightActions.has(metadata.action)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metadata", "action"],
        message: "metadata.action must be one of: improve_portfolio_experience, refine_service_setup, optimize_packages",
      });
    }
    return;
  }

  if (metadata.action !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["metadata", "action"],
      message: "metadata.action is only allowed when metadata.kind is analytics_insight_action_click",
    });
  }
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
  preferredDate: z
    .string()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(new Date(value).getTime()), {
      message: "Invalid preferred date",
    })
    .optional(),
  preferredTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid preferred time")
    .optional(),
  name: z.string().min(2).max(191),
  email: z.string().email(),
  phone: z.string().max(32).optional(),
  message: z.string().max(5000).optional(),
  source: z.enum(["WEBSITE", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "TIKTOK", "DIRECT", "OTHER"]),
});

const stripeWebhookEventSchema = z
  .object({
    id: z.string().min(1).max(255),
    object: z.literal("event").optional(),
    type: z.string().trim().min(3).max(191),
    data: z
      .object({
        object: z.record(z.string(), z.any()),
      })
      .passthrough(),
  })
  .passthrough();

export const webhookPayloadSchema = stripeWebhookEventSchema;

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

const leadChannelsSchema = z
  .object({
    whatsapp: z.boolean().optional(),
    email: z.boolean().optional(),
  })
  .passthrough();

const planEntitlementPatchSchema = z
  .object({
    services: z.number().int().min(-1).max(100000).optional(),
    portfolioImages: z.number().int().min(-1).max(1000000).optional(),
    portfolioPhotos: z.number().int().min(-1).max(1000000).optional(),
    packages: z.number().int().min(-1).max(100000).optional(),
    packagesPerService: z.number().int().min(-1).max(100000).optional(),
    packageFeatures: z.number().int().min(-1).max(100000).optional(),
    maxPackageFeatures: z.number().int().min(-1).max(100000).optional(),
    storage: z.number().int().min(-1).max(100000).optional(),
    storageGb: z.number().int().min(-1).max(100000).optional(),
    leadHistoryDays: z.number().int().min(-1).max(3650).optional(),
    leadVisibilityLimit: z.number().int().min(-1).max(10000000).optional(),
    leadTemplatesCount: z.number().int().min(-1).max(10000).optional(),
    teamSeats: z.number().int().min(-1).max(5000).optional(),
    customDomain: z.boolean().optional(),
    customDomainEnabled: z.boolean().optional(),
    analyticsTools: z.boolean().optional(),
    analyticsEnabled: z.boolean().optional(),
    hideBrandingEnabled: z.boolean().optional(),
    leadFiltersEnabled: z.boolean().optional(),
    leadExportEnabled: z.boolean().optional(),
    leadRemindersEnabled: z.boolean().optional(),
    leadAdvancedAnalyticsEnabled: z.boolean().optional(),
    teamSectionTools: z.boolean().optional(),
    teamToolsEnabled: z.boolean().optional(),
    isVisible: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isMostPopular: z.boolean().optional(),
    analyticsMode: z.enum(["NONE", "BASIC", "ADVANCED"]).optional(),
    leadAnalyticsMode: z.enum(["NONE", "BASIC", "ADVANCED"]).optional(),
    supportTier: z.enum(["STANDARD", "PRIORITY"]).optional(),
    brandingMode: z.enum(["FORCED_LENSAYA", "REMOVABLE"]).optional(),
    leadChannels: leadChannelsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const planLimitsSchema = z
  .object({
    free: planEntitlementPatchSchema.optional(),
    pro: planEntitlementPatchSchema.optional(),
    studio: planEntitlementPatchSchema.optional(),
  })
  .refine((value) => value.free !== undefined || value.pro !== undefined || value.studio !== undefined, {
    message: "At least one plan payload is required",
  });
const publicPricingPlanBulletsSchema = z.object({
  FREE: z.array(z.string().trim().min(1).max(160)).max(12),
  PRO: z.array(z.string().trim().min(1).max(160)).max(12),
  STUDIO: z.array(z.string().trim().min(1).max(160)).max(12),
});

const publicPricingSectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().min(1).max(300),
});

const publicPricingFaqItemSchema = z.object({
  question: z.string().trim().min(1).max(120),
  answer: z.string().trim().min(1).max(500),
});

const publicPricingUpgradeTransitionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(320),
});

const publicPricingUpgradeCopySchema = z.object({
  transitions: z
    .object({
      PRO: publicPricingUpgradeTransitionSchema,
      STUDIO: publicPricingUpgradeTransitionSchema,
    })
    .optional(),
  warning: z.string().trim().min(1).max(180).optional(),
  blocked: z.string().trim().min(1).max(180).optional(),
  empty: z.string().trim().min(1).max(180).optional(),
});

const publicPricingCompareRowSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(100),
  values: z.object({
    FREE: z.string().trim().min(1).max(120),
    PRO: z.string().trim().min(1).max(120),
    STUDIO: z.string().trim().min(1).max(120),
  }),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

export const publicPricingContentPatchSchema = z
  .object({
    section: publicPricingSectionSchema.optional(),
    faq: z.array(publicPricingFaqItemSchema).max(10).optional(),
    upgradeCopy: publicPricingUpgradeCopySchema.optional(),
    bullets: publicPricingPlanBulletsSchema.optional(),
    compareRows: z.array(publicPricingCompareRowSchema).max(30).optional(),
  })
  .refine(
    (value) =>
      value.section !== undefined ||
      value.faq !== undefined ||
      value.upgradeCopy !== undefined ||
      value.bullets !== undefined ||
      value.compareRows !== undefined,
    {
    message: "At least one field is required",
    }
  );

export const subscriptionPlanPutSchema = z
  .object({
    name: z.string().min(2).max(64).optional(),
    displayName: z.string().trim().min(1).max(128).optional(),
    tagline: z.string().trim().max(191).nullable().optional(),
    subtitle: z.string().trim().max(400).nullable().optional(),
    badgeText: z.string().trim().max(80).nullable().optional(),
    ctaText: z.string().trim().max(80).nullable().optional(),
    monthlyPriceDisplay: z.string().trim().max(80).nullable().optional(),
    yearlyPriceDisplay: z.string().trim().max(80).nullable().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    isVisible: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isMostPopular: z.boolean().optional(),
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
    maxPackagesPerService: z.number().int().min(-1).max(100000).optional(),
    maxPackageFeatures: z.number().int().min(-1).max(100000).optional(),
    maxPackageFeaturesPerPackage: z.number().int().min(-1).max(100000).optional(),
    storageGB: z.number().int().min(-1).max(100000).optional(),
    storageGb: z.number().int().min(-1).max(100000).optional(),
    leadHistoryDays: z.number().int().min(-1).max(3650).optional(),
    leadVisibilityLimit: z.number().int().min(-1).max(10000000).optional(),
    leadTemplatesCount: z.number().int().min(-1).max(10000).optional(),
    teamSeats: z.number().int().min(-1).max(5000).optional(),
    customDomain: z.boolean().optional(),
    customDomainEnabled: z.boolean().optional(),
    analyticsTools: z.boolean().optional(),
    analyticsEnabled: z.boolean().optional(),
    hideBrandingEnabled: z.boolean().optional(),
    leadFiltersEnabled: z.boolean().optional(),
    leadExportEnabled: z.boolean().optional(),
    leadRemindersEnabled: z.boolean().optional(),
    leadAdvancedAnalyticsEnabled: z.boolean().optional(),
    teamSectionTools: z.boolean().optional(),
    teamToolsEnabled: z.boolean().optional(),
    analyticsMode: z.enum(["NONE", "BASIC", "ADVANCED"]).optional(),
    leadAnalyticsMode: z.enum(["NONE", "BASIC", "ADVANCED"]).optional(),
    supportTier: z.enum(["STANDARD", "PRIORITY"]).optional(),
    brandingMode: z.enum(["FORCED_LENSAYA", "REMOVABLE"]).optional(),
    leadChannels: leadChannelsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });


export const cmsContentQuerySchema = z
  .object({
    section: z.enum(["RESOURCES", "HELP_CENTER", "BLOG", "GUIDES", "ABOUT", "CONTACT", "LEGAL"]).optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    search: z.string().max(191).optional(),
    q: z.string().max(191).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .passthrough();
export const cmsContentCreateSchema = z.object({
  section: z.enum(["RESOURCES", "HELP_CENTER", "BLOG", "GUIDES", "ABOUT", "CONTACT", "LEGAL"]),
  slug: z.string().trim().min(2).max(191),
  title: z.string().trim().min(2).max(191),
  excerpt: z.string().max(500).optional().nullable(),
  contentMarkdown: z.string().max(200000),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
  publishedAt: z.string().datetime().optional().nullable(),
});

export const cmsContentPatchSchema = cmsContentCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const publicContentQuerySchema = z
  .object({
    section: z.enum(["RESOURCES", "HELP_CENTER", "BLOG", "GUIDES", "ABOUT", "CONTACT", "LEGAL"]).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .passthrough();




