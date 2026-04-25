import { request } from "./core";

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


export const notificationsApi = {
  list: (query?: { unreadOnly?: boolean; page?: number; limit?: number }) =>
    request<{ items: Array<Record<string, unknown>>; unreadCount: number; pagination?: Record<string, unknown> }>("/users/notifications", { query }),
  markRead: (id: string) =>
    request<{ id: string; read: boolean; markedCount?: number }>("/users/notifications/read", {
      method: "PATCH",
      body: { id },
    }),
  markAllRead: () =>
    request<{ read: boolean; markedCount: number }>("/users/notifications/read", {
      method: "PATCH",
      body: { all: true },
    }),
};


