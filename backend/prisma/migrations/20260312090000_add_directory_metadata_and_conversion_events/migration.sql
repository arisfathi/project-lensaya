-- Directory metadata and branding controls for public discovery pages.
ALTER TABLE "Photographer"
ADD COLUMN "location" VARCHAR(191),
ADD COLUMN "city" VARCHAR(128),
ADD COLUMN "country" VARCHAR(128),
ADD COLUMN "specialty" VARCHAR(128),
ADD COLUMN "style" VARCHAR(128),
ADD COLUMN "hideBranding" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Photographer_city_isDirectoryVisible_status_idx"
ON "Photographer"("city", "isDirectoryVisible", "status");

CREATE INDEX "Photographer_specialty_isDirectoryVisible_status_idx"
ON "Photographer"("specialty", "isDirectoryVisible", "status");

-- Explicit CHIP purchase reference for subscription lifecycle debugging.
ALTER TABLE "Subscription"
ADD COLUMN "chipPurchaseId" VARCHAR(191);

CREATE UNIQUE INDEX "Subscription_chipPurchaseId_key"
ON "Subscription"("chipPurchaseId");

-- Conversion-focused analytics events.
ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'PACKAGE_VIEW';
ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'PORTFOLIO_SHARE';
