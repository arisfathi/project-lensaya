import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lensaya?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_API_KEY = process.env.STRIPE_API_KEY || "sk_test_stripe_key";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_stripe_secret";

const { billingController } = await import("../src/controllers/billingController.js");
const { billingProviderService } = await import("../src/services/billingProviderService.js");
const { billingService } = await import("../src/services/billingService.js");
const { stripeService } = await import("../src/services/stripeService.js");
const { hmacSha256 } = await import("../src/utils/crypto.js");
const { ApiError } = await import("../src/utils/apiError.js");

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

const makeRes = () => {
  const state = {
    statusCode: 200,
    body: null,
  };

  return {
    state,
    res: {
      status(code) {
        state.statusCode = code;
        return this;
      },
      json(body) {
        state.body = body;
        return this;
      },
    },
  };
};

test("stripeService.verifyWebhook validates Stripe signatures", () => {
  const rawBody = JSON.stringify({ id: "evt_test" });
  const timestamp = "1711450000";
  const signature = hmacSha256(`${timestamp}.${rawBody}`, process.env.STRIPE_WEBHOOK_SECRET);

  assert.equal(stripeService.verifyWebhook(rawBody, `t=${timestamp},v1=${signature}`), true);
  assert.equal(stripeService.verifyWebhook(rawBody, `t=${timestamp},v1=bad_signature`), false);
  assert.equal(stripeService.verifyWebhook("", `t=${timestamp},v1=${signature}`), false);
});

test("billingProviderService.createCheckoutSession uses Stripe when configured", async () => {
  const originalFetch = global.fetch;
  let capturedUrl = null;
  let capturedBody = null;

  global.fetch = async (url, options = {}) => {
    capturedUrl = String(url);
    capturedBody = options.body;
    return new Response(
      JSON.stringify({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  };

  const previousProvider = process.env.BILLING_PROVIDER;
  process.env.BILLING_PROVIDER = "stripe";

  try {
    const result = await billingProviderService.createCheckoutSession({
      sessionId: "session-1",
      targetPlanId: "plan-pro",
      amountCents: 7900,
      currency: "USD",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
      metadata: {
        userId: "user-1",
        planId: "plan-1",
        planName: "Pro",
        planTier: "PRO",
        billingCycle: "monthly",
      },
    });

    assert.equal(capturedUrl, "https://api.stripe.com/v1/checkout/sessions");
    assert.equal(result.provider, "stripe");
    assert.equal(result.sessionId, "cs_test_123");
    assert.equal(result.checkoutUrl, "https://checkout.stripe.com/c/pay/cs_test_123");

    const bodyString = String(capturedBody || "");
    assert.ok(bodyString.includes("mode=subscription"));
    assert.ok(bodyString.includes("client_reference_id=user-1"));
    assert.ok(bodyString.includes("metadata%5Bprovider%5D=STRIPE") || bodyString.includes("metadata[provider]=STRIPE"));
  } finally {
    process.env.BILLING_PROVIDER = previousProvider;
    global.fetch = originalFetch;
  }
});

test("billingProviderService.resolveCheckoutProvider defaults to CHIP for Malaysia", () => {
  const previousProvider = process.env.BILLING_PROVIDER;
  delete process.env.BILLING_PROVIDER;

  try {
    const provider = billingProviderService.resolveCheckoutProvider({ country: "MY" });
    assert.equal(provider, "chip");
  } finally {
    process.env.BILLING_PROVIDER = previousProvider;
  }
});

test("billingProviderService.resolveCheckoutProvider defaults to Stripe outside Malaysia", () => {
  const previousProvider = process.env.BILLING_PROVIDER;
  delete process.env.BILLING_PROVIDER;

  try {
    const provider = billingProviderService.resolveCheckoutProvider({ country: "US" });
    assert.equal(provider, "stripe");
  } finally {
    process.env.BILLING_PROVIDER = previousProvider;
  }
});

test("billingProviderService.resolveCheckoutProvider respects explicit user override", () => {
  const previousProvider = process.env.BILLING_PROVIDER;
  process.env.BILLING_PROVIDER = "chip";

  try {
    const provider = billingProviderService.resolveCheckoutProvider({
      country: "MY",
      requestedProvider: "stripe",
    });
    assert.equal(provider, "stripe");
  } finally {
    process.env.BILLING_PROVIDER = previousProvider;
  }
});

test("billingController.webhook rejects Stripe webhooks without a raw body", async () => {
  const { res } = makeRes();
  let capturedError = null;
  const next = (error) => {
    capturedError = error;
  };

  await billingController.webhook(
    {
      body: { id: "evt_checkout_1", object: "event", type: "checkout.session.completed", data: { object: {} } },
      headers: {
        "stripe-signature": "t=1711450000,v1=bad_signature",
      },
    },
    res,
    next
  );

  assert.ok(capturedError instanceof ApiError);
  assert.equal(capturedError.statusCode, 400);
  assert.equal(capturedError.message, "Stripe webhook raw body is required");
});

test("billingController.webhook keeps checkout.session.completed pending until invoice.paid", async () => {
  const payload = {
    id: "evt_checkout_1",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        object: "checkout.session",
        id: "cs_checkout_1",
        payment_status: "paid",
        amount_total: 7900,
        currency: "usd",
        payment_intent: "pi_123",
        subscription: "sub_123",
        metadata: {
          userId: "stripe-user-1",
          planId: "plan-uuid-1",
          planName: "PRO",
          planTier: "PRO",
          planInterval: "month",
          planCurrency: "USD",
          planPrice: 79,
          referralCode: "REF-STRIPE",
        },
      },
    },
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = "1711450000";
  const signature = hmacSha256(`${timestamp}.${rawBody}`, process.env.STRIPE_WEBHOOK_SECRET);

  let receivedPayload = null;
  const { res } = makeRes();

  await withMethodPatches(
    [
      {
        target: billingService,
        method: "handlePaymentWebhook",
        fn: async (normalizedPayload) => {
          receivedPayload = normalizedPayload;
          return { received: true };
        },
      },
    ],
    async () => {
      await billingController.webhook(
        {
          rawBody,
          body: payload,
          headers: {
            "stripe-signature": `t=${timestamp},v1=${signature}`,
          },
        },
        res,
        () => {}
      );

      assert.ok(receivedPayload);
      assert.equal(receivedPayload.provider, "STRIPE");
      assert.equal(receivedPayload.transaction_id, "pi_123");
      assert.equal(receivedPayload.purchase_id, "sub_123");
      assert.equal(receivedPayload.status, "pending");
      assert.equal(receivedPayload.metadata?.provider, "STRIPE");
      assert.equal(receivedPayload.metadata?.userId, "stripe-user-1");
    }
  );
});

test("billingController.webhook accepts invoice.paid as the final success signal", async () => {
  const payload = {
    id: "evt_invoice_paid_1",
    object: "event",
    type: "invoice.paid",
    data: {
      object: {
        object: "invoice",
        id: "in_123",
        amount_paid: 7900,
        currency: "usd",
        payment_intent: "pi_123",
        subscription: "sub_123",
        metadata: {
          userId: "stripe-user-1",
          planId: "plan-uuid-1",
          planName: "PRO",
          planTier: "PRO",
          planInterval: "month",
          planCurrency: "USD",
          planPrice: 79,
          referralCode: "REF-STRIPE",
        },
      },
    },
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = "1711450000";
  const signature = hmacSha256(`${timestamp}.${rawBody}`, process.env.STRIPE_WEBHOOK_SECRET);

  let receivedPayload = null;
  const { res } = makeRes();

  await withMethodPatches(
    [
      {
        target: billingService,
        method: "handlePaymentWebhook",
        fn: async (normalizedPayload) => {
          receivedPayload = normalizedPayload;
          return { received: true };
        },
      },
    ],
    async () => {
      await billingController.webhook(
        {
          rawBody,
          body: payload,
          headers: {
            "stripe-signature": `t=${timestamp},v1=${signature}`,
          },
        },
        res,
        () => {}
      );

      assert.ok(receivedPayload);
      assert.equal(receivedPayload.provider, "STRIPE");
      assert.equal(receivedPayload.transaction_id, "pi_123");
      assert.equal(receivedPayload.purchase_id, "sub_123");
      assert.equal(receivedPayload.status, "paid");
      assert.equal(receivedPayload.metadata?.stripeEventType, "invoice.paid");
    }
  );
});
