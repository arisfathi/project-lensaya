# Plan Gating Admin Config Audit (End-to-End)

This document maps **plan-gated** features/limits → **where they’re enforced** → **where admins configure them** → **which APIs carry the data**.

Scope: Lensaya `FREE/PRO/STUDIO` plan gating for photographers.

## Source Of Truth (Backend)

**Subscription plan configuration lives in the database**:

- `backend/prisma/schema.prisma`: `model SubscriptionPlan` (limits, feature flags, modes, pricing fields).

Backend services read these rows via:

- `backend/src/services/planLimitService.js`: `listAllPlans()` → `toEntitlements()` → gate evaluation helpers.

Admin writes the same rows via:

- `backend/src/services/admin/adminSubscriptionsService.js`: `updatePlanLimits()` (PATCH `/admin/subscriptions/plan-limits`)
- `backend/src/services/admin/adminSubscriptionsService.js`: `updatePlan()` (PUT `/admin/plans/:planId`)

## Admin Panel Surfaces (Frontend)

Admin UI (Subscriptions page) edits limits + pricing + feature flags:

- `frontend/src/pages/admin/Subscriptions.tsx:261` (`saveLimits()`)
- `frontend/src/pages/admin/subscriptions/components/PlanConfigurationSection.tsx:1`

Admin UI saves to:

- PATCH `/admin/subscriptions/plan-limits` (bulk limits/flags)
- PUT `/admin/plans/:planId` (per-plan pricing + limits/flags)
- PATCH `/admin/settings/plan-limits` (settings mirror used elsewhere)

## Public + App APIs That Must Reflect Config

Marketing/pricing pages (public) read plan config from:

- GET `/billing/plans` → `backend/src/services/billingService.js:1312` (uses `planLimitService.listAllPlans()` + `toEntitlements()`)

Logged-in app reads plan-gated state from:

- GET `/auth/me` → includes `entitlements` and `leadFeatures` (built using `planLimitService`)

## Plan-Gated Items (What’s Enforced)

### Hard Limits (403 on create/usage)

| Gate | Admin field (UI + payload key) | DB column(s) | Enforced in |
|---|---|---|---|
| Service listings | `services` | `SubscriptionPlan.maxServices` | `backend/src/services/planLimitService.js:877` + `backend/src/services/photographer/photographerServicesService.js` |
| Portfolio images | `portfolioPhotos` / `portfolioImages` | `SubscriptionPlan.maxPortfolioImages` | `backend/src/services/planLimitService.js:885` + `backend/src/services/uploadService.js` |
| Packages per service | `packagesPerService` / `packages` | `SubscriptionPlan.maxPackagesPerService` (and `maxPackages` alias) | `backend/src/services/planLimitService.js:893` + `backend/src/services/photographer/photographerPackagesService.js` |
| Package features per package | `packageFeatures` / `maxPackageFeatures` | `SubscriptionPlan.maxPackageFeaturesPerPackage` (and `maxPackageFeatures` alias) | `backend/src/services/planLimitService.js` (`metric: "packageFeatures"`) + `backend/src/services/photographer/photographerPackagesService.js` |
| Storage (GB) | `storageGb` / `storage` | `SubscriptionPlan.storageGb` (and `storageGB` alias) | `backend/src/services/uploadService.js` (via `planLimitService.evaluateLimitGate()`) |

### Feature Flags (403 when feature used)

| Gate | Admin field | DB column(s) | Enforced in |
|---|---|---|---|
| Custom domains | `customDomain` | `customDomainEnabled` (and `customDomain` alias) | `backend/src/services/customDomainService.js` + `backend/src/services/planLimitService.js:919` |
| Branding removal | `hideBrandingEnabled` + `brandingMode=REMOVABLE` | `hideBrandingEnabled`, `brandingMode` | `backend/src/services/planLimitService.js:923` + `backend/src/services/photographer/photographerProfileService.js:150` |
| Analytics tools | `analyticsTools` | `analyticsEnabled` (and `analyticsTools` alias) | `backend/src/services/planLimitService.js:1032` + `backend/src/services/analyticsService.js:322` |
| Team section tools | `teamSectionTools` | `teamToolsEnabled` (and `teamSectionTools` alias) | `backend/src/services/photographer/photographerProfileService.js:150` + public profile shaping in `backend/src/services/publicService.js:343` |

### Lead/Inquiry Feature Gating (filters/export/reminders/analytics window)

Lead features are computed in:

- `backend/src/services/planLimitService.js:525` (`getLeadFeatureAccess()`)

And enforced in:

- `backend/src/services/bookingService.js` (filter use + export endpoint gating)

Admin-configurable fields used here:

- `leadFiltersEnabled`, `leadExportEnabled`, `leadRemindersEnabled`, `leadAdvancedAnalyticsEnabled`
- `leadHistoryDays`, `leadVisibilityLimit`, `leadTemplatesCount`
- `leadChannels` (WhatsApp/email channel availability for follow-up workflows)

## Known Gaps / “Configurable But Not Enforced”

These fields are editable in Admin → Subscriptions, stored in `SubscriptionPlan`, and included in `entitlements`, but **are not currently used to change backend enforcement**:

- `analyticsMode`
- `leadAnalyticsMode`
- `teamSeats` (stored/returned, but no seat-count enforcement in team members yet)

If you want these to be “real gates”, wire them into enforcement (or remove them from the Admin UI to avoid confusion).

