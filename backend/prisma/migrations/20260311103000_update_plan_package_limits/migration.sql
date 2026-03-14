UPDATE "SubscriptionPlan"
SET "maxPackages" = CASE
  WHEN "name" = 'FREE' THEN 3
  WHEN "name" = 'PRO' THEN 5
  WHEN "name" = 'STUDIO' THEN 20
  ELSE "maxPackages"
END
WHERE "name" IN ('FREE', 'PRO', 'STUDIO');
