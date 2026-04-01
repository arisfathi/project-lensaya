ALTER TABLE "SubscriptionPlan"
ADD COLUMN IF NOT EXISTS "maxPackageFeatures" INTEGER NOT NULL DEFAULT 5;

UPDATE "SubscriptionPlan"
SET "maxPackageFeatures" = CASE
  WHEN UPPER("name") = 'FREE' THEN 5
  WHEN UPPER("name") = 'PRO' THEN 10
  WHEN UPPER("name") = 'STUDIO' THEN 20
  ELSE "maxPackageFeatures"
END
WHERE UPPER("name") IN ('FREE', 'PRO', 'STUDIO');
