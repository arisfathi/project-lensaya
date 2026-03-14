-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PHOTOGRAPHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED', 'PENDING_INVITE');

-- CreateEnum
CREATE TYPE "PhotographerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'COMPLETED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'DIRECT', 'OTHER');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'UNAVAILABLE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'STUDIO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "TransactionProvider" AS ENUM ('CHIP', 'STRIPE', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'BOOKING', 'BILLING', 'SECURITY', 'MARKETING', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('CLICKED', 'SIGNED_UP', 'CONVERTED', 'REWARDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetPurpose" AS ENUM ('AVATAR', 'BANNER', 'PORTFOLIO', 'SERVICE_THUMBNAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('PAGE_VIEW', 'PORTFOLIO_VIEW', 'PROFILE_CLICK', 'WHATSAPP_CLICK', 'BOOKING_INTENT', 'SERVICE_SELECT', 'PACKAGE_SELECT', 'SEARCH', 'FILTER', 'OTHER');

-- CreateEnum
CREATE TYPE "AdminLogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" VARCHAR(255),
    "googleId" VARCHAR(191),
    "fullName" VARCHAR(191) NOT NULL,
    "username" VARCHAR(64),
    "role" "UserRole" NOT NULL DEFAULT 'PHOTOGRAPHER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photographer" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "studioName" VARCHAR(191) NOT NULL,
    "bio" TEXT,
    "status" "PhotographerStatus" NOT NULL DEFAULT 'ACTIVE',
    "websiteUrl" VARCHAR(255),
    "themeColor" VARCHAR(16),
    "phone" VARCHAR(32),
    "whatsappNumber" VARCHAR(32),
    "instagramHandle" VARCHAR(191),
    "facebookUrl" VARCHAR(255),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "avatarAssetId" UUID,
    "bannerAssetId" UUID,
    "isDirectoryVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Photographer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "description" TEXT,
    "emoji" VARCHAR(32),
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "thumbnailAssetId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "durationLabel" VARCHAR(64) NOT NULL,
    "features" TEXT[],
    "status" "PackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "serviceId" UUID,
    "assetId" UUID NOT NULL,
    "title" VARCHAR(191),
    "description" TEXT,
    "category" VARCHAR(64),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "serviceId" UUID,
    "packageId" UUID,
    "portfolioItemId" UUID,
    "bookedByUserId" UUID,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "source" "BookingSource" NOT NULL DEFAULT 'WEBSITE',
    "clientName" VARCHAR(191),
    "clientEmail" VARCHAR(320),
    "clientPhone" VARCHAR(32),
    "message" TEXT,
    "preferredDate" TIMESTAMP(3),
    "quotedPriceCents" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "whatsappUrl" VARCHAR(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "note" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "photographerId" UUID,
    "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" "TransactionProvider" NOT NULL DEFAULT 'CHIP',
    "providerCustomerId" VARCHAR(191),
    "providerSubscriptionId" VARCHAR(191),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID,
    "userId" UUID,
    "provider" "TransactionProvider" NOT NULL,
    "providerTransactionId" VARCHAR(191),
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "failureReason" TEXT,
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bookingId" UUID,
    "subscriptionId" UUID,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(191) NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" VARCHAR(1024),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" UUID NOT NULL,
    "referrerUserId" UUID NOT NULL,
    "referredUserId" UUID,
    "referredPhotographerId" UUID,
    "referredEmail" VARCHAR(320),
    "code" VARCHAR(64) NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'CLICKED',
    "source" VARCHAR(64),
    "visitorId" VARCHAR(191),
    "rewardCents" INTEGER NOT NULL DEFAULT 0,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "photographerId" UUID,
    "uploadedById" UUID,
    "type" "AssetType" NOT NULL,
    "purpose" "AssetPurpose" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
    "bucket" VARCHAR(191) NOT NULL,
    "objectKey" VARCHAR(512) NOT NULL,
    "cdnUrl" VARCHAR(1024),
    "mimeType" VARCHAR(191) NOT NULL,
    "originalFileName" VARCHAR(255),
    "sizeBytes" INTEGER NOT NULL,
    "checksum" VARCHAR(128),
    "width" INTEGER,
    "height" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" BIGSERIAL NOT NULL,
    "eventType" "AnalyticsEventType" NOT NULL,
    "photographerId" UUID,
    "serviceId" UUID,
    "packageId" UUID,
    "portfolioItemId" UUID,
    "bookingId" UUID,
    "userId" UUID,
    "sessionId" VARCHAR(128),
    "visitorId" VARCHAR(128),
    "source" VARCHAR(64),
    "path" VARCHAR(512),
    "ipHash" VARCHAR(128),
    "userAgent" TEXT,
    "referrer" VARCHAR(1024),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" BIGSERIAL NOT NULL,
    "actorUserId" UUID NOT NULL,
    "targetUserId" UUID,
    "level" "AdminLogLevel" NOT NULL DEFAULT 'INFO',
    "action" VARCHAR(128) NOT NULL,
    "resourceType" VARCHAR(64) NOT NULL,
    "resourceId" VARCHAR(64),
    "ipAddress" VARCHAR(64),
    "userAgent" TEXT,
    "statusCode" INTEGER,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Photographer_userId_key" ON "Photographer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Photographer_username_key" ON "Photographer"("username");

-- CreateIndex
CREATE INDEX "Photographer_status_createdAt_idx" ON "Photographer"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Photographer_isDirectoryVisible_createdAt_idx" ON "Photographer"("isDirectoryVisible", "createdAt");

-- CreateIndex
CREATE INDEX "Photographer_studioName_idx" ON "Photographer"("studioName");

-- CreateIndex
CREATE INDEX "Service_photographerId_status_displayOrder_idx" ON "Service"("photographerId", "status", "displayOrder");

-- CreateIndex
CREATE INDEX "Service_createdAt_idx" ON "Service"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Service_photographerId_name_key" ON "Service"("photographerId", "name");

-- CreateIndex
CREATE INDEX "Package_serviceId_status_displayOrder_idx" ON "Package"("serviceId", "status", "displayOrder");

-- CreateIndex
CREATE INDEX "Package_photographerId_status_idx" ON "Package"("photographerId", "status");

-- CreateIndex
CREATE INDEX "Package_priceCents_idx" ON "Package"("priceCents");

-- CreateIndex
CREATE UNIQUE INDEX "Package_serviceId_name_key" ON "Package"("serviceId", "name");

-- CreateIndex
CREATE INDEX "PortfolioItem_photographerId_isFeatured_createdAt_idx" ON "PortfolioItem"("photographerId", "isFeatured", "createdAt");

-- CreateIndex
CREATE INDEX "PortfolioItem_serviceId_createdAt_idx" ON "PortfolioItem"("serviceId", "createdAt");

-- CreateIndex
CREATE INDEX "PortfolioItem_category_idx" ON "PortfolioItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_photographerId_assetId_key" ON "PortfolioItem"("photographerId", "assetId");

-- CreateIndex
CREATE INDEX "Booking_photographerId_status_preferredDate_idx" ON "Booking"("photographerId", "status", "preferredDate");

-- CreateIndex
CREATE INDEX "Booking_source_createdAt_idx" ON "Booking"("source", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_clientEmail_idx" ON "Booking"("clientEmail");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE INDEX "Availability_photographerId_status_idx" ON "Availability"("photographerId", "status");

-- CreateIndex
CREATE INDEX "Availability_date_idx" ON "Availability"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_photographerId_date_key" ON "Availability"("photographerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "Subscription_photographerId_status_idx" ON "Subscription"("photographerId", "status");

-- CreateIndex
CREATE INDEX "Subscription_plan_status_idx" ON "Subscription"("plan", "status");

-- CreateIndex
CREATE INDEX "Subscription_createdAt_idx" ON "Subscription"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_providerTransactionId_key" ON "Transaction"("providerTransactionId");

-- CreateIndex
CREATE INDEX "Transaction_subscriptionId_createdAt_idx" ON "Transaction"("subscriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_status_createdAt_idx" ON "Transaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_provider_createdAt_idx" ON "Transaction"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_bookingId_idx" ON "Notification"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");

-- CreateIndex
CREATE INDEX "Referral_referrerUserId_status_createdAt_idx" ON "Referral"("referrerUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_code_createdAt_idx" ON "Referral"("code", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_referredEmail_idx" ON "Referral"("referredEmail");

-- CreateIndex
CREATE INDEX "Referral_visitorId_idx" ON "Referral"("visitorId");

-- CreateIndex
CREATE INDEX "Asset_photographerId_purpose_status_idx" ON "Asset"("photographerId", "purpose", "status");

-- CreateIndex
CREATE INDEX "Asset_uploadedById_createdAt_idx" ON "Asset"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_deletedAt_idx" ON "Asset"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_bucket_objectKey_key" ON "Asset"("bucket", "objectKey");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_photographerId_createdAt_idx" ON "AnalyticsEvent"("photographerId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_createdAt_idx" ON "AnalyticsEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_visitorId_createdAt_idx" ON "AnalyticsEvent"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_serviceId_packageId_idx" ON "AnalyticsEvent"("serviceId", "packageId");

-- CreateIndex
CREATE INDEX "AdminLog_actorUserId_createdAt_idx" ON "AdminLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminLog_targetUserId_createdAt_idx" ON "AdminLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminLog_resourceType_resourceId_idx" ON "AdminLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AdminLog_level_createdAt_idx" ON "AdminLog"("level", "createdAt");

-- CreateIndex
CREATE INDEX "AdminLog_action_createdAt_idx" ON "AdminLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Photographer" ADD CONSTRAINT "Photographer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photographer" ADD CONSTRAINT "Photographer_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photographer" ADD CONSTRAINT "Photographer_bannerAssetId_fkey" FOREIGN KEY ("bannerAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_portfolioItemId_fkey" FOREIGN KEY ("portfolioItemId") REFERENCES "PortfolioItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookedByUserId_fkey" FOREIGN KEY ("bookedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredPhotographerId_fkey" FOREIGN KEY ("referredPhotographerId") REFERENCES "Photographer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_portfolioItemId_fkey" FOREIGN KEY ("portfolioItemId") REFERENCES "PortfolioItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
