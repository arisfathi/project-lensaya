# Operations Runbook

Operational knowledge and monitoring guidance for running Lensaya in production.

## System Architecture Overview

```
Frontend (React)
    ↓ (API calls)
    
Load Balancer/Ingress
    ↓
    
Express API Servers (multiple instances recommended)
    ↓ (multi-tenant)
    ├─ PostgreSQL (primary data store)
    ├─ Redis (queue + heartbeat registry)
    └─ S3/R2 (asset storage)

Background Workers (separate processes)
    ├─ Email Worker (BullMQ consumer)
    ├─ Analytics Worker (aggregation, metrics)
    ├─ Image Processing Worker (thumbnail generation)
    ├─ Asset Cleanup Worker (R2 purge)
    ├─ Notification Worker (reminders)
    └─ Billing Maintenance Worker (subscription reconciliation)

External Integrations
    ├─ Stripe (webhooks for payments)
    ├─ Resend (email delivery)
    ├─ Google OAuth (authentication)
    └─ Cloudflare R2 (image storage + CDN)
```

## Queues & Workers

### Queue Infrastructure

Uses **BullMQ** with Redis backend for async job processing.

**Queues defined**:
- `email-queue`: Transactional emails (verification, booking confirmations)
- `image-processing-queue`: Image resizing/optimization
- `analytics-queue`: Event aggregation into rollup tables
- `asset-cleanup-queue`: Periodic purge of deleted assets from R2
- `notification-queue`: User notifications and reminders
- `billing-maintenance-queue`: Subscription reconciliation and payment status updates

**Fallback behavior** (no Redis):
- Email jobs run inline (synchronous) — slow but safe
- Analytics/Image jobs are skipped with warning logs
- Asset cleanup runs on a local timer (no persistence)
- Billing maintenance still runs inline if queue is disabled

### Worker Processes

Each worker owns one queue and processes jobs from Redis.

**Starting workers**:

```bash
# In separate terminal windows or via process manager:
npm run worker:email
npm run worker:analytics
npm run worker:image          # Needs 'sharp' native module
npm run worker:asset-cleanup
npm run worker:notification
npm run worker:billing-maintenance
```

**Expected startup sequence**:
1. Worker connects to Redis
2. Worker starts heartbeat (every 30s by default)
3. Worker appears in registry: `SMEMBERS lensaya:worker:registry` (Redis CLI)
4. Worker begins processing jobs

**Monitoring**:

```bash
# Check worker health via admin endpoint
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://app.example.com/api/v1/admin/system/worker-health

# Expected response:
{
  "success": true,
  "data": {
    "summary": {
      "total": 6,
      "online": 6,
      "stale": 0,
      "offline": 0
    },
    "workers": [
      {
        "workerId": "email:12345:uuid...",
        "queue": "email-queue",
        "status": "online",
        "lastHeartbeat": "2026-03-30T15:23:45Z",
        "uptime": 3600000
      },
      // ... more workers
    ]
  }
}
```

## Database Operations

### Backups

**PostgreSQL dump** (custom format, faster restore):

```bash
npm run backup:postgres
# Creates: backend/data/backups/postgres/[timestamp].dump
```

**Restore from backup**:

```bash
npm run restore:postgres:snapshot
# Prompts for snapshot file to restore
```

**R2 manifest backup** (list of all uploaded objects):

```bash
npm run backup:r2manifest
# Creates: backend/data/backups/r2-manifests/[timestamp].json
```

**Daily backup schedule**:

```bash
npm run backup:daily
# Runs all backups and stores in data/backups/
```

**Retention**: Backups older than 14 days are auto-deleted.

**Production setup** (Windows):

```powershell
# Register as Windows scheduled task
database/scripts/register-daily-backup-task.ps1
# Runs `run-daily-backup.ps1` at configured time
```

### Migrations

**Apply pending migrations**:

```bash
npm run prisma:migrate:deploy
# Safe in production; won't create new migrations
```

**Generate new migration** (dev only):

```bash
npm run prisma:migrate
# Prompts for migration name, applies immediately
```

**Reset database** (dev only, dangerous):

```bash
npm run prisma:migrate:reset
# Drops all data and recreates schema
```

### Query Troubleshooting

**Check connection pool health**:

```sql
SELECT 
  datname as database,
  count(*) as connection_count,
  max(extract(epoch from (now() - query_start))) as idle_seconds
FROM pg_stat_activity
GROUP BY datname;
```

**Check for blocking queries**:

```sql
SELECT 
  blocking_locks.pid as blocking_pid,
  blocked_locks.pid as blocked_pid,
  blocked_locks.granted as lock_type
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
WHERE NOT blocked_locks.granted;
```

## Webhooks & Payment Provider Integration

### Stripe Webhooks

**Endpoint**: `POST /api/v1/billing/webhook`  
**Alternative**: `POST /api/v1/webhooks/payments`

**Signature verification**:
- Header: `stripe-signature`
- Secret: `STRIPE_WEBHOOK_SECRET`
- Raw body is required (see `backend/src/controllers/billingController.js`)

**Key webhook events**:
- `checkout.session.completed` → Subscription starts/renews
- `invoice.paid` → Payment successful, marks `ACTIVE`
- `invoice.payment_failed` → Marks `PAST_DUE`, retries

**Idempotency**: Service checks current status before applying transitions. Processing the same webhook twice is safe.

**Testing locally**:

```bash
# Trigger mock checkout completion
curl -X POST http://localhost:4000/api/v1/billing/mock/checkout/$SESSION_ID/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planName":"PRO","planInterval":"month"}'
```

**Re-triggering webhooks**: Use Stripe Dashboard → Developers → Events → Resend (or Stripe CLI `listen`)

## Analytics & Metrics

### Event Ingestion

**Endpoint**: `POST /api/v1/analytics/events`

**Event payload key**: `eventType`

**Supported event types**:
- `PAGE_VIEW`
- `PORTFOLIO_VIEW`
- `PROFILE_CLICK`
- `PACKAGE_VIEW`
- `WHATSAPP_CLICK`
- `BOOKING_INTENT`
- `PORTFOLIO_SHARE`
- `SERVICE_SELECT`
- `PACKAGE_SELECT`
- `SEARCH`
- `FILTER`
- `OTHER`

**`metadata.kind` taxonomy (`eventType = OTHER`)**:
- `analytics_upgrade_cta`: upgrade CTA interactions from analytics surfaces.
- `analytics_insight_action_click`: quick-action clicks from actionable insight cards.

**`analytics_insight_action_click` metadata.action values**:
- `improve_portfolio_experience`
- `refine_service_setup`
- `optimize_packages`

**Batch format**:

```json
{
  "events": [
    {
      "eventType": "PAGE_VIEW",
      "photographerId": "uuid",
      "timestamp": "2026-03-30T15:00:00Z",
      "metadata": { "page": "/services" }
    }
  ]
}
```

### Rollup Tables

Analytics Worker aggregates events into 3 rollup tables:

- `AnalyticsEventDaily`: One row per photographer per day
- `AnalyticsServiceDaily`: One row per service per day
- `AnalyticsVisitorDaily`: One row per visitor per day

**Rollup schedule**: Runs periodically (configurable via `ANALYTICS_ROLLUP_INTERVAL_MS`)

**Dashboard caching**: Admin storage overview caches R2 size for 60 seconds.

## Asset Lifecycle

### Upload Flow

1. Client calls `POST /api/v1/upload/presign` → Gets S3 PutObject URL
2. Client uploads to R2 directly
3. Client calls `POST /api/v1/upload/complete` → Asset marked READY
4. Asset is optimized (sharp ImageProcessingQueue job)
5. Asset is cached for web/thumbnail

### Purge Flow

**Asset cleanup worker** runs every 1 hour (configurable):

1. Find assets with status `DELETED` and `deletedAt > 24 hours ago`
2. Check reference count (used as avatar, banner, portfolio item, service thumbnail)
3. If count = 0: Delete from R2
4. Mark asset status as `PURGED` in database

**Reference counting** (critical):

```sql
-- Check if an asset is still referenced
SELECT COUNT(*) FROM "Asset" WHERE id = $assetId AND (
  id IN (SELECT "avatarAssetId" FROM "Photographer" WHERE "avatarAssetId" IS NOT NULL)
  OR id IN (SELECT "bannerAssetId" FROM "Photographer" WHERE "bannerAssetId" IS NOT NULL)
  OR id IN (SELECT "portfolioItemId" FROM "PortfolioItem" WHERE "portfolioItemId" IS NOT NULL)
  OR id IN (SELECT "thumbnailAssetId" FROM "Service" WHERE "thumbnailAssetId" IS NOT NULL)
);
```

**Storage quota**:

- FREE: 1 GB
- PRO: 50 GB  
- STUDIO: 500 GB

Quota is enforced at upload time (presign endpoint checks storage.used + newFileSize <= plan.storageLimit).

## Billing & Subscriptions

### Subscription Lifecycle

1. **Payment initiated**: User checks out → Stripe creates checkout session
2. **Payment captured**: Webhook → creates Transaction + Subscription (INCOMPLETE)
3. **Payment confirmed**: Webhook → Subscription → TRIALING or ACTIVE (based on plan)
4. **Active period**: User can use features gated by plan
5. **Renewal**: At period end, auto-renews if payment method valid
6. **Past due**: If payment fails → PAST_DUE (7-day grace period), can still use features
7. **Expired**: If unpaid after grace → CANCELED
8. **Resumed**: User can resume via `POST /api/v1/billing/subscription/resume`

### Billing Maintenance Job

Runs every 15 minutes, processes up to 500 subscriptions per run.

**Tasks**:
- Mark PAST_DUE if current period ended and no new payment
- Mark CANCELED if past due grace period expired
- Reconcile subscription status from provider
- Retry failed webhooks (transient errors)

**Monitoring**:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://app.example.com/api/v1/admin/subscriptions/overview
```

Expected response includes:
- Total active/past_due/canceled counts
- Revenue metrics
- Plan distribution

## Moderation & Admin

### User Suspension

**Admin endpoint**: `PATCH /api/v1/admin/photographers/:id/status`

**Suspension side effects** (implemented in [adminPhotographerStatusSideEffects.test.js](../backend/tests/adminPhotographerStatusSideEffects.test.js)):

1. User status → SUSPENDED
2. All assets marked FLAGGED (auto-removed from public)
3. No further billing charges
4. Portfolio becomes inaccessible
5. Photographer can appeal (stored in audit logs)

### Asset Flagging

**Endpoint**: `PATCH /api/v1/admin/moderation/flagged-images/:imageReportId`

**Context**: Photographer images can be flagged for violations.

**Actions**:
- `REVIEW`: Manual assessment pending
- `APPROVED`: Image is acceptable, remove flag
- `REMOVE`: Force remove from portfolio immediately

## Monitoring Checklist

### Daily Health Checks

```bash
# 1. API health
curl https://app.example.com/health
# Should return 200 with version, uptime

# 2. Worker health
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://app.example.com/api/v1/admin/system/worker-health
# All workers should show "online" status

# 3. Database connectivity
# Keep eye on connection pool via logs (Sentry dashboard)

# 4. Queue depth
# Check Redis: LLEN bull:email-queue
# Should be small (<100) under normal load

# 5. Error rate
# Check Sentry dashboard for 5xx errors
# Should be <0.1% of requests
```

### Critical Alerts to Set Up

| Metric | Threshold | Severity | Action |
|--------|-----------|----------|--------|
| API 5xx error rate | >1% | Critical | Page on-call, check logs |
| Worker offline | Any worker down >5m | High | Check Redis, restart worker |
| Database connection pool | >95% in use | High | Check for slow queries, scale if needed |
| Queue backlog | >1000 jobs | Medium | Check worker concurrency, add worker instance |
| Webhook failures | >10% failed | Medium | Check external provider status |
| Disk space | <10% free | Critical | Scale storage or archive old backups |

## Incident Response

### Scenario: Billing Stops Processing

1. Check worker health: `curl /api/v1/admin/system/worker-health`
2. If `billing-maintenance` is offline: restart it
3. Check Redis connectivity: `redis-cli PING`
4. Check Stripe status page for outages
5. Check database logs for errors (Sentry)
6. If transient: wait for automatic retry (exponential backoff)
7. If stuck: manually trigger billing maintenance (run `npm run worker:billing-maintenance` once)

### Scenario: Emails Not Sending

1. Check worker: `curl /api/v1/admin/system/worker-health`
2. If queue is disabled (no Redis): emails fallback to inline (slow but works)
3. Check Resend API key: verify it's set and still valid
4. Check logs: search for RESEND errors in Sentry
5. Manually resend: Admin endpoint with email queue replay (Needs confirmation)

### Scenario: Image Uploads Failing

1. Check R2 credentials: verify `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
2. Check R2 bucket: does it exist? Does it have public permissions?
3. Check storage quota: user may have exceeded plan limit
4. Check image processing worker: if it's offline, images stay in PENDING state

### Scenario: Custom Domain Stops Resolving

1. Verify DNS records are correct (CNAME to `domains.lensaya.app`)
2. Test with `nslookup custom-domain.example.com`
3. Check CUSTOM_DOMAIN_VERIFICATION_MODE: should be `dns` in production
4. Check webhook can reach app: `curl https://custom-domain.example.com/health`
5. If Stripe webhooks can't reach app via custom domain, billing will fail

### Scenario: High Database Load / Slow Queries

1. Check connection pool usage: `SELECT * FROM pg_stat_activity;`
2. Identify slow queries: Enable `log_min_duration_statement = 1000` in PostgreSQL
3. Check for N+1 queries in Sentry (search for "SELECT" spam)
4. Scale read replicas if available
5. Check if parity test is being run in production (would spike analytics rollups)

## Performance Tuning

### Database Connection Pool

Defaults work for small deployments. For high concurrency:

```bash
DATABASE_POOL_MAX_API=20         # Increase if seeing "pool exhausted" errors
DATABASE_POOL_MAX_WORKER=10      # Increase if workers are queued
DATABASE_POOL_IDLE_TIMEOUT_MS=60000   # Close idle connections faster (60s)
```

### Queue Concurrency

```bash
QUEUE_CONCURRENCY=10             # Default 5; increase for high throughput
```

Also set concurrency per worker:

```javascript
// In worker files, e.g., emailWorker.js
const worker = new Worker(EMAIL_QUEUE_NAME, processor, {
  connection: redis,
  concurrency: 10,  // Parallel email jobs
});
```

### Analytics Aggregation

If analytics are slow to compute:

```bash
ANALYTICS_ROLLUP_INTERVAL_MS=300000  # Aggregate less frequently (5 min interval)
```

### Billing Maintenance

For large photographer counts:

```bash
BILLING_MAINTENANCE_BATCH_SIZE=1000  # Process more per run
BILLING_MAINTENANCE_INTERVAL_MS=300000  # Run more frequently
```

## Disaster Recovery

### Database Corruption

1. Restore from most recent backup: `npm run restore:postgres:snapshot`
2. Apply migrations: `npm run prisma:migrate:deploy`
3. Verify data integrity: Check row counts in key tables

### Complete Data Loss

1. All backups also lost: Redeploy from staging database backup (if available)
2. Recreate schema: `npm run prisma:migrate:deploy`
3. Reseed demo data: `npm run seed:demo:lensaya` (if available)

### Ransomware / Malicious Access

1. Shut down all API servers immediately
2. Revoke all API keys (Stripe, R2, Resend, Google OAuth)
3. Restore database from backup taken before compromise
4. Rotate JWT_SECRET
5. Audit all admin logs (AdminLog table) for suspicious activity
6. Restart infrastructure with new credentials

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing (`npm test`)
- [ ] Migrations generated: `npm run prisma:migrate`
- [ ] Env vars configured: DATABASE_URL, JWT_SECRET, STRIPE_*, R2_*, etc.
- [ ] CORS origins configured: `CORS_ORIGINS` includes production domain
- [ ] Custom domain verification mode set: `CUSTOM_DOMAIN_VERIFICATION_MODE=dns`
- [ ] Cookie security enabled: `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=none`
- [ ] Sentry DSN configured: `SENTRY_DSN`
- [ ] Workers started: all 6 worker processes running
- [ ] Backup script scheduled: `database/scripts/register-daily-backup-task.ps1` (Windows) or cron job (Linux)
- [ ] Monitoring alerts set up: error rates, worker health, disk space
- [ ] Load balancer health check configured: `GET /health` should return 200
- [ ] Secrets stored securely: no env vars in git, use secrets manager

## Source References

- Worker implementations: [backend/src/workers/](../backend/src/workers/)
- Queue definitions: [backend/src/jobs/](../backend/src/jobs/)
- Billing service: [backend/src/services/billingService.js](../backend/src/services/billingService.js)
- Backup scripts: [backend/scripts/backup-*.js](../backend/scripts/)
- Admin health endpoint: [backend/src/routes/adminRoutes.js](../backend/src/routes/adminRoutes.js)
- Monitoring: [backend/src/jobs/workerHeartbeat.js](../backend/src/jobs/workerHeartbeat.js)
