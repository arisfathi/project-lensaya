# Environment Variables

For CHIP live integration readiness, callback verification notes, and the final credential handoff checklist, see `docs/chip-readiness.md`.

Required backend environment variables:

- `DATABASE_URL`: PostgreSQL connection string for Prisma
- `JWT_SECRET`: secret used to sign Lensaya session tokens

Feature-required backend variables:

- `APP_URL`: canonical Lensaya app/workspace origin
- `PUBLIC_APP_URL`: canonical Lensaya marketing/public origin
- `R2_BUCKET`: Cloudflare R2 bucket name for image objects
- `GOOGLE_CLIENT_ID`: Google OAuth client id
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `CHIP_API_KEY`: API key for CHIP billing integration
- `CHIP_BRAND_ID_PRO`: CHIP brand identifier used for Pro checkout
- `CHIP_BRAND_ID_STUDIO`: CHIP brand identifier used for Studio checkout
- `CHIP_BRAND_ID_FREE`: optional CHIP brand identifier for Free plan checkout flows

Additional supported backend variables:

- `NODE_ENV`
- `PORT`
- `REDIS_URL`
- `QUEUE_CONCURRENCY`
- `ASSET_CLEANUP_ENABLED`
- `ASSET_CLEANUP_INTERVAL_MS`
- `BILLING_MAINTENANCE_ENABLED`
- `BILLING_MAINTENANCE_INTERVAL_MS`
- `BILLING_MAINTENANCE_BATCH_SIZE`
- `BILLING_PROVIDER`
- `BILLING_MOCK_CHECKOUT_PATH`
- `APP_BASE_DOMAIN`
- `APP_URL`
- `PUBLIC_APP_URL`
- `ADMIN_APP_URL` or `ADMIN_URL` (optional dedicated admin origin; defaults to `APP_URL`)
- `CORS_ORIGINS` (comma-separated)
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_SAMESITE`
- `AUTH_COOKIE_SECURE`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID` / `R2_ACCESS_KEY`
- `R2_SECRET_ACCESS_KEY` / `R2_SECRET_KEY`
- `R2_PUBLIC_BASE_URL`
- `R2_BACKUP_BUCKET`
- `R2_BACKUP_DATABASE_URL` (optional dedicated DB URL for `backup:r2manifest`)
- `R2_BACKUP_MANIFEST_DIR`
- `CUSTOM_DOMAIN_CNAME_TARGET`
- `CUSTOM_DOMAIN_VERIFICATION_MODE`
- `CUSTOM_DOMAIN_LOOKUP_TIMEOUT_MS`
- `CHIP_API_BASE_URL`
- `CHIP_WEBHOOK_SECRET` (current code path only; documented live CHIP callbacks appear to require public-key verification, see `docs/chip-readiness.md`)
- `CHIP_SUCCESS_URL`
- `CHIP_CANCEL_URL`
- `CHIP_REQUEST_TIMEOUT_MS`
- `CHIP_MAX_RETRIES`
- `CHIP_RETRY_BASE_DELAY_MS`
- `CHIP_RETRY_MAX_DELAY_MS`
- `CHIP_BRAND_ID_FREE`
- `CHIP_BRAND_ID_PRO`
- `CHIP_BRAND_ID_STUDIO`
- `MEDIA_TRANSFORM_ENABLED`
- `MEDIA_WEB_MAX_WIDTH`
- `MEDIA_THUMB_MAX_WIDTH`
- `MEDIA_WEB_QUALITY`
- `MEDIA_THUMB_QUALITY`
- `FREE_PLAN_WATERMARK_TEXT`
- `FREE_PLAN_WATERMARK_OPACITY`
- `LOG_CLIENT_ERRORS`
- `ANALYTICS_IP_HASH_SALT`
- `LOG_TO_FILE`
- `LOG_FILE_PATH`
- `PG_BACKUP_DIR`
- `PG_BACKUP_RETENTION_DAYS`
- `PG_SNAPSHOT_FILE`
- `PG_SNAPSHOT_ALLOW_PARTIAL`

Frontend variables:

- `VITE_API_URL` or `VITE_API_BASE_URL`
- `VITE_APP_URL`
- `VITE_PUBLIC_APP_URL`
- `VITE_ADMIN_APP_URL` (optional; defaults to `VITE_APP_URL`)
- `VITE_APP_BASE_DOMAIN`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_BACKEND_ORIGIN` (used by Vite dev proxy for `/api` and `/auth`, default `http://localhost:4000`)
- `VITE_CUSTOM_DOMAIN_LOCAL_MOCK`

Custom-domain deployment note:

- If `/api` is proxied same-origin from custom domains, backend host guards will work using the incoming `Host` header.
- If the API is cross-origin instead, `CORS_ORIGINS` must include the actual origins that will call it.
