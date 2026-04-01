import { request } from "./core";

export const adminApi = {
  dashboardOverview: () =>
    request<{
      stats: {
        totalPhotographers: number;
        activePhotographers: number;
        monthlyRevenue: number;
        totalImagesStored: number;
      };
      growthSeries: Array<{ month: string; photographers: number }>;
      planDistribution: Array<{ plan: string; count: number }>;
      uploadsSeries: Array<{ month: string; uploads: number }>;
      revenueSeries: Array<{ month: string; revenue: number }>;
      recentPhotographers: Array<{
        id: string;
        name: string;
        username: string | null;
        plan: string;
        status: string;
        imagesStored?: number;
      }>;
    }>("/admin/dashboard/overview"),
  photographers: (query?: {
    search?: string;
    plan?: "FREE" | "PRO" | "STUDIO";
    status?: "ACTIVE" | "SUSPENDED";
    page?: number;
    limit?: number;
  }) =>
    request<{
      items: Array<{
        id: string;
        name: string;
        username: string | null;
        avatarUrl: string | null;
        plan: "FREE" | "PRO" | "STUDIO";
        status: "ACTIVE" | "SUSPENDED";
        portfolioCount: number;
        imagesStored: number;
        joinDate: string;
        lastActive: string | null;
      }>;
      pagination: Record<string, unknown>;
      countsByPlan: Record<string, number>;
    }>("/admin/photographers", { query }),
  photographerDetail: (id: string) =>
    request<{
      photographer: {
        id: string;
        email: string;
        fullName: string;
        username: string | null;
        status: string;
      };
      subscription: { plan?: string } | null;
      storage: Record<string, unknown>;
      activity: Record<string, unknown>;
    }>(`/admin/photographers/${id}`),
  photographerStatus: (id: string, status: "active" | "suspended") =>
    request<{ id: string; status: string }>(`/admin/photographers/${id}/status`, {
      method: "PATCH",
      body: { status },
    }),
  photographersExport: (query?: {
    plan?: "FREE" | "PRO" | "STUDIO";
    status?: "ACTIVE" | "SUSPENDED";
    from?: string;
    to?: string;
  }) => request<{ downloadUrl: string | null; filters: Record<string, unknown> }>("/admin/photographers/export", { query }),

  subscriptionsOverview: () =>
    request<{
      planStats: { FREE: number; PRO: number; STUDIO: number };
      distribution: Array<{ plan: string; count: number }>;
      upgradesDowngrades: { upgrades: number; downgrades: number };
    }>("/admin/subscriptions/overview"),
  plans: () =>
    request<{
      items: Array<{
        id: string;
        name: string;
        price: number;
        yearlyPrice: number;
        currency: string;
        trialDays: number;
        referralReward: number;
        storageCostPerGB: number;
        maxServices: number;
        maxPortfolioImages: number;
        maxPackages: number;
        maxPackageFeatures: number;
        storageGB: number;
        customDomain: boolean;
        analyticsTools: boolean;
        teamSectionTools: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("/admin/plans"),
  updatePlan: (
    planId: string,
    payload: Partial<{
      name: string;
      price: number;
      yearlyPrice: number;
      currency: string;
      trialDays: number;
      referralReward: number;
      storageCostPerGB: number;
      maxServices: number;
      maxPortfolioImages: number;
      maxPackages: number;
      maxPackageFeatures: number;
      storageGB: number;
      customDomain: boolean;
      analyticsTools: boolean;
      teamSectionTools: boolean;
    }>
  ) =>
    request<{
      id: string;
      name: string;
      price: number;
      yearlyPrice: number;
      currency: string;
      trialDays: number;
      referralReward: number;
      storageCostPerGB: number;
      maxServices: number;
      maxPortfolioImages: number;
      maxPackages: number;
      maxPackageFeatures: number;
      storageGB: number;
      customDomain: boolean;
      analyticsTools: boolean;
      teamSectionTools: boolean;
      createdAt: string;
      updatedAt: string;
    }>(`/admin/plans/${planId}`, {
      method: "PUT",
      body: payload,
    }),
  planLimits: () =>
    request<{
      free: Record<string, unknown>;
      pro: Record<string, unknown>;
      studio: Record<string, unknown>;
    }>("/admin/subscriptions/plan-limits"),
  updatePlanLimits: (payload: Record<string, unknown>) =>
    request<{ updated: boolean; limits: Record<string, unknown> }>("/admin/subscriptions/plan-limits", {
      method: "PATCH",
      body: payload,
    }),
  subscriptionChanges: (query?: { page?: number; limit?: number }) =>
    request<{
      items: Array<{ user: string; from: string; to: string; action: string; at: string }>;
      pagination: Record<string, unknown>;
    }>("/admin/subscriptions/changes", { query }),
  publicPricingContent: () =>
    request<{
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
    }>("/admin/subscriptions/public-pricing"),
  updatePublicPricingContent: (payload: {
    bullets?: {
      FREE: string[];
      PRO: string[];
      STUDIO: string[];
    };
    compareRows?: Array<{
      id?: string;
      label: string;
      sortOrder?: number;
      values: {
        FREE: string;
        PRO: string;
        STUDIO: string;
      };
    }>;
  }) =>
    request<{
      saved: boolean;
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
    }>("/admin/subscriptions/public-pricing", {
      method: "PATCH",
      body: payload,
    }),

  revenueOverview: () =>
    request<{
      mrr: number;
      successRate: number;
      ytdRevenue: number;
      activeSubscriptions: number;
    }>("/admin/revenue/overview"),
  revenueMonthly: () =>
    request<{
      series: Array<{ month: string; revenue: number }>;
    }>("/admin/revenue/monthly"),
  revenueByPlan: () =>
    request<{
      items: Array<{ plan: string; revenue: number }>;
    }>("/admin/revenue/by-plan"),
  revenueTransactions: (query?: { status?: string; page?: number; limit?: number }) =>
    request<{
      items: Array<{
        id: string;
        photographer: string;
        plan: string | null;
        amount: number;
        status: string;
        date: string;
      }>;
      pagination: Record<string, unknown>;
    }>("/admin/revenue/transactions", { query }),

  storageOverview: () =>
    request<{
      totalStorage: { _sum?: { sizeBytes?: number } };
      totalImages: number;
      avgPerUser: number;
      monthlyGrowth: number;
      neonDatabaseSizeBytes: number | null;
    }>("/admin/storage/overview"),
  storageR2Overview: () =>
    request<{
      configured: boolean;
      connected: boolean;
      bucket: string | null;
      prefix: string;
      totalBytes: number;
      totalObjects: number;
      dbReadyBytes: number;
      dbReadyObjects: number;
      deltaBytes: number | null;
      truncated: boolean;
      lastSyncedAt: string;
      message: string | null;
    }>("/admin/storage/r2-overview"),
  storageByPlan: () =>
    request<{
      items: Array<{ plan: string; usage: number }>;
    }>("/admin/storage/by-plan"),
  storageUploads: () =>
    request<{
      series: Array<{ month: string; uploads: number }>;
    }>("/admin/storage/uploads"),
  storageTopUsers: (query?: { page?: number; limit?: number }) =>
    request<{
      items: Array<{
        userId: string;
        name: string;
        plan: string;
        storageUsed: number;
        imageCount: number;
        quotaPercent: number;
      }>;
      pagination: Record<string, unknown>;
    }>("/admin/storage/top-users", { query }),

  moderationOverview: () =>
    request<{
      stats: {
        pendingReports: number;
        reviewedToday: number;
        suspendedAccounts: number;
        flaggedImages: number;
      };
      abuseTypes: Array<{ type: string; count: number }>;
    }>("/admin/moderation/overview"),
  moderationReports: (query?: { status?: string; severity?: string; page?: number; limit?: number }) =>
    request<{
      items: Array<{
        reportId: string;
        photographer: string;
        reports: number;
        reason: string;
        severity: string;
        status: string;
      }>;
      pagination: Record<string, unknown>;
    }>("/admin/moderation/reports", { query }),
  moderationPatchReport: (reportId: string, action: string, note?: string) =>
    request<{
      reportId: string;
      status: string;
      action: string;
    }>(`/admin/moderation/reports/${reportId}`, {
      method: "PATCH",
      body: { action, note },
    }),
  flaggedImages: (query?: { status?: string; page?: number; limit?: number }) =>
    request<{
      items: Array<{
        imageReportId: string;
        photographer: string;
        reason: string;
        reports: number;
        date: string;
        imageUrl: string | null;
      }>;
      pagination: Record<string, unknown>;
    }>("/admin/moderation/flagged-images", { query }),
  patchFlaggedImage: (imageReportId: string, action: string, note?: string) =>
    request<{
      imageReportId: string;
      status: string;
    }>(`/admin/moderation/flagged-images/${imageReportId}`, {
      method: "PATCH",
      body: { action, note },
    }),

  referralsOverview: () =>
    request<{
      stats: {
        totalReferrals: number;
        conversions: number;
      };
      growthSeries: Array<{ month: string; referrals: number; conversions: number }>;
    }>("/admin/referrals/overview"),
  topReferrers: (query?: { page?: number; limit?: number }) =>
    request<{
      items: Array<{
        userId: string;
        referrals: number;
        conversions: number;
        conversionRate: number;
        rewardEarned: number;
      }>;
      pagination: Record<string, unknown>;
    }>("/admin/referrals/top-referrers", { query }),

  analyticsOverview: () =>
    request<{
      trafficSeries: Array<Record<string, unknown>>;
      sourceBreakdown: Array<Record<string, unknown>>;
      portfolioViewsSeries: Array<Record<string, unknown>>;
      engagementMetrics: Array<Record<string, unknown>>;
    }>("/admin/analytics/overview"),

  systemLogs: (query?: {
    q?: string;
    eventType?: string;
    range?: string;
    page?: number;
    limit?: number;
  }) =>
    request<{
      items: Array<{
        id: string;
        timestamp: string;
        event: string;
        user: string | null;
        ip: string | null;
        status: string;
        details: unknown;
      }>;
      pagination: Record<string, unknown>;
    }>("/admin/system-logs", { query }),

  settings: () =>
    request<{
      planLimits: {
        free: Record<string, unknown>;
        pro: Record<string, unknown>;
        studio: Record<string, unknown>;
      };
      emailNotifications: {
        newSignup: boolean;
        subscription: boolean;
        abuse: boolean;
        dailyReport: boolean;
        weeklyReport: boolean;
      };

    }>("/admin/settings"),
  updateEmailNotifications: (payload: {
    newSignup: boolean;
    subscription: boolean;
    abuse: boolean;
    dailyReport: boolean;
    weeklyReport: boolean;
  }) =>
    request<{ saved: boolean }>("/admin/settings/email-notifications", {
      method: "PATCH",
      body: payload,
    }),
  updateSettingsPlanLimits: (payload: Record<string, unknown>) =>
    request<{ saved: boolean; limits: Record<string, unknown> }>("/admin/settings/plan-limits", {
      method: "PATCH",
      body: payload,
    }),
  contentList: (query?: {
    section?: "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES" | "ABOUT" | "CONTACT" | "LEGAL";
    status?: "DRAFT" | "PUBLISHED";
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    request<{
      items: Array<{
        id: string;
        section: "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES" | "ABOUT" | "CONTACT" | "LEGAL";
        slug: string;
        title: string;
        excerpt: string | null;
        contentMarkdown: string;
        status: "DRAFT" | "PUBLISHED";
        sortOrder: number;
        publishedAt: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: Record<string, unknown>;
    }>("/admin/content", { query }),
  contentGet: (contentId: string) =>
    request<{
      id: string;
      section: "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES" | "ABOUT" | "CONTACT" | "LEGAL";
      slug: string;
      title: string;
      excerpt: string | null;
      contentMarkdown: string;
      status: "DRAFT" | "PUBLISHED";
      sortOrder: number;
      publishedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>("/admin/content/" + encodeURIComponent(contentId)),
  contentCreate: (payload: {
    section: "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES" | "ABOUT" | "CONTACT" | "LEGAL";
    slug: string;
    title: string;
    excerpt?: string | null;
    contentMarkdown: string;
    status?: "DRAFT" | "PUBLISHED";
    sortOrder?: number;
    publishedAt?: string | null;
  }) =>
    request<{
      id: string;
      section: "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES" | "ABOUT" | "CONTACT" | "LEGAL";
      slug: string;
      title: string;
      excerpt: string | null;
      contentMarkdown: string;
      status: "DRAFT" | "PUBLISHED";
      sortOrder: number;
      publishedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>("/admin/content", { method: "POST", body: payload }),
  contentPatch: (
    contentId: string,
    payload: Partial<{
      section: "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES" | "ABOUT" | "CONTACT" | "LEGAL";
      slug: string;
      title: string;
      excerpt: string | null;
      contentMarkdown: string;
      status: "DRAFT" | "PUBLISHED";
      sortOrder: number;
      publishedAt: string | null;
    }>
  ) =>
    request<{
      id: string;
      section: "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES" | "ABOUT" | "CONTACT" | "LEGAL";
      slug: string;
      title: string;
      excerpt: string | null;
      contentMarkdown: string;
      status: "DRAFT" | "PUBLISHED";
      sortOrder: number;
      publishedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>("/admin/content/" + encodeURIComponent(contentId), { method: "PATCH", body: payload }),
  contentDelete: (contentId: string) =>
    request<{ deleted: boolean; id: string }>("/admin/content/" + encodeURIComponent(contentId), { method: "DELETE" }),
};

