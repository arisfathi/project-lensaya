ALTER TABLE "SubscriptionPlan"
ADD COLUMN IF NOT EXISTS "analyticsTools" BOOLEAN NOT NULL DEFAULT false;

UPDATE "SubscriptionPlan"
SET "analyticsTools" = CASE
  WHEN "name" = 'FREE' THEN false
  WHEN "name" IN ('PRO', 'STUDIO') THEN true
  ELSE "analyticsTools"
END;
