# CHIP Readiness

Date: 2026-03-14

This document isolates the remaining live-provider assumptions in Lensaya's billing flow and defines the shortest path from mock mode to a production CHIP integration.

## Current Status

What is already complete without live CHIP credentials:
- Mock billing remains the default safe path unless `BILLING_PROVIDER=chip` or a real CHIP API key is configured.
- Admin-configured plans remain the billing source of truth for price, interval, trial days, referral reward, and feature limits.
- Subscription lifecycle rules are implemented internally: immediate upgrades, next-cycle downgrades, cancel at period end, resume before period end, 7-day grace period, downgrade to Free after grace, and no destructive data deletion.
- Billing UI is wired for current plan, billing state, renewal timing, interval, transaction history, pending changes, and receipt placeholders.

## Live-Provider Assumption Audit

### 1. Checkout request shape is still provider-assumed

Current code:
- `backend/src/services/chipService.js`
- `backend/src/services/billingProviderService.js`
- `backend/src/services/billingService.js`

Current assumptions in code:
- Purchase creation is sent to `POST {CHIP_API_BASE_URL}/purchase/`.
- The payload currently sends:
  - `brand_id`
  - `success_redirect`
  - `failure_redirect`
  - `metadata`
  - optional `amount`
  - optional `currency`
- The response is assumed to include `checkout_url` and `id`.

Why this is risky:
- Official CHIP docs describe purchase creation at `POST /purchases/` and show a more structured payload with nested `client` and `purchase.products` data.
- The exact minimum payload Lensaya can use for paid plans needs to be confirmed against the real provider account and real response payloads.

Impact:
- `chipService.createCheckoutSession()` will need final request and response mapping before live launch.

### 2. Webhook verification is currently shaped like shared-secret HMAC, but CHIP docs describe RSA signatures

Current code:
- `backend/src/controllers/billingController.js`
- `backend/src/services/chipService.js`
- `backend/tests/subscriptionFlow.test.js`
- `backend/tests/launchCriticalFlows.test.js`

Current assumptions in code:
- Webhooks require `CHIP_WEBHOOK_SECRET`.
- Signature is read from `x-chip-signature` or `x-signature`.
- Signature verification computes `HMAC-SHA256(rawBody, CHIP_WEBHOOK_SECRET)`.

Why this is risky:
- Official CHIP docs state callback payloads are signed with asymmetric cryptography, sent in `X-Signature`, and verified using an RSA public key.
- The docs point to two public-key sources:
  - `Webhook.public_key` for webhook callbacks
  - `GET /public_key/` for success callback authentication
- This means the current HMAC verification path is not suitable for the documented live callback flow.

Impact:
- Live webhook verification is the primary blocker before production CHIP onboarding.
- Tests that currently generate HMAC signatures will need to be replaced with RSA-signed fixture coverage.

### 3. Webhook payload mapping is intentionally generic, but still based on inferred fields

Current code:
- `backend/src/utils/validationSchemas.js`
- `backend/src/services/billingService.js`
- `backend/tests/launchCriticalFlows.test.js`
- `backend/tests/subscriptionFlow.test.js`

Current assumptions in code:
- The webhook parser expects a top-level or wrapped payload containing fields such as:
  - `id`
  - `transaction_id` or `transactionId`
  - `purchase_id` or `purchaseId`
  - `status`
  - `amount`
  - `currency`
  - `metadata`
- Subscription activation currently relies heavily on metadata such as:
  - `userId`
  - `planDbId`
  - `planId`
  - `planTier`
  - `planPrice`
  - `planInterval`
  - `billingCycle`
  - `referralCode`

Why this is risky:
- Official CHIP docs indicate callback payloads include `event_type` and can deliver a purchase snapshot.
- The exact field names for paid, failed, refunded, canceled, pending, and recurring states need to be validated against real provider payloads.
- If live callbacks omit or rename fields currently inferred by Lensaya, the mapping layer will need adjustment.

Impact:
- We likely need a CHIP-specific payload normalizer between request validation and `billingService.handlePaymentWebhook()`.

### 4. Subscription renewal beyond the first checkout is still internal, not provider-driven

Current code:
- `backend/src/services/billingService.js`
- `frontend/src/pages/dashboard/Transactions.tsx`
- `frontend/src/pages/dashboard/Settings.tsx`

Current assumptions in code:
- Mock mode simulates renewals, failures, and grace handling internally.
- Live mode currently treats provider callbacks as payment lifecycle inputs but does not yet implement a CHIP recurring-token charging workflow.

Why this is risky:
- Official CHIP subscription flows describe recurring token usage through purchase creation plus `POST /purchases/{id}/charge/`.
- If Lensaya wants true auto-renewal on CHIP, the integration will need a provider-driven renewal path instead of relying only on first-checkout logic.

Impact:
- Initial paid checkout can be finished first.
- Fully automated recurring billing may still require a second live pass after the first production payment flow is proven.

### 5. Receipt and invoice handling is placeholder-only today

Current code:
- `backend/src/services/billingService.js`
- `frontend/src/pages/dashboard/Transactions.tsx`

Current assumptions in code:
- Transaction history exposes receipt placeholders.
- No real provider invoice or receipt URL is persisted yet.

Why this is risky:
- Official CHIP docs expose invoice-related fields and invoice actions for purchases.
- The exact purchase response fields available on your account must be confirmed before replacing placeholders.

Impact:
- This is not a blocker for billing activation, but it is unfinished for production polish and support workflows.

## Provider Test Matrix

### A. Checkout creation
- Free plan change to Free without provider checkout.
- First-time Pro monthly checkout returns provider checkout URL.
- First-time Pro yearly checkout returns provider checkout URL.
- First-time Studio monthly checkout returns provider checkout URL.
- First-time Studio yearly checkout returns provider checkout URL.
- Existing Pro monthly to Pro yearly change follows immediate paid upgrade logic.
- Existing Studio yearly to Pro yearly change schedules downgrade for next cycle.
- Trial-enabled plan uses configured trial days and still returns the correct provider flow.
- Checkout creation failure from provider is surfaced cleanly in API and UI.
- Timeout or retryable provider errors do not create duplicate subscriptions.

### B. Redirect handling
- Success redirect returns user to dashboard pricing, settings, or transactions cleanly.
- Failure redirect preserves a usable retry path.
- Cancel redirect preserves current subscription state.
- Public pricing page checkout redirect behaves consistently with dashboard pricing page.

### C. Webhook authenticity and idempotency
- Valid signed webhook is accepted.
- Invalid signature is rejected with no state mutation.
- Replayed callback does not duplicate transactions or subscriptions.
- Out-of-order events do not regress `SUCCEEDED` transactions to weaker states.
- Multiple delivery attempts from CHIP remain idempotent.

### D. Purchase lifecycle mapping
- Paid purchase activates the correct plan and billing interval.
- Failed payment marks transaction failed and, when appropriate, subscription `PAST_DUE`.
- Refund event cancels paid access and transitions the user safely back to Free.
- Cancel event is mapped correctly if CHIP sends a distinct cancellation state.
- Pending or asynchronous states do not prematurely activate access.
- Success callback and webhook payloads are both normalized correctly if both are enabled.

### E. Renewal lifecycle
- Renewal success extends `currentPeriodEnd` correctly for monthly subscriptions.
- Renewal success extends `currentPeriodEnd` correctly for yearly subscriptions.
- Renewal failure starts the 7-day grace period.
- Expired grace period downgrades the account to Free without deleting data.
- Resume before expiry restores active billing correctly.
- Scheduled downgrade executes on next billing cycle only after the paid term ends.

### F. Entitlement enforcement
- Pro limits are enforced after activation.
- Studio limits are enforced after activation.
- Downgrade to Free restricts premium access without deleting data.
- Admin-configured plan changes are reflected in billing and entitlement checks without code changes.
- Referral reward metadata survives paid conversion flow.

### G. Support and finance operations
- Transaction history shows provider reference IDs and final states.
- Real invoice or receipt link is stored when present.
- Admin revenue views still reflect CHIP-backed transactions correctly.
- Provider outages fail safely without partial local activation.

## Final Integration Checklist

### Before credentials are handed over
- Keep `BILLING_PROVIDER=mock` in all normal environments.
- Do not change the mock checkout path or remove mock endpoints.
- Keep current billing lifecycle and entitlement logic unchanged.

### At credential handoff
- Confirm the exact CHIP environment to use first: test or live.
- Add the API key to backend secrets.
- Confirm the final CHIP API base URL for your account.
- Confirm Brand IDs for every paid plan that will use CHIP checkout.
- Decide whether Free should ever create a provider purchase. Current recommendation: no.
- Create or retrieve the CHIP webhook definition for Lensaya.
- Capture the webhook callback URL, subscribed events, and webhook public key.
- Capture one real successful purchase payload and one real failed payload from the provider test environment.

### Implementation pass after credentials arrive
- Replace HMAC webhook verification with RSA signature verification against CHIP public keys.
- Finalize `chipService.createCheckoutSession()` request shape against the real purchase API.
- Add a dedicated CHIP payload normalizer for purchase callbacks.
- Confirm which callback source Lensaya should trust primarily:
  - webhook only
  - success callback plus webhook
  - webhook for final truth, redirect for UX only
- Persist any stable provider purchase IDs and invoice URLs returned by CHIP.
- Expand test coverage using real payload fixtures and signature fixtures.

### Go-live gates
- Test one successful payment in CHIP test mode.
- Test one failed payment in CHIP test mode.
- Test duplicate callback delivery.
- Test refund or cancel handling if your product policy uses it.
- Confirm transaction support logs are sufficient before first live transaction.
- Only then switch `BILLING_PROVIDER=chip` in the target environment.

## Environment Variables and Config Inputs Needed For CHIP

### Already used in code today
- `BILLING_PROVIDER`
  - `mock` or `chip`
- `CHIP_API_KEY`
- `CHIP_API_BASE_URL`
  - current default: `https://gate.chip-in.asia/api/v1`
- `CHIP_SUCCESS_URL`
- `CHIP_CANCEL_URL`
- `CHIP_REQUEST_TIMEOUT_MS`
- `CHIP_MAX_RETRIES`
- `CHIP_RETRY_BASE_DELAY_MS`
- `CHIP_RETRY_MAX_DELAY_MS`
- `CHIP_BRAND_ID_FREE`
- `CHIP_BRAND_ID_PRO`
- `CHIP_BRAND_ID_STUDIO`
- `APP_URL`
- `PUBLIC_APP_URL`

### Currently present but likely wrong for the documented live callback model
- `CHIP_WEBHOOK_SECRET`
  - Current code expects this.
  - Official docs describe public-key verification instead.
  - Treat this as provisional legacy config until live callback verification is rewritten.

### Additional live config Lensaya will likely need once CHIP is connected
- `CHIP_WEBHOOK_ID`
  - if we fetch or reconcile webhook configuration programmatically
- `CHIP_WEBHOOK_PUBLIC_KEY`
  - if we store the webhook-specific RSA public key directly in env or secret storage
- `CHIP_SUCCESS_CALLBACK_PUBLIC_KEY`
  - if we also validate purchase success callbacks separately from webhooks
- `CHIP_WEBHOOK_EVENTS`
  - optional config if we want deployment-time validation of required events
- `CHIP_ENVIRONMENT`
  - optional convenience variable for `test` vs `live`

## Webhook Requirements and Expected Signature Handling

### Required routing
- Public POST endpoint reachable by CHIP.
- Current routes:
  - `POST /api/v1/billing/webhook`
  - `POST /api/v1/webhooks/payments`

### Required request handling behavior
- Preserve the exact raw request body bytes before JSON parsing.
- Read `X-Signature` exactly as sent.
- Verify RSA signature against the raw body buffer.
- Reject invalid signatures before any parsing side effects mutate billing state.
- Return a 2xx response only after the event is durably recorded and safely processed or safely deduplicated.

### Expected payload handling model
- Treat CHIP callback payload as provider truth for final payment state.
- Normalize provider payload into Lensaya's internal billing event shape before lifecycle logic runs.
- Do not depend only on browser redirects for plan activation.
- Store enough provider payload data for support and later reconciliation.

### Candidate event coverage to confirm with the real account
- `purchase.paid`
- `purchase.payment_failure`
- `purchase.pending_capture`
- `purchase.captured`
- `purchase.refunded`
- `purchase.created`
- any recurring-token or charge-related events used by CHIP subscription flows

## Areas Likely To Need Adjustment Once Real Responses Are Available

### Backend
- `backend/src/services/chipService.js`
  - final purchase endpoint path
  - final request body shape
  - final response mapping
  - RSA signature verification implementation
- `backend/src/controllers/billingController.js`
  - callback header handling
  - verification prerequisites
- `backend/src/utils/validationSchemas.js`
  - update payload schema to match real callback envelopes and event fields
- `backend/src/services/billingService.js`
  - callback payload normalization
  - recurring renewal logic if CHIP recurring tokens are adopted
  - invoice URL persistence
- `backend/tests/subscriptionFlow.test.js`
- `backend/tests/launchCriticalFlows.test.js`
  - replace HMAC fixtures with RSA-backed callback fixtures

### Frontend
- `frontend/src/pages/dashboard/Pricing.tsx`
- `frontend/src/pages/Pricing.tsx`
- `frontend/src/pages/dashboard/Settings.tsx`
- `frontend/src/pages/dashboard/Transactions.tsx`

Potential adjustments after live payloads are known:
- clearer copy for provider-declined payments
- display of provider reference IDs or invoice URLs
- any UI distinctions between redirect success and final webhook-confirmed activation
- retry messaging if provider returns pending or asynchronous statuses

## Security-Sensitive Areas For Live Billing Deployment

- Never activate paid access from redirect alone. Activation must remain webhook-verified.
- Do not trust metadata without verifying the callback signature first.
- Preserve raw request bytes for signature verification; reserialized JSON is not sufficient for signed payload verification.
- Store CHIP API keys and webhook public keys in secret storage, not in code or client env.
- Keep webhook endpoints out of frontend code paths; only the backend should receive provider callbacks.
- Ensure webhook processing is idempotent. CHIP docs describe retries and duplicated delivery is possible under network faults.
- Log provider IDs, event type, and verification result, but never log secrets, full card data, or unbounded payload dumps.
- Restrict who can change billing env vars and webhook routing.
- Keep TLS enabled end to end for all callback URLs and redirect URLs.
- Consider IP allowlisting only as a secondary control, not as a replacement for signature verification.
- If success callbacks and webhooks are both enabled, define one source of truth to avoid double activation.

## What Is Fully Complete Right Now

- Mock billing flow is safe and usable for end-to-end internal testing.
- Billing lifecycle rules and entitlement enforcement are implemented in app logic.
- Admin-configured plans drive pricing, trials, and limits dynamically.
- Billing UI is largely complete for subscription management and transaction visibility.
- Provider abstraction exists, so CHIP can be plugged in without rewriting the billing domain model.

## What Becomes The Only Remaining Work After CHIP Credentials Arrive

- Finalize purchase request mapping to CHIP.
- Replace webhook HMAC verification with documented RSA and public-key verification.
- Normalize real CHIP callback payloads into Lensaya billing events.
- Validate at least one successful, one failed, and one duplicate callback flow end to end.
- Persist real invoice or receipt data if available.
- If you want true auto-renewal through CHIP recurring tokens, implement and verify the recurring charge path.

## What You Will Need To Provide At That Time

- `CHIP_API_KEY`
- final `CHIP_API_BASE_URL` if it differs from the current default
- Brand ID for each plan that should create a CHIP purchase:
  - Pro
  - Studio
  - optionally Free, though current recommendation is not to bill Free through CHIP
- webhook callback URL registered in CHIP
- webhook ID if available
- webhook public key or confirmation that we should fetch it from CHIP API
- exact webhook events you enable in CHIP
- one real successful callback payload sample
- one real failed callback payload sample
- confirmation whether you want to use:
  - webhooks only
  - success callback plus webhooks
- confirmation whether recurring token billing should be implemented immediately after first live checkout is working

## Official CHIP References

- Authentication: https://docs.chip-in.asia/chip-collect/overview/authentication
- Callbacks overview: https://docs.chip-in.asia/chip-collect/overview/callbacks
- Create purchase: https://docs.chip-in.asia/chip-collect/api-reference/purchases/create
- Retrieve public key: https://docs.chip-in.asia/chip-collect/api-reference/public-key/retrieve
- Create webhook: https://docs.chip-in.asia/chip-collect/api-reference/webhooks/create
- Subscriptions overview: https://docs.chip-in.asia/chip-collect/overview/online-purchases/subscription
