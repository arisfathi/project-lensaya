ALTER TABLE "Referral"
ADD COLUMN "rewardGrantedAt" TIMESTAMP(3),
ADD COLUMN "rewardPlan" "PlanTier",
ADD COLUMN "rewardDays" INTEGER NOT NULL DEFAULT 0;
