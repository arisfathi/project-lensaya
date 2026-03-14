# Lensaya

Foundational architecture for a multi-tenant photographer SaaS platform.

## Domains

- `lensaya.com` - marketing site
- `app.lensaya.com` - photographer dashboard
- `admin.lensaya.com` - admin panel
- `username.lensaya.com` - tenant photographer website

For local frontend development with Vite:

- `http://localhost:5173` - marketing site
- `http://app.localhost:5173` - photographer dashboard
- `http://admin.localhost:5173` - admin panel
- `http://aris.localhost:5173` (or any seeded username) - tenant photographer website

## Stack

- React frontend
- Node.js + Express backend
- PostgreSQL + Prisma ORM
- Cloudflare R2 object storage
- Cloudflare CDN delivery
- Google OAuth authentication

## Infrastructure Features

- Sharp image optimization + watermark processing pipeline
- Public analytics tracking + referral attribution
- CHIP billing integration (checkout + webhook)
- API rate limiting and structured request logging
- SEO auto-generation for public photographer pages
- Public photographer directory endpoint + marketing preview
- Daily PostgreSQL dump workflow + R2 backup manifest generation

## Getting Started

1. Configure environment files:
   - `backend/.env` from `backend/.env.example`
   - `frontend/.env` from `frontend/.env.example`
2. Install dependencies in each app:
   - `cd backend && npm install`
   - `cd frontend && npm install`
3. Initialize Prisma:
   - `cd backend && npm run prisma:generate`
   - `cd backend && npm run prisma:migrate`
4. Run apps:
   - `cd backend && npm run dev`
   - `cd frontend && npm run dev`
5. Run background workers (separate terminals):
   - `cd backend && npm run worker:image`
   - `cd backend && npm run worker:analytics`
   - `cd backend && npm run worker:email`
   - `cd backend && npm run worker:notification`
   - `cd backend && npm run worker:asset-cleanup`
   - `cd backend && npm run worker:billing-maintenance`

## Backup Commands

- `cd backend && npm run backup:postgres`
- `cd backend && npm run backup:r2manifest`
- `cd backend && npm run backup:daily`
