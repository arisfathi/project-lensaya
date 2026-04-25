# Billing UI IA Map (Stripe-first)

This document is a UI information-architecture (IA) map for subscription + payments in Lensaya, aligned to the current codebase routes/components and the current billing API contracts.

As of **April 21, 2026**, Lensaya routes users through **Stripe** for subscription checkout and billing management (Customer Portal) and uses Stripe webhooks for billing state synchronization. A `mock` provider is kept for local/dev flows.

---

## 1) Surfaces (Routes → Pages)

Source of truth:
- Frontend routes: `frontend/src/routes.tsx`, `frontend/src/routes.paths.ts`, `frontend/src/routes.lazy.ts`
- Billing UI pages: `frontend/src/pages/Pricing.tsx`, `frontend/src/pages/dashboard/Pricing.tsx`, `frontend/src/pages/dashboard/Transactions.tsx`

### Public (marketing host)

| Surface | Route | Component | Purpose |
|---|---|---|---|
| Public pricing | `/pricing` | `frontend/src/pages/Pricing.tsx` | Plans, billing-cycle toggle, plan comparison, FAQs, CTA to signup/dashboard pricing |
| Help Center | `/help-center` | `frontend/src/pages/HelpCenter.tsx` | Published CMS markdown entries (recommended place to publish billing FAQs) |

### Photographer app (platform app host)

| Surface | Route | Component | Purpose |
|---|---|---|---|
| Dashboard pricing | `/dashboard/pricing` | `frontend/src/pages/dashboard/Pricing.tsx` | Upgrade/downgrade flow (calls `/billing/change-plan`) + shows pending changes |
| Billing Center (transactions) | `/dashboard/transactions` | `frontend/src/pages/dashboard/Transactions.tsx` | Subscription state, notices, “Open Billing Center” (Stripe portal), and transaction history |
| Settings billing summary (card) | `/dashboard/settings` | `frontend/src/pages/dashboard/settings/components/BillingOverviewCard.tsx` | “quick actions” shortcuts to pricing, transactions, and Stripe portal |

### Admin (platform admin host)

| Surface | Route | Component | Purpose |
|---|---|---|---|
| Subscriptions & plans | `/admin/subscriptions` | `frontend/src/pages/admin/Subscriptions.tsx` | Plan pricing/limits config, public pricing content, subscription stats & changes |

---

## 2) Backend/API Contract Map (what UI calls)

Source of truth:
- Frontend client: `frontend/src/lib/api/billing-subscriptions.ts`
- Backend routes: `backend/src/routes/billingRoutes.js`
- Backend controller: `backend/src/controllers/billingController.js`

### Plan catalog (public + dashboard)

- `GET /billing/plans`
  - Used by: public pricing (`/pricing`), dashboard pricing (`/dashboard/pricing`), admin plans config (`/admin/subscriptions`)
  - Notes:
    - `trialDays`, `pricing.monthly/yearly`, `limits`, `isMostPopular`, `isVisible`, `isActive` drive UI rendering.

### Subscription state (dashboard)

- `GET /billing/subscription`
  - Used by: billing center (`/dashboard/transactions`), dashboard pricing (`/dashboard/pricing`), settings billing card
  - Includes: `plan`, `billingCycle`, `billingState`, `pendingChange`, `cancelAtPeriodEnd`, `trialEndsAt`, `graceEndsAt`, `provider`.

### Plan changes (upgrade/downgrade/renew)

- `POST /billing/change-plan`
  - Used by: dashboard pricing CTA, billing center “Renew now”
  - Returns:
    - `action: "checkout_required" | "changed" | "unchanged"`
    - `checkoutUrl` when payment must happen via provider checkout.

### Cancellation & resume

- `POST /billing/subscription/cancel` (payload includes `atPeriodEnd`)
- `POST /billing/subscription/resume`

### Stripe Customer Portal

- `POST /billing/portal-session` (payload includes `returnUrl`)
  - Used by: billing center + settings quick action
  - Expected behavior: redirect user to Stripe portal; Stripe returns to `returnUrl`.

### Transactions list

- `GET /billing/transactions` (supports `status`, `page`, `limit`)
  - Used by: billing center (`/dashboard/transactions`)

### Webhooks (Stripe)

- `POST /billing/webhook` (alias: `POST /webhooks/payments`)
  - Signature verification: `stripe-signature` + raw body required (see `backend/src/controllers/billingController.js`)

---

## 3) Canonical UI State Model (what screens must support)

Source of truth:
- Billing state resolution: `backend/src/services/billingService.js`

### Plan tiers

- `FREE`, `PRO`, `STUDIO`

### Billing cycle (interval)

- `monthly` / `yearly`

### Billing state (frontend-facing)

From `billingService.resolveBillingState()`:
- `free` (free plan / no paid cycle)
- `active`
- `trialing`
- `past_due` (includes incomplete)
- `cancelled` (cancel-at-period-end, canceled)
- `downgraded` (free plan after an ended paid cycle)
- `expired`

### Pending changes

From `subscription.pendingChange`:
- `{ type: "plan_change", plan, billingCycle, effectiveAt }`
- `{ type: "cancellation", plan: "FREE", billingCycle: null, effectiveAt }`

### Transaction statuses (history filters)

- `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `CANCELED`

---

## 4) Screen Inventory (what to design + what each must contain)

This is the “deliverables list” for a UI/UX agent. Items marked **(existing)** already exist in code; items marked **(recommended)** are standard SaaS add-ons that fit Lensaya’s architecture.

### Public pricing (`/pricing`) **(existing)**

Must support:
- Monthly/yearly toggle (show annual discount copy)
- Plan cards (badge: most popular, CTA)
- Comparison table (limits/features)
- Pricing FAQ block (content from pricing content utilities)
- CTA behavior:
  - Guest → `/signup?redirect=/dashboard/pricing` (paid) or `/signup?redirect=/dashboard` (free)
  - Authenticated → `/dashboard/pricing`

### Dashboard pricing (`/dashboard/pricing`) **(existing)**

Must support:
- Current plan badge + current billing cycle defaulting from subscription
- Upgrade/downgrade actions via `POST /billing/change-plan`
- Pending change notice (plan_change / cancellation)
- Return from checkout UX (`/checkout/success` and `/checkout/canceled`)
- Limit/feature comparison rows that match backend `limits` keys

### Billing Center / Transactions (`/dashboard/transactions`) **(existing)**

Must support:
- Subscription overview (plan, billing cycle, next renewal, status)
- Notices:
  - past_due grace period (show `graceEndsAt`)
  - pending change
  - cancel-at-period-end messaging
- Primary actions:
  - Open Stripe portal (`POST /billing/portal-session`)
  - Renew now (forces checkout if needed)
  - Resume auto-renew
  - Schedule cancellation at period end
- Transaction history table:
  - search/filter by status
  - pagination
  - receipts/links when available

### Settings billing card (`/dashboard/settings`) **(existing)**

Must support:
- Compact “plan snapshot” + payment status tone
- Quick actions: change plan, view transactions, open portal

### Help Center billing FAQ (`/help-center`) **(existing container, recommended content)**

Recommended IA inside CMS entries (publish as separate Help Center items):
- “Billing basics”
- “Free trials”
- “Upgrades/downgrades & proration”
- “Invoices & receipts”
- “Failed payments & grace period”
- “Cancellations & refunds”
- “Taxes / billing address (if enabled later)”

Dedicated quick-link page:
- `/help/billing` → `frontend/src/pages/BillingHelp.tsx`

### Checkout success/canceled pages **(recommended)**

Legacy pattern: Lensaya previously used `?checkout=...` on return URLs. The current implementation uses dedicated return pages.

Dedicated pages are now available (designer-friendly):
- `/checkout/success` → `frontend/src/pages/dashboard/CheckoutSuccess.tsx`
- `/checkout/canceled` → `frontend/src/pages/dashboard/CheckoutCanceled.tsx`

---

## 5) Standard “Stripe-first” SaaS flow (Lensaya-compatible)

### Acquisition → upgrade

1. User sees `/pricing` → selects paid plan
2. User lands on `/dashboard/pricing`
3. CTA calls `POST /billing/change-plan`
4. If `action === "checkout_required"` → redirect to `checkoutUrl`
5. Stripe sends webhook → backend updates subscription/transactions
6. User returns to `successUrl` (currently query-param based) → UI refreshes via `GET /billing/subscription`

### Self-serve billing management

- In-app shows subscription + invoices, but “source of truth” actions are in Stripe portal:
  - Update card
  - Download invoices/receipts (if configured)
  - Cancel/resume (if allowed)

Lensaya entrypoint: `POST /billing/portal-session` → redirect.

---

## 6) Gaps / optional wiring to confirm before UI redesign

These are implementation details that affect UI planning (not design):
- There is a dev-only UI file `frontend/src/pages/dashboard/MockCheckout.tsx` but it is not currently routed in `frontend/src/routes.tsx`. If you intend to keep mock checkout UX, add a route (dev-only) that matches `BILLING_MOCK_CHECKOUT_PATH`.
- In production, prefer `BILLING_PROVIDER=stripe` with Stripe Price IDs (`STRIPE_PRICE_ID_*`) configured for standard SaaS billing.
