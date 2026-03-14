-- Persist admin settings and legal pages in database for multi-instance environments.
CREATE TABLE "PlatformSetting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(128) NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");

CREATE TABLE "LegalPage" (
    "slug" VARCHAR(128) NOT NULL,
    "title" VARCHAR(191) NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalPage_pkey" PRIMARY KEY ("slug")
);
