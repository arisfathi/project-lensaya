CREATE TYPE "CustomDomainStatus" AS ENUM ('PENDING', 'AWAITING_DNS', 'VERIFYING', 'ACTIVE', 'FAILED', 'BROKEN');
CREATE TYPE "CustomDomainSslStatus" AS ENUM ('PENDING', 'ISSUED', 'ERROR');

CREATE TABLE "CustomDomain" (
  "id" UUID NOT NULL,
  "photographerId" UUID NOT NULL,
  "domain" VARCHAR(255) NOT NULL,
  "apexDomain" VARCHAR(255) NOT NULL,
  "host" VARCHAR(128) NOT NULL,
  "status" "CustomDomainStatus" NOT NULL DEFAULT 'AWAITING_DNS',
  "sslStatus" "CustomDomainSslStatus",
  "failureReason" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomDomain_photographerId_key" ON "CustomDomain"("photographerId");
CREATE UNIQUE INDEX "CustomDomain_domain_key" ON "CustomDomain"("domain");
CREATE INDEX "CustomDomain_status_updatedAt_idx" ON "CustomDomain"("status", "updatedAt");
CREATE INDEX "CustomDomain_domain_status_idx" ON "CustomDomain"("domain", "status");

ALTER TABLE "CustomDomain"
ADD CONSTRAINT "CustomDomain_photographerId_fkey"
FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
