# Single Droplet Deployment (Docker Compose + Caddy)

This is the recommended “cheap, first production” deployment for Lensaya:

- 1 DigitalOcean Droplet (2 vCPU / 4GB RAM)
- Ubuntu
- Postgres in Docker
- Redis in Docker
- Backend + workers in Docker
- Frontend served by Caddy (static build)
- HTTPS via Caddy + Let’s Encrypt (Cloudflare DNS challenge for wildcard)

This repo includes production-ready files:

- `docker-compose.yml`
- `docker-compose.prod.yml`
- `backend/Dockerfile`
- `deploy/Dockerfile.caddy`
- `deploy/Caddyfile`

## 0) Decide your production hostnames

For `lensaya.com`, with the app living on the apex:

- Marketing + App (login/dashboard): `https://lensaya.com`
- Admin: `https://admin.lensaya.com`
- Photographer sites: `https://<username>.lensaya.com` (wildcard DNS)

This matches the frontend host detection (`frontend/src/lib/platform.ts`) and backend host routing (`backend/src/middleware/hostContext.js`).

## 1) DNS records (Cloudflare)

Create these records pointing to your Droplet IP:

- `A` `@` → `<DROPLET_IP>` (DNS only at first)
- `A` `admin` → `<DROPLET_IP>` (DNS only)
- `A` `*` → `<DROPLET_IP>` (DNS only)

You can add `www` later if you want:

- `A` `www` → `<DROPLET_IP>`

Recommended:
- Keep `www.lensaya.com` only as a convenience, but redirect it to the apex `https://lensaya.com` (single canonical domain).
- This repo’s `deploy/Caddyfile` already includes a `www` → apex redirect.

## 2) Cloudflare token (required for wildcard TLS)

Create a Cloudflare API token that can edit DNS records for `lensaya.com`.

You will set it as:

- `CLOUDFLARE_API_TOKEN=...`

Without this, Caddy cannot issue `*.lensaya.com` certificates.

## 3) Server setup (Ubuntu)

On the Droplet:

- Install Docker + `docker compose` plugin
- Open ports 80/443 (UFW or DO firewall)
- Optional: add a 2GB swap file (helps builds on 4GB RAM)

## 4) Deploy the repo

On the Droplet:

```bash
sudo mkdir -p /opt/lensaya
sudo chown -R $USER:$USER /opt/lensaya
cd /opt/lensaya
git clone <YOUR_REPO_URL> .
```

## 5) Create `/opt/lensaya/.env`

Create `/opt/lensaya/.env` (this file is read by Docker Compose and passed into containers via `env_file`).

Recommended:
- Start from the template in the repo: `.env.production.example`

Minimum required for first boot:

```bash
# from /opt/lensaya
cp .env.production.example .env
nano .env

# Caddy / TLS
BASE_DOMAIN=lensaya.com
ACME_EMAIL=you@lensaya.com
CLOUDFLARE_API_TOKEN=replace-with-cloudflare-token

# Postgres (container)
POSTGRES_USER=postgres
POSTGRES_DB=lensaya
POSTGRES_PASSWORD=replace-with-strong-password

# Backend core
NODE_ENV=production
JWT_SECRET=replace-with-strong-secret
DATABASE_URL=postgresql://postgres:replace-with-strong-password@db:5432/lensaya?schema=public
REDIS_URL=redis://redis:6379

# Platform URLs
APP_URL=https://lensaya.com
PUBLIC_APP_URL=https://lensaya.com
ADMIN_APP_URL=https://admin.lensaya.com
CORS_ORIGINS=https://lensaya.com,https://admin.lensaya.com

# Auth cookie (shared across apex + subdomains)
AUTH_COOKIE_DOMAIN=.lensaya.com
AUTH_COOKIE_SAMESITE=none
AUTH_COOKIE_SECURE=true

# Storage (R2)
R2_ACCOUNT_ID=replace-with-r2-account-id
R2_ACCESS_KEY_ID=replace-with-r2-access-key-id
R2_SECRET_ACCESS_KEY=replace-with-r2-secret-access-key
R2_BUCKET=lensaya-prod
R2_PUBLIC_BASE_URL=replace-with-public-base-url

# Email (Resend)
RESEND_API_KEY=replace-with-resend-api-key
RESEND_FROM_EMAIL=no-reply@lensaya.com

# Billing (Stripe)
BILLING_PROVIDER=stripe
STRIPE_API_KEY=replace-with-stripe-api-key
STRIPE_WEBHOOK_SECRET=replace-with-stripe-webhook-secret
STRIPE_SUCCESS_URL=https://lensaya.com/checkout/success
STRIPE_CANCEL_URL=https://lensaya.com/checkout/canceled
```

Optional frontend build-time knobs (used by `deploy/Dockerfile.caddy`):

```bash
VITE_APP_BASE_DOMAIN=lensaya.com
VITE_GOOGLE_CLIENT_ID=replace-with-google-client-id
VITE_PUBLIC_DIRECTORY_ENABLED=false
```

## 6) First boot

From `/opt/lensaya`:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## 7) Apply migrations

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm backend npm run prisma:migrate:deploy
```

If the backend was crash-looping due to schema mismatch, it should recover after migrations.

## 8) Start workers

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile workers up -d
```

## 9) Verify

- `https://lensaya.com/health`
- `https://admin.lensaya.com/health`
- `https://anything.lensaya.com/health`

## 10) Bootstrap your first admin user

1) Sign up normally via the app.
2) Promote the user in the DB:

```bash
docker compose exec -T db psql -U postgres -d lensaya -c "update \"User\" set role='ADMIN' where email='you@lensaya.com';"
```

## Notes / gotchas

- Keep Cloudflare records as “DNS only” for the first deploy; enable proxy later if you want.
- If you enable Cloudflare proxy, ensure your origin still terminates TLS correctly and that you forward the real client IP.
- Wildcard TLS issuance requires `CLOUDFLARE_API_TOKEN`.
- `www.lensaya.com` is redirected to `lensaya.com` to avoid duplicate SEO/canonical URLs.
