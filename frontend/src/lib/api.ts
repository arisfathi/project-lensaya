import { getAccessToken } from "./auth";
import { getRuntimePublicHost } from "./platform";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  auth?: boolean;
  headers?: Record<string, string>;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

const DEFAULT_LIST_PAGE = 1;
const DEFAULT_REFERRAL_EVENTS_LIMIT = 20;
const MAX_REFERRAL_EVENTS_LIMIT = 100;

export class ApiClientError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 500, details: unknown = null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");

const toUrl = (path: string, query?: RequestOptions["query"]) => {
  const normalized = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const url = new URL(normalized, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  const isAbsoluteUrl = /^https?:\/\//i.test(normalized);
  return isAbsoluteUrl ? url.toString() : `${url.pathname}${url.search}`;
};

const toPositiveInt = (value: number | undefined, fallback: number) => {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAccessToken();
  const method = options.method || "GET";
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (isFormData) {
    Object.keys(headers).forEach((key) => {
      if (key.toLowerCase() === "content-type") {
        delete headers[key];
      }
    });
  }
  if (!isFormData && options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(toUrl(path, options.query), {
    method,
    headers,
    credentials: "include",
    body:
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });

  let payload: ApiEnvelope<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new ApiClientError("Invalid server response", response.status, text);
    }
  }

  if (!response.ok) {
    throw new ApiClientError(
      payload?.error || `Request failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  if (!payload) {
    throw new ApiClientError("Empty response from server", response.status);
  }

  if (!payload.success) {
    throw new ApiClientError(payload.error || "Request failed", response.status, payload);
  }

  return payload.data as T;
}

export const authApi = {
  signup: (input: { fullName: string; email: string; password: string; referralCode?: string }) =>
    request<{
      user: { id: string; email: string; fullName: string; username: string | null; role: string; status: string };
      expiresIn: string;
    }>("/auth/signup", { method: "POST", body: input, auth: false }),
  login: (input: { email: string; password: string }) =>
    request<{
      user: { id: string; email: string; fullName: string; username: string | null; role: string; status: string };
      expiresIn: string;
    }>("/auth/login", { method: "POST", body: input, auth: false }),
  google: (input: { idToken: string; referralCode?: string }) =>
    request<{
      user: { id: string; email: string; fullName: string; username: string | null; role: string; status: string };
      expiresIn: string;
    }>("/auth/google", { method: "POST", body: input, auth: false }),
  me: () =>
    request<{
      id: string;
      role: string;
      fullName: string;
      email: string;
      username: string | null;
      plan: string | null;
      status: string;
    }>("/auth/me"),
  forgotPassword: (input: { email: string }) =>
    request<{ message: string }>("/auth/forgot-password", { method: "POST", body: input, auth: false }),
  resetPassword: (input: { token: string; newPassword: string }) =>
    request<{ message: string }>("/auth/reset-password", { method: "POST", body: input, auth: false }),
  changePassword: (input: { currentPassword?: string; newPassword: string }) =>
    request<{ message: string }>("/users/change-password", { method: "POST", body: input }),
  deleteAccount: (input: { password?: string; confirmation: "DELETE" }) =>
    request<{ deleted: boolean; message: string }>("/users/account", { method: "DELETE", body: input }),
  refresh: () =>
    request<{ expiresIn: string }>("/auth/refresh", {
      method: "POST",
      body: {},
      auth: false,
    }),
  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),
};

export const dashboardApi = {
  overview: () =>
    request<{
      stats: Record<string, number>;
      trafficSeries: Array<{ name: string; views: number }>;
      categorySeries: Array<{ name: string; views: number }>;
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

export const profileApi = {
  get: () =>
    request<{
      studioName: string;
      bio: string | null;
      email: string;
      username: string | null;
      avatarUrl: string | null;
      bannerUrl: string | null;
      heroSubtitle: string | null;
      heroImageUrl: string | null;
      showHero: boolean;
      location: string | null;
      city: string | null;
      country: string | null;
      specialty: string | null;
      style: string | null;
      hideBranding: boolean;
      canHideBranding: boolean;
      socialLinks: { instagram?: string; facebook?: string; tiktok?: string; whatsapp?: string };
      themeColor: string | null;
    }>("/profile"),
  usernamePreview: (studioName: string) =>
    request<{
      studioName: string;
      username: string;
      available: boolean;
      reason: "invalid" | "too_short" | "reserved" | "taken" | null;
    }>("/profile/username-preview", {
      query: { studioName },
    }),
  update: (payload: Record<string, unknown>) => request<{ profile: unknown }>("/profile", { method: "PATCH", body: payload }),
  updateHero: (payload: {
    heroSubtitle?: string;
    heroImageUrl?: string;
    showHero?: boolean;
  }) => request<{ hero: Record<string, unknown> }>("/photographer/hero", { method: "PATCH", body: payload }),
  uploadAvatar: (formData: FormData) =>
    request<{
      avatarUrl: string | null;
    }>("/users/avatar", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  removeAvatar: () =>
    request<{
      removed: boolean;
      avatarUrl: string | null;
    }>("/users/avatar", {
      method: "DELETE",
    }),
};

export const customDomainsApi = {
  get: () =>
    request<{
      deleted?: boolean;
      eligible: boolean;
      currentPlan: string;
      domain: string | null;
      status: "pending" | "awaiting_dns" | "verifying" | "active" | "failed" | "broken" | null;
      sslStatus: "pending" | "issued" | "error" | null;
      failureReason: string | null;
      lastCheckedAt: string | null;
      verifiedAt: string | null;
      fallbackUrl: string;
      dnsInstructions: {
        type: string;
        host: string;
        value: string;
      } | null;
      verificationMode: "mock" | "dns" | string;
    }>("/profile/custom-domain"),
  save: (domain: string) =>
    request<{
      deleted?: boolean;
      eligible: boolean;
      currentPlan: string;
      domain: string | null;
      status: "pending" | "awaiting_dns" | "verifying" | "active" | "failed" | "broken" | null;
      sslStatus: "pending" | "issued" | "error" | null;
      failureReason: string | null;
      lastCheckedAt: string | null;
      verifiedAt: string | null;
      fallbackUrl: string;
      dnsInstructions: {
        type: string;
        host: string;
        value: string;
      } | null;
      verificationMode: "mock" | "dns" | string;
    }>("/profile/custom-domain", {
      method: "PUT",
      body: { domain },
    }),
  verify: () =>
    request<{
      deleted?: boolean;
      eligible: boolean;
      currentPlan: string;
      domain: string | null;
      status: "pending" | "awaiting_dns" | "verifying" | "active" | "failed" | "broken" | null;
      sslStatus: "pending" | "issued" | "error" | null;
      failureReason: string | null;
      lastCheckedAt: string | null;
      verifiedAt: string | null;
      fallbackUrl: string;
      dnsInstructions: {
        type: string;
        host: string;
        value: string;
      } | null;
      verificationMode: "mock" | "dns" | string;
    }>("/profile/custom-domain/verify", {
      method: "POST",
      body: {},
    }),
  disconnect: () =>
    request<{
      deleted?: boolean;
      eligible: boolean;
      currentPlan: string;
      domain: string | null;
      status: "pending" | "awaiting_dns" | "verifying" | "active" | "failed" | "broken" | null;
      sslStatus: "pending" | "issued" | "error" | null;
      failureReason: string | null;
      lastCheckedAt: string | null;
      verifiedAt: string | null;
      fallbackUrl: string;
      dnsInstructions: {
        type: string;
        host: string;
        value: string;
      } | null;
      verificationMode: "mock" | "dns" | string;
    }>("/profile/custom-domain", {
      method: "DELETE",
    }),
};
export const servicesApi = {
  list: () => request<{ items: Array<Record<string, unknown>> }>("/services"),
  create: (payload: Record<string, unknown>) => request<{ service: Record<string, unknown> }>("/services", { method: "POST", body: payload }),
  update: (id: string, payload: Record<string, unknown>) =>
    request<{ service: Record<string, unknown> }>(`/services/${id}`, { method: "PATCH", body: payload }),
  remove: (id: string) => request<{ deleted: boolean }>(`/services/${id}`, { method: "DELETE" }),
};

export const packagesApi = {
  list: (query?: { serviceId?: string }) => request<{ items: Array<Record<string, unknown>> }>("/packages", { query }),
  create: (payload: Record<string, unknown>) => request<{ package: Record<string, unknown> }>("/packages", { method: "POST", body: payload }),
  update: (id: string, payload: Record<string, unknown>) =>
    request<{ package: Record<string, unknown> }>(`/packages/${id}`, { method: "PATCH", body: payload }),
  duplicate: (id: string, name?: string) =>
    request<{ package: Record<string, unknown> }>(`/packages/${id}/duplicate`, { method: "POST", body: { name } }),
  remove: (id: string) => request<{ deleted: boolean }>(`/packages/${id}`, { method: "DELETE" }),
};

export const portfolioApi = {
  list: (query?: { serviceId?: string; category?: string; featured?: boolean }) =>
    request<{ items: Array<Record<string, unknown>>; pagination?: Record<string, unknown> }>("/portfolio/items", { query }),
  create: (payload: Record<string, unknown>) =>
    request<{ item: Record<string, unknown> }>("/portfolio/items", { method: "POST", body: payload }),
  update: (id: string, payload: Record<string, unknown>) =>
    request<{ item: Record<string, unknown> }>(`/portfolio/items/${id}`, { method: "PATCH", body: payload }),
  feature: (id: string, featured: boolean) =>
    request<{ item: Record<string, unknown> }>(`/portfolio/items/${id}/feature`, { method: "PATCH", body: { featured } }),
  remove: (id: string) => request<{ deleted: boolean }>(`/portfolio/items/${id}`, { method: "DELETE" }),
};

export const availabilityApi = {
  get: (month: string) => request<{ month: string; days: Array<{ date: string; status: string }> }>("/availability", { query: { month } }),
  patch: (updates: Array<{ date: string; status: string }>) =>
    request<{ month: string; updatedCount: number }>("/availability", {
      method: "PATCH",
      body: { updates },
    }),
};

export const bookingsApi = {
  list: (query?: {
    status?: "PENDING" | "CONFIRMED" | "DECLINED" | "COMPLETED" | "CANCELED" | "EXPIRED";
    page?: number;
    limit?: number;
  }) =>
    request<{
      items: Array<{
        id: string;
        status: string;
        clientName: string | null;
        clientEmail: string | null;
        clientPhone: string | null;
        message: string | null;
        preferredDate: string | null;
        createdAt: string;
        service: { id: string; name: string } | null;
        package: { id: string; name: string } | null;
      }>;
      pagination?: Record<string, unknown>;
    }>("/bookings", { query }),
  calendar: (month: string) =>
    request<{ month: string; bookedDates: string[]; totals: { booked: number } }>("/bookings/calendar", {
      query: { month },
    }),
  updateStatus: (
    bookingId: string,
    status: "PENDING" | "CONFIRMED" | "DECLINED" | "COMPLETED" | "CANCELED" | "EXPIRED"
  ) =>
    request<{ bookingId: string; status: string; updatedAt: string }>(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      body: { status },
    }),
};

export const uploadsApi = {
  presign: (payload: { fileName: string; mimeType: string; size: number; purpose: "portfolio" | "avatar" | "banner" }) =>
    request<{ assetId: string; uploadUrl: string; publicUrl: string | null; headers: Record<string, string> }>(
      "/uploads/presign",
      { method: "POST", body: payload }
    ),
  complete: async (assetId: string) => {
    const data = await request<{ assetId: string; status: string; url: string | null }>("/uploads/complete", {
      method: "POST",
      body: { assetId },
    });
    return {
      ...data,
      publicUrl: data.url,
    };
  },
  remove: (assetId: string) => request<{ deleted: boolean }>(`/uploads/${assetId}`, { method: "DELETE" }),
};

export const billingApi = {
  plans: () =>
    request<{
      plans: Array<{
        id: string;
        name: string;
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
      }>;
    }>(
      "/billing/plans",
      { auth: false }
    ),
  subscription: () =>
    request<{
      plan: string;
      status: string;
      billingState?: string;
      statusLabel?: string;
      renewAt: string | null;
      nextRenewalAt?: string | null;
      billingCycle?: "monthly" | "yearly" | null;
      cancelAtPeriodEnd?: boolean;
      canceledAt?: string | null;
      trialEndsAt?: string | null;
      graceEndsAt?: string | null;
      provider?: string;
      pendingChange?: {
        type: "plan_change" | "cancellation";
        plan: string;
        billingCycle: "monthly" | "yearly" | null;
        effectiveAt: string | null;
      } | null;
      recentTransition?: {
        fromPlan: string;
        endedAt: string | null;
        reason: string;
      } | null;
      usage: Record<string, unknown>;
    }>("/billing/subscription"),
  changePlan: (payload: {
    targetPlanId: "FREE" | "PRO" | "STUDIO";
    billingCycle?: "monthly" | "yearly";
    successUrl?: string;
    cancelUrl?: string;
    referralCode?: string;
    forceCheckout?: boolean;
  }) =>
    request<{
      action: "checkout_required" | "changed" | "unchanged";
      changeType?: "upgrade" | "downgrade" | "renew";
      currentPlan: string;
      targetPlan: string;
      checkoutUrl?: string | null;
      sessionId?: string | null;
      plan?: string;
      status?: string;
      billingState?: string;
      statusLabel?: string;
      renewAt?: string | null;
      nextRenewalAt?: string | null;
      billingCycle?: "monthly" | "yearly" | null;
      cancelAtPeriodEnd?: boolean;
      trialEndsAt?: string | null;
      graceEndsAt?: string | null;
      provider?: string;
      pendingChange?: {
        type: "plan_change" | "cancellation";
        plan: string;
        billingCycle: "monthly" | "yearly" | null;
        effectiveAt: string | null;
      } | null;
      usage?: Record<string, unknown>;
    }>("/billing/change-plan", {
      method: "POST",
      body: payload,
    }),
  cancelSubscription: (payload?: { atPeriodEnd?: boolean }) =>
    request<{
      action: "scheduled" | "canceled" | "unchanged";
      plan: string;
      status: string;
      billingState?: string;
      statusLabel?: string;
      renewAt: string | null;
      nextRenewalAt?: string | null;
      billingCycle?: "monthly" | "yearly" | null;
      cancelAtPeriodEnd?: boolean;
      canceledAt?: string | null;
      trialEndsAt?: string | null;
      graceEndsAt?: string | null;
      provider?: string;
      pendingChange?: {
        type: "plan_change" | "cancellation";
        plan: string;
        billingCycle: "monthly" | "yearly" | null;
        effectiveAt: string | null;
      } | null;
      usage: Record<string, unknown>;
    }>("/billing/subscription/cancel", {
      method: "POST",
      body: payload || {},
    }),
  resumeSubscription: () =>
    request<{
      action: "resumed" | "unchanged";
      plan: string;
      status: string;
      billingState?: string;
      statusLabel?: string;
      renewAt: string | null;
      nextRenewalAt?: string | null;
      billingCycle?: "monthly" | "yearly" | null;
      cancelAtPeriodEnd?: boolean;
      canceledAt?: string | null;
      trialEndsAt?: string | null;
      graceEndsAt?: string | null;
      provider?: string;
      pendingChange?: {
        type: "plan_change" | "cancellation";
        plan: string;
        billingCycle: "monthly" | "yearly" | null;
        effectiveAt: string | null;
      } | null;
      usage: Record<string, unknown>;
    }>("/billing/subscription/resume", {
      method: "POST",
      body: {},
    }),
  mockCheckoutSession: (sessionId: string) =>
    request<{
      sessionId: string;
      status: string;
      amount: number;
      currency: string;
      currentPlan: string;
      targetPlan: string | null;
      planName: string;
      changeType: string;
      billingCycle: "monthly" | "yearly";
      trialDays: number;
      trialAvailable: boolean;
      redirectUrls: { success: string | null; cancel: string | null };
      provider: string;
    }>("/billing/mock/checkout/" + sessionId),
  completeMockCheckout: (sessionId: string, payload?: { outcome?: "succeeded" | "failed" | "canceled" | "trial" }) =>
    request<{
      sessionId: string;
      outcome: string;
      redirectUrl: string | null;
      subscription: {
        plan: string;
        status: string;
        billingState?: string;
        statusLabel?: string;
        renewAt: string | null;
        nextRenewalAt?: string | null;
        billingCycle?: "monthly" | "yearly" | null;
        cancelAtPeriodEnd?: boolean;
        canceledAt?: string | null;
        trialEndsAt?: string | null;
        graceEndsAt?: string | null;
        provider?: string;
        pendingChange?: {
          type: "plan_change" | "cancellation";
          plan: string;
          billingCycle: "monthly" | "yearly" | null;
          effectiveAt: string | null;
        } | null;
        usage: Record<string, unknown>;
      };
    }>("/billing/mock/checkout/" + sessionId + "/complete", {
      method: "POST",
      body: payload || {},
    }),
  portalSession: (payload?: { returnUrl?: string }) =>
    request<{
      portalUrl: string;
      returnUrl: string | null;
      provider: string;
      capabilities: {
        changePlan: boolean;
        cancelAtPeriodEnd: boolean;
        resume: boolean;
        transactions: boolean;
      };
      subscription: {
        plan: string;
        status: string;
        billingState?: string;
        renewAt: string | null;
        billingCycle?: "monthly" | "yearly" | null;
        cancelAtPeriodEnd: boolean;
        pendingChange?: {
          type: "plan_change" | "cancellation";
          plan: string;
          billingCycle: "monthly" | "yearly" | null;
          effectiveAt: string | null;
        } | null;
      };
    }>("/billing/portal-session", {
      method: "POST",
      body: payload || {},
    }),
  transactions: (query?: {
    status?: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "CANCELED";
    page?: number;
    limit?: number;
  }) =>
    request<{
      items: Array<{
        id: string;
        amount: number;
        currency: string;
        status: string;
        createdAt: string;
        provider?: string;
        plan?: string | null;
        billingCycle?: "monthly" | "yearly";
        description?: string;
        failureReason?: string | null;
        receiptUrl?: string | null;
        receiptAvailable?: boolean;
        receiptLabel?: string;
      }>;
      summary?: {
        totalTransactions: number;
        successfulPayments: number;
        pendingPayments: number;
        paidAmount: number;
        currency: string;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>("/billing/transactions", { query }),
};

export const analyticsApi = {
  overview: () =>
    request<{
      stats: {
        portfolioViews: number;
        whatsappClicks: number;
        inquiries: number;
        conversionRate: number;
        profileClicks?: number;
        monthlyVisitors?: number;
      };
      trafficSeries: Array<Record<string, unknown>>;
      categorySeries: Array<Record<string, unknown>>;
      sourceBreakdown: Array<Record<string, unknown>>;
    }>("/analytics/overview"),
  categories: () =>
    request<{
      categories: Array<{
        name: string;
        views: number;
      }>;
    }>("/analytics/categories"),
  activity: (query?: { page?: number; limit?: number }) =>
    request<{ items: Array<{ at: string; action: string; portfolio: string | null; source: string | null }>; pagination?: Record<string, unknown> }>(
      "/analytics/activity",
      { query }
    ),
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
  siteContext: () =>
    request<{
      host: string | null;
      hostSource: string | null;
      hostType: "platform" | "managed_subdomain" | "custom_domain" | "unknown" | string;
      resolutionStatus: "resolved" | "not_public_host" | "not_found" | "inactive" | "broken" | "upgrade_required" | string;
      message: string | null;
      photographer: {
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
    name: string;
    email: string;
    phone?: string;
    message?: string;
    source?: "WEBSITE" | "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "DIRECT" | "OTHER";
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
        username: string;
        name: string;
        studioName: string;
        bio: string | null;
        avatarUrl: string | null;
        heroSubtitle: string | null;
        heroImageUrl: string | null;
        showHero: boolean;
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

export const notificationsApi = {
  list: (query?: { unreadOnly?: boolean; page?: number; limit?: number }) =>
    request<{ items: Array<Record<string, unknown>>; unreadCount: number; pagination?: Record<string, unknown> }>("/notifications", { query }),
  markRead: (id: string) =>
    request<{ id: string; read: boolean; markedCount?: number }>("/notifications/read", {
      method: "POST",
      body: { id },
    }),
  markAllRead: () =>
    request<{ read: boolean; markedCount: number }>("/notifications/read", {
      method: "POST",
      body: { all: true },
    }),
};

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
        storageGB: number;
        customDomain: boolean;
        analyticsTools: boolean;
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
      storageGB: number;
      customDomain: boolean;
      analyticsTools: boolean;
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
      storageGB: number;
      customDomain: boolean;
      analyticsTools: boolean;
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
      legalPagesMeta: Array<{ slug: string; title: string; updatedAt: string }>;
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
  legalPages: () =>
    request<{
      items: Array<{ slug: string; title: string; updatedAt: string }>;
    }>("/admin/legal-pages"),
  legalPage: (slug: string) =>
    request<{ slug: string; title: string; content: string; updatedAt: string }>(
      `/admin/legal-pages/${encodeURIComponent(slug)}`
    ),
  patchLegalPage: (slug: string, payload: { title?: string; content: string }) =>
    request<{ slug: string; updatedAt: string; title?: string; content: string }>(`/admin/legal-pages/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: payload,
    }),
};

export const getApiErrorMessage = (error: unknown, fallback = "Something went wrong") => {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};





