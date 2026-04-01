ALTER TABLE "SubscriptionPlan"
ADD COLUMN IF NOT EXISTS "teamSectionTools" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "SubscriptionPlan"
SET "teamSectionTools" = CASE
  WHEN UPPER("name") = 'STUDIO' THEN TRUE
  ELSE FALSE
END;
