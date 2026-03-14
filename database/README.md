# Database Bootstrap (PostgreSQL + Prisma)

Lensaya uses PostgreSQL with Prisma migrations as the source of truth.

## Local Setup

1. Create a PostgreSQL database (example: `lensaya`).
2. Set `DATABASE_URL` in [`backend/.env.example`](/c:/portfolio dev/project lensaya/backend/.env.example).
3. Run migrations from `backend`:

```bash
npm run prisma:generate
npm run prisma:migrate
```

## Files

- `init.sql` - optional base SQL for DB bootstrap (extensions, defaults)
- `seeds/seed.sql` - optional starter seed rows for local previews
- `scripts/run-daily-backup.ps1` - runs DB dump + R2 manifest backup workflow
- `scripts/register-daily-backup-task.ps1` - registers Windows daily scheduled task

## Backup Workflow

Run from `backend/`:

```bash
npm run backup:postgres
npm run backup:r2manifest
npm run backup:daily
```
