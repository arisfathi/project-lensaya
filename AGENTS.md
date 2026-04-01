# AGENTS.md

Guidance for future Codex/AI agent work on the Lensaya repository.

## Project Overview

**Lensaya** is a multi-tenant SaaS platform for photographers to manage portfolios, bookings, billing, and analytics.

**Key Features**:
- Host-aware routing (3 host types: platform app/admin, managed subdomains, custom domains)
- Photographer-scoped data (tenant isolation via Prisma middleware)
- Subscription billing (CHIP + Stripe payment providers)
- Asset management (R2 storage, image optimization, cleanup)
- Analytics (event ingestion, daily rollups)
- Moderation system (flagged assets, suspended accounts)
- Referral tracking and conversion rewards
- Custom domain support with CNAME/DNS verification

**Tech Stack**:
- Backend: Node.js (ESM), Express, Prisma ORM, PostgreSQL, BullMQ/Redis, AWS SDK (R2)
- Frontend: React 19, TypeScript, Vite, React Router v6, TailwindCSS
- Testing: Node's node:test + supertest
- Infrastructure: Docker-ready, PM2/systemd for workers

---

## Repository Layout

```
├── backend/
│   ├── src/
│   │   ├── app.js                    # Express app setup
│   │   ├── config/                   # Environment, logger, db, Redis, R2
│   │   ├── middleware/               # auth, tenantContext, publicHostApiGuard, requestHost
│   │   ├── routes/                   # 16 route files organized by domain (auth, profile, billing, etc.)
│   │   ├── controllers/              # Route handlers; one per route file
│   │   ├── services/                 # Business logic (billingService, authService, uploadService, etc.)
│   │   │   ├── admin/                # Admin-specific services (revenue, storage, moderation)
│   │   │   └── photographer/         # Photographer domain modules (profile, dashboard, analytics, availability)
│   │   ├── utils/                    # Helpers (JWT, validation, pagination, crypto, retry logic)
│   │   ├── workers/                  # 6 async processors (email, analytics, image, asset cleanup, notification, billing)
│   │   └── jobs/                     # Queue definitions and worker heartbeat
│   ├── prisma/
│   │   ├── schema.prisma             # 21 models + enums
│   │   └── migrations/               # Numbered migration files
│   ├── tests/                        # 131+ tests (contracts, flows, isolation, webhooks)
│   ├── scripts/                      # Backup, restore, seed utilities
│   ├── package.json                  # npm scripts for dev, test, workers, migrations
│   └── server.js                     # Entry point
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # Root component
│   │   ├── main.tsx                  # React entry, Google OAuth init
│   │   ├── routes.tsx                # React Router config (lazy-loaded pages)
│   │   ├── routes.paths.ts           # Route path constants
│   │   ├── routes.lazy.ts            # Lazy page components
│   │   ├── components/               # Reusable UI components
│   │   ├── contexts/                 # AuthContext, TenantContext, etc.
│   │   ├── features/                 # Feature-specific logic (booking, analytics, dashboard)
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── layouts/                  # Page layouts (app, public, admin)
│   │   ├── lib/
│   │   │   ├── api/                  # API clients (core, auth, public, admin, portfolio-media)
│   │   │   └── platform.ts           # Host detection, public site validation
│   │   ├── pages/                    # Page components (organized by area)
│   │   ├── services/                 # Business logic (not API clients)
│   │   └── styles/                   # TailwindCSS, styling utilities
│   ├── public/                       # Static assets
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── database/
│   ├── init.sql                      # Optional: extensions, base setup
│   ├── seeds/seed.sql                # Optional: starter data
│   └── scripts/                      # Backup/restore scripts
│
├── docs/                             # Complete documentation (newly added)
│   ├── api.md                        # API endpoints, request/response envelopes, auth model
│   ├── architecture.md               # System overview, request flow, module org, async patterns
│   ├── business-rules.md             # Plan limits, feature gating, booking/billing/referral rules
│   ├── database.md                   # Schema, constraints, lifecycle, backup
│   ├── deployment.md                 # Build, migration, deployment steps, checklist
│   ├── setup.md                      # Local developer onboarding (7 phases with commands)
│   ├── testing.md                    # Test framework, test categories, pitfalls, checklist
│   ├── troubleshooting.md            # 40+ symptom→cause→fix scenarios
│   ├── env.md                        # 60+ environment variables, required vs optional
│   └── operations.md                 # Production runbook, monitoring, queues, incident response
│
├── ARCHITECTURE.md                   # High-level architecture (summary)
├── README.md                         # Quick start, docs index
└── AGENTS.md                         # This file
```

---

## Key Frontend/Backend Module Boundaries

### Frontend Architecture

**API Client Layer** (`frontend/src/lib/api/`):
- `core.ts`: Base HTTP client, auth token injection, URL building
- `auth.ts`: Signup, login, OAuth, password/email operations
- `public.ts`: Dashboard, analytics, referral endpoints (photographer-facing)
- `admin.ts`: Admin surface (photographers, subscriptions, revenue, storage, moderation, logs)
- `portfolio-media.ts`: Services, packages, portfolio, availability, bookings, uploads
- Each client is independent; no cross-client dependencies

**Routing & Host Boundaries** (`frontend/src/routes.tsx`):
- Three host types: platform app, platform admin, public photographer sites
- `PlatformHostBoundary`: Blocks public hosts from accessing /dashboard or /admin
- `PublicHostCanonicalRoute`: Redirects public hosts to canonical paths
- `platform.ts` utility: Host detection, public site validation, URL builders

**Page-by-Feature Organization**:
- Features like Booking, Analytics, Dashboard have dedicated page + hook structure
- No global state except AuthContext
- Component reuse is high; pages are thin

### Backend Architecture

**Request Flow**:
```
HTTP Request
    ↓
middleware/hostContext.js (detect host type, classify request)
    ↓
middleware/auth.js (JWT validation, optional)
    ↓
middleware/tenantContext.js (photographer ID resolution, Prisma extension setup)
    ↓
middleware/publicHostApiGuard.js (block certain routes on public hosts, 421 errors)
    ↓
Route Handler
    ↓
Controller (validation, response formatting)
    ↓
Service (business logic, Prisma queries, integrations)
    ↓
Database / External APIs
```

**Service Layer Boundaries**:
- **Domain Services**: authService, referralService, bookingService, uploadService, customDomainService, billingService, chipService, notificationService, planLimitService, emailService, assetLifecycleService
- **Photographer Facade**: photographerService (thin wrapper calling photographer/* modules)
- **Photographer Modules**: photographerProfileService, photographerDashboardService, photographerAnalyticsService, photographerAvailabilityService, photographerServicesService, photographerPackagesService
- **Admin Services**: adminService (facade), admin/* submodules (adminStorageService, etc.)
- **Utilities**: validationSchemas (Zod), jwt, crypto, response helpers, pagination

**Middleware Isolation**:
- Auth (`middleware/auth.js`): JWT validation only; sets req.user
- Tenant (`middleware/tenantContext.js`): Resolves photographer context; extends Prisma
- Host (`middleware/hostContext.js`): Classifies request source (platform vs custom domain)
- API Guard (`middleware/publicHostApiGuard.js`): Enforces route availability per host type

**Database Access**:
- All Prisma queries go through services
- Tenant middleware auto-filters via Prisma extension on $queryRaw
- Explicit `ensureTenantOwnership()` checks for sensitive updates
- No raw SQL in controllers; SQL only in services/utilities
- Reference counting queries for asset lifecycle (counts across multiple relations)

---

## Current Maintainability Status

### What's Good
- ✅ **Clear separation of concerns**: Routes → Controllers → Services → Database
- ✅ **Tenant isolation**: Middleware-level guarantees, tested
- ✅ **Comprehensive tests**: 131+ test cases (contract, parity, flow, isolation, webhook, health)
- ✅ **Complete documentation**: Architecture, API, setup, testing, troubleshooting, env, operations
- ✅ **Facade pattern established**: Service facades (photographerService, adminService) provide clean public API
- ✅ **Validation centralized**: Zod schemas at route boundaries
- ✅ **Error handling**: ApiError class with status codes, Sentry integration
- ✅ **Async patterns**: BullMQ queues with fallbacks, worker heartbeat monitoring

### What's Done (Don't Refactor Further)
- ✅ Migration from old service structure → new photographer modules completed
- ✅ Tenant isolation is proven via tests (tenantIsolation.test.js, adminPhotographerStatusSideEffects.test.js)
- ✅ Facade patterns are in place; no need to restructure service layer
- ✅ Worker infrastructure is stable and tested
- ✅ Billing workflow is idempotent and well-tested
- ✅ API envelope and error handling patterns are standardized

### What to Focus On (Feature Work)
- 🚀 New photographer features (services, packages, bookings enhancements)
- 🚀 Analytics improvements (new metrics, visualizations)
- 🚀 Admin capabilities (new reports, bulk operations)
- 🚀 Billing features (new payment methods, dunning, retry logic)
- 🚀 Frontend UX improvements

---

## Setup, Build, Lint, Test Commands

### Backend Commands

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Create new migration (dev only)
npm run prisma:migrate

# Apply migrations (production-safe)
npm run prisma:migrate:deploy

# Validate Prisma schema
npm run prisma:validate

# Format Prisma schema
npm run prisma:format

# Local development (with file watching)
npm run dev

# Production startup
npm start

# Run all tests
npm test

# Run specific test file
npm test -- tests/authAndPortfolioFlow.test.js

# Lint (no linter currently configured)
npm run lint

# Start individual workers (separate terminals)
npm run worker:email
npm run worker:analytics
npm run worker:image
npm run worker:asset-cleanup
npm run worker:notification
npm run worker:billing-maintenance

# Database backups
npm run backup:postgres
npm run backup:r2manifest
npm run backup:daily
npm run restore:postgres:snapshot

# Seed demo data
npm run seed:demo:lensaya

# Environment
# Create backend/.env from backend/.env.example
# Required: DATABASE_URL, JWT_SECRET
# See docs/env.md for complete reference
```

### Frontend Commands

```bash
cd frontend

# Install dependencies
npm install

# Build Tailwind CSS
npm run tw:build

# Local development (includes Tailwind watch)
npm run dev

# Production build (TypeScript + Vite + Tailwind)
npm run build

# Preview production build
npm run preview

# Lint (ESLint)
npm run lint

# Environment
# Create frontend/.env (optional)
# See docs/env.md for available variables
```

---

## Default Workflow for Future Tasks

### When Adding a New Feature

1. **Understand the scope**: Read relevant section of docs/business-rules.md to confirm limits/constraints
2. **Plan database changes**: If new fields → create Prisma migration
3. **Plan API endpoints**: Document in docs/api.md what you'll add
4. **Implement in order**:
   - Prisma migration + schema update
   - Backend: service logic → controller → route
   - Backend: add validation schema (Zod)
   - Backend: write tests (flow + contract)
   - Frontend: API client → hook → component
   - Frontend: integration test (if possible)
5. **Validate before finishing**:
   - [ ] All tests pass: `npm test` (backend), `npm run lint` (frontend)
   - [ ] Manual testing: try the flow end-to-end locally
   - [ ] Docs updated: docs/api.md if endpoints changed, docs/business-rules.md if logic changed
   - [ ] No new "Needs confirmation" are introduced
   - [ ] Diffs are reviewable (tight scope)

### When Fixing a Bug

1. **Reproduce**: Write a test that fails (documents the bug)
2. **Locate root cause**: Use test failures + logs + git blame
3. **Fix in service layer** (not controller): Services own the logic
4. **Don't refactor while fixing**: Keep the diff clean and focused
5. **Run tests**: Ensure the test now passes
6. **Check for side effects**: Does this bug fix affect billing, webhooks, or asset lifecycle?

### When Optimizing/Refactoring

1. **Only if explicitly requested**: The repo is in good shape; avoid premature optimization
2. **Keep facade patterns intact**: photogerapher/* and admin/* are established; don't flatten them
3. **Write tests first**: Ensure current behavior is tested before refactoring
4. **Small scopes**: Refactor one service/file per PR, not the whole layer
5. **Maintain backward compatibility**: Don't break internal APIs that other services depend on

---

## Rules for When NOT to Refactor Architecture

**DO NOT refactor these areas unless explicitly requested**:

1. **Service layer structure**: Facade pattern (photographerService, adminService) is intentional; keep it
2. **Middleware chain**: Request handling flow is proven; adding middleware OK, reordering NOT OK
3. **Prisma middleware/extensions**: Tenant scoping is critical; don't restructure without tests
4. **Queue architecture**: BullMQ + fallback is working; don't consolidate workers
5. **Database schema**: Migrations are immutable; only ADD fields, don't restructure tables
6. **API envelope format**: `{ success, data, error }` is standard; keep it across all endpoints
7. **Error handling**: ApiError class is the pattern; don't introduce different error types
8. **Test structure**: Mocking via `withMethodPatches` is established; don't switch to DI
9. **Frontend routing**: Lazy-loaded pages + three host types is the pattern; keep it
10. **Authentication flow**: JWT + refresh tokens + Google OAuth is working; don't change

**What CAN be refactored**:
- ✅ Safe to extract utility functions
- ✅ Safe to consolidate duplicate code (but only within same module)
- ✅ Safe to add new services alongside existing ones
- ✅ Safe to add new middleware (but not reorder existing)
- ✅ Safe to improve logging/observability
- ✅ Safe to add caching layer (Redis) to expensive queries

---

## Where New Code Should Go

### Backend

**New endpoint for existing domain**:
```
backend/src/routes/[domain]Routes.js  # Add route
  → backend/src/controllers/[domain]Controller.js  # Add handler
    → backend/src/services/[domain]Service.js  # Add logic
      → backend/prisma/schema.prisma  # Add model/field if needed
```

**New domain entirely**:
```
backend/src/routes/newDomainRoutes.js
backend/src/controllers/newDomainController.js
backend/src/services/newDomainService.js
backend/src/utils/validationSchemas.js  # Add schemas for new domain
backend/tests/newDomainFlow.test.js  # Add flow test
```

**New utility or helper**:
```
backend/src/utils/[utility].js  # Add function
backend/tests/utils/[utility].test.js  # Add test if complex
```

**New worker**:
```
backend/src/jobs/[worker]Queue.js  # Define queue + job names
backend/src/workers/[worker]Worker.js  # Implement processor
backend/src/jobs/processors/[processor].js  # If processor is complex, extract
```

**Admin-specific logic**:
```
backend/src/services/admin/admin[Feature]Service.js
# Keep admin services separate from photographer services
```

**Photographer-specific logic**:
```
backend/src/services/photographer/photographer[Feature]Service.js
# Call these from photogerapher/photographerService.js facade
```

### Frontend

**New route/page**:
```
frontend/src/pages/[Area]/[Page].tsx
frontend/src/routes.lazy.ts  # Add lazy() component
frontend/src/routes.tsx  # Add route definition
frontend/src/routes.paths.ts  # Add path constant
```

**New feature (with hooks/logic)**:
```
frontend/src/features/[Feature]/
  ├── [Feature].hook.ts  # Hook wrapping API client
  ├── [Feature]Context.tsx  # Context if needed
  └── use[Feature].ts  # Or direct hook file
```

**New API client domain**:
```
frontend/src/lib/api/[domain].ts
# Export functions matching backend endpoints
# Call core.request<T>() for HTTP
```

---

## How to Validate Changes Before Claiming Done

### Checklist for All Changes

- [ ] **Code compiles**: No TypeScript errors, no syntax errors
- [ ] **Tests pass**: `npm test` (backend) or `npm run lint` (frontend)
- [ ] **Relevant tests written/updated**: New feature has test coverage
- [ ] **Docs updated**: If API or business logic changed, update docs/
- [ ] **Diffs are tight**: Related changes only, no unintended reformatting
- [ ] **Commit message is clear**: Explains WHAT and WHY, not just description
- [ ] **Manual testing**: Feature works end-to-end locally

### Checklist for Risky Areas

**If touching billing**:
- [ ] Test webhook idempotency (process same webhook twice → same result)
- [ ] Verify subscription status transitions are valid (PENDING → SUCCEEDED OK, SUCCEEDED → PENDING NOT OK)
- [ ] Check database: only one Transaction for one payment
- [ ] Run `npm test -- tests/subscriptionFlow.test.js` and `tests/stripeBilling.test.js`

**If touching asset lifecycle**:
- [ ] Verify cleanup doesn't delete in-use assets (reference counting)
- [ ] Check R2 has correct credentials (uploads don't fail silently)
- [ ] Test watermark logic for free plan (images processed correctly)

**If touching webhooks**:
- [ ] Verify signature verification (CHIP/Stripe)
- [ ] Test with correct AND wrong signatures (should reject wrong ones)
- [ ] Check webhook is idempotent (duplicates are safe)
- [ ] Verify side effects (emails, notifications, DB updates)

**If touching multi-tenant logic**:
- [ ] Run `npm test -- tests/tenantIsolation.test.js`
- [ ] Verify photographer A cannot read/write photographer B's data
- [ ] Check Prisma middleware is applied (context is injected)

**If touching queues/workers**:
- [ ] Verify fallback works (disable Redis, check inline processing)
- [ ] Check worker heartbeat (health endpoint should show worker online)
- [ ] Test job retries (intentionally fail a job, verify exponential backoff)

**If touching custom domains**:
- [ ] Test DNS vs mock verification modes
- [ ] Verify CNAME instructions are correct
- [ ] Check billing webhooks reach app via custom domain

---

## Important Docs to Read First

**In Priority Order**:

1. **README.md** (~300 lines)
   - Quick start
   - Where to look
   - Command map

2. **docs/setup.md** (~400 lines)
   - Local development prerequisites and setup (7 phases)
   - First-run troubleshooting
   - PostgreSQL + Prisma + Redis setup

3. **ARCHITECTURE.md** (repo-level summary)
   - System overview (quick read)

4. **docs/api.md** (~7000 lines)
   - Full endpoint reference
   - Request/response envelopes
   - Error handling patterns
   - Auth model

5. **docs/architecture.md** (~6500 lines)
   - Detailed system flow (request path)
   - Module organization
   - Async/queue patterns
   - Billing integration

6. **docs/business-rules.md** (~5800 lines)
   - Plan limits and feature gating
   - Booking/referral/billing rules
   - Moderation logic

7. **docs/database.md** (~5100 lines)
   - Schema overview
   - Key constraints/indexes
   - Lifecycle rules

8. **docs/deployment.md** (~4600 lines)
   - Build + migration flow
   - Production checklist
   - Requirements

9. **docs/testing.md** (~12400 lines)
   - Test framework + categories
   - Pitfalls and common errors
   - Pre-merge checklist

10. **docs/troubleshooting.md** (~16400 lines)
    - 40+ symptom→cause→fix scenarios
    - Local dev + production issues
    - Incident response

11. **docs/env.md** (~14600 lines)
    - All 60+ environment variables
    - Local dev .env example
    - Production .env example

12. **docs/operations.md** (~17600 lines)
    - Production runbook
    - Queue/worker management
    - Health monitoring
    - Incident response

---

## Known Risky Areas

### 1. Billing Webhook Idempotency

**Risk**: Same webhook processed twice → double charge or duplicate transaction

**Location**: [backend/src/controllers/billingController.js](../backend/src/controllers/billingController.js), [backend/src/services/billingService.js](../backend/src/services/billingService.js)

**What can go wrong**:
- Payment provider retries webhook (network error)
- Transaction created twice
- Subscription status updated incorrectly

**How to stay safe**:
- Always check subscription status before applying state transitions
- Use status-aware upserts, not unconditional inserts
- Query by externalId (CHIP/Stripe reference ID), not by timestamp
- Write tests that process the same webhook twice (verifyFlow.test.js does this)

**Test coverage**: [backend/tests/subscriptionFlow.test.js](../backend/tests/subscriptionFlow.test.js), [backend/tests/stripeBilling.test.js](../backend/tests/stripeBilling.test.js)

### 2. Tenant Isolation (Multi-Tenant Safety)

**Risk**: Photographer A reads/writes Photographer B's data

**Location**: [backend/src/middleware/tenantContext.js](../backend/src/middleware/tenantContext.js), Prisma middleware in [backend/src/config/prisma.js](../backend/src/config/prisma.js)

**How it works**:
- Middleware resolves photographer ID from JWT or subdomain
- Prisma middleware injects `where: { photographerId: tenantId }` into all model queries
- Services call `ensureTenantOwnership()` for sensitive updates

**What can go wrong**:
- Forgetting to apply middleware to a route
- Bypassing Prisma (raw SQL without tenant filter)
- Cross-checking services without tenant scoping

**How to stay safe**:
- All photographer routes must have middleware applied (see routing files)
- Never use raw SQL without explicit tenant filter
- Pass tenantContext to services that need it
- Test with two photographers reading/writing each other's data

**Test coverage**: [backend/tests/tenantIsolation.test.js](../backend/tests/tenantIsolation.test.js)

### 3. Asset Lifecycle & R2 Purge

**Risk**: Deleting an asset that's still in use (avatar, banner, portfolio item, service thumbnail)

**Location**: [backend/src/services/assetLifecycleService.js](../backend/src/services/assetLifecycleService.js), [backend/src/workers/assetCleanupWorker.js](../backend/src/workers/assetCleanupWorker.js)

**What can go wrong**:
- Reference count query is incomplete (misses one of the 4 relations)
- Asset deleted from R2 but database record not updated
- Old asset purges before new upload completes
- Storage quota enforcement fails (allows over-limit)

**How to stay safe**:
- Reference counting must check ALL four places: avatarAssetId, bannerAssetId, portfolioItems, serviceThumbnails
- Asset status lifecycle: PENDING → READY → READY (in use) → DELETED (soft delete) → PURGED (hard delete)
- Test with multiple photographers, multiple assets per photographer
- Verify storage quota in presign endpoint (uploadService)

**Test coverage**: Tests in [backend/tests/](../backend/tests/) verify asset status and quota

### 4. Queue & Worker Side Effects

**Risk**: Job fails silently, side effect incomplete, data inconsistency

**Locations**:
- Email: [backend/src/jobs/emailQueue.js](../backend/src/jobs/emailQueue.js), [backend/src/workers/emailWorker.js](../backend/src/workers/emailWorker.js)
- Analytics: [backend/src/jobs/analyticsQueue.js](../backend/src/jobs/analyticsQueue.js), [backend/src/workers/analyticsWorker.js](../backend/src/workers/analyticsWorker.js)
- Billing: [backend/src/jobs/billingMaintenanceQueue.js](../backend/src/jobs/billingMaintenanceQueue.js), [backend/src/workers/billingMaintenanceWorker.js](../backend/src/workers/billingMaintenanceWorker.js)

**What can go wrong**:
- Job enqueued but worker not running → email never sent, analytics never aggregated
- Worker crashes mid-job → partial state, retry loses context
- Redis unavailable → fallback to inline (slow) but works
- Job retry exhausted → job buried in dead letter queue

**How to stay safe**:
- Always start all 6 workers in production
- Use health endpoint to verify workers are online
- Configure alerts if any worker is offline >5 min
- Test with Redis disabled (fallback behavior)
- Verify job is idempotent (safe to retry)

**Test coverage**: [backend/tests/workerHealthMonitoring.test.js](../backend/tests/workerHealthMonitoring.test.js)

### 5. Webhook Authorization & Signature Verification

**Risk**: Attacker forges webhook signature → malicious action (fake payment, false referral, etc.)

**Locations**:
- CHIP: [backend/src/services/chipService.js](../backend/src/services/chipService.js)
- Stripe: [backend/src/services/stripeService.js](../backend/src/services/stripeService.js)

**What can go wrong**:
- Webhook secret not configured (uses default/empty string)
- Signature verification accidentally disabled
- Webhook secret rotated but old one still used
- Timing attack on signature comparison

**How to stay safe**:
- Webhook secret must be set (tests default to `chip-webhook-secret`, production uses real value)
- Use constant-time comparison for HMAC (crypto.timingSafeEqual if needed)
- Include raw request body (not parsed JSON) in signature
- Include timestamp in signature (replay protection)
- Log webhook attempts (success and failure)

**Test coverage**: [backend/tests/chipWebhookSecretOrder.test.js](../backend/tests/chipWebhookSecretOrder.test.js), [backend/tests/stripeBilling.test.js](../backend/tests/stripeBilling.test.js)

### 6. Database Connection Pool Exhaustion

**Risk**: All pool connections in use, new requests timeout, API becomes unavailable

**Locations**: [backend/src/config/prisma.js](../backend/src/config/prisma.js), [backend/src/config/env.js](../backend/src/config/env.js)

**What can go wrong**:
- Long-running query holds connection
- N+1 queries in service logic
- Worker tier connections leak
- Admin endpoint runs expensive analytics query

**How to stay safe**:
- Pool defaults: 10 for API, 5 for workers
- Monitor connection count: `SELECT COUNT(*) FROM pg_stat_activity`
- Use connection timeout: 10 seconds (configurable)
- Avoid blocking operations in handlers
- Pagination on expensive queries (analytics, logs)

**Test coverage**: No explicit test; monitored via Sentry

### 7. Custom Domain Routing & Verification

**Risk**: Custom domain doesn't route to correct app, verification fails, billing webhooks can't be reached

**Locations**: [backend/src/services/customDomainService.js](../backend/src/services/customDomainService.js), [backend/src/middleware/hostContext.js](../backend/src/middleware/hostContext.js)

**What can go wrong**:
- DNS CNAME not pointing to right place
- Verification mode mismatch (DNS vs mock)
- CHIP can't reach app via custom domain
- Database stores wrong domain variant (with/without www)

**How to stay safe**:
- Normalize domains: apex domain → www.domain (stored with www)
- Provide clear CNAME instructions to user
- Test DNS before marking verified (only in production; mock in dev)
- Ensure billing webhooks can reach app via custom domain
- Use timeouts on DNS lookups (4 second timeout, configurable)

**Test coverage**: [backend/tests/customDomainFlow.test.js](../backend/tests/customDomainFlow.test.js)

---

## Done Criteria for Code Tasks

A task is **done** when:

1. **Code is complete**:
   - [ ] Logic implemented as designed
   - [ ] All requested features are present
   - No TODOs left in code

2. **Tests pass**:
   - [ ] `npm test` passes (backend)
   - [ ] Relevant test suite passes specifically
   - [ ] No new warnings or errors
   - [ ] Test coverage for new logic (flow test + contract test for new endpoints)

3. **Documentation updated**:
   - [ ] docs/api.md updated (if endpoints changed)
   - [ ] docs/business-rules.md updated (if logic/limits changed)
   - [ ] README.md updated (if new commands or setup steps)
   - [ ] Code comments added (if logic is non-obvious)

4. **Code quality**:
   - [ ] No lint errors
   - [ ] Diffs are tight (no unintended changes)
   - [ ] Variable/function names are clear
   - [ ] No console.log left behind (use logger instead)

5. **Manual testing**:
   - [ ] Feature works end-to-end locally
   - [ ] Error cases tested (invalid input, auth failure, etc.)
   - [ ] Risky areas validated (if touching billing/webhooks/tenants/assets)

6. **No regressions**:
   - [ ] All existing tests still pass
   - [ ] No performance degradation
   - [ ] No new errors in Sentry

7. **Code review-ready**:
   - [ ] Commit message is clear
   - [ ] Change is understandable without explanation
   - [ ] No merge conflicts expected
   - [ ] Follows repo patterns (service layer structure, error handling, validation)

### Specific Done Criteria by Task Type

#### Feature (New Endpoint, New UI Screen)

Done when:
- Route/API defined and tested (contract test)
- End-to-end flow works (flow test)
- Error cases handled (400, 401, 421, 500)
- Documentation updated
- Frontend and backend changes integrated
- All tests pass

#### Bug Fix

Done when:
- Bug reproduced in test
- Fix applied
- Regression test written (prevents reoccurrence)
- Root cause understood and documented (commit message)
- No new issues introduced

#### Refactor / Performance

Done when:
- Old tests still pass (no behavior change)
- Measurement shows improvement (if performance optimization)
- Code is clearer (if code refactor)
- No regressions in manual testing

#### Database Migration

Done when:
- Migration file created
- Reverse migration possible (if down() exists)
- Data migration tested (if data transformation)
- Schema is valid: `npm run prisma:validate`
- Migration applies cleanly: `npm run prisma:migrate`

---

## Encode These Repo Values

**Principles to follow**:

1. **Prefer working features over refactoring**
   - The repo is in good shape; don't restructure unnecessarily
   - Focus on features, bugs, and optimizations
   - Refactoring OK only if it enables new features

2. **Preserve established patterns**
   - Service facades: don't flatten
   - Middleware chain: don't reorder
   - API envelope: keep consistent
   - Test mocking: use withMethodPatches

3. **Maintain tight diffs**
   - One change per commit
   - No accidental reformatting
   - No unrelated fixes in same PR

4. **Use documentation as source of truth**
   - docs/business-rules.md defines limits and rules
   - docs/api.md defines contracts
   - docs/architecture.md defines flow
   - Don't contradict docs without updating them

5. **Test before declaring done**
   - Run relevant test suite
   - Write tests for new code
   - Manual end-to-end test locally

6. **Respect risky areas**
   - Billing, webhooks, assets, multi-tenant, custom domains
   - Extra scrutiny and testing required
   - Don't assume; verify with tests

7. **Communicate changes in code + docs**
   - Commit message explains WHY
   - Code comments explain HOW (if non-obvious)
   - Docs explain WHAT and WHEN

---

## Contact & Escalation

**When unsure**:
1. Check the relevant doc first (docs/api.md, docs/business-rules.md, docs/architecture.md)
2. Search existing tests for similar patterns
3. Read the service implementation
4. Check git blame for recent changes to that area

**If still unclear**: Mark it as "Needs confirmation" in comments and proceed with best estimate.

---

## Last Updated

March 30, 2026

**What this documents**:
- Project structure as of latest code inspection
- Test suite coverage (131+ tests)
- Documentation completeness (10 docs files, 60KB)
- Known patterns and best practices
- Risky areas requiring extra care
