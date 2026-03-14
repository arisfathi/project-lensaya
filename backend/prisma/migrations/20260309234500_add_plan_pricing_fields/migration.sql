ALTER TABLE "SubscriptionPlan"
ADD COLUMN "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN "trialDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "referralReward" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "storageCostPerGB" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "SubscriptionPlan"
SET
  "price" = 0,
  "currency" = 'USD',
  "trialDays" = 0,
  "referralReward" = 0,
  "storageCostPerGB" = 0
WHERE "name" = 'FREE';

UPDATE "SubscriptionPlan"
SET
  "price" = 19.99,
  "currency" = 'USD',
  "trialDays" = 7,
  "referralReward" = 5,
  "storageCostPerGB" = 0.50
WHERE "name" = 'PRO';

UPDATE "SubscriptionPlan"
SET
  "price" = 49.99,
  "currency" = 'USD',
  "trialDays" = 14,
  "referralReward" = 10,
  "storageCostPerGB" = 0.25
WHERE "name" = 'STUDIO';
