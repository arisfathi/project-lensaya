# Lensaya Business Rules

This file captures business and platform rules derived from implementation and tests.

## Confirmed By Code

## Authentication And Account

- Protected routes require access tokens; refresh tokens are invalid for protected API access.
- Login is blocked for SUSPENDED and DELETED users.
- Signup creates photographer profile and default FREE subscription when applicable.

Source hints:
- backend/src/middleware/auth.js
- backend/src/services/authService.js
- backend/tests/authAndPortfolioFlow.test.js

## Plan Tiers And Limits

Plan tiers:
- FREE
- PRO
- STUDIO

Limit enforcement includes:
- maxServices
- maxPortfolioImages
- maxPackages (packages per service semantics in services)
- maxPackageFeatures
- storageGB

Limit behavior:
- Limit checks are enforced in create/update flows for services, packages, portfolio uploads, and storage-sensitive operations.
- Limit violations throw 403 with upgrade-oriented messages.

Source hints:
- backend/src/services/planLimitService.js
- backend/src/services/photographer/photographerServicesService.js
- backend/src/services/photographer/photographerPackagesService.js
- backend/src/services/photographerService.js
- backend/src/services/uploadService.js

## Feature Gating

- Analytics tools are gated by plan-level analyticsTools capability.
- Team section management is gated by teamSectionTools capability.
- Hide branding is only available on non-FREE plans.
- Custom domains are only available on plans with customDomain enabled.

Source hints:
- backend/src/services/planLimitService.js
- backend/src/services/photographer/photographerProfileService.js
- backend/src/services/customDomainService.js

## Username/Profile Rules

- Username preview logic rejects:
	- invalid generated username
	- too short generated username
	- reserved username
	- already-taken username
- Studio name update may trigger username sync in User and Photographer tables.
- Default website URL can be auto-synced when username changes and URL is still default-style.

Source hints:
- backend/src/services/photographer/photographerProfileService.js
- backend/src/utils/generateUsername.js

## Portfolio/Asset Lifecycle

- Portfolio item create requires READY asset.
- Asset must belong to tenant photographer or be uploaded by tenant user (unless admin).
- Deleting portfolio item can trigger R2 purge if no remaining references from:
	- PortfolioItem.assetId
	- Service.thumbnailAssetId
	- Photographer.avatarAssetId
	- Photographer.bannerAssetId
- Purged assets are marked with status PURGED and deletedAt.

Source hints:
- backend/src/services/photographerService.js
- backend/src/services/uploadService.js
- backend/tests/authAndPortfolioFlow.test.js

## Availability Rules

- Availability updates reject invalid dates.
- Past dates cannot be updated.
- Status is normalized to AVAILABLE/BOOKED for stored day-level records.

Source hints:
- backend/src/services/photographer/photographerAvailabilityService.js

## Booking Rules

- Public booking creation validates photographer and optional service/package references.
- Booking sources are constrained to enum values (WEBSITE, WHATSAPP, INSTAGRAM, FACEBOOK, TIKTOK, DIRECT, OTHER).
- Lead features (filters/export/reminders/analytics visibility windows) are plan-based.
- CSV lead export availability is plan-gated.

Source hints:
- backend/src/utils/validationSchemas.js
- backend/src/services/bookingService.js
- frontend/src/lib/api/portfolio-media.ts

## Analytics Rules

- Events are ingested via /analytics/events and processed asynchronously when queue is available.
- Rollup tables are preferred for dashboard/analytics responses; raw-event fallback is used when rollups unavailable.
- Free tier analytics returns reduced visibility with preview sections and locked sections metadata.

Source hints:
- backend/src/services/analyticsService.js
- backend/src/services/photographer/photographerAnalyticsService.js
- backend/src/services/photographer/photographerDashboardService.js

## Billing Lifecycle Rules

- Supported subscription statuses include TRIALING, ACTIVE, PAST_DUE, CANCELED, EXPIRED, INCOMPLETE.
- Webhooks support Stripe payload patterns with signature verification.
- Duplicate/stale webhook handling is designed to be idempotent and status-safe.
- Plan changes classify as upgrade/downgrade/renew based on rank and cycle.

Source hints:
- backend/src/services/billingService.js
- backend/src/controllers/billingController.js
- backend/tests/subscriptionFlow.test.js
- backend/tests/stripeBilling.test.js

## Referral Rules

- Referral codes are normalized with REF- prefix semantics.
- Self-referrals are blocked (including same-email patterns).
- Track endpoint is deduplicated by visitor and time window logic.
- Conversion/reward flow grants referrer rewards and can extend paid subscriptions.

Source hints:
- backend/src/services/referralService.js
- backend/tests/referralFlow.test.js

## Moderation/Admin Rules

- Admin access requires ADMIN role.
- Moderation report actions include approve/suspend/escalate.
- Flagged image actions include approve/remove.
- Removing flagged images can remove portfolio links and mark assets deleted.

Source hints:
- backend/src/routes/adminRoutes.js
- backend/src/utils/validationSchemas.js
- backend/tests/moderationFlow.test.js

## Needs Confirmation

- Commercial policy for yearly pricing discounts (code supports yearlyPrice but product policy wording is not documented).
- Exact SLA expectations for queue-backed operations when Redis is down in production.
- Whether any plans beyond FREE/PRO/STUDIO are expected long term.
