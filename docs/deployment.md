# Deployment Guide

This guide describes deployment concerns visible in the repository.

## Deployable Units

- Backend API process
- Frontend static build/app server
- Optional worker processes:
	- analytics worker
	- image processing worker
	- email worker
	- notification worker
	- asset cleanup worker
	- billing maintenance worker

Source hints:
- backend/package.json
- frontend/package.json

## Environment Dependencies

## Required Core

- DATABASE_URL
- JWT_SECRET

If production:
- APP_URL or FRONTEND_URL
- PUBLIC_APP_URL or PUBLIC_URL or APP_BASE_URL

Source hints:
- backend/src/config/env.js

## Common Integrations

- PostgreSQL
- Redis (for queues; code supports disabled mode with fallbacks in some paths)
- Cloudflare R2 (uploads and asset storage)
- Stripe billing credentials (or mock provider when not configured)
- Optional Sentry DSN

Source hints:
- backend/src/config/env.js
- backend/src/config/r2.js
- backend/src/config/redis.js
- backend/src/services/stripeService.js
- backend/src/controllers/billingController.js

## Build And Start Flow

## Backend

- Dev: npm run dev
- Start: npm run start
- Pre-dev/start runs prisma generate automatically
- Server startup performs schema compatibility assertions

## Frontend

- Dev: npm run dev
- Build: npm run build
- Vite-based app with generated Tailwind build step

Source hints:
- backend/package.json
- frontend/package.json
- backend/server.js

## Database Migration Flow

- Local/dev migration: npm run prisma:migrate
- Deploy migration: npm run prisma:migrate:deploy
- Prisma schema path and migration path are set in prisma.config.ts

Source hints:
- backend/package.json
- backend/prisma.config.ts

## Queue And Worker Behavior

- Workers require Redis for normal queue consumption.
- If Redis is missing:
	- Worker processes exit early (disabled)
	- Some enqueue paths use inline fallback in non-production

Implication:
- Production should run Redis + workers for reliable async processing.

Source hints:
- backend/src/workers/*.js
- backend/src/jobs/analyticsQueue.js
- backend/src/jobs/imageProcessingQueue.js

## Billing/Webhook Deployment Requirements

- Webhook endpoints:
	- /api/v1/billing/webhook
	- /api/v1/webhooks/payments
- Raw request body handling is required for signature verification.
- Stripe webhook path requires `STRIPE_WEBHOOK_SECRET` and `stripe-signature` handling.

Source hints:
- backend/src/app.js
- backend/src/controllers/billingController.js

## Storage And Media Requirements

- R2 credentials and bucket must be configured for upload + delete operations.
- Public asset URL behavior depends on R2 public base URL and asset URL helpers.
- Free-plan watermark and transform toggles are env-controlled.

Source hints:
- backend/src/config/env.js
- backend/src/services/uploadService.js

## Host Routing Concerns

- Frontend and backend both assume host-aware behavior:
	- app host
	- admin host
	- public domain/subdomain hosts
- Public host API guard blocks non-public routes on public domains.

Source hints:
- frontend/src/lib/platform.ts
- backend/src/middleware/publicHostApiGuard.js
- backend/src/services/publicHostService.js

## Deployment Checklist

1. Provision PostgreSQL and set DATABASE_URL (+ DIRECT_URL if needed)
2. Run backend prisma generate + migrate deploy
3. Configure JWT, app/public/admin URLs, and CORS origins
4. Configure Redis and launch worker processes
5. Configure R2 account/keys/bucket/public URL
6. Configure billing provider credentials and webhook secrets
7. Set frontend env (API URL, Google client id if used)
8. Start backend and frontend services
9. Verify health endpoints:
	 - /health
	 - /api/v1/admin/system/worker-health (admin auth required)
10. Run full backend test suite in CI before production rollout

## Local vs Production Differences

- Inline queue fallbacks are non-production only.
- Production env has stricter required URL and billing brand checks.
- Error responses may be less verbose in production.

Source hints:
- backend/src/config/env.js
- backend/src/middleware/errorHandler.js
- backend/src/jobs/*Queue.js

## Needs Confirmation

- Official container/orchestration strategy (Docker/Kubernetes/PM2/systemd not specified).
- TLS termination and ingress setup for custom domains (code models states but infra implementation is external).
- Recommended worker scaling policy per queue for production traffic.

## Reference Deployments

- Single Droplet (Docker Compose + Caddy): `docs/deployment-single-droplet.md`
