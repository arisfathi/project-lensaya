# Lensaya

Lensaya is a multi-tenant photographer platform with:
- Public photographer websites and marketing pages
- Photographer workspace for portfolio/services/packages/bookings/analytics
- Admin panel for subscriptions, moderation, storage, referrals, and operations

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + Zod validation
- Database: PostgreSQL + Prisma
- Storage: Cloudflare R2 (S3-compatible)
- Queue/Workers: BullMQ + Redis
- Billing: CHIP integration with Stripe-compatible webhook path support

## Repository Structure

- backend
  - Express API, Prisma schema/migrations, workers, scripts, tests
- frontend
  - Host-aware React app for public/app/admin surfaces
- database
  - DB bootstrap notes and backup scheduler scripts
- docs
  - Developer documentation (setup, architecture, API, deployment, business rules, database)

## Quick Start

1. Install dependencies:

  cd backend
  npm install

  cd ../frontend
  npm install

2. Configure environment:
- Create backend/.env from backend/.env.example
- Verify frontend/.env API URL values

3. Initialize DB (from backend):

  npm run prisma:generate
  npm run prisma:migrate

4. Start apps:

  terminal 1:
  cd backend
  npm run dev

  terminal 2:
  cd frontend
  npm run dev

5. Optional worker processes (backend):

  npm run worker:analytics
  npm run worker:image
  npm run worker:email
  npm run worker:notification
  npm run worker:asset-cleanup
  npm run worker:billing-maintenance

6. Run backend tests:

  cd backend
  npm test

## Main Commands

Backend:
- npm run dev
- npm run start
- npm run test
- npm run prisma:migrate
- npm run prisma:migrate:deploy
- npm run seed:demo:lensaya
- npm run backup:postgres
- npm run backup:r2manifest
- npm run backup:daily

Frontend:
- npm run dev
- npm run build
- npm run preview

## Where To Look First

- Backend app bootstrap: backend/src/app.js
- API routes: backend/src/routes
- Core photographer facade and domain services:
  - backend/src/services/photographerService.js
  - backend/src/services/photographer
- Prisma schema: backend/prisma/schema.prisma
- Frontend route map: frontend/src/routes.tsx
- Frontend API layer: frontend/src/lib/api

## Documentation Map

- docs/setup.md
- docs/architecture.md
- docs/api.md
- docs/business-rules.md
- docs/database.md
- docs/deployment.md

Additional docs currently present but not yet fully populated:
- docs/testing.md
- docs/troubleshooting.md
- docs/env.md
- docs/operations.md

## Current Status Notes

- Backend tests are green in the latest checkpoint (131/131).
- Photographer service refactor wave has landed with a thin facade and domain modules.
- Portfolio extraction remains optional and should be evaluated against current feature priorities.
