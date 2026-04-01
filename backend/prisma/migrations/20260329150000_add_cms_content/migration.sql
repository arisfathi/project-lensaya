DO $$
BEGIN
  CREATE TYPE "CmsContentSection" AS ENUM ('RESOURCES', 'HELP_CENTER', 'BLOG', 'GUIDES');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CmsContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CmsContent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "section" "CmsContentSection" NOT NULL,
  "slug" VARCHAR(191) NOT NULL,
  "title" VARCHAR(191) NOT NULL,
  "excerpt" VARCHAR(500),
  "contentMarkdown" TEXT NOT NULL,
  "status" "CmsContentStatus" NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CmsContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CmsContent_section_slug_key" ON "CmsContent"("section", "slug");
CREATE INDEX IF NOT EXISTS "CmsContent_section_status_sortOrder_createdAt_idx" ON "CmsContent"("section", "status", "sortOrder", "createdAt");
CREATE INDEX IF NOT EXISTS "CmsContent_status_publishedAt_idx" ON "CmsContent"("status", "publishedAt");

INSERT INTO "CmsContent" ("section", "slug", "title", "excerpt", "contentMarkdown", "status", "sortOrder", "publishedAt")
VALUES
  ('RESOURCES', 'resource-hub-overview', 'Resource Hub Overview', 'How Lensaya resources are organized for photographers.', '## Resource Hub\n\nUse the Help Center for setup and troubleshooting.\n\nUse Guides for tactical workflows and execution plans.\n\nUse the Blog for product updates and growth insights.', 'PUBLISHED', 0, CURRENT_TIMESTAMP),
  ('HELP_CENTER', 'getting-started', 'Getting Started Checklist', 'Launch your first profile and publish your portfolio.', '## Getting Started\n\n1. Complete your profile and hero section.\n2. Upload portfolio work and organize by service.\n3. Configure packages and availability.\n4. Publish and test the public booking flow.', 'PUBLISHED', 0, CURRENT_TIMESTAMP),
  ('BLOG', 'product-update-content-cms', 'Product Update: Content CMS is now available', 'Manage Resources, Help Center, Blog, and Guides from admin.', '## What is new\n\nYou can now manage public content from **Admin > Content CMS**.\n\n- Draft and publish entries\n- Order entries by sort order\n- Write content in Markdown', 'PUBLISHED', 0, CURRENT_TIMESTAMP),
  ('GUIDES', 'portfolio-conversion-basics', 'Portfolio Conversion Basics', 'Structure your portfolio so clients can make decisions faster.', '## Conversion Basics\n\n- Keep service categories clear\n- Show social proof near key CTAs\n- Make package differences explicit\n- Keep booking steps short', 'PUBLISHED', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("section", "slug") DO NOTHING;
