# Multi-Tenant Routing

Lensaya host routing conventions:

- `lensaya.com` and `www.lensaya.com` -> marketing website
- `app.lensaya.com` -> photographer dashboard and auth workspace
- `admin.lensaya.com` -> internal admin workspace
- `{username}.lensaya.com` -> photographer public website
- `www.customdomain.com` -> mapped photographer public website

Reserved subdomains:

- `www`
- `app`
- `admin`
- `api`

## Runtime Resolution

Backend host parsing and resolution live in:

- `backend/src/utils/requestHost.js`
- `backend/src/middleware/hostContext.js`
- `backend/src/middleware/publicHostApiGuard.js`
- `backend/src/services/publicHostService.js`

Frontend host-aware routing lives in:

- `frontend/src/lib/platform.ts`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/components/routing/PlatformHostBoundary.tsx`
- `frontend/src/components/routing/PublicHostCanonicalRoute.tsx`
- `frontend/src/pages/HostAwareHome.tsx`
- `frontend/src/pages/HostAwareGallery.tsx`

`hostContext` resolves request hosts in this order for public-site preview support:

1. `x-tenant-host`
2. `x-forwarded-host`
3. `host`

The stricter API guard uses the direct host only:

1. `x-forwarded-host`
2. `host`

That prevents a client from spoofing `x-tenant-host` to bypass or trigger protected-route handling on platform hosts.

Public host resolution is exposed at:

- `GET /api/v1/public/site`

## Exact Route Behavior

### Public hosts: `{username}.lensaya.com` and connected custom domains

Allowed locally:

- `/` -> public portfolio home
- `/gallery` -> public gallery
- `/api/v1/public/*` -> public data and booking endpoints
- `/api/v1/analytics/events` -> public analytics ingestion
- `/api/v1/billing/plans` -> public plan data if needed by a public entry point

Redirected away from the public host:

- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/dashboard/*`
- photographer settings and payments routes under `/dashboard/*`
- `/admin/*`
- `/pricing`
- `/photographers`

Redirect targets:

- auth and dashboard routes -> `APP_URL` / `VITE_APP_URL`
- admin routes -> `ADMIN_APP_URL` / `VITE_ADMIN_APP_URL` when configured, otherwise `APP_URL`
- marketing and directory routes -> `PUBLIC_APP_URL` / `VITE_PUBLIC_APP_URL`

Canonicalized on public hosts:

- `/p/:username` -> `/`
- `/p/:username/gallery` -> `/gallery`
- `/portfolio` -> `/`

Unavailable behavior on public hosts:

- unresolved custom domain on `/` or `/gallery` -> `PublicSiteUnavailable`
- inactive or awaiting DNS domain on `/` or `/gallery` -> `PublicSiteUnavailable`
- broken domain on `/` or `/gallery` -> `PublicSiteUnavailable`
- custom domain without current plan entitlement -> `PublicSiteUnavailable` with fallback Lensaya URL
- non-public API on a public host -> HTTP `421` JSON response from `publicHostApiGuard`

### Platform hosts

Expected behavior:

- `lensaya.com` / `www.lensaya.com` -> marketing, pricing, photographer directory
- `app.lensaya.com` -> auth, dashboard, settings, billing, mock checkout
- `admin.lensaya.com` -> admin routes
- `/p/:username` and fallback public site URLs continue to work on Lensaya-managed hosts

## Public API Safety Rules

The backend now denies non-public API routes when the real request host is a public photographer host.

Allowed API prefixes on public hosts:

- `/api/v1/public/`
- `/api/v1/analytics/events`
- `/api/v1/billing/plans`

Denied examples:

- `/api/v1/auth/*`
- `/api/v1/dashboard/*`
- `/api/v1/profile/*`
- `/api/v1/billing/subscription*`
- `/api/v1/admin/*`

This is defense in depth for cases where a public-host SPA route is hit directly or a same-origin proxy exposes `/api` on the custom domain.

## Hosting, Ingress, Proxy, and CDN Requirements

Production routing depends on infrastructure doing all of the following:

- Serve the frontend SPA on:
  - marketing hosts
  - wildcard Lensaya public subdomains
  - connected custom domains
- Route `/api/*` to the backend while preserving the original host.
- Forward `Host` or `X-Forwarded-Host` intact end to end.
- Preserve HTTPS termination metadata correctly if TLS terminates at the edge.
- Return `index.html` for public SPA routes such as `/` and `/gallery`.
- Return `index.html` for platform SPA routes on app and admin hosts.
- Ensure custom domains point to the same frontend edge as the Lensaya fallback public site.
- Ensure webhook and internal API hosts do not depend on a custom-domain host header.

Recommended ingress/CDN rules:

- Route custom domains and wildcard public subdomains to the public SPA entry.
- Route `app.*` and `admin.*` to the platform SPA entry.
- Route `/api/*` from every SPA host to the backend service.
- Preserve the incoming host header; do not rewrite custom domains to the fallback subdomain before the backend sees them.
- Optionally add edge redirects for obviously invalid combinations, but keep the frontend and backend guards in place as the source of truth.

If the API is served from a separate origin instead of a same-origin proxy:

- `CORS_ORIGINS` must include the app host, public marketing host, admin host, and any custom-domain origins you intend to call the API directly from.
- Same-origin proxying is the safer default because custom domains are dynamic.

## SSL and Certificate Integration Touchpoints

No certificate automation is implemented yet. The existing integration points are ready for that later hookup:

- Prisma `CustomDomain.status`
- Prisma `CustomDomain.sslStatus`
- Prisma `CustomDomain.lastCheckedAt`
- Prisma `CustomDomain.verifiedAt`
- `backend/src/services/customDomainService.js`
- `backend/src/services/publicHostService.js`

Recommended future SSL flow:

1. Domain is saved as `AWAITING_DNS` with `sslStatus=PENDING`.
2. DNS verification succeeds.
3. Certificate job is requested from the edge or cert provider.
4. Provider callback or poll updates `sslStatus` to `ISSUED` or `ERROR`.
5. Public routing continues serving only when domain `status=ACTIVE`.
6. If certificate renewal later fails, keep `status=ACTIVE` only if the edge still serves valid TLS; otherwise mark `BROKEN` with `sslStatus=ERROR`.

This keeps certificate state explicit without forcing certificate automation into the current MVP.

## Background Re-Verification Worker Design

Not implemented yet. The useful low-risk design is:

Candidate selection:

- `ACTIVE` domains whose `lastCheckedAt` is older than the recheck window
- `VERIFYING` domains stuck longer than the verification timeout window
- `BROKEN` domains eligible for retry
- `AWAITING_DNS` domains optionally retried on a slower cadence

Recommended transitions:

- `AWAITING_DNS` -> `VERIFYING` -> `ACTIVE`
- `AWAITING_DNS` -> `VERIFYING` -> `FAILED`
- `ACTIVE` -> `VERIFYING` -> `ACTIVE`
- `ACTIVE` -> `VERIFYING` -> `BROKEN`
- `BROKEN` -> `VERIFYING` -> `ACTIVE`
- `BROKEN` -> `VERIFYING` -> `BROKEN`

Recommended worker responsibilities:

- run DNS verification using the same verification logic as manual verify
- update `lastCheckedAt` every pass
- preserve `verifiedAt` when an already-active domain remains active
- write a concise `failureReason` when a domain moves to `FAILED` or `BROKEN`
- never delete the fallback Lensaya URL or the domain record automatically

Plan-entitlement loss should continue to be handled at resolution time as `upgrade_required`; that does not need a worker mutation.

## Remaining Edge Cases To Watch

- Proxy strips or rewrites `Host` / `X-Forwarded-Host`, causing wrong-site resolution.
- Public custom-domain traffic reaches the backend without the original host preserved.
- Separate-origin API deployments forget to allow the required origins in `CORS_ORIGINS`.
- Edge rules accidentally expose app or admin routes from custom-domain hosts without the redirect layer.
- Public-host clients manually calling protected API routes; backend now blocks this, but logs should still be watched.
- Success of manual DNS verification does not guarantee certificate issuance yet; `sslStatus` is still an application-side readiness signal, not proof of live TLS automation.
- Unknown routes on public hosts still fall through to the SPA and rely on route-level handling; if you want stricter behavior later, add edge-level rewrites or a public-host 404 page.

## Production-Ready After This Pass

What is covered now:

- public hostname resolution
- custom-domain to photographer mapping
- fallback Lensaya subdomain behavior
- clean unavailable states for inactive, broken, and unentitled domains
- redirect/deny behavior for platform routes on public hosts
- backend API deny layer for non-public routes on public hosts
- documented ingress, proxy, SSL touchpoints, and worker design
