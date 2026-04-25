-- Centralize plan entitlements and pricing presentation metadata.
-- Non-destructive migration: adds new columns and backfills from current tier behavior.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AnalyticsMode') THEN
    CREATE TYPE "AnalyticsMode" AS ENUM ('NONE', 'BASIC', 'ADVANCED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadAnalyticsMode') THEN
    CREATE TYPE "LeadAnalyticsMode" AS ENUM ('NONE', 'BASIC', 'ADVANCED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTier') THEN
    CREATE TYPE "SupportTier" AS ENUM ('STANDARD', 'PRIORITY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BrandingMode') THEN
    CREATE TYPE "BrandingMode" AS ENUM ('FORCED_LENSAYA', 'REMOVABLE');
  END IF;
END $$;

ALTER TABLE "SubscriptionPlan"
  ADD COLUMN IF NOT EXISTS "displayName" VARCHAR(128) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "tagline" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "subtitle" TEXT,
  ADD COLUMN IF NOT EXISTS "badgeText" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "ctaText" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "monthlyPriceDisplay" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "yearlyPriceDisplay" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isVisible" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "isMostPopular" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "maxPackagesPerService" INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS "maxPackageFeaturesPerPackage" INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS "storageGb" INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS "leadHistoryDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "leadVisibilityLimit" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "leadTemplatesCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "teamSeats" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "analyticsEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "customDomainEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "hideBrandingEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "leadFiltersEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "leadExportEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "leadRemindersEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "leadAdvancedAnalyticsEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "teamToolsEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "analyticsMode" "AnalyticsMode" NOT NULL DEFAULT 'BASIC',
  ADD COLUMN IF NOT EXISTS "leadAnalyticsMode" "LeadAnalyticsMode" NOT NULL DEFAULT 'BASIC',
  ADD COLUMN IF NOT EXISTS "supportTier" "SupportTier" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "brandingMode" "BrandingMode" NOT NULL DEFAULT 'FORCED_LENSAYA',
  ADD COLUMN IF NOT EXISTS "leadChannels" JSONB;

UPDATE "SubscriptionPlan"
SET
  "displayName" = COALESCE(NULLIF("displayName", ''), INITCAP(LOWER("name"))),
  "sortOrder" = CASE UPPER("name") WHEN 'FREE' THEN 1 WHEN 'PRO' THEN 2 WHEN 'STUDIO' THEN 3 ELSE "sortOrder" END,
  "isVisible" = TRUE,
  "isActive" = TRUE,
  "isMostPopular" = CASE WHEN UPPER("name") = 'PRO' THEN TRUE ELSE FALSE END,
  "maxPackagesPerService" = CASE
    WHEN "maxPackagesPerService" = -1 AND "maxPackages" IS NOT NULL THEN "maxPackages"
    ELSE "maxPackagesPerService"
  END,
  "maxPackageFeaturesPerPackage" = CASE
    WHEN "maxPackageFeaturesPerPackage" = -1 AND "maxPackageFeatures" IS NOT NULL THEN "maxPackageFeatures"
    ELSE "maxPackageFeaturesPerPackage"
  END,
  "storageGb" = CASE
    WHEN "storageGb" = -1 AND "storageGB" IS NOT NULL THEN "storageGB"
    ELSE "storageGb"
  END,
  "customDomainEnabled" = COALESCE("customDomain", FALSE),
  "analyticsEnabled" = COALESCE("analyticsTools", FALSE),
  "teamToolsEnabled" = COALESCE("teamSectionTools", FALSE),
  "analyticsMode" = CASE
    WHEN COALESCE("analyticsTools", FALSE) THEN 'ADVANCED'::"AnalyticsMode"
    ELSE 'NONE'::"AnalyticsMode"
  END,
  "leadAnalyticsMode" = CASE
    WHEN UPPER("name") IN ('PRO', 'STUDIO') THEN 'ADVANCED'::"LeadAnalyticsMode"
    ELSE 'NONE'::"LeadAnalyticsMode"
  END,
  "brandingMode" = CASE
    WHEN UPPER("name") IN ('PRO', 'STUDIO') THEN 'REMOVABLE'::"BrandingMode"
    ELSE 'FORCED_LENSAYA'::"BrandingMode"
  END,
  "hideBrandingEnabled" = CASE WHEN UPPER("name") IN ('PRO', 'STUDIO') THEN TRUE ELSE FALSE END,
  "leadFiltersEnabled" = CASE WHEN UPPER("name") IN ('PRO', 'STUDIO') THEN TRUE ELSE FALSE END,
  "leadExportEnabled" = CASE WHEN UPPER("name") IN ('PRO', 'STUDIO') THEN TRUE ELSE FALSE END,
  "leadRemindersEnabled" = CASE WHEN UPPER("name") IN ('PRO', 'STUDIO') THEN TRUE ELSE FALSE END,
  "leadAdvancedAnalyticsEnabled" = CASE WHEN UPPER("name") IN ('PRO', 'STUDIO') THEN TRUE ELSE FALSE END,
  "leadHistoryDays" = CASE
    WHEN UPPER("name") = 'FREE' THEN 30
    WHEN UPPER("name") = 'PRO' THEN 365
    WHEN UPPER("name") = 'STUDIO' THEN -1
    ELSE "leadHistoryDays"
  END,
  "leadVisibilityLimit" = CASE
    WHEN UPPER("name") = 'FREE' THEN 60
    WHEN UPPER("name") IN ('PRO', 'STUDIO') THEN -1
    ELSE "leadVisibilityLimit"
  END,
  "leadTemplatesCount" = CASE
    WHEN UPPER("name") = 'FREE' THEN 1
    WHEN UPPER("name") = 'PRO' THEN 8
    WHEN UPPER("name") = 'STUDIO' THEN -1
    ELSE "leadTemplatesCount"
  END,
  "teamSeats" = CASE
    WHEN UPPER("name") = 'FREE' THEN 1
    WHEN UPPER("name") = 'PRO' THEN 3
    WHEN UPPER("name") = 'STUDIO' THEN 10
    ELSE "teamSeats"
  END,
  "supportTier" = CASE
    WHEN UPPER("name") = 'STUDIO' THEN 'PRIORITY'::"SupportTier"
    ELSE 'STANDARD'::"SupportTier"
  END,
  "leadChannels" = COALESCE("leadChannels", '{"whatsapp":true,"email":true}'::jsonb),
  "tagline" = COALESCE("tagline", CASE
    WHEN UPPER("name") = 'FREE' THEN 'For getting started'
    WHEN UPPER("name") = 'PRO' THEN 'For growing photographers'
    WHEN UPPER("name") = 'STUDIO' THEN 'For studios and teams'
    ELSE NULL
  END),
  "subtitle" = COALESCE("subtitle", CASE
    WHEN UPPER("name") = 'FREE' THEN 'Launch your public profile and start collecting inquiries.'
    WHEN UPPER("name") = 'PRO' THEN 'Scale your bookings with stronger limits and workflow tools.'
    WHEN UPPER("name") = 'STUDIO' THEN 'Run high-volume operations with advanced controls and team workflows.'
    ELSE NULL
  END),
  "badgeText" = COALESCE("badgeText", CASE WHEN UPPER("name") = 'PRO' THEN 'Most Popular' ELSE NULL END),
  "ctaText" = COALESCE("ctaText", CASE
    WHEN UPPER("name") = 'FREE' THEN 'Get Started Free'
    WHEN UPPER("name") = 'PRO' THEN 'Start Pro'
    WHEN UPPER("name") = 'STUDIO' THEN 'Talk to Sales'
    ELSE NULL
  END),
  "monthlyPriceDisplay" = COALESCE("monthlyPriceDisplay", CONCAT('$', TO_CHAR(COALESCE("price", 0), 'FM999999990.00'), '/mo')),
  "yearlyPriceDisplay" = COALESCE("yearlyPriceDisplay", CONCAT('$', TO_CHAR(COALESCE("yearlyPrice", 0), 'FM999999990.00'), '/yr'));
