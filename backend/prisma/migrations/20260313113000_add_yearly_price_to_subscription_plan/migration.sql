-- Add explicit yearly pricing for each subscription plan.
-- Safe migration: no destructive schema changes, existing subscriptions/transactions remain intact.

ALTER TABLE "SubscriptionPlan"
ADD COLUMN "yearlyPrice" DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Initialize yearly prices with a sensible default:
-- FREE stays 0, paid plans default to 10 months worth of monthly price.
UPDATE "SubscriptionPlan"
SET "yearlyPrice" = CASE
  WHEN UPPER("name") = 'FREE' THEN 0
  WHEN "price" > 0 THEN ROUND(("price" * 10)::numeric, 2)
  ELSE 0
END
WHERE "yearlyPrice" = 0;
