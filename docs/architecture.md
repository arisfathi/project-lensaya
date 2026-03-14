# Lensaya SaaS Architecture

Lensaya is a multi-tenant photographer platform:

- Public tenant site: `username.lensaya.com`
- Photographer portal: `app.lensaya.com`
- Platform admin: `admin.lensaya.com`
- Marketing: `lensaya.com`

## Core Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma
- Media: Cloudflare R2 + Cloudflare CDN
- Auth: Google OAuth + JWT cookies
- Payments: CHIP API

## Infrastructure Features

- Sharp image optimization + thumbnail generation
- Plan-aware watermark pipeline
- Public analytics tracking and referral attribution
- CHIP checkout + webhook payment reconciliation
- Route-level and global rate limiting
- Structured request/application logging (console + file)
- Daily PostgreSQL backup workflow
- R2 backup manifest generation strategy
- SEO auto-generation per photographer site
- Public photographer directory API

## Service Layers

- `middleware`: auth, tenant resolution, rate limits, request logging, error handling
- `routes`: auth, dashboard, admin, public, uploads, billing
- `controllers`: request orchestration, input/output shaping
- `services`: business logic (analytics, billing, SEO, image processing, plans)
- `utils`: host parsing, cache, logging, helpers
- `db`: Prisma client adapter

## Data Model Summary

- `users`: identities and roles (`admin`/`photographer`)
- `photographers`: tenant workspace and subdomain metadata
- `plans` + `plan_limits`: SaaS pricing and feature flags
  - user-facing capacity is photo-first (`maxPortfolioImages`)
  - `maxPackages` is enforced per service (not account-wide)
  - storage is enforced as backend safety guardrails
- `services`, `packages`, `photos`, `portfolio_categories`, `availability`
- `page_views`, `referrals`: traffic + attribution
- `payments`: CHIP payment lifecycle
- `seo_settings`, `theme_settings`: branding + metadata controls

## Scalability Baseline

Current design targets support for at least:

- 10,000 photographers
- 100,000 images

Implemented baseline strategy:

- indexed PostgreSQL access paths for tenant/public queries
- pagination and bounded limits on list endpoints
- short-TTL caching for high-traffic public site + directory reads
- lightweight analytics write path (single page view insert + referral upsert)
- rate limiting and request logging across all API surfaces
