CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "idx_photographer_studio_name_trgm"
  ON "Photographer" USING gin ("studioName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_photographer_username_trgm"
  ON "Photographer" USING gin ("username" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_photographer_location_trgm"
  ON "Photographer" USING gin ("location" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_photographer_city_trgm"
  ON "Photographer" USING gin ("city" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_photographer_country_trgm"
  ON "Photographer" USING gin ("country" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_photographer_specialty_trgm"
  ON "Photographer" USING gin ("specialty" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_photographer_style_trgm"
  ON "Photographer" USING gin ("style" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_service_name_trgm"
  ON "Service" USING gin ("name" gin_trgm_ops);
