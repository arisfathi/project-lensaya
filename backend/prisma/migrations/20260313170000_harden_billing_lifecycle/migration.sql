CREATE TYPE ""BillingInterval"" AS ENUM ('MONTHLY', 'YEARLY');

ALTER TABLE ""Subscription""
ADD COLUMN ""billingInterval"" ""BillingInterval"" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN ""pendingPlan"" ""PlanTier"",
ADD COLUMN ""pendingBillingInterval"" ""BillingInterval"";

UPDATE ""Subscription""
SET ""billingInterval"" = CASE
  WHEN ""currentPeriodStart"" IS NOT NULL
    AND ""currentPeriodEnd"" IS NOT NULL
    AND ""currentPeriodEnd"" >= ""currentPeriodStart"" + INTERVAL '45 days'
  THEN 'YEARLY'::""BillingInterval""
  ELSE 'MONTHLY'::""BillingInterval""
END;

CREATE INDEX ""Subscription_userId_status_billingInterval_idx""
ON ""Subscription"" (""userId"", ""status"", ""billingInterval"");
