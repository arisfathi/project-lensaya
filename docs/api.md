# Lensaya API Guide

This document describes the practical API surface based on current code and tests.

## Base URL And Envelope

- Base path: /api/v1
- Success envelope:
	- success: true
	- data: object or null
	- error: null
- Error envelope:
	- success: false
	- data: null
	- error: message string

Source hints:
- backend/src/app.js
- backend/src/utils/response.js
- backend/src/middleware/errorHandler.js
- frontend/src/lib/api/core.ts

## Auth And Access Model

- Access token is expected as Bearer token or accessToken cookie.
- Refresh tokens are explicitly rejected on protected routes.
- Admin routes require ADMIN role.
- Most photographer workspace routes require tenant context (photographer ownership).

Source hints:
- backend/src/middleware/auth.js
- backend/src/middleware/tenantContext.js
- backend/tests/authAndPortfolioFlow.test.js
- backend/tests/tenantIsolation.test.js

## Host Separation (Platform vs Public Hosts)

- Public photographer hosts are allowed only for:
	- /public/*
	- /analytics/events
	- /billing/plans
- Other API routes return 421 with redirect hints to app/admin hosts.

Source hints:
- backend/src/middleware/publicHostApiGuard.js
- backend/tests/publicHostApiGuard.test.js

## Route Groups

### Authentication (/auth)

- POST /auth/signup
- POST /auth/login
- POST /auth/google
- POST /auth/forgot-password
- POST /auth/reset-password
- POST /auth/verify-email
- POST /auth/resend-verification
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me

Notes:
- /auth/me returns role, plan, status and plan feature snapshots used by frontend gating.

Source hints:
- backend/src/routes/authRoutes.js
- frontend/src/lib/api/auth.ts

### Photographer Workspace Core

Profile and domain:
- GET /profile
- PATCH /profile
- GET /profile/username-preview
- PATCH /photographer/hero
- GET/PUT/POST/DELETE /profile/custom-domain*

Dashboard and analytics:
- GET /dashboard/overview
- GET /dashboard/website-summary
- GET /analytics/overview
- GET /analytics/activity
- GET /analytics/categories

Catalog and portfolio:
- GET/POST/PATCH/DELETE /services*
- GET/POST/PATCH/DELETE /packages*
- POST /packages/:packageId/duplicate
- GET/POST/PATCH/DELETE /portfolio/items*
- PATCH /portfolio/items/:itemId/feature

Availability and bookings:
- GET/PATCH /availability
- GET /bookings
- GET /bookings/export
- GET /bookings/calendar
- PATCH /bookings/:bookingId/status
- PATCH /bookings/:bookingId

Uploads and account:
- POST /uploads/presign
- POST /uploads/complete
- DELETE /uploads/:assetId
- GET /users/me
- PATCH /users/profile
- POST /users/change-password
- DELETE /users/account
- GET /users/notifications
- PATCH /users/notifications/read
- POST /users/avatar
- DELETE /users/avatar

Source hints:
- backend/src/routes/profileRoutes.js
- backend/src/routes/dashboardRoutes.js
- backend/src/routes/analyticsRoutes.js
- backend/src/routes/servicesRoutes.js
- backend/src/routes/packagesRoutes.js
- backend/src/routes/portfolioRoutes.js
- backend/src/routes/availabilityRoutes.js
- backend/src/routes/bookingRoutes.js
- backend/src/routes/uploadRoutes.js
- backend/src/routes/userRoutes.js

### Public Site API (/public)

- GET /public/site (host resolution, fallback URLs, domain state)
- GET /public/content
- GET /public/pricing-content
- GET /public/photographers/featured
- GET /public/photographers
- GET /public/photographer/:username
- GET /public/photographers/:username
- GET /public/photographers/:username/services
- GET /public/photographers/:username/portfolio
- GET /public/photographers/:username/gallery
- GET /public/photographers/:username/packages
- GET /public/photographers/:username/availability
- POST /public/bookings
- POST /public/client-errors
- POST /public/referrals/track
- POST /analytics/events (public + optional auth)

Source hints:
- backend/src/routes/publicRoutes.js
- backend/src/services/publicHostService.js
- backend/src/services/publicService.js

### Billing And Webhooks

Public:
- GET /billing/plans

Authenticated:
- GET /billing/subscription
- POST /billing/change-plan
- POST /billing/subscription/cancel
- POST /billing/subscription/resume
- POST /billing/portal-session
- GET /billing/transactions
- GET /billing/mock/checkout/:sessionId
- POST /billing/mock/checkout/:sessionId/complete

Webhook endpoints:
- POST /billing/webhook
- POST /webhooks/payments

Webhook behavior:
- Supports CHIP and Stripe-style payloads.
- Signature verification is enforced before processing.
- Raw body capture is enabled for webhook paths.

Source hints:
- backend/src/routes/billingRoutes.js
- backend/src/controllers/billingController.js
- backend/src/services/billingService.js
- backend/src/services/chipService.js
- backend/tests/subscriptionFlow.test.js
- backend/tests/stripeBilling.test.js

### Admin API (/admin)

Protected by requireAuth + requireRole("ADMIN").

Major groups:
- Dashboard and analytics overview
- Photographer lifecycle and export
- Subscription plans and plan limits
- Revenue and transactions
- Storage and R2 overview
- Moderation reports and flagged images
- Referrals analytics
- System logs and worker health
- Global settings and CMS content

Source hints:
- backend/src/routes/adminRoutes.js
- backend/src/services/adminService.js
- backend/tests/adminContracts.test.js

## Request/Response Conventions

- Pagination query generally uses page and limit.
- IDs are mostly UUIDs, validated with Zod on route boundaries.
- Booking/public forms include explicit enums and tight validation.
- Webhooks accept multiple payload shapes with normalization.

Source hints:
- backend/src/utils/validationSchemas.js
- backend/src/utils/pagination.js

## Common Error Patterns

- 400: validation errors and malformed payloads.
- 401: missing/invalid token, invalid webhook signature.
- 403: ownership/plan-gating violations.
- 404: resource not found.
- 409: uniqueness conflicts (username/email/domain).
- 421: route blocked on public host.
- 500: server-side failures.

## Notable Side Effects

- Portfolio/service/image flows can enqueue image processing jobs.
- Analytics ingest enqueues (or inline-fallback processes) analytics rollups.
- Billing webhook updates subscriptions and transactions with idempotency protections.
- Deleting a portfolio item may purge unreferenced R2 objects.
- Referral conversion can extend/create referrer subscription rewards.

Source hints:
- backend/src/jobs/imageProcessingQueue.js
- backend/src/jobs/analyticsQueue.js
- backend/src/services/photographerService.js
- backend/src/services/referralService.js
- backend/src/services/billingService.js

## Needs Confirmation

- API versioning strategy beyond /api/v1 (no formal versioning policy doc found).
- Public API rate limits per route in production (middleware exists, operational thresholds are env-driven).
