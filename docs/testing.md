# Testing Guide

Lensaya uses Node's built-in test framework (node:test) for backend testing. The frontend has no automated test suite currently.

## Testing Philosophy

Tests are organized by concern:

- **Contract tests**: Validate API endpoint responses match expected shapes
- **Parity tests**: Ensure calculated metrics (admin overviews, analytics) remain consistent across code changes
- **Flow tests**: Multi-step workflows (auth → portfolio → subscription → billing)
- **Isolation tests**: Verify tenant boundaries (one photographer can't modify another's data)
- **Side-effect tests**: Validate that admin operations trigger expected cascading changes
- **Integration tests**: Webhook handling, payment provider interactions
- **Health monitoring tests**: Worker heartbeat and system health probes

## Test Infrastructure

**Framework**: `node:test` (built-in)  
**HTTP Testing**: `supertest` (for API testing)  
**Mocking Strategy**: Method patching on imported modules (see `withMethodPatches` pattern)

## Running Tests

From `backend/`:

```bash
# All tests
npm test

# Watch mode (not supported; use a loop instead)
npm test

# Single test file
npm test -- tests/authAndPortfolioFlow.test.js

# Tests matching a pattern (grep)
npm test -- --grep "subscription"
```

**Notes:**
- Tests run with `NODE_ENV=test`
- Test concurrency is disabled (set to 1) to avoid interference
- Each test file sets required env vars with defaults (see pattern below)

### Test Environment Setup Pattern

Every test file sets minimal env variables:

```javascript
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CHIP_WEBHOOK_SECRET = process.env.CHIP_WEBHOOK_SECRET || "chip-webhook-secret";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lensaya?schema=public";
```

This allows tests to be overridden from CI/env without hardcoding values.

## Test Categories

### Contract Tests (`adminContracts.test.js`, `publicHostApiGuard.test.js`, etc.)

**Purpose**: Validate HTTP response envelopes and status codes match public API contract.

**Coverage**: 40+ endpoint contracts including:
- Admin dashboard overview, analytics, photographers, subscriptions
- Revenue, storage, moderation, logs
- Referrals, CMS content
- Worker health endpoints

**Pattern**: Make request → assert status → check response.success flag and data shape

**Key Assertions**:
- `res.status === 200` and `res.body.success === true` for success paths
- `res.status === 400` and `res.body.error` for validation failures
- `res.status === 401` for auth failures
- `res.status === 421` for routes blocked on public hosts

### Parity Tests (`adminOverviewParity.test.js`)

**Purpose**: Verify calculation logic is correct and doesn't regress when code refactors.

**Coverage**:
- Dashboard overview series lengths match period windows
- Analytics metric calculations (events, visitors, conversions)
- Revenue aggregation correctness

**Pattern**: Mock Prisma methods → call endpoint → assert numeric totals are correct

### Flow Tests

Multiple-step workflows ensuring end-to-end functionality:

- **`authAndPortfolioFlow.test.js`**: signup → login → create portfolio → update profile → delete account
- **`subscriptionFlow.test.js`**: webhook idempotency, payment status transitions, past-due marking
- **`stripeBilling.test.js`**: Stripe webhook signature verification and order-of-operations
- **`referralFlow.test.js`**: signup with referral code → conversion → reward granting
- **`customDomainFlow.test.js`**: custom domain save → verify (mock/DNS modes) → disconnect
- **`launchCriticalFlows.test.js`**: Essential pre-launch user journeys
- **`dashboardRoutes.test.js`**: Dashboard feature and photographer availability operations
- **`profileRoutes.test.js`**: Profile CRUD and photographer operations
- **`publicHostResolution.test.js`**: Subdomain/domain resolution, custom domain errors

### Isolation Tests (`tenantIsolation.test.js`)

**Purpose**: Prevent data leakage between photographers (multi-tenant safety).

**Coverage**:
- One photographer cannot read another's services
- One photographer cannot update another's packages
- Photographer IDs are auto-filtered by Prisma middleware

**Pattern**: Create two photographers → one tries to modify the other's data → assert "Access denied"

### Side-Effect Tests (`adminPhotographerStatusSideEffects.test.js`)

**Purpose**: Verify that admin operations have expected cascading consequences.

**Coverage**:
- Suspending a photographer → asset flags are removed
- Reactivating a photographer → cleanup state is reset

### Webhook/Integration Tests (`chipWebhookSecretOrder.test.js`)

**Purpose**: Validate payment provider webhook handling is correct.

**Key behaviors**:
- CHIP webhook signature verification with HMAC-SHA256
- Idempotent webhook processing (duplicate webhooks are safe)
- Status transitions are state-aware (not just upserts)
- Stripe signature validation (if applicable)

**Gotcha**: `CHIP_WEBHOOK_SECRET` is a getter in env.js, allowing tests to set it after initial import (see `chipWebhookSecretOrder.test.js` pattern).

### Health Monitoring Tests (`workerHealthMonitoring.test.js`)

**Purpose**: Validate worker heartbeat and system health endpoints.

**Coverage**:
- `GET /health` returns basic server info
- `GET /api/v1/admin/system/worker-health` returns detailed worker metrics
- Graceful degradation when worker monitoring is unavailable

## Mocking Pattern

The codebase uses method patching instead of dependency injection. Example:

```javascript
const withMethodPatches = async (patches, callback) => {
  const originals = patches.map((patch) => ({
    target: patch.target,
    method: patch.method,
    original: patch.target[patch.method],
  }));

  for (const patch of patches) {
    patch.target[patch.method] = patch.fn;
  }

  try {
    await callback();
  } finally {
    for (const original of originals) {
      original.target[original.method] = original.original;
    }
  }
};

// Usage:
await withMethodPatches(
  [
    {
      target: prisma.photographer,
      method: "findUnique",
      fn: async () => ({ id: "photo-1", username: "test" }),
    },
  ],
  async () => {
    const res = await request(app).get("/api/v1/profile");
    assert.equal(res.status, 200);
  }
);
```

This approach restores original methods even if the callback throws, preventing test pollution.

## Common Pitfalls & Flaky Areas

### 1. Environment Variable Order

**Issue**: Tests that need specific env values must set them BEFORE importing modules that read env.

**Example Problem**: If a test reads env.CHIP_WEBHOOK_SECRET in test code, it must be set before the test file imports `billingController`.

**Solution**: Set env vars at the top of each test file; use getter pattern for dynamic env (like CHIP_WEBHOOK_SECRET).

### 2. Webhook Secret Timing

**Issue**: `CHIP_WEBHOOK_SECRET` is read at module import time for most code, but tests need to set it dynamically.

**Solution**: `env.js` uses a getter for this value:
```javascript
get webhookSecret() { return process.env.CHIP_WEBHOOK_SECRET || ""; }
```

See `chipWebhookSecretOrder.test.js` for test examples that rely on this.

### 3. Database State Pollution

**Issue**: Tests that use method patching can leave Prisma in an inconsistent state if the callback throws.

**Solution**: All method patching uses `try/finally` to restore originals. Ensure your `withMethodPatches` does the same.

### 4. Webhook Signature Verification

**Issue**: CHIP and Stripe webhooks require HMAC signature verification. Tests must include correct signatures.

**Pattern**: 
```javascript
const signature = hmacSha256(rawBody, process.env.CHIP_WEBHOOK_SECRET);
const res = await request(app)
  .post("/api/v1/billing/webhook")
  .set("X-Chip-Signature", signature)
  .send(payload);
```

Signature mismatches result in 401 Unauthorized.

### 5. Idempotency Assumptions

**Issue**: Billing webhooks must be idempotent (processing the same webhook twice must be safe).

**Pattern**: Services check current status before applying transitions. Example:
```javascript
// PENDING → SUCCEEDED is OK
// SUCCEEDED → SUCCEEDED is a no-op (idempotent)
// SUCCEEDED → FAILED is NOT allowed
```

Tests verify this with duplicate webhook posts.

### 6. Transient Database Errors

**Issue**: Some tests configure attempts=1 in test mode to fail fast; others use retry logic.

**Pattern**: `billingMaintenanceQueue.js` retries on transient DB errors but caps at 5 attempts in test mode.

### 7. Parity Test Data Assumptions

**Issue**: Parity tests assume specific mock data structures. If you change Prisma mock shapes, tests break.

**Pattern**: Review parity test mocks when modifying service calculations.

## When to Use Which Test Style

| Goal | Style | Example |
|------|-------|---------|
| Verify endpoint response format | Contract | adminContracts.test.js |
| Validate calculation logic | Parity | adminOverviewParity.test.js |
| Multi-step user flow | Flow | authAndPortfolioFlow.test.js |
| Prevent data leakage | Isolation | tenantIsolation.test.js |
| Admin action cascades | Side-effect | adminPhotographerStatusSideEffects.test.js |
| External service handling | Integration | stripeBilling.test.js, chipWebhookSecretOrder.test.js |
| System health check | Health | workerHealthMonitoring.test.js |

## Writing New Tests

1. **Choose the right style** (see table above)
2. **Set environment variables** at the top of the file
3. **Import app and services** after setting env
4. **Use withMethodPatches** for Prisma/service mocks
5. **Test the actual behavior**, not implementation details
6. **Verify error cases** (auth failures, validation, 304 errors)
7. **Use meaningful assertion messages** for debugging

Example template:

```javascript
import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/config/prisma.js");
const { signAccessToken } = await import("../src/utils/jwt.js");

const makeToken = (sub) => signAccessToken({ sub, role: "PHOTOGRAPHER", email: `${sub}@example.com`, username: sub });

const withMethodPatches = async (patches, callback) => {
  const originals = patches.map(p => ({ target: p.target, method: p.method, original: p.target[p.method] }));
  for (const patch of patches) patch.target[patch.method] = patch.fn;
  try {
    await callback();
  } finally {
    for (const original of originals) original.target[original.method] = original.original;
  }
};

test("GET /api/v1/my-endpoint returns expected shape", async () => {
  await withMethodPatches(
    [{ target: prisma.user, method: "findUnique", fn: async () => ({ id: "user-1", email: "test@example.com" }) }],
    async () => {
      const res = await request(app)
        .get("/api/v1/my-endpoint")
        .set("Authorization", `Bearer ${makeToken("user-1")}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert(res.body.data.id);
    }
  );
});
```

## Pre-Merge Test Checklist

Before pushing a PR:

- [ ] Run `npm test` and all tests pass
- [ ] New feature has flow or contract test coverage
- [ ] If modifying Prisma queries: check parity test assumptions
- [ ] If adding webhook handling: verify idempotency in tests
- [ ] If changing auth: verify requireAuth middleware usage
- [ ] If modifying admin operations: check side-effect tests
- [ ] Linting passes (if configured)

## Source References

- Test infrastructure: [backend/package.json](../backend/package.json) (scripts, devDependencies)
- Test utilities: [backend/tests/](../backend/tests/)
- Mocking patterns: All test files use `withMethodPatches`
- Environment setup: [backend/src/config/env.js](../backend/src/config/env.js)
- Worker health: [backend/src/workers/](../backend/src/workers/)
