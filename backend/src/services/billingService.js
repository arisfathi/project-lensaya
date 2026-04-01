import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { chipService } from "./chipService.js";
import { billingProviderService } from "./billingProviderService.js";
import { referralService } from "./referralService.js";
import { notificationService } from "./notificationService.js";
import { planLimitService } from "./planLimitService.js";
import { ApiError } from "../utils/apiError.js";
import { getPagination, buildPagination } from "../utils/pagination.js";
import { enqueueImageProcessing } from "../jobs/imageProcessingQueue.js";
import { isTransientDatabaseError, retryWithExponentialBackoff } from "../utils/retry.js";

const decimalToNumber = (value, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toPlanLabel = (name = "") => {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return "Plan";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};
const PLAN_TIERS = new Set(["FREE", "PRO", "STUDIO"]);
const PLAN_RANK = { FREE: 0, PRO: 1, STUDIO: 2 };
const SUBSCRIPTION_ACTIVE_STATUSES = new Set(["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"]);
const SUBSCRIPTION_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPROCESSABLE_PURPOSES = ["PORTFOLIO", "SERVICE_THUMBNAIL"];
const BILLING_ASSET_REPROCESS_MAX_ATTEMPTS = env.nodeEnv === "test" ? 1 : 5;
const BILLING_ASSET_REPROCESS_BASE_DELAY_MS = 5000;
const BILLING_ASSET_REPROCESS_MAX_DELAY_MS = 2 * 60 * 1000;

const isUuid = (value) => UUID_PATTERN.test(String(value || "").trim());
const toPlanTier = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return PLAN_TIERS.has(normalized) ? normalized : null;
};
const resolveConfiguredChipBrandId = (planTier) => {
  const tier = toPlanTier(planTier);
  if (!tier) return "";
  return String(env.chip?.brandIds?.[tier] || "").trim();
};
const resolveChipBrandId = (plan) => {
  const tier = toPlanTier(plan?.name);
  const configuredBrandId = resolveConfiguredChipBrandId(tier);
  if (configuredBrandId) {
    return configuredBrandId;
  }

  if (env.isProduction) {
    throw new ApiError(
      503,
      `Billing checkout is not configured for ${tier || "the selected"} plan. Set CHIP_BRAND_ID_${tier || "PLAN"}.`
    );
  }

  return String(plan?.id || "").trim();
};
const getFrontendBaseUrl = () => {
  const candidate = String(env.appUrl || env.publicAppUrl || env.frontendUrl || "").trim();
  if (!candidate) {
    throw new ApiError(500, "APP_URL is not configured for billing redirects");
  }
  try {
    return new URL(candidate).toString().replace(/\/+$/, "");
  } catch {
    throw new ApiError(500, "APP_URL is invalid for billing redirects");
  }
};
const normalizeReturnUrl = (value) => {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.toString();
  } catch {
    return null;
  }
};
const isActiveSubscriptionStatus = (value) => SUBSCRIPTION_ACTIVE_STATUSES.has(String(value || "").trim().toUpperCase());
const resolvePlanChangeType = (currentPlan, targetPlan, currentBillingCycle = "monthly", targetBillingCycle = "monthly") => {
  const currentTier = toPlanTier(currentPlan) || "FREE";
  const targetTier = toPlanTier(targetPlan) || "FREE";
  const normalizedCurrentCycle = normalizeBillingCycle(currentBillingCycle);
  const normalizedTargetCycle = normalizeBillingCycle(targetBillingCycle);

  if (currentTier === targetTier) {
    if (normalizedCurrentCycle === normalizedTargetCycle) return "renew";
    return normalizedTargetCycle === "yearly" ? "upgrade" : "downgrade";
  }

  if ((PLAN_RANK[targetTier] || 0) > (PLAN_RANK[currentTier] || 0)) return "upgrade";
  return "downgrade";
};
const mapUsageMetric = (used, limit) => ({
  used: Number(used || 0),
  limit: Number(limit || 0),
});
const toBillingIntervalEnum = (billingCycle = "monthly") =>
  normalizeBillingCycle(billingCycle) === "yearly" ? "YEARLY" : "MONTHLY";
const fromBillingIntervalEnum = (billingInterval = "MONTHLY") =>
  String(billingInterval || "MONTHLY").trim().toUpperCase() === "YEARLY" ? "yearly" : "monthly";
const resolveSubscriptionBillingCycle = (subscription) => {
  if (subscription?.billingInterval) {
    return fromBillingIntervalEnum(subscription.billingInterval);
  }

  if (subscription?.currentPeriodStart && subscription?.currentPeriodEnd) {
    const durationMs =
      new Date(subscription.currentPeriodEnd).getTime() - new Date(subscription.currentPeriodStart).getTime();
    if (Number.isFinite(durationMs) && durationMs >= 45 * 24 * 60 * 60 * 1000) {
      return "yearly";
    }
  }

  return "monthly";
};
const resolveGraceEndsAt = (subscription) => {
  if (!subscription?.currentPeriodEnd) return null;
  return new Date(new Date(subscription.currentPeriodEnd).getTime() + SUBSCRIPTION_GRACE_PERIOD_MS);
};
const resolvePendingChange = (subscription) => {
  if (!subscription) return null;

  if (subscription.pendingPlan) {
    return {
      type: "plan_change",
      plan: subscription.pendingPlan,
      billingCycle: fromBillingIntervalEnum(subscription.pendingBillingInterval || subscription.billingInterval),
      effectiveAt: subscription.currentPeriodEnd || null,
    };
  }

  if (subscription.cancelAtPeriodEnd && subscription.plan !== "FREE") {
    return {
      type: "cancellation",
      plan: "FREE",
      billingCycle: null,
      effectiveAt: subscription.currentPeriodEnd || null,
    };
  }

  return null;
};
const resolveRecentPaidTransition = (subscription, latestPaid) => {
  if (!subscription || subscription.plan !== "FREE" || !latestPaid) {
    return null;
  }

  const endedAt = latestPaid.canceledAt || latestPaid.currentPeriodEnd || latestPaid.updatedAt || latestPaid.createdAt || null;
  const normalizedStatus = normalizeSubscriptionStatus(latestPaid.status);

  if (!["CANCELED", "EXPIRED"].includes(normalizedStatus)) {
    return null;
  }

  return {
    fromPlan: latestPaid.plan,
    endedAt,
    reason: normalizedStatus === "EXPIRED" ? "downgraded" : "canceled",
  };
};
const resolveBillingState = (subscription, latestPaid) => {
  const status = normalizeSubscriptionStatus(subscription?.status || "ACTIVE");

  if ((subscription?.plan || "FREE") === "FREE") {
    const recentTransition = resolveRecentPaidTransition(subscription, latestPaid);
    return recentTransition?.reason === "downgraded" ? "downgraded" : "free";
  }

  if (subscription?.cancelAtPeriodEnd) return "cancelled";
  if (status === "TRIALING") return "trialing";
  if (status === "ACTIVE") return "active";
  if (status === "PAST_DUE" || status === "INCOMPLETE") return "past_due";
  if (status === "CANCELED") return "cancelled";
  if (status === "EXPIRED") return "expired";
  return status.toLowerCase();
};
const resolveStatusLabel = (billingState) => {
  if (billingState === "past_due") return "Past Due";
  if (billingState === "trialing") return "Trialing";
  if (billingState === "cancelled") return "Cancelled";
  if (billingState === "downgraded") return "Downgraded";
  if (billingState === "free") return "Free Plan";
  if (billingState === "active") return "Active";
  if (billingState === "expired") return "Expired";
  return toPlanLabel(billingState || "unknown");
};
const mapSubscriptionResponse = (subscription, usage = {}, latestPaid = null) => {
  const billingCycle = resolveSubscriptionBillingCycle(subscription);
  const billingState = resolveBillingState(subscription, latestPaid);
  const pendingChange = resolvePendingChange(subscription);
  const recentTransition = resolveRecentPaidTransition(subscription, latestPaid);

  return {
    plan: subscription?.plan || "FREE",
    status: String(subscription?.status || "ACTIVE").toLowerCase(),
    billingState,
    statusLabel: resolveStatusLabel(billingState),
    renewAt: subscription?.currentPeriodEnd || null,
    nextRenewalAt: subscription?.currentPeriodEnd || null,
    billingCycle: subscription?.plan === "FREE" ? null : billingCycle,
    cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    canceledAt: subscription?.canceledAt || null,
    trialEndsAt: subscription?.trialEndsAt || null,
    graceEndsAt: billingState === "past_due" ? resolveGraceEndsAt(subscription) : null,
    provider: billingProviderService.mapRuntimeProvider(
      subscription?.provider || "MANUAL",
      subscription?.providerSubscriptionId || ""
    ),
    pendingChange,
    recentTransition,
    usage,
  };
};
const normalizeWebhookMetadata = (payload) => {
  if (!payload || typeof payload !== "object") return {};
  if (payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)) {
    return payload.metadata;
  }
  if (
    payload.data &&
    typeof payload.data === "object" &&
    payload.data.object &&
    typeof payload.data.object === "object" &&
    payload.data.object.metadata &&
    typeof payload.data.object.metadata === "object" &&
    !Array.isArray(payload.data.object.metadata)
  ) {
    return payload.data.object.metadata;
  }
  return {};
};
const resolveWebhookProvider = (payload) => {
  const typeToken = String(payload?.stripeEventType || payload?.type || "").trim().toLowerCase();
  if (typeToken.startsWith("checkout.") || typeToken.startsWith("invoice.") || typeToken.startsWith("customer.subscription.")) {
    return "STRIPE";
  }

  const candidates = [payload?.provider, payload?._provider, payload?.metadata?.provider, payload?.metadata?._provider];
  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim().toUpperCase();
    if (["CHIP", "STRIPE", "MANUAL", "OTHER"].includes(normalized)) {
      return normalized;
    }
  }

  return "CHIP";
};
const normalizePaymentStatus = (value) => String(value || "").trim().toLowerCase();
const toTransactionStatus = (paymentStatus) => {
  const status = normalizePaymentStatus(paymentStatus);
  if (["paid", "succeeded", "success", "completed"].includes(status)) return "SUCCEEDED";
  if (["failed", "error", "declined"].includes(status)) return "FAILED";
  if (["refunded"].includes(status)) return "REFUNDED";
  if (["canceled", "cancelled", "voided"].includes(status)) return "CANCELED";
  return "PENDING";
};
const normalizeBillingCycle = (value) => {
  const token = String(value || "").trim().toLowerCase();
  if (["yearly", "annual", "year"].includes(token)) return "yearly";
  if (["monthly", "month"].includes(token)) return "monthly";
  return "monthly";
};
const toPlanIntervalToken = (billingCycle) => {
  const normalized = normalizeBillingCycle(billingCycle);
  return normalized === "yearly" ? "year" : "month";
};
const resolvePlanPricing = (plan, billingCycle = "monthly") => {
  const monthlyPrice = decimalToNumber(plan?.price, 0);
  const yearlyFallback = monthlyPrice > 0 ? Number((monthlyPrice * 10).toFixed(2)) : 0;
  const yearlyPrice = decimalToNumber(plan?.yearlyPrice, yearlyFallback);
  const normalizedCycle = normalizeBillingCycle(billingCycle);

  if (normalizedCycle === "yearly") {
    return {
      billingCycle: "yearly",
      intervalToken: "year",
      unitPrice: yearlyPrice,
      monthlyPrice,
      yearlyPrice,
    };
  }

  return {
    billingCycle: "monthly",
    intervalToken: "month",
    unitPrice: monthlyPrice,
    monthlyPrice,
    yearlyPrice,
  };
};
const getOptionalPlanByName = async (name) => {
  try {
    return await planLimitService.getPlanByName(name);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
};
const getOptionalPlanById = async (planId) => {
  try {
    return await planLimitService.getPlanById(planId);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
};
const addPlanInterval = (date, interval = "month") => {
  const start = new Date(date);
  const token = String(interval || "").trim().toLowerCase();
  if (token === "year" || token === "annual" || token === "yearly") {
    start.setFullYear(start.getFullYear() + 1);
    return start;
  }
  start.setMonth(start.getMonth() + 1);
  return start;
};
const resolveProviderTransactionId = (payload) =>
  String(payload?.transaction_id || payload?.transactionId || payload?.id || "").trim() || null;
const resolveProviderSubscriptionId = (payload) =>
  String(payload?.purchase_id || payload?.purchaseId || payload?.id || "").trim() || null;
const resolveAmountCents = (payload, fallbackCents) => {
  const payloadAmount = Number(payload?.amount);
  if (Number.isFinite(payloadAmount) && payloadAmount > 0) return Math.round(payloadAmount);
  return Math.max(Math.round(Number(fallbackCents || 0)), 0);
};
const shouldApplyTransactionStatus = (currentStatus, nextStatus) => {
  const current = String(currentStatus || "").trim().toUpperCase();
  const next = String(nextStatus || "").trim().toUpperCase();
  if (!current) return true;
  if (!next) return false;
  if (current === next) return true;

  if (current === "PENDING") return true;
  if (current === "FAILED") return ["SUCCEEDED", "CANCELED", "REFUNDED"].includes(next);
  if (current === "SUCCEEDED") return ["REFUNDED", "CANCELED"].includes(next);
  if (current === "CANCELED") return next === "REFUNDED";
  if (current === "REFUNDED") return false;
  return false;
};
const normalizeSubscriptionStatus = (value) => String(value || "").trim().toUpperCase();
const isTerminalSubscriptionStatus = (value) =>
  ["CANCELED", "EXPIRED"].includes(normalizeSubscriptionStatus(value));
const resolveWebhookEventTimestamp = (payload) => {
  const candidates = [
    payload?.paid_at,
    payload?.paidAt,
    payload?.created_at,
    payload?.createdAt,
    payload?.updated_at,
    payload?.updatedAt,
    payload?.event_at,
    payload?.eventAt,
    payload?.timestamp,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      const timestampMs = candidate > 9999999999 ? candidate : candidate * 1000;
      const date = new Date(timestampMs);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
      continue;
    }

    if (typeof candidate === "string" && candidate.trim()) {
      const date = new Date(candidate);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return new Date();
};
const canMarkSubscriptionPastDue = (subscription, referenceDate = new Date()) => {
  if (!subscription || subscription.plan === "FREE") return false;

  const currentStatus = normalizeSubscriptionStatus(subscription.status);
  if (!["ACTIVE", "TRIALING", "INCOMPLETE"].includes(currentStatus)) return false;
  if (!subscription.currentPeriodEnd) return true;

  return subscription.currentPeriodEnd <= referenceDate;
};
const canCancelPaidSubscription = (subscription) => {
  if (!subscription || subscription.plan === "FREE") return false;
  return !isTerminalSubscriptionStatus(subscription.status);
};
const resolveLinkedSubscriptionByProvider = async (client, providerSubscriptionId) => {
  if (!providerSubscriptionId) return null;
  return client.subscription.findFirst({
    where: {
      OR: [{ providerSubscriptionId }, { chipPurchaseId: providerSubscriptionId }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      photographerId: true,
      plan: true,
      status: true,
      currentPeriodEnd: true,
    },
  });
};
const buildWebhookLockToken = ({ providerTransactionId, providerSubscriptionId, userId }) => {
  const token =
    String(providerTransactionId || "").trim() ||
    String(providerSubscriptionId || "").trim() ||
    String(userId || "").trim() ||
    "unknown";
  return `billing-webhook:${token}`;
};
const acquireWebhookTransactionLock = async (tx, lockToken) => {
  if (!lockToken || typeof tx?.$executeRaw !== "function") return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockToken}))`;
};
const enqueuePhotographerAssetReprocessingBatch = async (photographerId, reason) => {
  if (!photographerId) return 0;

  const assets = await prisma.asset.findMany({
    where: {
      photographerId,
      type: "IMAGE",
      purpose: { in: REPROCESSABLE_PURPOSES },
      status: "READY",
      deletedAt: null,
    },
    select: { id: true },
    take: 2000,
  });

  let skippedCount = 0;
  for (const asset of assets) {
    const dispatched = await enqueueImageProcessing({
      assetId: asset.id,
      jobId: `asset:${asset.id}`,
      reason,
    });

    if (!dispatched) {
      skippedCount += 1;
    }
  }

  if (skippedCount > 0) {
    logger.warn(
      {
        photographerId,
        reason,
        totalAssets: assets.length,
        skippedCount,
      },
      "Some asset reprocessing jobs could not be dispatched"
    );
  }

  logger.info(
    {
      photographerId,
      reason,
      totalAssets: assets.length,
      dispatchedCount: assets.length - skippedCount,
      skippedCount,
    },
    "Billing asset reprocessing dispatch completed"
  );

  return assets.length;
};
const enqueuePhotographerAssetReprocessing = async (photographerId, reason) => {
  if (!photographerId) return 0;

  return retryWithExponentialBackoff(
    async () => enqueuePhotographerAssetReprocessingBatch(photographerId, reason),
    {
      operationName: "billing-asset-reprocessing-dispatch",
      maxAttempts: BILLING_ASSET_REPROCESS_MAX_ATTEMPTS,
      baseDelayMs: BILLING_ASSET_REPROCESS_BASE_DELAY_MS,
      maxDelayMs: BILLING_ASSET_REPROCESS_MAX_DELAY_MS,
      unrefDelayTimer: true,
      shouldRetry: (error) => isTransientDatabaseError(error),
      onRetry: ({ error, attempt, maxAttempts, retryDelayMs, operationName }) => {
        logger.warn(
          {
            photographerId,
            reason,
            operationName,
            attempt,
            maxAttempts,
            retryDelayMs,
            errorCode: error?.code || null,
            errorName: error?.name || null,
          },
          "Retrying billing asset reprocessing dispatch after transient database failure"
        );
      },
    }
  );
};
const triggerPhotographerAssetReprocessing = (photographerId, reason) => {
  if (env.nodeEnv === "test") return;
  if (!photographerId) return;
  void enqueuePhotographerAssetReprocessing(photographerId, reason).catch((error) => {
    logger.error(
      {
        err: error,
        photographerId,
        reason,
        transientDatabaseError: isTransientDatabaseError(error),
        errorCode: error?.code || null,
        errorName: error?.name || null,
      },
      "Failed to enqueue asset reprocessing for subscription plan transition"
    );
  });
};
const resolveMostRelevantSubscription = async (userId) => {
  const active = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (active) {
    return active;
  }

  return prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};
const resolvePhotographerIdForUser = async (userId, tx = prisma) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      photographer: {
        select: { id: true },
      },
    },
  });
  return user?.photographer?.id || null;
};
const resolvePhotographerCountryForUser = async (userId, tx = prisma) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      photographer: {
        select: { country: true },
      },
    },
  });
  return String(user?.photographer?.country || "").trim();
};
const ensureFreeSubscriptionTx = async (tx, userId, photographerId = null) => {
  const existingActiveFree = await tx.subscription.findFirst({
    where: {
      userId,
      plan: "FREE",
      status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingActiveFree) {
    return tx.subscription.update({
      where: { id: existingActiveFree.id },
      data: {
        status: "ACTIVE",
        provider: "MANUAL",
        billingInterval: "MONTHLY",
        pendingPlan: null,
        pendingBillingInterval: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        ...(existingActiveFree.currentPeriodStart ? {} : { currentPeriodStart: new Date() }),
      },
    });
  }

  const now = new Date();
  return tx.subscription.create({
    data: {
      userId,
      photographerId: photographerId || null,
      plan: "FREE",
      status: "ACTIVE",
      provider: "MANUAL",
      billingInterval: "MONTHLY",
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: null,
      pendingPlan: null,
      pendingBillingInterval: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt: null,
    },
  });
};
const createMockTransactionTx = async (tx, payload) => {
  const amountCents = Math.max(Math.round(Number(payload?.amountCents || 0)), 0);
  return tx.transaction.create({
    data: {
      subscriptionId: payload?.subscriptionId || null,
      userId: payload?.userId || null,
      provider: "OTHER",
      providerTransactionId: payload?.providerTransactionId || `mock_tx_${randomUUID()}`,
      status: payload?.status || "SUCCEEDED",
      amountCents,
      currency: String(payload?.currency || "USD").toUpperCase(),
      failureReason: payload?.failureReason || null,
      metadata: payload?.metadata || null,
      processedAt: payload?.status === "PENDING" ? null : new Date(),
    },
  });
};
const transitionPaidSubscriptionToFreeTx = async (tx, subscription, nextStatus, effectiveAt) => {
  const updated = await tx.subscription.update({
    where: { id: subscription.id },
    data: {
      status: nextStatus,
      cancelAtPeriodEnd: false,
      canceledAt: subscription.canceledAt || effectiveAt,
      currentPeriodEnd: effectiveAt,
      pendingPlan: null,
      pendingBillingInterval: null,
    },
  });

  const photographerId = updated.photographerId || (await resolvePhotographerIdForUser(subscription.userId, tx));
  await ensureFreeSubscriptionTx(tx, subscription.userId, photographerId);
  return { updated, photographerId };
};
const syncSubscriptionLifecycle = async (userId) => {
  const active = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
    },
    orderBy: [{ currentPeriodStart: "desc" }, { createdAt: "desc" }],
  });

  if (!active) {
    return null;
  }

  const now = new Date();
  const isMockProvider =
    billingProviderService.mapRuntimeProvider(active.provider, active.providerSubscriptionId || "") === "mock";
  const billingCycle = resolveSubscriptionBillingCycle(active);
  const effectiveDueAt = active.currentPeriodEnd || active.trialEndsAt || null;

  if (active.plan === "FREE") {
    if (
      active.status !== "ACTIVE" ||
      active.cancelAtPeriodEnd ||
      active.pendingPlan ||
      active.pendingBillingInterval ||
      active.provider !== "MANUAL"
    ) {
      return prisma.subscription.update({
        where: { id: active.id },
        data: {
          status: "ACTIVE",
          provider: "MANUAL",
          billingInterval: "MONTHLY",
          pendingPlan: null,
          pendingBillingInterval: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          trialEndsAt: null,
          currentPeriodEnd: null,
        },
      });
    }
    return active;
  }

  if (!effectiveDueAt || effectiveDueAt > now) {
    return active;
  }

  if (active.cancelAtPeriodEnd) {
    const transitioned = await prisma.$transaction(async (tx) =>
      transitionPaidSubscriptionToFreeTx(tx, active, "CANCELED", effectiveDueAt)
    );
    triggerPhotographerAssetReprocessing(
      transitioned.photographerId || active.photographerId || null,
      "subscription_downgrade_to_free"
    );
    return transitioned.updated;
  }

  if (active.status === "TRIALING" && active.trialEndsAt && active.trialEndsAt <= now) {
    if (isMockProvider) {
      const plan = await getOptionalPlanByName(active.plan);

      if (plan) {
        const pricing = resolvePlanPricing(plan, billingCycle);
        const periodStart = active.trialEndsAt;
        const periodEnd = addPlanInterval(periodStart, toPlanIntervalToken(billingCycle));
        const renewed = await prisma.$transaction(async (tx) => {
          const result = await upsertSuccessfulSubscriptionTx(tx, {
            userId,
            targetPlan: active.plan,
            provider: "OTHER",
            providerSubscriptionId: active.providerSubscriptionId || `mock_sub_${randomUUID()}`,
            periodStart,
            periodEnd,
            billingInterval: billingCycle,
          });
          await createMockTransactionTx(tx, {
            userId,
            subscriptionId: result.subscription.id,
            amountCents: Math.round(pricing.unitPrice * 100),
            currency: plan.currency,
            metadata: {
              kind: "trial_conversion",
              plan: active.plan,
              billingCycle,
            },
          });
          return result.subscription;
        });

        triggerPhotographerAssetReprocessing(renewed.photographerId || active.photographerId || null, "paid_plan_activated");
        return renewed;
      }
    }

    const graceEndsAt = resolveGraceEndsAt({ currentPeriodEnd: active.trialEndsAt });
    if (graceEndsAt && now < graceEndsAt) {
      if (active.status !== "PAST_DUE") {
        return prisma.subscription.update({
          where: { id: active.id },
          data: { status: "PAST_DUE" },
        });
      }
      return active;
    }

    const transitioned = await prisma.$transaction(async (tx) =>
      transitionPaidSubscriptionToFreeTx(tx, active, "EXPIRED", active.trialEndsAt)
    );
    triggerPhotographerAssetReprocessing(
      transitioned.photographerId || active.photographerId || null,
      "subscription_downgrade_to_free"
    );
    return transitioned.updated;
  }

  if (active.pendingPlan && isMockProvider) {
    const targetCycle = fromBillingIntervalEnum(active.pendingBillingInterval || active.billingInterval);
    const targetPlan = await getOptionalPlanByName(active.pendingPlan);

    if (targetPlan) {
      const pricing = resolvePlanPricing(targetPlan, targetCycle);
      const periodStart = active.currentPeriodEnd || effectiveDueAt;
      const periodEnd = addPlanInterval(periodStart, toPlanIntervalToken(targetCycle));
      const transitioned = await prisma.$transaction(async (tx) => {
        const result = await upsertSuccessfulSubscriptionTx(tx, {
          userId,
          targetPlan: active.pendingPlan,
          provider: "OTHER",
          providerSubscriptionId: `mock_sub_${randomUUID()}`,
          periodStart,
          periodEnd,
          billingInterval: targetCycle,
        });
        await createMockTransactionTx(tx, {
          userId,
          subscriptionId: result.subscription.id,
          amountCents: Math.round(pricing.unitPrice * 100),
          currency: targetPlan.currency,
          metadata: {
            kind: "scheduled_plan_change",
            fromPlan: active.plan,
            toPlan: active.pendingPlan,
            billingCycle: targetCycle,
          },
        });
        return result.subscription;
      });

      triggerPhotographerAssetReprocessing(transitioned.photographerId || active.photographerId || null, "paid_plan_activated");
      return transitioned;
    }
  }

  if (isMockProvider) {
    const plan = await getOptionalPlanByName(active.plan);

    if (plan) {
      const pricing = resolvePlanPricing(plan, billingCycle);
      const periodStart = active.currentPeriodEnd || effectiveDueAt;
      const periodEnd = addPlanInterval(periodStart, toPlanIntervalToken(billingCycle));
      const renewed = await prisma.$transaction(async (tx) => {
        const result = await upsertSuccessfulSubscriptionTx(tx, {
          userId,
          targetPlan: active.plan,
          provider: "OTHER",
          providerSubscriptionId: active.providerSubscriptionId || `mock_sub_${randomUUID()}`,
          periodStart,
          periodEnd,
          billingInterval: billingCycle,
        });
        await createMockTransactionTx(tx, {
          userId,
          subscriptionId: result.subscription.id,
          amountCents: Math.round(pricing.unitPrice * 100),
          currency: plan.currency,
          metadata: {
            kind: "renewal",
            plan: active.plan,
            billingCycle,
          },
        });
        return result.subscription;
      });

      return renewed;
    }
  }

  const graceEndsAt = resolveGraceEndsAt(active);
  if (graceEndsAt && now < graceEndsAt) {
    if (active.status !== "PAST_DUE") {
      return prisma.subscription.update({
        where: { id: active.id },
        data: { status: "PAST_DUE" },
      });
    }
    return active;
  }

  const transitioned = await prisma.$transaction(async (tx) =>
    transitionPaidSubscriptionToFreeTx(tx, active, "EXPIRED", effectiveDueAt)
  );

  triggerPhotographerAssetReprocessing(
    transitioned.photographerId || active.photographerId || null,
    "subscription_downgrade_to_free"
  );
  return transitioned.updated;
};
const resolveUsageForSubscription = async (userId, subscription) => {
  if (!subscription) return {};

  const photographerId =
    subscription.photographerId || (await resolvePhotographerIdForUser(userId));
  if (!photographerId) return {};

  const [servicesCount, packagesCount, portfolioImagesCount, storageAggregate, planLimits] =
    await Promise.all([
      prisma.service.count({
        where: {
          photographerId,
          status: { not: "ARCHIVED" },
        },
      }),
      prisma.package.count({
        where: {
          photographerId,
          status: { not: "ARCHIVED" },
        },
      }),
      prisma.portfolioItem.count({
        where: { photographerId },
      }),
      prisma.asset.aggregate({
        where: {
          photographerId,
          status: { in: ["PENDING", "READY"] },
          deletedAt: null,
        },
        _sum: { sizeBytes: true },
      }),
      getOptionalPlanByName(subscription.plan),
    ]);

  const packagesPerServiceUsage = await planLimitService.getPackagesPerServiceUsage(
    photographerId,
    planLimits?.maxPackages || 0
  );

  const usedBytes = Number(storageAggregate?._sum?.sizeBytes || 0);
  const storageLimitGb = Number(planLimits?.storageGB || 0);
  const storageLimitBytes = storageLimitGb < 0 ? -1 : storageLimitGb * 1024 * 1024 * 1024;

  return {
    services: mapUsageMetric(servicesCount, planLimits?.maxServices || 0),
    packages: mapUsageMetric(packagesCount, planLimits?.maxPackages || 0),
    packagesPerService: packagesPerServiceUsage,
    portfolioImages: mapUsageMetric(portfolioImagesCount, planLimits?.maxPortfolioImages || 0),
    storage: {
      usedBytes,
      limitBytes: storageLimitBytes,
      limitGB: storageLimitGb,
    },
  };
};
const getSubscriptionSnapshot = async (userId, options = {}) => {
  const shouldSync = options.syncLifecycle !== false;
  if (shouldSync) {
    await syncSubscriptionLifecycle(userId);
  }

  let subscription = await resolveMostRelevantSubscription(userId);

  if (!subscription) {
    const photographerId = await resolvePhotographerIdForUser(userId);
    const now = new Date();
    subscription = await prisma.subscription.create({
      data: {
        userId,
        photographerId,
        plan: "FREE",
        status: "ACTIVE",
        provider: "MANUAL",
        billingInterval: "MONTHLY",
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: null,
      },
    });
  }

  const [usage, latestPaid] = await Promise.all([
    resolveUsageForSubscription(userId, subscription),
    prisma.subscription.findFirst({
      where: {
        userId,
        plan: { not: "FREE" },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    record: subscription,
    response: mapSubscriptionResponse(subscription, usage, latestPaid),
    latestPaid,
  };
};
const resolveLifecycleMaintenanceCandidates = async (referenceDate, batchSize) => {
  const take = Math.max(batchSize * 2, batchSize);
  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      plan: { not: "FREE" },
      status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
      currentPeriodEnd: {
        not: null,
        lte: referenceDate,
      },
    },
    select: {
      userId: true,
      status: true,
    },
    orderBy: [{ currentPeriodEnd: "asc" }, { createdAt: "asc" }],
    take,
  });

  const uniqueByUser = new Map();
  for (const row of dueSubscriptions) {
    if (!row?.userId || uniqueByUser.has(row.userId)) continue;
    uniqueByUser.set(row.userId, row.status);
    if (uniqueByUser.size >= batchSize) break;
  }

  return Array.from(uniqueByUser.entries()).map(([userId, status]) => ({ userId, status }));
};
const upsertSuccessfulSubscriptionTx = async (tx, payload) => {
  const {
    userId,
    targetPlan,
    providerSubscriptionId,
    chipPurchaseId,
    periodStart,
    periodEnd,
    billingInterval = "monthly",
    provider = "CHIP",
    status = "ACTIVE",
    trialEndsAt = null,
  } = payload;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      photographer: {
        select: { id: true },
      },
    },
  });

  if (!user) throw new ApiError(404, "User not found for payment webhook");
  const photographerId = user.photographer?.id || null;

  let existing = null;
  if (providerSubscriptionId || chipPurchaseId) {
    existing = await tx.subscription.findFirst({
      where: {
        OR: [
          ...(providerSubscriptionId ? [{ providerSubscriptionId }] : []),
          ...(chipPurchaseId ? [{ chipPurchaseId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  const activePaid = await tx.subscription.findFirst({
    where: {
      userId,
      plan: { not: "FREE" },
      status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
    },
    orderBy: [{ currentPeriodStart: "desc" }, { createdAt: "desc" }],
  });

  if (!existing) {
    existing =
      activePaid ||
      (await tx.subscription.findFirst({
        where: {
          userId,
          status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
        },
        orderBy: { createdAt: "desc" },
      }));
  }

  if (
    existing &&
    existing.plan === targetPlan &&
    !isActiveSubscriptionStatus(existing.status) &&
    activePaid &&
    activePaid.id !== existing.id
  ) {
    return { subscription: activePaid, stateChanged: false };
  }

  const cancelOtherActivePaidSubscriptions = async (activeSubscriptionId) => {
    await tx.subscription.updateMany({
      where: {
        userId,
        id: { not: activeSubscriptionId },
        plan: { not: "FREE" },
        status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
      },
      data: {
        status: "CANCELED",
        cancelAtPeriodEnd: false,
        canceledAt: periodStart,
        currentPeriodEnd: periodStart,
        pendingPlan: null,
        pendingBillingInterval: null,
      },
    });
  };

  const activationPayload = {
    photographerId: photographerId || existing?.photographerId,
    plan: targetPlan,
    status,
    provider,
    billingInterval: toBillingIntervalEnum(billingInterval),
    ...(providerSubscriptionId ? { providerSubscriptionId } : {}),
    ...(chipPurchaseId ? { chipPurchaseId } : {}),
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    pendingPlan: null,
    pendingBillingInterval: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt,
  };

  if (existing && existing.plan === targetPlan) {
    const updated = await tx.subscription.update({
      where: { id: existing.id },
      data: activationPayload,
    });
    await cancelOtherActivePaidSubscriptions(updated.id);
    return { subscription: updated, stateChanged: true };
  }

  if (existing) {
    await tx.subscription.update({
      where: { id: existing.id },
      data: {
        status: "CANCELED",
        cancelAtPeriodEnd: false,
        canceledAt: periodStart,
        currentPeriodEnd: periodStart,
        pendingPlan: null,
        pendingBillingInterval: null,
      },
    });
  }

  const created = await tx.subscription.create({
    data: {
      userId,
      photographerId,
      plan: targetPlan,
      status,
      provider,
      billingInterval: toBillingIntervalEnum(billingInterval),
      providerSubscriptionId: providerSubscriptionId || null,
      chipPurchaseId: chipPurchaseId || null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      startedAt: periodStart,
      pendingPlan: null,
      pendingBillingInterval: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt,
    },
  });
  await cancelOtherActivePaidSubscriptions(created.id);
  return { subscription: created, stateChanged: true };
};

const resolveSubscriptionPlanFromMetadata = async (metadata = {}) => {
  if (!prisma.subscriptionPlan || typeof prisma.subscriptionPlan.findUnique !== "function") {
    const candidateNames = [
      metadata.planTier,
      metadata.planName,
      metadata.planId,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    for (const candidate of candidateNames) {
      const tier = toPlanTier(candidate);
      if (!tier) continue;

      const price = decimalToNumber(metadata.planPrice, decimalToNumber(metadata.price, 0));
      const yearlyPrice = decimalToNumber(metadata.planYearlyPrice, price ? price * 10 : 0);
      const currency = String(metadata.planCurrency || metadata.currency || "USD").toUpperCase();
      const trialDays = Number.parseInt(String(metadata.planTrialDays ?? metadata.trialDays ?? 0), 10);

      return {
        id: null,
        name: tier,
        currency,
        price,
        yearlyPrice,
        trialDays: Number.isFinite(trialDays) && trialDays >= 0 ? trialDays : 0,
      };
    }

    return null;
  }

  const candidateIds = [
    metadata.planDbId,
    metadata.subscriptionPlanId,
    metadata.planId,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of candidateIds) {
    if (!isUuid(candidate)) continue;
    const planById = await getOptionalPlanById(candidate);
    if (planById) return planById;
  }

  const candidateNames = [
    metadata.planTier,
    metadata.planName,
    metadata.planId,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of candidateNames) {
    const tier = toPlanTier(candidate);
    if (!tier) continue;
    const planByName = await getOptionalPlanByName(tier);
    if (planByName) return planByName;
  }

  return null;
};

const withCheckoutStatus = (inputUrl, checkoutStatus) => {
  const fallbackUrl = new URL(getFrontendBaseUrl() + "/dashboard/transactions");
  fallbackUrl.searchParams.set("checkout", checkoutStatus);

  if (!inputUrl) {
    return fallbackUrl.toString();
  }

  try {
    const url = new URL(String(inputUrl));
    url.searchParams.set("checkout", checkoutStatus);
    return url.toString();
  } catch {
    return fallbackUrl.toString();
  }
};
const resolveMockRedirectUrl = (metadata = {}, outcome = "success") => {
  const normalizedOutcome = String(outcome || "success").trim().toLowerCase();
  if (["success", "trial"].includes(normalizedOutcome)) {
    return withCheckoutStatus(metadata.successUrl, normalizedOutcome);
  }
  return withCheckoutStatus(metadata.cancelUrl || metadata.successUrl, normalizedOutcome);
};
const createCheckoutSessionForPlan = async ({
  userId,
  plan,
  successUrl,
  cancelUrl,
  referralCode,
  billingCycle = "monthly",
  sourcePlanId,
  requestedProvider,
  additionalMetadata = {},
}) => {
  const planTier = toPlanTier(plan?.name);
  if (!planTier) {
    throw new ApiError(400, "Invalid target plan");
  }

  const pricing = resolvePlanPricing(plan, billingCycle);
  const amountCents = Math.max(Math.round(pricing.unitPrice * 100), 0);
  const billingCountry = await resolvePhotographerCountryForUser(userId);
  const runtimeProvider = billingProviderService.resolveCheckoutProvider({
    country: billingCountry,
    requestedProvider,
  });
  const metadata = {
    userId,
    planDbId: plan.id,
    planId: sourcePlanId || plan.id,
    planName: plan.name,
    planTier,
    planPrice: pricing.unitPrice,
    planMonthlyPrice: pricing.monthlyPrice,
    planYearlyPrice: pricing.yearlyPrice,
    planCurrency: plan.currency,
    planInterval: pricing.intervalToken,
    billingCycle: pricing.billingCycle,
    trialDays: plan.trialDays,
    referralCode: referralCode || null,
    billingCountry: billingCountry || null,
    requestedProvider: requestedProvider || null,
    resolvedProvider: runtimeProvider,
    successUrl: successUrl || null,
    cancelUrl: cancelUrl || null,
    ...additionalMetadata,
  };

  let pendingTransaction = null;
  if (runtimeProvider === "mock") {
    pendingTransaction = await prisma.transaction.create({
      data: {
        userId,
        provider: "OTHER",
        providerTransactionId: `mock_checkout_${randomUUID()}`,
        status: "PENDING",
        amountCents,
        currency: plan.currency,
        metadata: {
          ...metadata,
          kind: "mock_checkout",
        },
      },
    });
  }

  const targetPlanId = runtimeProvider === "chip" ? resolveChipBrandId(plan) : String(plan.id || planTier);
  const session = await billingProviderService.createCheckoutSession({
    sessionId: pendingTransaction?.id || null,
    targetPlanId,
    amountCents,
    currency: plan.currency,
    successUrl,
    cancelUrl,
    provider: runtimeProvider,
    metadata,
  });

  return {
    provider: session.provider,
    checkoutUrl: session.checkoutUrl,
    sessionId: session.sessionId,
    pendingTransactionId: pendingTransaction?.id || null,
  };
};

export const billingService = {
  async listPlans() {
    const plans = await planLimitService.listAllPlans();
    return {
      plans: plans.map((plan) => {
        const pricing = resolvePlanPricing(plan, "monthly");
        const yearlyReference = pricing.monthlyPrice * 12;
        const yearlyDiscountPercent =
          yearlyReference > 0 && pricing.yearlyPrice > 0
            ? Math.max(0, Math.round((1 - pricing.yearlyPrice / yearlyReference) * 100))
            : 0;

        return {
          id: plan.name,
          name: toPlanLabel(plan.name),
          // Backward-compatible monthly fields
          price: pricing.monthlyPrice,
          currency: plan.currency,
          interval: "month",
          // New cycle-aware pricing fields
          monthlyPrice: pricing.monthlyPrice,
          yearlyPrice: pricing.yearlyPrice,
          pricing: {
            monthly: pricing.monthlyPrice,
            yearly: pricing.yearlyPrice,
          },
          billingCycles: ["monthly", "yearly"],
          yearlyDiscountPercent,
          trialDays: plan.trialDays,
          referralReward: decimalToNumber(plan.referralReward),
          storageCostPerGB: decimalToNumber(plan.storageCostPerGB),
          packageLimitScope: "per_service",
          limits: {
            portfolioPhotos: plan.maxPortfolioImages,
            services: plan.maxServices,
            portfolioImages: plan.maxPortfolioImages,
            packages: plan.maxPackages,
            packagesPerService: plan.maxPackages,
            packageFeatures: Number(plan.maxPackageFeatures ?? 5),
            maxPackageFeatures: Number(plan.maxPackageFeatures ?? 5),
            storage: plan.storageGB,
            customDomain: Boolean(plan.customDomain),
            analyticsTools: Boolean(plan.analyticsTools),
            teamSectionTools: Boolean(plan.teamSectionTools),
          },
          features: {
            lensayaSubdomain: true,
            basicAnalytics: true,
            advancedAnalytics: Boolean(plan.analyticsTools),
            removeLensayaBranding: String(plan.name || "").toUpperCase() !== "FREE",
            prioritySupport: String(plan.name || "").toUpperCase() !== "FREE",
            teamSection: Boolean(plan.teamSectionTools),
          },
        };
      }),
    };
  },

  async currentSubscription(userId) {
    const snapshot = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
    return snapshot.response;
  },

  async runLifecycleMaintenance(options = {}) {
    const now = options.now instanceof Date && !Number.isNaN(options.now.getTime()) ? options.now : new Date();
    const reason = String(options.reason || "scheduled").trim() || "scheduled";
    const configuredBatchSize = Number.parseInt(String(env.billingMaintenance?.batchSize ?? ""), 10);
    const requestedBatchSize = Number.parseInt(String(options.batchSize ?? ""), 10);
    const fallbackBatchSize = Number.isFinite(configuredBatchSize) && configuredBatchSize > 0 ? configuredBatchSize : 500;
    const rawBatchSize = Number.isFinite(requestedBatchSize) && requestedBatchSize > 0 ? requestedBatchSize : fallbackBatchSize;
    const batchSize = Math.max(1, Math.min(rawBatchSize, 5000));

    const candidates = await resolveLifecycleMaintenanceCandidates(now, batchSize);
    const summary = {
      scanned: candidates.length,
      transitioned: 0,
      pastDue: 0,
      canceled: 0,
      expired: 0,
      errors: 0,
      batchSize,
      reason,
      processedAt: now.toISOString(),
    };

    for (const [index, candidate] of candidates.entries()) {
      const userId = String(candidate.userId || "").trim();
      if (!userId) continue;

      try {
        const previousStatus = normalizeSubscriptionStatus(candidate.status);
        const updated = await syncSubscriptionLifecycle(userId);
        const nextStatus = normalizeSubscriptionStatus(updated?.status || previousStatus);

        if (nextStatus !== previousStatus) {
          summary.transitioned += 1;
          if (nextStatus === "PAST_DUE") summary.pastDue += 1;
          if (nextStatus === "CANCELED") summary.canceled += 1;
          if (nextStatus === "EXPIRED") summary.expired += 1;
        }
      } catch (error) {
        if (isTransientDatabaseError(error)) {
          logger.warn(
            {
              err: error,
              userId,
              reason,
              candidateIndex: index + 1,
              candidateCount: candidates.length,
              transientDatabaseError: true,
              errorCode: error?.code || null,
              errorName: error?.name || null,
            },
            "Billing lifecycle maintenance interrupted due to transient database failure"
          );
          throw error;
        }

        summary.errors += 1;
        logger.error(
          {
            err: error,
            userId,
            reason,
            candidateIndex: index + 1,
            candidateCount: candidates.length,
            transientDatabaseError: false,
            errorCode: error?.code || null,
            errorName: error?.name || null,
          },
          "Failed to run subscription lifecycle maintenance for user"
        );
      }
    }

    logger.info(
      {
        reason,
        scanned: summary.scanned,
        transitioned: summary.transitioned,
        pastDue: summary.pastDue,
        canceled: summary.canceled,
        expired: summary.expired,
        errors: summary.errors,
      },
      "Billing lifecycle maintenance sweep completed"
    );

    return summary;
  },

  async changePlan(userId, payload) {
    const targetPlan = toPlanTier(payload?.targetPlanId);
    const billingCycle = normalizeBillingCycle(payload?.billingCycle);
    const forceCheckout = payload?.forceCheckout === true;
    if (!targetPlan) throw new ApiError(400, "Invalid target plan");

    const referralCode = referralService.normalizeReferralCode(payload?.referralCode);
    const current = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
    const currentPlan = current.record?.plan || "FREE";
    const currentBillingCycle = current.response.billingCycle || resolveSubscriptionBillingCycle(current.record);
    const changeType = resolvePlanChangeType(currentPlan, targetPlan, currentBillingCycle, billingCycle);
    const now = new Date();

    if (targetPlan === "FREE") {
      if (currentPlan === "FREE" && !current.record?.cancelAtPeriodEnd) {
        return {
          action: "unchanged",
          changeType: "renew",
          currentPlan,
          targetPlan,
          ...current.response,
        };
      }

      const activePaid = await prisma.subscription.findFirst({
        where: {
          userId,
          plan: { not: "FREE" },
          status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
        },
        orderBy: [{ currentPeriodStart: "desc" }, { createdAt: "desc" }],
      });

      if (
        activePaid &&
        activePaid.cancelAtPeriodEnd &&
        activePaid.currentPeriodEnd &&
        activePaid.currentPeriodEnd > now
      ) {
        return {
          action: "unchanged",
          changeType: "downgrade",
          currentPlan,
          targetPlan,
          ...current.response,
        };
      }

      if (activePaid && activePaid.currentPeriodEnd && activePaid.currentPeriodEnd > now) {
        await prisma.subscription.update({
          where: { id: activePaid.id },
          data: {
            cancelAtPeriodEnd: true,
            canceledAt: null,
            pendingPlan: null,
            pendingBillingInterval: null,
          },
        });

        await notificationService.create({
          userId,
          type: "BILLING",
          title: "Downgrade scheduled",
          body: "Your subscription will move to the Free plan at the end of the current billing period.",
          subscriptionId: activePaid.id,
          actionUrl: "/dashboard/pricing",
        });

        const next = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
        return {
          action: "changed",
          changeType: "downgrade",
          currentPlan,
          targetPlan,
          ...next.response,
        };
      }

      const downgradePhotographerId =
        activePaid?.photographerId || current.record?.photographerId || (await resolvePhotographerIdForUser(userId));

      await prisma.$transaction(async (tx) => {
        if (activePaid) {
          await tx.subscription.update({
            where: { id: activePaid.id },
            data: {
              status: "CANCELED",
              cancelAtPeriodEnd: false,
              canceledAt: now,
              currentPeriodEnd: now,
              pendingPlan: null,
              pendingBillingInterval: null,
            },
          });
        }

        const photographerId =
          current.record?.photographerId || (await resolvePhotographerIdForUser(userId, tx));
        await ensureFreeSubscriptionTx(tx, userId, photographerId);
      });
      triggerPhotographerAssetReprocessing(downgradePhotographerId, "manual_downgrade_to_free");

      await notificationService.create({
        userId,
        type: "BILLING",
        title: "Subscription changed",
        body: "Your subscription has been moved to the Free plan.",
        actionUrl: "/dashboard/pricing",
      });

      const next = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
      return {
        action: "changed",
        changeType: "downgrade",
        currentPlan,
        targetPlan,
        ...next.response,
      };
    }

    if (
      current.record?.id &&
      currentPlan === targetPlan &&
      currentBillingCycle === billingCycle &&
      current.record?.pendingPlan &&
      !forceCheckout
    ) {
      await prisma.subscription.update({
        where: { id: current.record.id },
        data: {
          pendingPlan: null,
          pendingBillingInterval: null,
        },
      });

      const resumed = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
      return {
        action: "changed",
        changeType: "renew",
        currentPlan,
        targetPlan,
        billingCycle,
        ...resumed.response,
      };
    }

    if (
      currentPlan === targetPlan &&
      currentBillingCycle === billingCycle &&
      !current.record?.cancelAtPeriodEnd &&
      !current.record?.pendingPlan &&
      !forceCheckout
    ) {
      return {
        action: "unchanged",
        changeType: "renew",
        currentPlan,
        targetPlan,
        billingCycle,
        ...current.response,
      };
    }

    if (currentPlan === targetPlan && current.record?.cancelAtPeriodEnd && !forceCheckout && currentBillingCycle === billingCycle) {
      await prisma.subscription.update({
        where: { id: current.record.id },
        data: {
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });

      const resumed = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
      return {
        action: "changed",
        changeType: "renew",
        currentPlan,
        targetPlan,
        billingCycle,
        ...resumed.response,
      };
    }

    const activePaid = await prisma.subscription.findFirst({
      where: {
        userId,
        plan: { not: "FREE" },
        status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
      },
      orderBy: [{ currentPeriodStart: "desc" }, { createdAt: "desc" }],
    });
    const hasFuturePaidTime = Boolean(activePaid?.currentPeriodEnd && activePaid.currentPeriodEnd > now);

    if (changeType === "downgrade" && currentPlan !== "FREE" && hasFuturePaidTime && activePaid) {
      const nextInterval = toBillingIntervalEnum(billingCycle);
      const alreadyScheduled =
        activePaid.pendingPlan === targetPlan && activePaid.pendingBillingInterval === nextInterval && !activePaid.cancelAtPeriodEnd;

      if (alreadyScheduled) {
        return {
          action: "unchanged",
          changeType,
          currentPlan,
          targetPlan,
          billingCycle,
          ...current.response,
        };
      }

      await prisma.subscription.update({
        where: { id: activePaid.id },
        data: {
          pendingPlan: targetPlan,
          pendingBillingInterval: nextInterval,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });

      await notificationService.create({
        userId,
        type: "BILLING",
        title: "Plan change scheduled",
        body: "Your plan will switch to " + toPlanLabel(targetPlan) + " on the next billing cycle.",
        subscriptionId: activePaid.id,
        actionUrl: "/dashboard/pricing",
      });

      const next = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
      return {
        action: "changed",
        changeType,
        currentPlan,
        targetPlan,
        billingCycle,
        ...next.response,
      };
    }

    const plan = await getOptionalPlanByName(targetPlan);
    if (!plan) throw new ApiError(400, "Invalid target plan");

    const session = await createCheckoutSessionForPlan({
      userId,
      plan,
      successUrl: payload?.successUrl,
      cancelUrl: payload?.cancelUrl,
      referralCode,
      billingCycle,
      sourcePlanId: targetPlan,
      requestedProvider: payload?.paymentProvider,
      additionalMetadata: {
        previousPlan: currentPlan,
        previousBillingCycle: currentBillingCycle,
        changeType,
      },
    });

    return {
      action: "checkout_required",
      changeType,
      currentPlan,
      targetPlan,
      billingCycle,
      provider: session.provider,
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId,
    };
  },

  async getMockCheckoutSession(userId, sessionId) {
    const session = await prisma.transaction.findFirst({
      where: {
        id: sessionId,
        userId,
        provider: "OTHER",
      },
    });

    if (!session) {
      throw new ApiError(404, "Mock checkout session not found");
    }

    const metadata = session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
      ? session.metadata
      : {};
    const plan = await resolveSubscriptionPlanFromMetadata(metadata);
    const targetPlan = toPlanTier(metadata.planTier || metadata.planName || plan?.name);

    return {
      sessionId: session.id,
      status: String(session.status || "PENDING").toLowerCase(),
      amount: Number(session.amountCents || 0) / 100,
      currency: session.currency,
      currentPlan: String(metadata.previousPlan || "FREE").toUpperCase(),
      targetPlan: targetPlan || null,
      planName: plan?.name ? toPlanLabel(plan.name) : toPlanLabel(targetPlan || "plan"),
      changeType: String(metadata.changeType || "renew").toLowerCase(),
      billingCycle: normalizeBillingCycle(metadata.billingCycle || metadata.planInterval),
      trialDays: Number(plan?.trialDays || metadata.trialDays || 0),
      trialAvailable:
        String(session.status || "PENDING").toUpperCase() === "PENDING" &&
        Number(plan?.trialDays || metadata.trialDays || 0) > 0 &&
        String(metadata.previousPlan || "FREE").toUpperCase() === "FREE",
      redirectUrls: {
        success: metadata.successUrl || null,
        cancel: metadata.cancelUrl || null,
      },
      provider: "mock",
    };
  },

  async completeMockCheckout(userId, sessionId, payload = {}) {
    const outcome = String(payload?.outcome || "succeeded").trim().toLowerCase();
    if (!["succeeded", "failed", "canceled", "trial"].includes(outcome)) {
      throw new ApiError(400, "Invalid mock checkout outcome");
    }

    const session = await prisma.transaction.findFirst({
      where: {
        id: sessionId,
        userId,
        provider: "OTHER",
      },
    });

    if (!session) {
      throw new ApiError(404, "Mock checkout session not found");
    }

    const metadata = session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
      ? session.metadata
      : {};

    if (String(session.status || "PENDING").toUpperCase() !== "PENDING") {
      return {
        sessionId,
        outcome: String(session.status || "PENDING").toLowerCase(),
        redirectUrl: resolveMockRedirectUrl(metadata, String(session.status || "pending").toLowerCase()),
        subscription: (await getSubscriptionSnapshot(userId, { syncLifecycle: true })).response,
      };
    }

    const plan = await resolveSubscriptionPlanFromMetadata(metadata);
    const targetPlan = toPlanTier(metadata.planTier || metadata.planName || plan?.name);
    if (!plan || !targetPlan) {
      throw new ApiError(400, "Mock checkout is missing a valid target plan");
    }

    const billingCycle = normalizeBillingCycle(metadata.billingCycle || metadata.planInterval);
    const referralCode = referralService.normalizeReferralCode(metadata.referralCode);

    if (outcome === "failed" || outcome === "canceled") {
      await prisma.transaction.update({
        where: { id: session.id },
        data: {
          status: outcome === "failed" ? "FAILED" : "CANCELED",
          failureReason: outcome === "failed" ? "Mock payment declined" : null,
          processedAt: new Date(),
        },
      });

      return {
        sessionId,
        outcome,
        redirectUrl: resolveMockRedirectUrl(metadata, outcome),
        subscription: (await getSubscriptionSnapshot(userId, { syncLifecycle: true })).response,
      };
    }

    const current = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
    const trialEligible =
      outcome === "trial" &&
      Number(plan.trialDays || 0) > 0 &&
      current.record?.plan === "FREE" &&
      !current.latestPaid;

    if (outcome === "trial" && !trialEligible) {
      throw new ApiError(400, "This subscription is not eligible for a trial");
    }

    const now = new Date();
    let photographerId = null;

    await prisma.$transaction(async (tx) => {
      if (trialEligible) {
        const trialEndsAt = new Date(now.getTime() + Number(plan.trialDays || 0) * 24 * 60 * 60 * 1000);
        const result = await upsertSuccessfulSubscriptionTx(tx, {
          userId,
          targetPlan,
          provider: "OTHER",
          providerSubscriptionId: `mock_sub_${randomUUID()}`,
          periodStart: now,
          periodEnd: trialEndsAt,
          billingInterval: billingCycle,
          status: "TRIALING",
          trialEndsAt,
        });
        photographerId = result.subscription.photographerId || null;
        await tx.transaction.update({
          where: { id: session.id },
          data: {
            status: "SUCCEEDED",
            amountCents: 0,
            metadata: {
              ...metadata,
              mockOutcome: "trial",
              listPriceAmountCents: session.amountCents,
            },
            processedAt: now,
          },
        });
        return;
      }

      const periodEnd = addPlanInterval(now, toPlanIntervalToken(billingCycle));
      const result = await upsertSuccessfulSubscriptionTx(tx, {
        userId,
        targetPlan,
        provider: "OTHER",
        providerSubscriptionId: `mock_sub_${randomUUID()}`,
        periodStart: now,
        periodEnd,
        billingInterval: billingCycle,
      });
      photographerId = result.subscription.photographerId || null;
      await tx.transaction.update({
        where: { id: session.id },
        data: {
          status: "SUCCEEDED",
          metadata: {
            ...metadata,
            mockOutcome: "succeeded",
          },
          processedAt: now,
        },
      });
    });

    if (photographerId) {
      triggerPhotographerAssetReprocessing(photographerId, "paid_plan_activated");
    }

    if (!trialEligible) {
      await referralService.markConversionAndReward({
        referredUserId: userId,
        referralCode,
      });
    }

    return {
      sessionId,
      outcome: trialEligible ? "trial" : "succeeded",
      redirectUrl: resolveMockRedirectUrl(metadata, trialEligible ? "trial" : "success"),
      subscription: (await getSubscriptionSnapshot(userId, { syncLifecycle: true })).response,
    };
  },

  async createPortalSession(userId, returnUrl) {
    const snapshot = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
    const normalizedReturnUrl = normalizeReturnUrl(returnUrl);
    const portalUrl = new URL(getFrontendBaseUrl() + "/dashboard/transactions");
    portalUrl.searchParams.set("billing", "1");
    if (normalizedReturnUrl) {
      portalUrl.searchParams.set("returnUrl", normalizedReturnUrl);
    }

    return {
      portalUrl: portalUrl.toString(),
      returnUrl: normalizedReturnUrl,
      provider: snapshot.response.provider,
      capabilities: {
        changePlan: true,
        cancelAtPeriodEnd: snapshot.response.plan !== "FREE",
        resume: Boolean(snapshot.response.cancelAtPeriodEnd),
        transactions: true,
        inAppBillingCenter: true,
      },
      subscription: {
        plan: snapshot.response.plan,
        status: snapshot.response.status,
        billingState: snapshot.response.billingState,
        renewAt: snapshot.response.renewAt,
        billingCycle: snapshot.response.billingCycle,
        cancelAtPeriodEnd: snapshot.response.cancelAtPeriodEnd,
        pendingChange: snapshot.response.pendingChange,
      },
    };
  },

  async cancelSubscription(userId, payload = {}) {
    const atPeriodEnd = payload?.atPeriodEnd !== false;
    const activePaid = await prisma.subscription.findFirst({
      where: {
        userId,
        plan: { not: "FREE" },
        status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activePaid) {
      const current = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
      return { action: "unchanged", ...current.response };
    }

    const now = new Date();
    if (atPeriodEnd && activePaid.currentPeriodEnd && activePaid.currentPeriodEnd > now) {
      await prisma.subscription.update({
        where: { id: activePaid.id },
        data: {
          cancelAtPeriodEnd: true,
          canceledAt: null,
          pendingPlan: null,
          pendingBillingInterval: null,
        },
      });

      await notificationService.create({
        userId,
        type: "BILLING",
        title: "Cancellation scheduled",
        body: "Your paid subscription will be canceled at the end of the current billing period.",
        subscriptionId: activePaid.id,
        actionUrl: "/dashboard/pricing",
      });

      const current = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
      return { action: "scheduled", ...current.response };
    }

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: activePaid.id },
        data: {
          status: "CANCELED",
          cancelAtPeriodEnd: false,
          canceledAt: now,
          currentPeriodEnd: now,
          pendingPlan: null,
          pendingBillingInterval: null,
        },
      });

      await ensureFreeSubscriptionTx(
        tx,
        userId,
        activePaid.photographerId || (await resolvePhotographerIdForUser(userId, tx))
      );
    });
    triggerPhotographerAssetReprocessing(activePaid.photographerId || null, "subscription_canceled_to_free");

    await notificationService.create({
      userId,
      type: "BILLING",
      title: "Subscription canceled",
      body: "Your paid subscription has been canceled and your account is now on the Free plan.",
      subscriptionId: activePaid.id,
      actionUrl: "/dashboard/pricing",
    });

    const current = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
    return { action: "canceled", ...current.response };
  },

  async resumeSubscription(userId) {
    const scheduledCancellation = await prisma.subscription.findFirst({
      where: {
        userId,
        plan: { not: "FREE" },
        status: { in: Array.from(SUBSCRIPTION_ACTIVE_STATUSES) },
        cancelAtPeriodEnd: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!scheduledCancellation) {
      const current = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
      return { action: "unchanged", ...current.response };
    }

    await prisma.subscription.update({
      where: { id: scheduledCancellation.id },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });

    await notificationService.create({
      userId,
      type: "BILLING",
      title: "Subscription resumed",
      body: "Automatic renewal has been restored for your subscription.",
      subscriptionId: scheduledCancellation.id,
      actionUrl: "/dashboard/pricing",
    });

    const current = await getSubscriptionSnapshot(userId, { syncLifecycle: true });
    return { action: "resumed", ...current.response };
  },

  async listTransactions(userId, query) {
    const { page, limit, skip, take } = getPagination(query);

    const where = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const accountWideWhere = { userId };

    const [items, total, totalTransactions, statusCounts, successfulAmount, successfulCurrency] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          subscription: {
            select: {
              plan: true,
              billingInterval: true,
              providerSubscriptionId: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: accountWideWhere }),
      prisma.transaction.groupBy({
        by: ["status"],
        where: accountWideWhere,
        _count: { _all: true },
      }),
      prisma.transaction.aggregate({
        where: { ...accountWideWhere, status: "SUCCEEDED" },
        _sum: { amountCents: true },
      }),
      prisma.transaction.findFirst({
        where: { ...accountWideWhere, status: "SUCCEEDED" },
        orderBy: { createdAt: "desc" },
        select: { currency: true },
      }),
    ]);

    const countsByStatus = new Map(statusCounts.map((row) => [String(row.status || "").toUpperCase(), row._count._all || 0]));

    return {
      items: items.map((tx) => {
        const metadata = tx.metadata && typeof tx.metadata === "object" && !Array.isArray(tx.metadata) ? tx.metadata : {};
        const billingCycle = metadata.billingCycle || fromBillingIntervalEnum(tx.subscription?.billingInterval || "MONTHLY");
        return {
          id: tx.id,
          amount: tx.amountCents / 100,
          currency: tx.currency,
          status: tx.status.toLowerCase(),
          createdAt: tx.createdAt,
          provider: billingProviderService.mapRuntimeProvider(tx.provider, tx.subscription?.providerSubscriptionId || ""),
          plan: tx.subscription?.plan || metadata.planTier || null,
          billingCycle,
          description: String(metadata.kind || "subscription_payment").replace(/_/g, " "),
          failureReason: tx.failureReason || null,
          receiptUrl: null,
          receiptAvailable: false,
          receiptLabel: "Receipt available after live provider integration.",
        };
      }),
      summary: {
        totalTransactions,
        successfulPayments: countsByStatus.get("SUCCEEDED") || 0,
        pendingPayments: countsByStatus.get("PENDING") || 0,
        paidAmount: (successfulAmount._sum.amountCents || 0) / 100,
        currency: successfulCurrency?.currency || items[0]?.currency || "USD",
      },
      pagination: buildPagination(page, limit, total),
    };
  },

  async handlePaymentWebhook(payload) {
    const metadata = normalizeWebhookMetadata(payload);
    let userId = String(metadata.userId || "").trim() || null;
    const subscriptionPlan = await resolveSubscriptionPlanFromMetadata(metadata);
    const targetPlan = toPlanTier(subscriptionPlan?.name || metadata.planTier || metadata.planName || metadata.planId);
    const metadataBillingCycle = normalizeBillingCycle(metadata.billingCycle || metadata.planInterval);
    const resolvedWebhookPricing = resolvePlanPricing(subscriptionPlan || {}, metadataBillingCycle);
    const referralCode = referralService.normalizeReferralCode(metadata.referralCode);
    const webhookProvider = resolveWebhookProvider(payload);
    const incomingTransactionStatus = toTransactionStatus(payload?.status);
    const providerSubscriptionId = resolveProviderSubscriptionId(payload);
    const providerTransactionId = resolveProviderTransactionId(payload);
    const eventOccurredAt = resolveWebhookEventTimestamp(payload);
    const metadataPlanPrice = decimalToNumber(metadata.planPrice, resolvedWebhookPricing.unitPrice);
    const fallbackAmountCents = Math.max(Math.round(metadataPlanPrice * 100), 0);
    const amountCents = resolveAmountCents(payload, fallbackAmountCents);
    const currency = String(payload?.currency || metadata.planCurrency || subscriptionPlan?.currency || "USD").toUpperCase();
    const existingTransaction = providerTransactionId
      ? await prisma.transaction.findUnique({
          where: { providerTransactionId },
          select: { status: true, subscriptionId: true },
        })
      : null;
    const shouldApplyStatus = shouldApplyTransactionStatus(
      existingTransaction?.status,
      incomingTransactionStatus
    );
    const transactionStatus = shouldApplyStatus
      ? incomingTransactionStatus
      : String(existingTransaction?.status || incomingTransactionStatus);
    const transactionStatusChanged =
      !existingTransaction ||
      normalizeSubscriptionStatus(existingTransaction.status) !== normalizeSubscriptionStatus(transactionStatus);
    const shouldApplyLifecycle = !providerTransactionId || (shouldApplyStatus && transactionStatusChanged);
    const isPaymentSucceeded = transactionStatus === "SUCCEEDED";
    const shouldResolveLinkedSubscription =
      Boolean(providerSubscriptionId) && (!userId || !isPaymentSucceeded || !shouldApplyLifecycle);
    const linkedSubscription = shouldResolveLinkedSubscription
      ? await resolveLinkedSubscriptionByProvider(prisma, providerSubscriptionId)
      : null;

    if (!userId && linkedSubscription?.userId) {
      userId = linkedSubscription.userId;
    }

    if (isPaymentSucceeded && !userId) {
      throw new ApiError(400, "Webhook is missing userId metadata");
    }

    const shouldMutateLinkedSubscription =
      Boolean(userId && linkedSubscription) &&
      ((transactionStatus === "FAILED" && canMarkSubscriptionPastDue(linkedSubscription, eventOccurredAt)) ||
        (["REFUNDED", "CANCELED"].includes(transactionStatus) && canCancelPaidSubscription(linkedSubscription)));
    const requiresSerializedLifecycleMutation =
      Boolean(isPaymentSucceeded && userId) || Boolean(shouldApplyLifecycle && shouldMutateLinkedSubscription);

    if (!shouldApplyLifecycle || !requiresSerializedLifecycleMutation) {
      const transactionData = {
        subscriptionId: existingTransaction?.subscriptionId || linkedSubscription?.id || null,
        userId,
        provider: webhookProvider,
        providerTransactionId,
        status: transactionStatus,
        amountCents,
        currency,
        failureReason:
          transactionStatus === "FAILED" ? String(payload?.failure_reason || payload?.error || "Payment failed") : null,
        metadata: payload,
        processedAt: new Date(),
      };

      if (providerTransactionId) {
        await prisma.transaction.upsert({
          where: { providerTransactionId },
          update: transactionData,
          create: transactionData,
        });
      } else {
        await prisma.transaction.create({
          data: transactionData,
        });
      }

      return { received: true };
    }

    const lockToken = buildWebhookLockToken({
      providerTransactionId,
      providerSubscriptionId,
      userId,
    });

    const applied = await prisma.$transaction(async (tx) => {
      await acquireWebhookTransactionLock(tx, lockToken);

      const transactionStore = tx.transaction || prisma.transaction || null;
      const existingTransactionInTx =
        providerTransactionId && transactionStore && typeof transactionStore.findUnique === "function"
          ? await transactionStore.findUnique({
              where: { providerTransactionId },
              select: { status: true, subscriptionId: true },
            })
          : null;

      const shouldApplyStatusInTx = shouldApplyTransactionStatus(
        existingTransactionInTx?.status,
        incomingTransactionStatus
      );
      const transactionStatusInTx = shouldApplyStatusInTx
        ? incomingTransactionStatus
        : String(existingTransactionInTx?.status || incomingTransactionStatus);
      const transactionStatusChangedInTx =
        !existingTransactionInTx ||
        normalizeSubscriptionStatus(existingTransactionInTx.status) !==
          normalizeSubscriptionStatus(transactionStatusInTx);
      const shouldApplyLifecycleInTx =
        !providerTransactionId || (shouldApplyStatusInTx && transactionStatusChangedInTx);
      const isPaymentSucceededInTx = transactionStatusInTx === "SUCCEEDED";

      let userIdInTx = userId;
      const shouldResolveLinkedSubscriptionInTx =
        Boolean(providerSubscriptionId) && (!userIdInTx || !isPaymentSucceededInTx || !shouldApplyLifecycleInTx);
      const linkedSubscriptionInTx = shouldResolveLinkedSubscriptionInTx
        ? await resolveLinkedSubscriptionByProvider(tx, providerSubscriptionId)
        : null;

      if (!userIdInTx && linkedSubscriptionInTx?.userId) {
        userIdInTx = linkedSubscriptionInTx.userId;
      }

      if (isPaymentSucceededInTx && !userIdInTx) {
        throw new ApiError(400, "Webhook is missing userId metadata");
      }

      let subscriptionRecordInTx = null;
      let didApplySuccessfulPaymentInTx = false;
      let reprocessPhotographerId = null;
      let reprocessReason = null;

      if (isPaymentSucceededInTx && userIdInTx && shouldApplyLifecycleInTx) {
        if (!targetPlan) {
          throw new ApiError(400, "Webhook is missing a valid plan");
        }

        const periodStart = eventOccurredAt;
        const periodEnd = addPlanInterval(periodStart, metadata.planInterval || toPlanIntervalToken(metadataBillingCycle));

        const subscriptionResult = await upsertSuccessfulSubscriptionTx(tx, {
          userId: userIdInTx,
          targetPlan,
          providerSubscriptionId,
          chipPurchaseId: webhookProvider === "CHIP" ? providerSubscriptionId : null,
          periodStart,
          periodEnd,
        });
        subscriptionRecordInTx = subscriptionResult.subscription;
        didApplySuccessfulPaymentInTx = subscriptionResult.stateChanged === true;
        if (didApplySuccessfulPaymentInTx) {
          reprocessPhotographerId = subscriptionRecordInTx?.photographerId || null;
          reprocessReason = "paid_plan_activated";
        }
      } else if (shouldApplyLifecycleInTx && userIdInTx && linkedSubscriptionInTx) {
        if (transactionStatusInTx === "FAILED" && canMarkSubscriptionPastDue(linkedSubscriptionInTx, eventOccurredAt)) {
          await tx.subscription.update({
            where: { id: linkedSubscriptionInTx.id },
            data: { status: "PAST_DUE" },
          });
        }

        if (["REFUNDED", "CANCELED"].includes(transactionStatusInTx) && canCancelPaidSubscription(linkedSubscriptionInTx)) {
          const canceledAt = eventOccurredAt;
          reprocessPhotographerId =
            linkedSubscriptionInTx.photographerId || (await resolvePhotographerIdForUser(userIdInTx, tx));

          await tx.subscription.update({
            where: { id: linkedSubscriptionInTx.id },
            data: {
              status: "CANCELED",
              cancelAtPeriodEnd: false,
              canceledAt,
              currentPeriodEnd: canceledAt,
            },
          });

          await ensureFreeSubscriptionTx(
            tx,
            userIdInTx,
            linkedSubscriptionInTx.photographerId || (await resolvePhotographerIdForUser(userIdInTx, tx))
          );
          reprocessReason = "payment_refunded_or_canceled";
        }
      }

      const transactionData = {
        subscriptionId:
          subscriptionRecordInTx?.id || existingTransactionInTx?.subscriptionId || linkedSubscriptionInTx?.id || null,
        userId: userIdInTx,
        provider: webhookProvider,
        providerTransactionId,
        status: transactionStatusInTx,
        amountCents,
        currency,
        failureReason:
          transactionStatusInTx === "FAILED" ? String(payload?.failure_reason || payload?.error || "Payment failed") : null,
        metadata: payload,
        processedAt: new Date(),
      };

      if (providerTransactionId) {
        await transactionStore.upsert({
          where: { providerTransactionId },
          update: transactionData,
          create: transactionData,
        });
      } else {
        await transactionStore.create({
          data: transactionData,
        });
      }

      return {
        userId: userIdInTx,
        shouldNotifySuccessfulPayment:
          isPaymentSucceededInTx && shouldApplyLifecycleInTx && didApplySuccessfulPaymentInTx && Boolean(userIdInTx),
        notificationSubscriptionId: subscriptionRecordInTx?.id || existingTransactionInTx?.subscriptionId || null,
        reprocessPhotographerId,
        reprocessReason,
      };
    });

    if (applied.reprocessPhotographerId && applied.reprocessReason) {
      triggerPhotographerAssetReprocessing(applied.reprocessPhotographerId, applied.reprocessReason);
    }

    if (applied.shouldNotifySuccessfulPayment && applied.userId) {
      const amountValue = Number.isFinite(amountCents) ? amountCents / 100 : 0;
      const targetPlanLabel = targetPlan || "plan";
      await notificationService.create({
        userId: applied.userId,
        type: "BILLING",
        title: "Payment successful",
        body: `Your ${targetPlanLabel} subscription payment of $${amountValue.toFixed(2)} was successful.`,
        subscriptionId: applied.notificationSubscriptionId,
        actionUrl: "/dashboard/settings",
      });

      await referralService.markConversionAndReward({
        referredUserId: applied.userId,
        referralCode,
      });
    }

    return { received: true };
  },
};








