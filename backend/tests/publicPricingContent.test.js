import assert from "node:assert/strict";
import test from "node:test";

const { DEFAULT_PUBLIC_PRICING_CONTENT, normalizePublicPricingContent } = await import("../src/utils/publicPricingContent.js");

test("normalizePublicPricingContent preserves seeded pricing copy defaults", () => {
  const content = normalizePublicPricingContent({});

  assert.equal(content.section.title, DEFAULT_PUBLIC_PRICING_CONTENT.section.title);
  assert.equal(content.section.subtitle, DEFAULT_PUBLIC_PRICING_CONTENT.section.subtitle);
  assert.equal(content.faq.length, DEFAULT_PUBLIC_PRICING_CONTENT.faq.length);
  assert.equal(content.upgradeCopy.transitions.PRO.title, DEFAULT_PUBLIC_PRICING_CONTENT.upgradeCopy.transitions.PRO.title);
});

test("normalizePublicPricingContent falls back when shared copy is incomplete", () => {
  const content = normalizePublicPricingContent({
    section: {
      title: "Custom title",
    },
    faq: [
      {
        question: "What happens if I reach my plan limit?",
        answer: "Custom answer",
      },
      {
        question: "",
        answer: "",
      },
    ],
    upgradeCopy: {
      transitions: {
        PRO: {
          title: "",
          description: "",
        },
      },
      warning: "",
    },
  });

  assert.equal(content.section.title, "Custom title");
  assert.equal(content.section.subtitle, DEFAULT_PUBLIC_PRICING_CONTENT.section.subtitle);
  assert.equal(content.faq.length, 1);
  assert.equal(content.upgradeCopy.transitions.PRO.title, DEFAULT_PUBLIC_PRICING_CONTENT.upgradeCopy.transitions.PRO.title);
  assert.equal(content.upgradeCopy.warning, DEFAULT_PUBLIC_PRICING_CONTENT.upgradeCopy.warning);
});
