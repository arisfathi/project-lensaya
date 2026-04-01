CREATE TABLE IF NOT EXISTS "AnalyticsDailyEventRollup" (
  "photographerId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "eventType" "AnalyticsEventType" NOT NULL,
  "source" VARCHAR(64) NOT NULL DEFAULT 'direct',
  "eventCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsDailyEventRollup_pkey" PRIMARY KEY ("photographerId", "date", "eventType", "source")
);

CREATE TABLE IF NOT EXISTS "AnalyticsDailyServiceRollup" (
  "photographerId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "serviceId" UUID NOT NULL,
  "eventType" "AnalyticsEventType" NOT NULL,
  "eventCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsDailyServiceRollup_pkey" PRIMARY KEY ("photographerId", "date", "serviceId", "eventType")
);

CREATE TABLE IF NOT EXISTS "AnalyticsDailyVisitorRollup" (
  "photographerId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "visitorId" VARCHAR(128) NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsDailyVisitorRollup_pkey" PRIMARY KEY ("photographerId", "date", "visitorId")
);

CREATE INDEX IF NOT EXISTS "idx_analytics_daily_event_rollup_photographer_date"
  ON "AnalyticsDailyEventRollup" ("photographerId", "date");
CREATE INDEX IF NOT EXISTS "idx_analytics_daily_event_rollup_photographer_event_date"
  ON "AnalyticsDailyEventRollup" ("photographerId", "eventType", "date");

CREATE INDEX IF NOT EXISTS "idx_analytics_daily_service_rollup_photographer_date"
  ON "AnalyticsDailyServiceRollup" ("photographerId", "date");
CREATE INDEX IF NOT EXISTS "idx_analytics_daily_service_rollup_photographer_service_event_date"
  ON "AnalyticsDailyServiceRollup" ("photographerId", "serviceId", "eventType", "date");

CREATE INDEX IF NOT EXISTS "idx_analytics_daily_visitor_rollup_photographer_date"
  ON "AnalyticsDailyVisitorRollup" ("photographerId", "date");

ALTER TABLE "AnalyticsDailyEventRollup"
  ADD CONSTRAINT "AnalyticsDailyEventRollup_photographerId_fkey"
  FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsDailyServiceRollup"
  ADD CONSTRAINT "AnalyticsDailyServiceRollup_photographerId_fkey"
  FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsDailyServiceRollup"
  ADD CONSTRAINT "AnalyticsDailyServiceRollup_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsDailyVisitorRollup"
  ADD CONSTRAINT "AnalyticsDailyVisitorRollup_photographerId_fkey"
  FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AnalyticsDailyEventRollup" ("photographerId", "date", "eventType", "source", "eventCount")
SELECT
  ae."photographerId",
  (ae."createdAt" AT TIME ZONE 'UTC')::date AS "date",
  ae."eventType",
  COALESCE(NULLIF(TRIM(ae."source"), ''), 'direct') AS "source",
  COUNT(*)::int AS "eventCount"
FROM "AnalyticsEvent" ae
WHERE ae."photographerId" IS NOT NULL
GROUP BY
  ae."photographerId",
  (ae."createdAt" AT TIME ZONE 'UTC')::date,
  ae."eventType",
  COALESCE(NULLIF(TRIM(ae."source"), ''), 'direct')
ON CONFLICT ("photographerId", "date", "eventType", "source") DO UPDATE
SET "eventCount" = EXCLUDED."eventCount";

INSERT INTO "AnalyticsDailyServiceRollup" ("photographerId", "date", "serviceId", "eventType", "eventCount")
SELECT
  ae."photographerId",
  (ae."createdAt" AT TIME ZONE 'UTC')::date AS "date",
  ae."serviceId",
  ae."eventType",
  COUNT(*)::int AS "eventCount"
FROM "AnalyticsEvent" ae
WHERE ae."photographerId" IS NOT NULL
  AND ae."serviceId" IS NOT NULL
GROUP BY
  ae."photographerId",
  (ae."createdAt" AT TIME ZONE 'UTC')::date,
  ae."serviceId",
  ae."eventType"
ON CONFLICT ("photographerId", "date", "serviceId", "eventType") DO UPDATE
SET "eventCount" = EXCLUDED."eventCount";

INSERT INTO "AnalyticsDailyVisitorRollup" ("photographerId", "date", "visitorId")
SELECT DISTINCT
  ae."photographerId",
  (ae."createdAt" AT TIME ZONE 'UTC')::date AS "date",
  ae."visitorId"
FROM "AnalyticsEvent" ae
WHERE ae."photographerId" IS NOT NULL
  AND ae."visitorId" IS NOT NULL
  AND TRIM(ae."visitorId") <> ''
ON CONFLICT ("photographerId", "date", "visitorId") DO NOTHING;
