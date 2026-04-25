import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePricingContent,
  resolvePlanCopy,
  resolvePricingFaq,
  resolvePricingSectionCopy,
  resolvePricingUpgradeCopy,
  resolveUsagePrompt,
} from "../src/lib/pricingContent.js";

test("normalizePricingContent seeds the current default copy", () => {
  const content = normalizePricingContent({});

  assert.equal(content.section.title, "Simple pricing for photographers at every stage");
  assert.equal(content.faq.length, 5);
  assert.equal(content.upgradeCopy.transitions.PRO.title, "Unlock more room to grow");
  assert.equal(content.upgradeCopy.transitions.STUDIO.title, "Built for growing studios");
});

test("pricing content resolvers honor admin overrides", () => {
  const content = normalizePricingContent({
    section: {
      title: "Choose the right Lensaya plan",
      subtitle: "Admin subtitle",
    },
    faq: [
      {
        question: "Custom question?",
        answer: "Custom answer.",
      },
    ],
    upgradeCopy: {
      transitions: {
        PRO: {
          title: "Grow faster",
          description: "Pro description",
        },
        STUDIO: {
          title: "Scale further",
          description: "Studio description",
        },
      },
      warning: "Close to your limit on {plan}.",
      blocked: "Blocked on {plan}.",
      empty: "Empty on {plan}.",
    },
  });

  assert.equal(resolvePricingSectionCopy(content).title, "Choose the right Lensaya plan");
  assert.equal(resolvePricingFaq(content)[0].question, "Custom question?");
  assert.equal(resolvePricingUpgradeCopy(content, "PRO").title, "Grow faster");
  assert.equal(resolveUsagePrompt(content, "warning", { plan: "PRO", limit: "10 items" }), "Close to your limit on PRO.");
  assert.equal(resolveUsagePrompt(content, "blocked", { plan: "STUDIO", limit: "Unlimited" }), "Blocked on STUDIO.");
});

test("plan copy falls back when metadata is incomplete", () => {
  const copy = resolvePlanCopy({ id: "PRO", tagline: "", subtitle: "", badgeText: "", ctaText: "" });

  assert.equal(copy.tagline, "For photographers ready to grow");
  assert.equal(copy.description, "Get more room for your portfolio, stronger branding, and better inquiry tools to help turn interest into bookings.");
  assert.equal(copy.badge, "Most Popular");
  assert.equal(copy.cta, "Upgrade to Pro");
});
