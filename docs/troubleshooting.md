# Troubleshooting Guide

Common issues and their solutions when developing Lensaya locally or in production.

## Setup & Environment Issues

### Error: "Missing required env var: DATABASE_URL"

**Symptom**: Backend fails to start with this error message.

**Cause**: The `.env` file is missing or doesn't have `DATABASE_URL` set. This is checked at import time in [backend/src/config/env.js](../backend/src/config/env.js).

**Fix**:
1. Create `backend/.env` (copy from `.env.example` if it exists)
2. Set `DATABASE_URL=postgresql://username:password@localhost:5432/lensaya?schema=public`
3. Restart the backend server

### Error: "Missing required env var: JWT_SECRET"

**Symptom**: Backend fails with this error.

**Cause**: JWT_SECRET is required for token signing/verification.

**Fix**:
```bash
# In backend/.env, add a value (for local dev, any string works):
JWT_SECRET=your-local-secret-key-here
```

For production, use a strong random string (e.g., `openssl rand -base64 32`).

### Error: "pg_dump binary not found"

**Symptom**: Running `npm run backup:postgres` fails with this message.

**Cause**: PostgreSQL client tools aren't installed.

**Fix** (Windows):
1. Install PostgreSQL (includes pg_dump)
2. Add PostgreSQL `bin/` directory to PATH
3. Or set `PG_DUMP_BIN` env var to explicit path (e.g., `C:\Program Files\PostgreSQL\15\bin\pg_dump.exe`)

**Fix** (macOS):
```bash
brew install postgresql
```

**Fix** (Linux):
```bash
sudo apt-get install postgresql-client
```

### Error: "Redis is disabled because REDIS_URL is not configured"

**Symptom**: Workers don't start; queue operations fail silently.

**Cause**: `REDIS_URL` is not set. Queue/worker functionality falls back to inline processing.

**Behavior**:
- Email jobs are sent inline (synchronous) instead of queued
- Analytics workers still process but without queue persistence
- Asset cleanup runs on a local timer instead of queue schedule

**Fix** (for local dev, if you don't need queues):
- This is OK! The fallback keeps things working.
- If you need queue testing, set `REDIS_URL=redis://localhost:6379`

**Fix** (to use Redis):
```bash
# Start Redis locally (Docker)
docker run -d -p 6379:6379 redis:7

# Add to backend/.env
REDIS_URL=redis://localhost:6379
```

## Database Issues

### Error: "relation "User" does not exist"

**Symptom**: Backend queries fail with this PostgreSQL error.

**Cause**: Migrations haven't been run. Database schema is empty.

**Fix**:
```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

If you're asked for a migration name, enter something like `manual_init`.

### Error: "ECONNREFUSED localhost:5432"

**Symptom**: Backend can't connect to database.

**Cause**: PostgreSQL server isn't running or connection string is wrong.

**Fix**:
1. Verify PostgreSQL is running (`psql --version` should work)
2. Check `DATABASE_URL` in `.env` is correct (test connection with psql):
   ```bash
   psql postgresql://postgres:password@localhost:5432/lensaya
   ```
3. Create the database if it doesn't exist:
   ```bash
   createdb lensaya
   ```

### Error: "password authentication failed"

**Symptom**: `psql` or migrations fail with this error.

**Cause**: Wrong database username/password in `DATABASE_URL`.

**Fix**:
```bash
# Check your PostgreSQL user credentials
psql -U postgres  # or whatever user you created
# Then verify they in DATABASE_URL, e.g.:
# DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/lensaya?schema=public
```

### Error: "column \"xyz\" does not exist" after pulling new code

**Symptom**: API fails with "column does not exist" error.

**Cause**: Someone added a database column but migrations haven't been run locally.

**Fix**:
```bash
cd backend
npm run prisma:migrate
```

This applies any pending migrations.

### Error: Stale test database state

**Symptom**: Tests pass locally but fail in CI, or vice versa.

**Cause**: Test database has leftover data from previous runs.

**Fix**:
```bash
# Option 1: Clean and reseed
cd backend
npm run prisma:migrate:reset  # Caution: drops and recreates database

# Option 2: Check test database isolation
# Ensure NODE_ENV=test is set before running tests
npm test
```

## Migration Issues

### Error: "Failed to apply migration"

**Symptom**: `npm run prisma:migrate` fails partway through.

**Cause**: Migration contains SQL that conflicts with existing data or schema.

**Fix**:
1. Check the migration file in `backend/prisma/migrations/` to understand what failed
2. **Option A**: If the migration is optional, skip it and update it
3. **Option B**: If required, fix the underlying data issue, then retry:
   ```bash
   npm run prisma:migrate
   ```
4. **Option C**: If stuck, reset (destroys local data):
   ```bash
   npm run prisma:migrate:reset
   npm run seed:demo:lensaya  # Optional: reseed demo data
   ```

### Error: "Migration lock is held"

**Symptom**: Migrations hang or fail with "migration already in progress" message.

**Cause**: A previous migration process crashed and didn't release the lock.

**Fix**:
```bash
# Force unlock (careful!)
cd backend
npx prisma migrate resolve --rolled-back 20260309074718_init_lensaya_schema
```

(Use the actual migration name from the error message.)

## Authentication Issues

### Error: "invalid token" or "token expired"

**Symptom**: API calls fail with 401 Unauthorized after some time.

**Cause**: JWT token is expired. Default expiry is 15 minutes.

**Fix**:
1. Frontend should auto-refresh tokens using refresh endpoint
2. If manual testing, get a new token by logging in again
3. To change expiry, set `JWT_EXPIRES_IN` env var (e.g., `JWT_EXPIRES_IN=24h`)

### Error: "Invalid Google OAuth"

**Symptom**: Google sign-in button doesn't work or redirects fail.

**Cause**: `GOOGLE_CLIENT_ID` not set or mismatched with frontend config.

**Fix**:
1. Get client ID from Google Cloud Console
2. Add to `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-secret-here
   ```
3. Ensure frontend `index.html` has the same client ID in the Google script tag

### Error: "Access denied" for cross-photographer data

**Symptom**: Photographer A can't view/edit Photographer B's services but gets 403 instead of 401.

**Cause**: Tenant scoping is working (good!), but the error message is confusing.

**Expected behavior**: Tenant middleware blocks access at the Prisma query level. See [tenantIsolation.test.js](../backend/tests/tenantIsolation.test.js).

**To verify**: Check middleware in [backend/src/middleware/tenantContext.js](../backend/src/middleware/tenantContext.js).

## Webhook Issues

### Error: "Webhook signature mismatch" or 401 Unauthorized

**Symptom**: Webhook from payment provider is rejected.

**Cause**: Webhook secret mismatch. The signature verification failed.

**Fix**:
1. For CHIP: Ensure `CHIP_WEBHOOK_SECRET` matches the secret in CHIP dashboard
2. For Stripe: Ensure `STRIPE_WEBHOOK_SECRET` matches the secret in Stripe dashboard
3. In test: Set env var BEFORE importing the webhook handler module (see [chipWebhookSecretOrder.test.js](../backend/tests/chipWebhookSecretOrder.test.js))

### Webhook appears to be processed twice

**Symptom**: Payment appears twice in the database for a single invoice.

**Cause**: Webhook was sent twice by payment provider (common due to retries).

**Expected behavior**: Billing service is idempotent. It checks the current subscription status before applying a transition. See [subscriptionFlow.test.js](../backend/tests/subscriptionFlow.test.js) for verification.

**To debug**:
1. Check database: `SELECT * FROM "Transaction" WHERE id = 'xyz';`
2. Verify only one transaction exists
3. Check the webhook endpoint logs to confirm it was called once (use Sentry)

### Webhook endpoint responds 200 but transaction isn't created

**Symptom**: Payment webhook succeeds (returns 200) but refund/transaction isn't created.

**Cause**: Usually a downstream integration error (email sending, notification service, etc.). Webhook processing is intentionally lenient.

**To debug**:
1. Check Sentry for errors in the webhook handler
2. Check logs for the specific webhook ID
3. Look at [backend/src/controllers/billingController.js](../backend/src/controllers/billingController.js) webhook handler for the flow

## Storage/R2 Issues

### Error: "R2 credentials invalid" or objects won't upload

**Symptom**: Upload preview fails; R2 bucket operations fail.

**Cause**: R2 credentials are missing or incorrect.

**Fix**:
1. Get credentials from Cloudflare dashboard
2. Add to `backend/.env`:
   ```
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=your-access-key
   R2_SECRET_ACCESS_KEY=your-secret-key
   R2_BUCKET=your-bucket-name
   R2_PUBLIC_URL=https://your-bucket.your-account.r2.cloudflarestorage.com
   ```
3. Verify bucket exists and has public read access enabled

### Error: "Asset cleanup is disabled"

**Symptom**: Old deleted assets aren't being removed from R2.

**Cause**: Asset cleanup is controlled by `ASSET_CLEANUP_ENABLED` env var (default: true).

**Fix**:
1. Check if cleanup is truly disabled: `echo $ASSET_CLEANUP_ENABLED`
2. If you want it enabled, ensure it's not set to false:
   ```
   # In backend/.env, either remove this line or set:
   ASSET_CLEANUP_ENABLED=true
   ```
3. Verify Redis is working (cleanup is scheduled via BullMQ)

### Error: "Upload fails with 403 Forbidden"

**Symptom**: User can't upload images.

**Cause**: Usually storage quota exceeded. Check plan limits.

**Debug**:
1. Check user subscription plan: `SELECT * FROM "Subscription" WHERE userId = 'xyz';`
2. Check storage used:
   ```sql
   SELECT SUM(fileSize) as total_bytes FROM "Asset" WHERE photographerId = 'xyz' AND status = 'READY';
   ```
3. Check plan limits in [backend/src/services/planLimitService.js](../backend/src/services/planLimitService.js)

## Redis/Queue Issues

### Error: "Worker is disabled because REDIS_URL is missing"

**Symptom**: Email, analytics, or image processing workers don't start.

**Cause**: REDIS_URL isn't set.

**Behavior**: Workers either fall back to inline processing (email) or skip entirely (analytics/image).

**Fix** (for local dev, optional):
```bash
# Set REDIS_URL to enable queue-based workers
REDIS_URL=redis://localhost:6379
```

### Queue job is stuck / never completes

**Symptom**: A queued job (email, image processing) never completes.

**Cause**: Worker crashed or was never started.

**Fix**:
1. Check if worker is running: `ps aux | grep worker`
2. Start the worker: `npm run worker:email` (in a separate terminal)
3. Check queue status: `npm run worker:analytics` should emit logs
4. If stuck, reset the queue (caution: deletes pending jobs):
   ```bash
   redis-cli DEL "bull:email" "bull:image-processing"
   ```

## Billing/Payment Issues

### Error: "CHIP_BRAND_ID_PRO not configured"

**Symptom**: Checkout fails with 503 Service Unavailable in production.

**Cause**: CHIP brand IDs are required for production billing.

**Fix** (production only):
1. Get brand IDs from CHIP dashboard (one per plan tier)
2. Add to `.env`:
   ```
   CHIP_BRAND_ID_FREE=brand-free-123
   CHIP_BRAND_ID_PRO=brand-pro-456
   CHIP_BRAND_ID_STUDIO=brand-studio-789
   ```
3. Restart backend

### Error: "Billing provider is 'mock'"

**Symptom**: Billing endpoints return mock checkout URLs instead of real payment gateway.

**Cause**: `CHIP_API_KEY` is missing or not configured, so mock mode is enabled.

**Expected behavior** (local dev): This is OK! You can test with mock checkouts at `/dashboard/billing/mock-checkout`.

**To use real billing**:
```bash
# In backend/.env:
CHIP_API_KEY=your-real-api-key
BILLING_PROVIDER=chip
```

### Subscription status is "PAST_DUE" but should be active

**Symptom**: User's plan appears suspended even though payment is current.

**Cause**: A webhook marked subscription past due and it wasn't updated when payment succeeded.

**Fix**:
1. Check subscription in DB: `SELECT status, currentPeriodEnd FROM "Subscription" WHERE userId = 'xyz';`
2. Check if a newer successful payment exists after the past-due date
3. Run billing maintenance job to reconcile (or wait for cron):
   ```bash
   npm run worker:billing-maintenance
   ```

## Analytics Issues

### Error: "Analytics events aren't being ingested"

**Symptom**: Dashboard shows zero events even after user activity.

**Cause**: Analytics worker isn't running or Redis isn't configured.

**Fix**:
1. Start the analytics worker: `npm run worker:analytics` (separate terminal)
2. Ensure `REDIS_URL` is set
3. Check logs for errors

### Metrics show incorrect numbers

**Symptom**: Dashboard overview shows wrong totals or series.

**Cause**: Parity test assumptions have been violated (service logic changed but tests didn't). Or rollup tables are stale.

**Debug**:
1. Run parity tests: `npm test -- tests/adminOverviewParity.test.js`
2. Check if they fail (indicates calculation mismatch)
3. If tests pass but dashboard is wrong, check rollup tables:
   ```sql
   SELECT * FROM "AnalyticsEventDaily" ORDER BY date DESC LIMIT 10;
   ```

## Local Development Issues

### Error: "Cannot find module" or "Cannot import"

**Symptom**: Backend fails with module not found.

**Cause**: Maybe `npm install` wasn't run, or there's a circular import.

**Fix**:
```bash
cd backend
npm install
npm run prisma:generate  # Generate Prisma client
```

### Frontend dev server doesn't reflect code changes

**Symptom**: Change a component but page doesn't update.

**Cause**: Vite dev server might have crashed or cache is stale.

**Fix**:
```bash
cd frontend
npm run dev
# If still stuck:
rm -rf node_modules dist .vite
npm install
npm run dev
```

### "Port 4000 already in use"

**Symptom**: Backend fails to start with "EADDRINUSE" error.

**Cause**: Another process is using port 4000.

**Fix**:
```bash
# Find what's using port 4000
lsof -i :4000

# Kill it (macOS/Linux)
kill -9 <PID>

# On Windows:
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

Or change port:
```bash
PORT=4001 npm run dev
```

## Production Gotchas

### Error: "App URL is required in production"

**Symptom**: Backend fails to start in production.

**Cause**: Missing `APP_URL` or `PUBLIC_APP_URL` env vars.

**Fix**:
```bash
# Both are required in production:
APP_URL=https://app.example.com
PUBLIC_APP_URL=https://example.com
```

### Billing starts failing after setting up custom domain

**Symptom**: Checkout returns 503, then works again after rollback.

**Cause**: Custom domain DNS isn't pointing to the right place; CHIP callbacks can't reach your app.

**Fix**:
1. Verify custom domain DNS records are correct
2. Test: `curl https://your-custom-domain.com/health`
3. Ensure CHIP can reach your `/api/v1/billing/webhook` endpoint

### Workers don't process jobs in production

**Symptom**: Jobs queue up but never execute.

**Cause**: Workers aren't running. Worker processes must be started separately from the main app.

**Fix**:
1. Ensure all workers are running as separate processes:
   - `npm run worker:email`
   - `npm run worker:analytics`
   - `npm run worker:image`
   - `npm run worker:asset-cleanup`
   - `npm run worker:notification`
   - `npm run worker:billing-maintenance`
2. Use process manager (PM2, systemd, etc.) to keep them alive
3. Monitor worker health with `/api/v1/admin/system/worker-health`

## Source References

- Environment configuration: [backend/src/config/env.js](../backend/src/config/env.js)
- Database config: [backend/src/config/prisma.js](../backend/src/config/prisma.js)
- Tenant isolation: [backend/src/middleware/tenantContext.js](../backend/src/middleware/tenantContext.js)
- Billing webhook: [backend/src/controllers/billingController.js](../backend/src/controllers/billingController.js)
- Workers: [backend/src/workers/](../backend/src/workers/)
- Test examples: [backend/tests/](../backend/tests/)
