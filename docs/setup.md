# Local Setup Guide

This guide is for a new developer starting Lensaya locally.

## Prerequisites

- Node.js 20+ (recommended for modern ESM and tooling)
- npm
- PostgreSQL
- Optional but recommended: Redis
- Optional: pg_dump client tools (for DB backup script)

## 1) Clone And Install

From repo root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

## 2) Configure Environment

## Backend

Create backend/.env from backend/.env.example and set at minimum:
- DATABASE_URL
- JWT_SECRET

Recommended for local:
- PORT=4000
- APP_URL=http://localhost:5173
- PUBLIC_APP_URL=http://localhost:5173
- CORS_ORIGINS includes localhost host variants

If testing queue workers:
- REDIS_URL

If testing uploads:
- R2_ACCOUNT_ID
- R2_ACCESS_KEY_ID or R2_ACCESS_KEY
- R2_SECRET_ACCESS_KEY or R2_SECRET_KEY
- R2_BUCKET

If testing billing webhooks:
- CHIP_WEBHOOK_SECRET

## Frontend

Check frontend/.env values, especially:
- VITE_API_URL=http://localhost:4000/api/v1
- VITE_API_BASE_URL=/api/v1
- VITE_BACKEND_ORIGIN=http://localhost:4000
- VITE_GOOGLE_CLIENT_ID (optional)

Source hints:
- backend/.env.example
- backend/src/config/env.js
- frontend/.env

## 3) Database Bootstrap

From backend:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Optional demo seed:

```bash
npm run seed:demo:lensaya
```

Source hints:
- backend/package.json
- backend/prisma.config.ts
- backend/scripts/seed-lensaya-demo.js

## 4) Start Applications

Terminal A (backend):

```bash
cd backend
npm run dev
```

Terminal B (frontend):

```bash
cd frontend
npm run dev
```

## 5) Start Workers (Optional For Full Behavior)

Each in separate terminal from backend:

```bash
npm run worker:analytics
npm run worker:image
npm run worker:email
npm run worker:notification
npm run worker:asset-cleanup
npm run worker:billing-maintenance
```

Without Redis, worker processes will disable themselves; some queue operations can fallback inline in non-production.

## 6) Verify Health

- API health: GET http://localhost:4000/health
- Frontend: http://localhost:5173

Optional host-mode previews in frontend:
- http://localhost:5173/?previewHost=app.lensaya.com
- http://localhost:5173/?previewHost=admin.lensaya.com
- http://localhost:5173/?previewHost=username.lensaya.com

Source hints:
- frontend/README.md
- frontend/src/lib/platform.ts

## 7) Run Tests

From backend:

```bash
npm test
```

Run a focused suite:

```bash
npm test -- tests/authAndPortfolioFlow.test.js
```

## 8) Backup And Restore Utilities

From backend:

```bash
npm run backup:postgres
npm run backup:r2manifest
npm run backup:daily
```

Restore snapshot:

```bash
npm run restore:postgres:snapshot -- path/to/snapshot.json
```

Windows scheduled backup helper scripts:
- database/scripts/register-daily-backup-task.ps1
- database/scripts/run-daily-backup.ps1

## Common First-Run Issues

## Missing env var: DATABASE_URL or JWT_SECRET

- Cause: backend/src/config/env.js hard requirement
- Fix: set both in backend/.env

## Prisma schema compatibility error on startup

- Cause: migrations not applied
- Fix: run npm run prisma:migrate (or deploy migration path)

## Redis warnings and disabled workers

- Cause: REDIS_URL unset
- Fix: set REDIS_URL and start workers
- Note: some operations still work with inline fallback in development

## Upload or avatar operations fail with R2 config error

- Cause: missing R2 credentials/bucket
- Fix: configure R2_* env values

## Billing webhook returns webhook secret not configured

- Cause: missing CHIP_WEBHOOK_SECRET (or Stripe secret for Stripe path)
- Fix: set correct webhook secret and retry

## Public host routes blocked with 421

- Cause: non-public API route called from public host context
- Fix: use app/admin host for workspace endpoints, keep public host for /public endpoints only

## Needs Confirmation

- Team preference for local host strategy (raw localhost vs subdomain mapping) is not standardized in repo docs.
- Preferred local seed baseline beyond demo seed (only one explicit seed script is present).
