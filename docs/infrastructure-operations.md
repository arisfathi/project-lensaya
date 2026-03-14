# Infrastructure Operations

## Image Optimization + Watermark

- Entry point: `POST /api/v1/uploads/complete`
- Uses Sharp to:
  - normalize orientation
  - resize to optimized WebP
  - generate thumbnail
  - optionally apply text watermark
- Watermark behavior is plan-aware:
  - if plan does not allow watermark toggle, watermark remains enabled

## Analytics + Referral Tracking

- Public events endpoint: `POST /api/v1/analytics/events`
- Captures:
  - event type
  - page path
  - session / visitor id
  - referrer URL/domain
  - anonymized IP hash
- Writes:
  - `analytics_events` (request event stream)
  - `referrals` (when referral attribution is present)
- Photographer analytics endpoint:
  - `GET /api/v1/analytics/overview`
  - `GET /api/v1/analytics/categories`
  - `GET /api/v1/analytics/activity`

## CHIP Payments

- Endpoints:
  - `GET /api/v1/billing/plans`
  - `GET /api/v1/billing/subscription`
  - `POST /api/v1/billing/change-plan`
  - `GET /api/v1/billing/transactions`
  - `POST /api/v1/billing/webhook`
  - `POST /api/v1/webhooks/payments` (alias)
- Canonical client mutation route:
  - `POST /api/v1/billing/change-plan`
- Reliability guards:
  - request timeout + retry for transient CHIP/network failures
  - strict signed webhook verification
  - idempotent webhook status transitions + transaction lock
- Flow:
  1. create checkout purchase request to CHIP
  2. store transaction + metadata in PostgreSQL
  3. reconcile status via signed webhook
  4. activate/update/cancel subscription based on payment lifecycle

## Internal Admin Ops

- Internal-only route: `GET /api/v1/admin/system/worker-health`
- Intended for admin/ops diagnostics only; keep it out of the public frontend API contract.

## Rate Limiting

- Global API limiter at `/api/v1`
- Specific limiters for:
  - auth
  - uploads
  - analytics tracking
  - billing
  - admin APIs

## Logging

- JSON structured logs to console
- Optional file logging (`LOG_TO_FILE=true`)
- Request logging includes:
  - request id
  - method/url/status
  - latency
  - tenant and user context

## Backups

### PostgreSQL

- `npm run backup:postgres` (from `backend/`)
- Produces `pg_dump` output + SHA256 checksum when `pg_dump` is available
- Falls back to full JSON snapshot (`*.snapshot.json`) + SHA256 when `pg_dump` is unavailable
- Retention controlled by `PG_BACKUP_RETENTION_DAYS`
- Snapshot restore:
  - `npm run restore:postgres:snapshot -- <path-to-*.snapshot.json>`
  - set `PG_SNAPSHOT_FILE` instead of CLI path when needed
  - set `PG_SNAPSHOT_ALLOW_PARTIAL=true` only for intentional partial restores

### R2 Backup Strategy

- `npm run backup:r2manifest` (from `backend/`)
- Generates JSON + CSV manifest of active `Asset.objectKey` records
- Use manifest with:
  - Cloudflare replication rules, or
  - batch sync job to secondary R2 bucket (`R2_BACKUP_BUCKET`)

### Daily Workflow

- `npm run backup:daily`
- Windows Task Scheduler helpers:
  - `database/scripts/run-daily-backup.ps1`
  - `database/scripts/register-daily-backup-task.ps1`

## Public Photographer Directory

- Endpoint: `GET /api/v1/public/directory?page=1&limit=20&q=...`
- Includes active photographers with booking enabled
- Returns profile metadata, sample services, and counts
- Used by marketing site directory preview
