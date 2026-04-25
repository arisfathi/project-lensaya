import { getRuntimePublicHost } from "../platform";
import { DEFAULT_LIST_PAGE, DEFAULT_REFERRAL_EVENTS_LIMIT, MAX_REFERRAL_EVENTS_LIMIT, request, toPositiveInt } from "./core";

export const dashboardApi = {
  overview: () =>
    request<{
      photographerId: string;
      stats: Record<string, number>;
      trafficSeries: Array<{ name: string; views: number }>;
      categorySeries: Array<{ name: string; views: number }>;
      analyticsAccess: {
        tier: string;
        hasFullAccess: boolean;
        upgradeTarget: string | null;
        lockedSections: string[];
      };
      analyticsPreview: {
        topCategories: Array<{
          name: string;
          rank: number;
        }>;
        totalCategoriesTracked: number;
      };
      quickCounts: { portfolioCount: number; serviceCount: number; packageCount: number; bookingCount: number };
      plan?: {
        name: string;
        price: number;
        currency: string;
        trialDays: number;
      };
      usage?: {
        services: { used: number; limit: number };
        packages: { used: number; limit: number };
        packagesPerService?: {
          used: number;
          limit: number;
          serviceId?: string | null;
          serviceName?: string | null;
          servicesAtLimit?: number;
        };
        portfolioImages: { used: number; limit: number };
      };
    }>("/dashboard/overview"),
  websiteSummary: () =>
    request<{
      websiteUrl: string;
      portfolioCount: number;
      serviceCount: number;
      packageCount: number;
      lastUpdated: string;
    }>("/dashboard/website-summary"),
};


export const analyticsApi = {
  overview: (query?: { windowDays?: number }) =>
    request<{
      photographerId: string;
      access: {
        tier: string;
        hasFullAccess: boolean;
        upgradeTarget: string | null;
        lockedSections: string[];
      };
      stats: {
        portfolioViews: number;
        packageViews?: number;
        serviceSelections?: number;
        packageSelections?: number;
        whatsappClicks: number;
        inquiries: number;
        packageSelectionRate?: number | null;
        inquiryRateFromSelections?: number | null;
        conversionRate: number | null;
        profileClicks?: number | null;
        monthlyVisitors?: number | null;
      };
      trafficSeries: Array<Record<string, unknown>>;
      categorySeries: Array<{
        name: string;
        views: number;
      }>;
      sourceBreakdown: Array<Record<string, unknown>>;
      comparison?: {
        portfolioViews: { current: number; previous: number; changePercent: number; trend: "up" | "down" };
        packageViews: { current: number; previous: number; changePercent: number; trend: "up" | "down" };
        packageSelections: { current: number; previous: number; changePercent: number; trend: "up" | "down" };
        inquiries: { current: number; previous: number; changePercent: number; trend: "up" | "down" };
        whatsappClicks: { current: number; previous: number; changePercent: number; trend: "up" | "down" };
      } | null;
      funnel?: {
        portfolioViews: number;
        packageViews: number;
        packageSelections: number;
        inquiries: number;
        whatsappClicks: number;
        viewToInquiryRate: number | null;
        selectionToInquiryRate: number | null;
      };
      servicePerformance?: Array<{
        serviceId: string;
        name: string;
        portfolioViews: number;
        packageViews: number;
        serviceSelections: number;
        packageSelections: number;
        inquiries: number;
        conversionRate: number;
      }>;
      packagePerformance?: Array<{
        packageId: string;
        name: string;
        serviceId: string | null;
        packageViews: number;
        packageSelections: number;
        inquiries: number;
        selectionRate: number;
        inquiryRate: number;
      }>;
      sourceFunnelBreakdown?: Array<{
        source: string;
        pageViews: number;
        portfolioViews: number;
        packageViews: number;
        packageSelections: number;
        inquiries: number;
        whatsappClicks: number;
        viewToInquiryRate: number;
      }>;
      goalTracker?: {
        locked: boolean;
        monthLabel: string;
        inquiriesMonthToDate: number;
        daysElapsedInMonth: number;
        daysInMonth: number;
        daysRemainingInMonth: number;
        currentDailyPace: number;
        projectedInquiries: number;
        savedGoalTarget: number | null;
        suggestedGoal: number;
        requiredDailyRateToGoal: number;
        onTrackForSuggestedGoal: boolean;
        history: Array<{
          key: string;
          label: string;
          monthLabel: string;
          inquiries: number;
          target: number;
          attainmentPercent: number;
          achieved: boolean;
          isCurrentMonth: boolean;
        }>;
        streak: {
          current: number;
          best: number;
          totalMonthsAchieved: number;
        };
        badges: Array<{
          id: string;
          label: string;
          threshold: number;
          earned: boolean;
        }>;
      };
      preview: {
        trafficWindowDays: number;
        metricsWindowDays: number;
        contactActions: number;
        topSource: string | null;
        sourceCount: number;
        topCategories: Array<{
          name: string;
          rank: number;
        }>;
        totalCategoriesTracked: number;
      };
    }>("/analytics/overview", { query }),
  categories: () =>
    request<{
      categories: Array<{
        name: string;
        views: number;
      }>;
    }>("/analytics/categories"),
  activity: (query?: { page?: number; limit?: number }) =>
    request<{
      access: {
        tier: string;
        hasFullAccess: boolean;
        upgradeTarget: string | null;
        lockedSections: string[];
      };
      items: Array<{ at: string; action: string; portfolio: string | null; source: string | null }>;
      pagination?: Record<string, unknown>;
      preview: {
        shownCount: number;
        hiddenCount: number;
        totalTrackedEvents: number;
      };
    }>("/analytics/activity", { query }),
  setGoal: (payload: { inquiryGoalTarget: number }) =>
    request<{ inquiryGoalTarget: number }>("/analytics/goal", { method: "PATCH", body: payload }),
  track: (payload: Record<string, unknown>) => request<{ eventId: string | number; accepted: boolean }>("/analytics/events", { method: "POST", body: payload }),
};

export const referralApi = {
  me: () =>
    request<{
      referralCode: string | null;
      totalReferrals: number;
      clicks: number;
      signups: number;
      conversions: number;
      conversionRate: number;
      rewardsEarned: number;
      activeReferrals: number;
    }>("/referrals/me"),
  events: (query?: { page?: number; limit?: number }) => {
    const page = toPositiveInt(query?.page, DEFAULT_LIST_PAGE);
    const limit = Math.min(
      MAX_REFERRAL_EVENTS_LIMIT,
      toPositiveInt(query?.limit, DEFAULT_REFERRAL_EVENTS_LIMIT)
    );

    return request<{
      items: Array<{
        visitorEmail: string | null;
        status: string;
        reward: number;
        date: string;
      }>;
      pagination?: Record<string, unknown>;
    }>("/referrals/me/events", { query: { page, limit } });
  },
};

const getPublicSiteHeaders = (): Record<string, string> => {
  const host = getRuntimePublicHost();
  if (!host) return {};
  return {
    "X-Tenant-Host": host,
  };
};

export const publicApi = {
  plans: () =>
    request<{
      plans: Array<{
        id: string;
        name: string;
        displayName?: string;
        tagline?: string | null;
        subtitle?: string | null;
        badgeText?: string | null;
        ctaText?: string | null;
        monthlyPriceDisplay?: string | null;
        yearlyPriceDisplay?: string | null;
        sortOrder?: number;
        isVisible?: boolean;
        isActive?: boolean;
        isMostPopular?: boolean;
        price: number;
        monthlyPrice?: number;
        yearlyPrice?: number;
        pricing?: {
          monthly: number;
          yearly: number;
        };
        billingCycles?: Array<"monthly" | "yearly">;
        yearlyDiscountPercent?: number;
        currency: string;
        interval: string;
        trialDays: number;
        referralReward: number;
        storageCostPerGB: number;
        packageLimitScope?: "per_service" | string;
        limits: Record<string, number | boolean>;
        features?: Record<string, boolean>;
        entitlements?: Record<string, unknown>;
      }>;
    }>("/billing/plans", { auth: false, credentials: "omit", headers: getPublicSiteHeaders() }),
  siteContext: () =>
    request<{
      host: string | null;
      hostSource: string | null;
      hostType: "platform" | "managed_subdomain" | "custom_domain" | "unknown" | string;
      resolutionStatus: "resolved" | "not_public_host" | "not_found" | "inactive" | "broken" | "upgrade_required" | string;
      message: string | null;
      photographer: {
        id: string;
        username: string;
        studioName: string;
      } | null;
      domain: string | null;
      domainStatus: "pending" | "awaiting_dns" | "verifying" | "active" | "failed" | "broken" | null;
      sslStatus: "pending" | "issued" | "error" | null;
      failureReason: string | null;
      siteUrl: string | null;
      galleryUrl: string | null;
      fallbackUrl: string | null;
      fallbackGalleryUrl: string | null;
      isCustomDomain: boolean;
    }>("/public/site", {
      auth: false,
      headers: getPublicSiteHeaders(),
    }),
  content: (query?: { section?: "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES" | "ABOUT" | "CONTACT" | "LEGAL"; limit?: number }) =>
    request<{
      items: Array<{
        id: string;
        section: "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES" | "ABOUT" | "CONTACT" | "LEGAL";
        slug: string;
        title: string;
        excerpt: string | null;
        contentMarkdown: string;
        sortOrder: number;
        publishedAt: string | null;
        updatedAt: string;
      }>;
    }>("/public/content", { query, auth: false, headers: getPublicSiteHeaders() }),
  pricingContent: () =>
    request<{
      section: {
        title: string;
        subtitle: string;
      };
      faq: Array<{
        question: string;
        answer: string;
      }>;
      upgradeCopy: {
        transitions: {
          PRO: {
            title: string;
            description: string;
          };
          STUDIO: {
            title: string;
            description: string;
          };
        };
        warning: string;
        blocked: string;
        empty: string;
      };
      bullets: {
        FREE: string[];
        PRO: string[];
        STUDIO: string[];
      };
      compareRows: Array<{
        id: string;
        label: string;
        sortOrder: number;
        values: {
          FREE: string;
          PRO: string;
          STUDIO: string;
        };
      }>;
      updatedAt: string | null;
    }>("/public/pricing-content", { auth: false, headers: getPublicSiteHeaders() }),
  trackReferral: (payload: { referralCode: string; visitorId: string }) =>
    request<{ tracked: boolean }>("/public/referrals/track", {
      method: "POST",
      body: payload,
      auth: false,
    }),
  createBooking: (payload: {
    photographerUsername: string;
    serviceId?: string;
    packageId?: string;
    preferredDate?: string;
    preferredTime?: string;
    name: string;
    email: string;
    phone?: string;
    message?: string;
    source: "WEBSITE" | "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "DIRECT" | "OTHER";
  }) =>
    request<{
      bookingId: string;
      status: string;
      whatsappUrl: string | null;
      summary: string;
    }>("/public/bookings", {
      method: "POST",
      body: payload,
      auth: false,
    }),
  featured: (query?: { limit?: number; service?: string }) =>
    request<{
      items: Array<{
        username: string;
        studioName: string | null;
        category: string | null;
        imageUrl: string | null;
        location: string | null;
      }>;
    }>("/public/photographers/featured", { query, auth: false }),
  directory: (query?: {
    search?: string;
    city?: string;
    specialty?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
  }) =>
    request<{
      items: Array<{
        username: string;
        studioName: string | null;
        bio?: string | null;
        category: string | null;
        imageUrl: string | null;
        location: string | null;
        city?: string | null;
        country?: string | null;
        specialty?: string | null;
        style?: string | null;
      }>;
      pagination?: Record<string, unknown>;
    }>("/public/photographers", { query, auth: false }),
  photographer: (username: string) =>
    request<{
      photographer: {
        id: string;
        username: string;
        name: string;
        studioName: string;
        bio: string | null;
        avatarUrl: string | null;
        heroSubtitle: string | null;
        heroImageUrl: string | null;
        showHero: boolean;
      teamSection: {
        enabled: boolean;
        canManage: boolean;
        members: Array<{
          name: string;
          role: string;
          image: string;
        }>;
      };
        location: string | null;
        city: string | null;
        country: string | null;
        specialty: string | null;
        style: string | null;
        showLensayaBranding: boolean;
        socialLinks: {
          instagram: string | null;
          facebook: string | null;
          tiktok: string | null;
        };
        whatsappNumber: string | null;
        phone: string | null;
        themeColor: string | null;
      } | null;
    }>(`/public/photographer/${encodeURIComponent(username)}`, { auth: false }),
  profile: (username: string) =>
    request<{
      username: string;
      name?: string;
      studioName: string;
      bio: string | null;
      avatarUrl: string | null;
      heroSubtitle: string | null;
      heroImageUrl: string | null;
      showHero: boolean;
      teamSection: {
        enabled: boolean;
        canManage: boolean;
        members: Array<{
          name: string;
          role: string;
          image: string;
        }>;
      };
      location: string | null;
      city: string | null;
      country: string | null;
      specialty: string | null;
      style: string | null;
      showLensayaBranding: boolean;
      socialLinks: {
        instagram: string | null;
        facebook: string | null;
        tiktok: string | null;
      };
      whatsappNumber: string | null;
      phone: string | null;
      themeColor: string | null;
    } | null>(`/public/photographers/${encodeURIComponent(username)}`, { auth: false }),
  services: (username: string) =>
    request<{
      services: Array<{
        id: string;
        name: string;
        emoji: string | null;
        thumbnailUrl: string | null;
        order: number;
      }>;
      portfolioImages: Array<{
        id: string;
        imageUrl: string | null;
        serviceId: string | null;
      }>;
    } | null>(`/public/photographers/${encodeURIComponent(username)}/services`, { auth: false }),
  portfolio: (username: string, query?: { serviceId?: string; page?: number; limit?: number }) =>
    request<{
      items: Array<{
        id: string;
        imageUrl: string | null;
        serviceId: string | null;
        category: string | null;
        featured: boolean;
        views: number;
      }>;
      pagination?: Record<string, unknown>;
    } | null>(`/public/photographers/${encodeURIComponent(username)}/portfolio`, { query, auth: false }),
  gallery: (username: string, query?: { category?: string }) =>
    request<{
      items: Array<{
        id: string;
        imageUrl: string | null;
        serviceId: string | null;
        category: string | null;
        featured: boolean;
        views: number;
        createdAt: string;
      }>;
    } | null>(`/public/photographers/${encodeURIComponent(username)}/gallery`, { query, auth: false }),
  packages: (username: string, query?: { serviceId?: string }) =>
    request<{
      items: Array<{
        id: string;
        serviceId: string;
        name: string;
        price: number;
        currency: string;
        duration: string;
        features: string[];
      }>;
    } | null>(`/public/photographers/${encodeURIComponent(username)}/packages`, { query, auth: false }),
  availability: (username: string, month?: string) =>
    request<{
      month: string;
      days: Array<{
        date: string;
        status: string;
      }>;
    } | null>(`/public/photographers/${encodeURIComponent(username)}/availability`, {
      query: month ? { month } : undefined,
      auth: false,
    }),
};


