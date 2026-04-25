# Database Guide

Lensaya uses PostgreSQL with Prisma as the primary schema contract.

## Stack And Ownership

- ORM: Prisma Client
- DB: PostgreSQL
- Schema source: backend/prisma/schema.prisma
- Migration config: backend/prisma.config.ts

Startup guard:
- Server runs a schema compatibility check at startup for required columns/enum values.

Source hints:
- backend/prisma/schema.prisma
- backend/prisma.config.ts
- backend/src/config/schemaGuard.js

## Core Domains And Relationships

## Identity And Tenant

- User (role, status, auth identity)
- Photographer (1:1 with User via userId unique)

Key ownership principle:
- Most workspace entities tie back to Photographer.

## Catalog And Portfolio

- Service belongs to Photographer
- Package belongs to Service and Photographer
- PortfolioItem belongs to Photographer, optional Service, and required Asset
- Asset can be referenced by:
	- Photographer avatar/banner
	- Service thumbnail
	- PortfolioItem image

## Leads/Bookings

- Booking belongs to Photographer and may link Service/Package/PortfolioItem/User
- Booking status/source enums are central for lead workflows

## Billing

- Subscription belongs to User (optional Photographer)
- Transaction links to Subscription and optional User
- Provider-related fields include `providerSubscriptionId` (Stripe). `chipPurchaseId` is a legacy field kept for older data and is no longer written by the app.

## Content And Platform Controls

- PlatformSetting stores global JSON settings
- CmsContent stores site/admin-managed content by section and status

## Analytics

- AnalyticsEvent stores raw events (BigInt id)
- Rollup tables:
	- AnalyticsDailyEventRollup
	- AnalyticsDailyServiceRollup
	- AnalyticsDailyVisitorRollup

## Admin/Audit/Security

- AdminLog tracks admin actions
- PasswordResetToken and EmailVerificationToken support auth lifecycle
- Notification stores user notifications

## Referral

- Referral tracks code clicks, signup, conversion and reward metadata

Source hints:
- backend/prisma/schema.prisma

## Important Constraints And Index Patterns

Examples of critical uniqueness/relationship constraints:
- User.email unique
- Photographer.userId unique, Photographer.username unique
- Service unique per photographer + name
- Package unique per service + name
- PortfolioItem unique per photographer + assetId
- CustomDomain unique on photographerId and domain
- Subscription `providerSubscriptionId` unique; `chipPurchaseId` unique (legacy)
- Transaction providerTransactionId unique

Indexes heavily support:
- Time-window analytics queries
- Public directory filtering (city/specialty/visibility/status)
- Billing/reporting access patterns
- Moderation/admin list operations

Source hints:
- backend/prisma/schema.prisma

## Prisma Behavior And Tenant Scoping

- Prisma client is extended to auto-apply tenant filters for scoped models when tenant context is present and requester is not admin.
- Create/createMany/upsert can auto-inject photographerId in tenant context.

This reduces accidental cross-tenant reads/writes, but explicit ownership checks are still used in services.

Source hints:
- backend/src/config/prisma.js
- backend/src/utils/tenantStore.js
- backend/src/utils/tenantQuery.js

## Raw SQL Hotspots

Raw SQL is used selectively where needed:
- Schema compatibility checks via information_schema and pg_enum queries
- Asset reference counting queries for safe purge decisioning
- Some plan compatibility and fallback behavior in plan limit service
- Backup/restore scripts using pg client and SQL table introspection

Source hints:
- backend/src/config/schemaGuard.js
- backend/src/services/photographerService.js
- backend/src/services/planLimitService.js
- backend/scripts/backup-postgres.js
- backend/scripts/restore-postgres-snapshot.js

## Data Lifecycle Notes

Asset lifecycle:
- PENDING -> READY -> DELETED/PURGED (depending on operations)
- Portfolio deletion may cascade into R2 object purge only when reference count is zero.

Subscription lifecycle:
- FREE/PRO/STUDIO plans with status transitions and billing interval fields.
- Pending plan change fields support deferred transitions.

Analytics lifecycle:
- Raw events ingested first.
- Rollups queried preferentially for dashboard and analytics APIs.

## Backup And Recovery

Available scripts:
- backup-postgres.js
	- Uses pg_dump when available
	- Falls back to JSON snapshot mode if pg_dump is missing
- backup-r2-manifest.js
	- Exports active Asset manifest JSON + CSV with checksums
- restore-postgres-snapshot.js
	- Restores from JSON snapshot, supports partial override flag

Source hints:
- backend/scripts/backup-postgres.js
- backend/scripts/backup-r2-manifest.js
- backend/scripts/restore-postgres-snapshot.js
- database/scripts/run-daily-backup.ps1

## Needs Confirmation

- Expected production backup retention and offsite policy beyond current script defaults.
- Preferred strategy for large-table retention/partitioning as analytics volume grows.
- Whether JSON snapshot restore path is intended for production recovery or dev-only fallback.
