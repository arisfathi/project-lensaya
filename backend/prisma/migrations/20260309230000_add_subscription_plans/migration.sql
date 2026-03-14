CREATE TABLE "SubscriptionPlan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(64) NOT NULL,
    "maxServices" INTEGER NOT NULL,
    "maxPortfolioImages" INTEGER NOT NULL,
    "maxPackages" INTEGER NOT NULL,
    "storageGB" INTEGER NOT NULL,
    "customDomain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

INSERT INTO "SubscriptionPlan" (
    "name",
    "maxServices",
    "maxPortfolioImages",
    "maxPackages",
    "storageGB",
    "customDomain"
) VALUES
    ('FREE', 2, 50, 3, 1, false),
    ('PRO', 10, 500, 20, 10, true),
    ('STUDIO', -1, -1, -1, -1, true)
ON CONFLICT ("name") DO UPDATE SET
    "maxServices" = EXCLUDED."maxServices",
    "maxPortfolioImages" = EXCLUDED."maxPortfolioImages",
    "maxPackages" = EXCLUDED."maxPackages",
    "storageGB" = EXCLUDED."storageGB",
    "customDomain" = EXCLUDED."customDomain",
    "updatedAt" = CURRENT_TIMESTAMP;
