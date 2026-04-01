# Lensaya Architecture

This document explains the current implementation architecture in plain English.

## System Overview

Lensaya is a multi-surface SaaS for photographers with one backend serving:
- Public marketing and photographer websites
- Photographer workspace (app)
- Admin panel

At runtime, behavior changes based on host context and route scope.

## High-Level Components

- Frontend: React + Vite (host-aware routing and role-protected sections)
- Backend: Express API with route-level auth/validation and service layer
- Database: PostgreSQL via Prisma (with some raw SQL in hotspots)
- Storage: Cloudflare R2 (S3-compatible)
- Queues/Workers: BullMQ + Redis with inline fallback when Redis is unavailable
- Billing: CHIP as default provider, Stripe path also supported
- Monitoring: Sentry hooks + worker health endpoints + structured logging

Source hints:
- frontend/src/routes.tsx
- backend/src/app.js
- backend/src/config/prisma.js
- backend/src/config/r2.js
- backend/src/config/redis.js
- backend/src/services/billingService.js

## Runtime Request Flow

1. Incoming request enters Express app
2. Middleware adds request id, logging, cookie parsing, host context
3. JSON parsing captures raw body for webhook routes
4. Public host API guard blocks non-public route categories on public hosts
5. Route-level middleware applies auth, role checks, tenant context, and Zod validation
6. Controllers call services; services use Prisma and integrations
7. Response envelope returns success/data/error

Source hints:
- backend/src/app.js
- backend/src/middleware/publicHostApiGuard.js
- backend/src/middleware/auth.js
- backend/src/middleware/tenantContext.js
- backend/src/middleware/validate.js
- backend/src/utils/response.js

## Host And Tenant Boundaries

Host boundaries:
- Platform hosts (app/admin/public root) and public photographer hosts are distinguished by hostname.
- Public hosts can access only selected public API paths.

Tenant boundaries:
- Tenant context resolves req.tenant for authenticated photographers.
- Prisma client extension auto-applies tenant filter for tenant-scoped models unless admin context.

Source hints:
- backend/src/services/publicHostService.js
- backend/src/utils/requestHost.js
- backend/src/middleware/tenantContext.js
- backend/src/config/prisma.js

## Backend Module Organization

Core layout:
- backend/src/routes: HTTP route definitions by domain
- backend/src/controllers: request orchestration and envelope responses
- backend/src/services: business logic
- backend/src/services/photographer: photographer domain submodules
- backend/src/jobs and backend/src/workers: async queue producers/consumers
- backend/src/config: environment, prisma, redis, sentry, logging

### Photographer Service Refactor Pattern

Current pattern uses a thin facade with domain modules:
- Facade: backend/src/services/photographerService.js
- Domain modules:
	- photographerDashboardService.js
	- photographerProfileService.js
	- photographerAnalyticsService.js
	- photographerAvailabilityService.js
	- photographerServicesService.js
	- photographerPackagesService.js
- Shared helper modules:
	- photographerService.utils.js
	- photographerService.constants.js

This keeps route/controller contracts stable while splitting behavior by domain.

## Data And Storage Architecture

Relational core entities:
- User <-> Photographer (identity/profile)
- Service -> Package (commercial catalog)
- PortfolioItem -> Asset
- Booking links public inquiries to photographer resources
- Subscription + Transaction handle billing state/history
- AnalyticsEvent with daily rollup tables for reporting performance

Storage flow:
- Upload presign creates Asset record (PENDING)
- Client uploads directly to R2
- Complete endpoint marks asset READY
- Image processing worker generates variants/watermark behavior (plan-aware)
- Certain deletes can mark/purge asset lifecycle states

Source hints:
- backend/prisma/schema.prisma
- backend/src/services/uploadService.js
- backend/src/services/assetLifecycleService.js
- backend/src/workers/imageProcessingWorker.js

## Async Processing

Queues:
- analyticsQueue
- imageProcessingQueue
- emailQueue
- notificationQueue

Workers:
- analyticsWorker.js
- imageProcessingWorker.js
- emailWorker.js
- notificationWorker.js
- assetCleanupWorker.js
- billingMaintenanceWorker.js

Fallback behavior:
- In non-production, if Redis is unavailable, selected queue work runs inline.

Source hints:
- backend/src/jobs/queueFactory.js
- backend/src/jobs/analyticsQueue.js
- backend/src/jobs/imageProcessingQueue.js
- backend/src/workers/*.js

## Billing Architecture

- Billing service is provider-aware and supports CHIP and Stripe normalization paths.
- Webhook endpoints accept multiple payload shapes and enforce signature verification.
- Subscription lifecycle supports trialing, active, past_due, canceled, expired, incomplete.
- Plan changes support monthly/yearly cycle metadata and pending changes.

Source hints:
- backend/src/services/billingService.js
- backend/src/services/billingProviderService.js
- backend/src/services/chipService.js
- backend/src/services/stripeService.js
- backend/src/controllers/billingController.js

## Frontend Architecture

- React Router drives app/public/admin pages.
- Host-aware components redirect users to canonical host contexts.
- API layer wraps fetch with auth token injection and common envelope parsing.
- Context providers handle auth, onboarding, and toasts.

Source hints:
- frontend/src/routes.tsx
- frontend/src/components/routing/PlatformHostBoundary.tsx
- frontend/src/lib/platform.ts
- frontend/src/lib/api/core.ts
- frontend/src/contexts/AuthContext.tsx

## Text Diagram

Browser -> Frontend (host-aware routes)
-> Backend /api/v1
-> Middleware (host/auth/tenant/validation)
-> Controllers
-> Services (domain + integrations)
-> Prisma/Postgres and R2/Redis/Provider APIs
-> Workers (BullMQ) for async post-processing

## Needs Confirmation

- Expected production process model for running API + all workers (systemd/PM2/container scheduler not documented).
- Final canonical billing provider choice for production (code supports CHIP and Stripe).
- Long-term module ownership boundaries in backend/services/admin submodules (current structure is clear, ownership policy is not documented).
