CREATE INDEX IF NOT EXISTS "idx_portfolio_item_photographer_service_created_at"
  ON "PortfolioItem" ("photographerId", "serviceId", "createdAt");

CREATE INDEX IF NOT EXISTS "idx_analytics_event_photographer_event_type_created_at"
  ON "AnalyticsEvent" ("photographerId", "eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "idx_analytics_event_photographer_source_created_at"
  ON "AnalyticsEvent" ("photographerId", "source", "createdAt");
