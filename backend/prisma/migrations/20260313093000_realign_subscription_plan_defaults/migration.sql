-- Align launch plan defaults with photographer-friendly pricing semantics.
-- Safe migration: updates/creates plan configuration rows only.
-- Does not modify subscriptions, transactions, or billing provider linkage.

INSERT INTO "SubscriptionPlan" (
  "name",
  "maxServices",
  "maxPortfolioImages",
  "maxPackages",
  "storageGB",
  "customDomain",
  "analyticsTools",
  "price",
  "currency",
  "trialDays",
  "referralReward",
  "storageCostPerGB"
) VALUES
  ('FREE', 3, 30, 3, 1, false, false, 0, 'USD', 0, 0, 0),
  ('PRO', 10, 200, 5, 10, true, true, 19.99, 'USD', 7, 5, 0.50),
  ('STUDIO', -1, -1, 10, -1, true, true, 49.99, 'USD', 14, 10, 0.25)
ON CONFLICT ("name") DO UPDATE SET
  "maxServices" = EXCLUDED."maxServices",
  "maxPortfolioImages" = EXCLUDED."maxPortfolioImages",
  "maxPackages" = EXCLUDED."maxPackages",
  "storageGB" = EXCLUDED."storageGB",
  "customDomain" = EXCLUDED."customDomain",
  "analyticsTools" = EXCLUDED."analyticsTools",
  "price" = EXCLUDED."price",
  "currency" = EXCLUDED."currency",
  "trialDays" = EXCLUDED."trialDays",
  "referralReward" = EXCLUDED."referralReward",
  "storageCostPerGB" = EXCLUDED."storageCostPerGB",
  "updatedAt" = CURRENT_TIMESTAMP;
