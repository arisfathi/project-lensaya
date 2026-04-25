# Environment Variables Reference

This document lists all environment variables used by Lensaya.

## Required vs Optional

- **Required**: Must be set; application will not start without these
- **Optional**: Application runs without them, but features may be disabled or use fallback behavior
- **Production-required**: Required only in production deployments

## Backend Environment Variables

## Docker/Caddy Deployment (Single Droplet)

These variables are used by the provided Docker Compose + Caddy deployment files (`docker-compose.yml`, `docker-compose.prod.yml`, `deploy/Caddyfile`).

| Variable | Required | Type | Purpose | Example / Notes |
|----------|----------|------|---------|-----------------|
| `BASE_DOMAIN` | **Yes** | domain | Base domain for platform + wildcard studio hosts | `lensaya.com` |
| `ACME_EMAIL` | **Yes** | email | Email used for TLS issuance (Let’s Encrypt via Caddy) | `you@lensaya.com` |
| `CLOUDFLARE_API_TOKEN` | **Yes*** | string | Cloudflare token for DNS challenge (wildcard certs) | Required for `*.${BASE_DOMAIN}` TLS |
| `POSTGRES_DB` | No | string | Postgres database name (container) | Default: `lensaya` |
| `POSTGRES_USER` | No | string | Postgres user (container) | Default: `postgres` |
| `POSTGRES_PASSWORD` | **Yes** | string | Postgres password (container) | Must match `DATABASE_URL` password |

**Notes**:
- `CLOUDFLARE_API_TOKEN` must have DNS edit permissions for the zone to issue wildcard certificates.
- These are deployment-only variables; the backend does not read `BASE_DOMAIN` directly (it derives base domain from `PUBLIC_APP_URL`/`APP_URL`, or `APP_BASE_DOMAIN`).

### Core Application

| Variable | Required | Type | Purpose | Example / Notes |
|----------|----------|------|---------|-----------------|
| `NODE_ENV` | No | `development`, `test`, `production` | Environment mode; affects logging, CORS, cookie security | Default: `development` |
| `PORT` | No | number | HTTP server port | Default: `4000` |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, `error` | Pino logger level | Default: `info` |
| `DATABASE_URL` | **Yes** | PostgreSQL URL | Prisma database connection string | `postgresql://user:password@host:5432/dbname?schema=public` |
| `JWT_SECRET` | **Yes** | string | Secret for signing JWT tokens | Use strong random value (32+ chars for production) |
| `JWT_EXPIRES_IN` | No | time string | JWT access token expiry | Default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | time string | JWT refresh token expiry | Default: `30d` |

### Frontend/App URLs

| Variable | Required | Type | Purpose | Example / Notes |
|----------|----------|------|---------|-----------------|
| `APP_URL` | Prod-required | URL | App domain (photographer + admin interface) | `https://app.example.com` or `http://localhost:5173` |
| `FRONTEND_URL` | No | URL | Alias for `APP_URL` (either can be used) | |
| `PUBLIC_APP_URL` | Prod-required | URL | Public marketing/portfolio domain | `https://example.com` or `http://localhost:5173` |
| `PUBLIC_URL` | No | URL | Alias for `PUBLIC_APP_URL` | |
| `APP_BASE_URL` | No | URL | Alias for `PUBLIC_APP_URL` | |
| `ADMIN_APP_URL` | No | URL | Admin-only domain (if different from APP_URL) | `https://admin.example.com` |
| `ADMIN_URL` | No | URL | Alias for `ADMIN_APP_URL` | |
| `APP_BASE_DOMAIN` | No | string | Base domain for tenant subdomains | `example.com`; inferred from APP_BASE_URL if not set |
| `CORS_ORIGINS` | No | CSV string | Comma-separated allowed origins | `http://localhost:5173,https://app.example.com` |

**Notes**:
- In production, at least one of `APP_URL` or `FRONTEND_URL` is required
- In production, at least one of `PUBLIC_APP_URL`, `PUBLIC_URL`, or `APP_BASE_URL` is required
- URLs are normalized (trailing slashes removed)

### Database Connection Pool

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `DATABASE_POOL_MAX_OVERRIDE` | No | number | Force max pool size (0 = use tier-based) | Default: `0` |
| `DATABASE_POOL_MAX_API` | No | number | Max connections for API tier | Default: `10` |
| `DATABASE_POOL_MAX_WORKER` | No | number | Max connections for worker tier | Default: `5` |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | No | number | Idle connection timeout | Default: `30000` |
| `DATABASE_POOL_CONNECTION_TIMEOUT_MS` | No | number | Connection attempt timeout | Default: `10000` |

### Authentication (Google OAuth / Apple Sign-In)

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `GOOGLE_CLIENT_ID` | No | string | Google OAuth app client ID | Required for Google sign-up/login |
| `GOOGLE_CLIENT_SECRET` | No | string | Google OAuth app secret | Never expose in frontend |
| `APPLE_AUTH_ENABLED` | No | boolean | Enable Apple Sign-In on the backend | Must be `true` to expose Apple auth flows |
| `APPLE_CLIENT_ID` | No | string | Apple Services ID | Must match frontend `VITE_APPLE_CLIENT_ID` |
| `APPLE_TEAM_ID` | No | string | Apple developer team ID | Required when token exchange is enabled |
| `APPLE_KEY_ID` | No | string | Apple private key identifier | Required when token exchange is enabled |
| `APPLE_PRIVATE_KEY` | No | PEM string | Apple private key for server-side token exchange | Use escaped newlines in `.env` files |
| `APPLE_REDIRECT_URI` | No | URL | Apple redirect URI for authorization code exchange | Must match frontend `VITE_APPLE_REDIRECT_URI` exactly |

### Billing (Stripe)

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `BILLING_PROVIDER` | No | `stripe`, `mock` | Billing provider selection | Production must use `stripe` |
| `STRIPE_API_KEY` | No | string | Stripe API secret key | Required for Stripe checkout + portal |
| `STRIPE_API_BASE_URL` | No | URL | Stripe API base URL | Default: `https://api.stripe.com/v1` |
| `STRIPE_WEBHOOK_SECRET` | No | string | Stripe webhook signature secret | Required for webhook validation |
| `STRIPE_WEBHOOK_TOLERANCE_SEC` | No | number | Maximum Stripe webhook timestamp age | Default: `300` seconds |
| `STRIPE_SUCCESS_URL` | No | URL | Redirect after successful checkout | Used by checkout sessions |
| `STRIPE_CANCEL_URL` | No | URL | Redirect after checkout cancellation | Used by checkout sessions |
| `STRIPE_REQUEST_TIMEOUT_MS` | No | number | HTTP request timeout | Default: `10000` |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Recommended | string | Stripe Price ID for PRO monthly | Standard SaaS setup |
| `STRIPE_PRICE_ID_PRO_YEARLY` | Recommended | string | Stripe Price ID for PRO yearly | Standard SaaS setup |
| `STRIPE_PRICE_ID_STUDIO_MONTHLY` | Recommended | string | Stripe Price ID for STUDIO monthly | Standard SaaS setup |
| `STRIPE_PRICE_ID_STUDIO_YEARLY` | Recommended | string | Stripe Price ID for STUDIO yearly | Standard SaaS setup |
| `BILLING_MOCK_CHECKOUT_PATH` | No | string | Mock checkout endpoint path | Default: `/dashboard/billing/mock-checkout` |

**Notes**:
- If you don’t set `STRIPE_PRICE_ID_*`, the backend falls back to amount-based checkout (works, but not the “standard SaaS” Stripe architecture).

 ### Storage (Cloudflare R2)

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `R2_ACCOUNT_ID` | No | string | Cloudflare account ID | Required for R2 file uploads |
| `R2_ACCESS_KEY_ID` | No | string | R2 API access key | Also: `R2_ACCESS_KEY` |
| `R2_SECRET_ACCESS_KEY` | No | string | R2 API secret key | Also: `R2_SECRET_KEY` |
| `R2_BUCKET` | No | string | R2 bucket name | Where images are stored |
| `R2_PUBLIC_URL` | No | URL | Public URL for R2 bucket | Base URL for image downloads |

**Notes**:
- If R2 credentials are missing, file uploads will fail with 409 error
- Alternative names accepted: `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_PUBLIC_BASE_URL`

### Email (Resend)

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `RESEND_API_KEY` | No | string | Resend email service API key | Required for transactional emails |
| `RESEND_FROM_EMAIL` | No | email | Sender email address | Default: `no-reply@example.com` |

**Notes**:
- If `RESEND_API_KEY` is not set, email operations fail silently (logged to Sentry)

### Queues & Workers (Redis)

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `REDIS_URL` | No | Redis URL | Redis connection for BullMQ queues | Format: `redis://[user:password@]host[:port][/db]` |
| `QUEUE_CONCURRENCY` | No | number | Queue job concurrency | Default: `5` |

**Notes**:
- If `REDIS_URL` is not set, queues are disabled and fallback to inline processing
- Fallback behavior: emails are sent inline; analytics/image processing are skipped

### Async Job Configuration

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `ASSET_CLEANUP_ENABLED` | No | boolean | Enable asset cleanup worker | Default: `true` |
| `ASSET_CLEANUP_INTERVAL_MS` | No | number | Asset cleanup check frequency | Default: `3600000` (1 hour) |
| `BILLING_MAINTENANCE_ENABLED` | No | boolean | Enable billing maintenance worker | Default: `true` |
| `BILLING_MAINTENANCE_INTERVAL_MS` | No | number | Billing maintenance check frequency | Default: `900000` (15 minutes) |
| `BILLING_MAINTENANCE_BATCH_SIZE` | No | number | Subscriptions processed per run | Default: `500` |
| `NOTIFICATION_REMINDERS_ENABLED` | No | boolean | Enable notification reminders worker | Default: `true` |
| `NOTIFICATION_REMINDERS_INTERVAL_MS` | No | number | Reminder check frequency | Default: `900000` (15 minutes) |
| `NOTIFICATION_REMINDERS_BATCH_SIZE` | No | number | Reminders processed per run | Default: `200` |

### Monitoring & Observability

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `SENTRY_DSN` | No | Sentry DSN | Sentry error tracking | Leave blank to disable error reporting |
| `LOG_CLIENT_ERRORS` | No | boolean | Log client-side errors | Default: `true` |
| `WORKER_HEARTBEAT_INTERVAL_MS` | No | number | Worker heartbeat publish frequency | Default: `30000` |
| `WORKER_HEARTBEAT_TTL_SEC` | No | number | Worker heartbeat Redis TTL | Default: `120` |
| `WORKER_BACKLOG_WARN_THRESHOLD` | No | number | Warning threshold for job backlog | Default: `20` |
| `RATE_LIMIT_WINDOW_MS` | No | number | Rate limit window duration | Default: `900000` (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | No | number | Max requests per window per IP | Default: `100` |

### Custom Domains

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `CUSTOM_DOMAIN_CNAME_TARGET` | No | string | CNAME target for custom domains | Default: `domains.lensaya.app` |
| `CUSTOM_DOMAIN_VERIFICATION_MODE` | No | `dns`, `mock` | Domain verification strategy | Default: `mock` (for local dev); use `dns` in production |
| `CUSTOM_DOMAIN_LOOKUP_TIMEOUT_MS` | No | number | DNS lookup timeout | Default: `4000` |

### Media Processing

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `MEDIA_WEB_MAX_WIDTH` | No | number | Max image width for web | Default: `1920` |
| `MEDIA_THUMB_MAX_WIDTH` | No | number | Max width for thumbnails | Default: `640` |
| `MEDIA_WEB_QUALITY` | No | number | JPEG quality for web images | Default: `82` (1-100) |
| `MEDIA_THUMB_QUALITY` | No | number | JPEG quality for thumbnails | Default: `68` (1-100) |
| `FREE_PLAN_WATERMARK_TEXT` | No | string | Watermark text on free plan images | Default: `Lensaya` |
| `FREE_PLAN_WATERMARK_OPACITY` | No | decimal | Watermark opacity | Default: `0.35` (0-1) |
| `MEDIA_TRANSFORM_ENABLED` | No | boolean | Enable image transformation | Default: `true` |

### Cookie Security

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `AUTH_COOKIE_DOMAIN` | No | string | Cookie domain restriction | Leave blank for same-domain only |
| `AUTH_COOKIE_SAMESITE` | No | `lax`, `strict`, `none` | SameSite cookie policy | Default: `lax` (dev), `none` (production) |
| `AUTH_COOKIE_SECURE` | No | boolean | Require HTTPS for cookies | Default: `false` (dev), `true` (production) |

## Frontend Environment Variables

The frontend uses Vite's `.env` system. Create `frontend/.env` or access via `import.meta.env.VITE_*`.

| Variable | Required | Type | Purpose | Notes |
|----------|----------|------|---------|-------|
| `VITE_API_BASE_URL` | No | URL | Backend API base URL | Default: `/api/v1` (relative); set full URL for external API |
| `VITE_GOOGLE_CLIENT_ID` | No | string | Google OAuth client ID | Must match backend `GOOGLE_CLIENT_ID` |
| `VITE_APPLE_AUTH_ENABLED` | No | boolean | Show Apple Sign-In in the UI | Must be `true` to render Apple buttons |
| `VITE_APPLE_CLIENT_ID` | No | string | Apple Services ID | Must match backend `APPLE_CLIENT_ID` |
| `VITE_APPLE_REDIRECT_URI` | No | URL | Apple redirect URI used by the browser SDK | Must match backend `APPLE_REDIRECT_URI` |
| `VITE_APP_URL` | No | URL | App domain for redirects | Default: same as current origin |
| `VITE_PUBLIC_DIRECTORY_ENABLED` | No | boolean | Enable marketing directory section + `/photographers` route | Default: `false` (hidden/redirected) |

**Notes**:
- Frontend environment variables must be prefixed with `VITE_` to be accessible
- They are inlined at build time (not runtime)
- `.env.local` files are ignored by git

## Local Development Configuration

### Minimum .env for Local Dev

```bash
# database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lensaya?schema=public

# security
JWT_SECRET=dev-secret-key-for-testing-only

# app URLs (local)
APP_URL=http://localhost:5173
PUBLIC_APP_URL=http://localhost:5173

# optional: queues (if testing async jobs)
REDIS_URL=redis://localhost:6379

# optional: file uploads
R2_ACCOUNT_ID=your-test-account
R2_ACCESS_KEY_ID=test-access-key
R2_SECRET_ACCESS_KEY=test-secret
R2_BUCKET=test-bucket
R2_PUBLIC_URL=https://test-bucket.test-account.r2.cloudflarestorage.com

# optional: auth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# optional: email
RESEND_API_KEY=your-resend-key
```

### Production Deployment Configuration

```bash
# Required

DATABASE_URL=postgresql://prod-user:secure-password@prod-db-host:5432/lensaya?schema=public
JWT_SECRET=<use-openssl-rand-base64-32>
NODE_ENV=production
APP_URL=https://app.example.com
PUBLIC_APP_URL=https://example.com

# Apple Sign-In

APPLE_AUTH_ENABLED=true
APPLE_CLIENT_ID=replace-with-apple-services-id
APPLE_TEAM_ID=replace-with-apple-team-id
APPLE_KEY_ID=replace-with-apple-key-id
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nreplace-with-apple-private-key\n-----END PRIVATE KEY-----
APPLE_REDIRECT_URI=https://app.example.com

# Frontend build-time Apple config (Vite)

VITE_APPLE_AUTH_ENABLED=true
VITE_APPLE_CLIENT_ID=replace-with-apple-services-id
VITE_APPLE_REDIRECT_URI=https://app.example.com

# Billing (Stripe)

BILLING_PROVIDER=stripe
STRIPE_API_KEY=replace-with-stripe-api-key
STRIPE_WEBHOOK_SECRET=replace-with-stripe-webhook-secret
STRIPE_SUCCESS_URL=https://example.com/checkout/success
STRIPE_CANCEL_URL=https://example.com/checkout/canceled
STRIPE_PRICE_ID_PRO_MONTHLY=replace-with-stripe-price-id
STRIPE_PRICE_ID_PRO_YEARLY=replace-with-stripe-price-id
STRIPE_PRICE_ID_STUDIO_MONTHLY=replace-with-stripe-price-id
STRIPE_PRICE_ID_STUDIO_YEARLY=replace-with-stripe-price-id

# Infrastructure

REDIS_URL=redis://prod-redis-host:6379
SENTRY_DSN=https://your-sentry-dsn
RESEND_API_KEY=prod-resend-key
GOOGLE_CLIENT_ID=prod-google-client
GOOGLE_CLIENT_SECRET=prod-google-secret

# Storage

R2_ACCOUNT_ID=prod-account-id
R2_ACCESS_KEY_ID=prod-access-key
R2_SECRET_ACCESS_KEY=prod-secret-key
R2_BUCKET=prod-bucket
R2_PUBLIC_URL=https://prod-bucket.prod-account.r2.cloudflarestorage.com

# Security (production)

AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none
CUSTOM_DOMAIN_VERIFICATION_MODE=dns

# Optional tuning

RATE_LIMIT_MAX_REQUESTS=200
BILLING_MAINTENANCE_BATCH_SIZE=1000
ASSET_CLEANUP_INTERVAL_MS=3600000
```

## Needs Confirmation

The following are inferred from code but lack explicit documentation:

- [ ] **Exact behavior of `DATABASE_POOL_MAX_OVERRIDE`**: Does it apply to both API and worker pools, or just API?
- [ ] **JEMALLOC/performance tuning**: No environment variables visible for memory tuning or worker process concurrency at OS level
- [ ] **Image processing worker concurrency**: Is there a `WORKER_IMAGE_CONCURRENCY` env var, or does it always use 1?

## Source References

- Environment parsing: [backend/src/config/env.js](../backend/src/config/env.js)  
- Database config: [backend/src/config/prisma.js](../backend/src/config/prisma.js)  
- Redis config: [backend/src/config/redis.js](../backend/src/config/redis.js)  
- R2 config: [backend/src/config/r2.js](../backend/src/config/r2.js)  
- Logger config: [backend/src/config/logger.js](../backend/src/config/logger.js)  
