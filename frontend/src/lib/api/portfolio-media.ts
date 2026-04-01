import { getAccessToken } from "../auth";
import { ApiClientError, request, toUrl } from "./core";

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


export const servicesApi = {
  list: () => request<{ items: Array<Record<string, unknown>> }>("/services"),
  create: (payload: Record<string, unknown>) => request<{ service: Record<string, unknown> }>("/services", { method: "POST", body: payload }),
  update: (id: string, payload: Record<string, unknown>) =>
    request<{ service: Record<string, unknown> }>(`/services/${id}`, { method: "PATCH", body: payload }),
  remove: (id: string) => request<{ deleted: boolean }>(`/services/${id}`, { method: "DELETE" }),
};

export const packagesApi = {
  list: (query?: { serviceId?: string }) =>
    request<{ items: Array<Record<string, unknown>>; limits?: { packageFeatures?: number; maxPackageFeatures?: number } }>(
      "/packages",
      { query }
    ),
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
    source?: "WEBSITE" | "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "DIRECT" | "OTHER";
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) =>
    request<{
      items: Array<{
        id: string;
        status: string;
        source?: string | null;
        clientName: string | null;
        clientEmail: string | null;
        clientPhone: string | null;
        message: string | null;
        notes?: string | null;
        preferredDate: string | null;
        preferredTime: string | null;
        createdAt: string;
        leadScore?: number;
        leadTemperature?: "HOT" | "WARM" | "COLD";
        service: { id: string; name: string } | null;
        package: { id: string; name: string } | null;
      }>;
      pagination?: Record<string, unknown>;
      leadFeatures?: {
        plan: string;
        filters: boolean;
        export: boolean;
        reminders: boolean;
        historyDays: number;
        maxVisibleLeads: number;
        advancedAnalytics: boolean;
        templatePack: string;
        templateLimit: number;
        channels: {
          whatsapp: boolean;
          email: boolean;
        };
        upgradeTarget: string | null;
      };
      followUpTemplates?: Array<{
        id: string;
        label: string;
        whatsapp: string;
        emailSubject: string;
        emailBody: string;
      }>;
      upgradeNudges?: Array<{
        id: string;
        type: string;
        title: string;
        body: string;
      }>;
      leadWindow?: {
        historyDays: number;
        historyStart: string | null;
        isHistoryClamped: boolean;
        isVisibleClamped?: boolean;
        maxVisibleLeads?: number;
        effectiveFrom: string | null;
        effectiveTo: string | null;
      };
      leadInsights?: {
        totals: {
          leads: number;
          pending: number;
          confirmed: number;
          completed: number;
          declined: number;
          canceled: number;
          expired: number;
          converted: number;
          responded: number;
        };
        rates: {
          conversionRate: number;
          responseRate: number;
        };
        responseTime: {
          averageMinutes: number | null;
          sampledCount: number;
          sampleLimited: boolean;
        };
        sourceBreakdown: Array<{
          source: string;
          leads: number;
          converted: number;
          conversionRate: number;
        }>;
        trends: {
          daily7d: Array<{ date: string; leads: number; converted: number }>;
          daily30d: Array<{ date: string; leads: number; converted: number }>;
        };
        locked?: {
          advancedAnalytics: boolean;
          upgradeTarget: string;
        };
      };
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
  updateNotes: (bookingId: string, notes: string | null) =>
    request<{ bookingId: string; notes: string | null; updatedAt: string }>(`/bookings/${bookingId}`, {
      method: "PATCH",
      body: { notes },
    }),
  exportCsv: async (query?: {
    status?: "PENDING" | "CONFIRMED" | "DECLINED" | "COMPLETED" | "CANCELED" | "EXPIRED";
    source?: "WEBSITE" | "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "DIRECT" | "OTHER";
    search?: string;
    from?: string;
    to?: string;
  }) => {
    const token = getAccessToken();
    const response = await fetch(toUrl('/bookings/export', query), {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      const text = await response.text();
      if (text) {
        try {
          const payload = JSON.parse(text) as { error?: string };
          errorMessage = payload?.error || errorMessage;
        } catch {
          // ignore non-json
        }
      }
      throw new ApiClientError(errorMessage, response.status, null);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = fileNameMatch?.[1] || `lead-export-${new Date().toISOString().slice(0, 10)}.csv`;
    return { blob, filename };
  },
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




