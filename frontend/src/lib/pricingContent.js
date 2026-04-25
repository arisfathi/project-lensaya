const PLAN_IDS = ["FREE", "PRO", "STUDIO"];

export const PLAN_COPY_DEFAULTS = {
  FREE: {
    tagline: "For photographers getting started",
    description: "Create a professional photography page, showcase your work, and start receiving inquiries online.",
    badge: "Get Started",
    cta: "Start for Free",
  },
  PRO: {
    tagline: "For photographers ready to grow",
    description:
      "Get more room for your portfolio, stronger branding, and better inquiry tools to help turn interest into bookings.",
    badge: "Most Popular",
    cta: "Upgrade to Pro",
  },
  STUDIO: {
    tagline: "For studios and teams",
    description: "Built for higher-volume businesses that need more flexibility, collaboration, and room to scale.",
    badge: "For Teams",
    cta: "Go Studio",
  },
};

export const PRICING_SECTION_DEFAULTS = {
  title: "Simple pricing for photographers at every stage",
  subtitle:
    "Build your portfolio, receive inquiries, and grow your photography business with the tools you need - from first bookings to full studio operations.",
};

export const PRICING_FAQ_DEFAULTS = [
  {
    question: "Can I start for free?",
    answer:
      "Yes. The Free plan lets you launch a professional portfolio page and begin receiving inquiries with no credit card required.",
  },
  {
    question: "Can I upgrade later?",
    answer:
      "Absolutely. You can upgrade from Free to Pro, or Pro to Studio, whenever you need more capacity and advanced tools.",
  },
  {
    question: "What happens if I reach my plan limit?",
    answer:
      "Lensaya shows pre-limit warnings first, then upgrade prompts with exact unlock values so you can move up before your workflow is blocked.",
  },
  {
    question: "Can I use my own domain?",
    answer:
      "Yes. Custom domain support is available on eligible paid plans, while Free includes a Lensaya subdomain so you can publish immediately.",
  },
  {
    question: "Is Lensaya suitable for teams?",
    answer:
      "Yes. Studio is designed for teams that need collaboration workflows, higher limits, and room to scale operations.",
  },
];

export const PRICING_UPGRADE_COPY_DEFAULTS = {
  transitions: {
    PRO: {
      title: "Unlock more room to grow",
      description:
        "Move to Pro for stronger branding, more portfolio room, and better inquiry tools that help turn attention into bookings.",
    },
    STUDIO: {
      title: "Built for growing studios",
      description:
        "Move to Studio for higher-volume workflows, broader collaboration, and enough headroom to keep scaling without friction.",
    },
  },
  warning: "You are close to your limit. Upgrade to {plan} for up to {limit}.",
  blocked: "Limit reached. Upgrade to {plan} for up to {limit}.",
  empty: "No extra room left on {plan}. Upgrade to {nextPlan} to keep moving without hard stops.",
};

const DEFAULT_BULLETS = {
  FREE: ["No credit card required", "Publish your portfolio fast", "Best for trying Lensaya"],
  PRO: ["Most popular for active photographers", "Higher limits for growth", "Priority support included"],
  STUDIO: ["For high-volume studios", "Large catalogs and team workflows", "Maximum flexibility and scale"],
};

const DEFAULT_COMPARE_ROWS = [
  {
    id: "portfolio-photos",
    label: "Portfolio Photos",
    sortOrder: 0,
    values: { FREE: "100", PRO: "1000", STUDIO: "Unlimited" },
  },
  {
    id: "services",
    label: "Services",
    sortOrder: 1,
    values: { FREE: "3", PRO: "15", STUDIO: "Unlimited" },
  },
  {
    id: "custom-domain",
    label: "Custom Domain",
    sortOrder: 2,
    values: { FREE: "Not included", PRO: "Included", STUDIO: "Included" },
  },
];

const normalizeText = (value, fallback, max = 240) => {
  const text = String(value || "").trim().slice(0, max);
  return text || fallback;
};

const normalizePlanId = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return PLAN_IDS.includes(normalized) ? normalized : null;
};

const normalizeBullets = (input) => {
  const source = input && typeof input === "object" ? input : {};
  const next = {};

  for (const plan of PLAN_IDS) {
    const fallbackList = DEFAULT_BULLETS[plan];
    const rawList = Array.isArray(source?.[plan]) ? source[plan] : fallbackList;
    const cleaned = rawList.map((item) => normalizeText(item, "", 160)).filter(Boolean).slice(0, 12);
    next[plan] = cleaned.length ? cleaned : fallbackList.slice(0, 12);
  }

  return next;
};

const normalizeCompareRows = (rows) => {
  const sourceRows = Array.isArray(rows) ? rows : DEFAULT_COMPARE_ROWS;
  const normalized = sourceRows
    .map((row, index) => {
      const label = normalizeText(row?.label, "", 100);
      if (!label) return null;

      const valuesSource = row?.values && typeof row.values === "object" ? row.values : {};
      const values = {};
      for (const plan of PLAN_IDS) {
        values[plan] = normalizeText(valuesSource?.[plan], "-", 120) || "-";
      }

      return {
        id: normalizeText(row?.id, `row-${index + 1}`, 80),
        label,
        sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index,
        values,
      };
    })
    .filter(Boolean)
    .slice(0, 30)
    .sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder));

  return normalized.length ? normalized : DEFAULT_COMPARE_ROWS;
};

const normalizeFaq = (items) => {
  const source = Array.isArray(items) ? items : PRICING_FAQ_DEFAULTS;
  const normalized = source
    .map((item) => {
      const question = normalizeText(item?.question, "", 120);
      const answer = normalizeText(item?.answer, "", 500);
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter(Boolean)
    .slice(0, 10);

  return normalized.length ? normalized : PRICING_FAQ_DEFAULTS;
};

const normalizeUpgradeCopy = (upgradeCopy) => {
  const source = upgradeCopy && typeof upgradeCopy === "object" ? upgradeCopy : {};
  const transitionsSource = source.transitions && typeof source.transitions === "object" ? source.transitions : {};

  return {
    transitions: {
      PRO: {
        title: normalizeText(transitionsSource?.PRO?.title, PRICING_UPGRADE_COPY_DEFAULTS.transitions.PRO.title, 120),
        description: normalizeText(
          transitionsSource?.PRO?.description,
          PRICING_UPGRADE_COPY_DEFAULTS.transitions.PRO.description,
          320
        ),
      },
      STUDIO: {
        title: normalizeText(transitionsSource?.STUDIO?.title, PRICING_UPGRADE_COPY_DEFAULTS.transitions.STUDIO.title, 120),
        description: normalizeText(
          transitionsSource?.STUDIO?.description,
          PRICING_UPGRADE_COPY_DEFAULTS.transitions.STUDIO.description,
          320
        ),
      },
    },
    warning: normalizeText(source.warning, PRICING_UPGRADE_COPY_DEFAULTS.warning, 180),
    blocked: normalizeText(source.blocked, PRICING_UPGRADE_COPY_DEFAULTS.blocked, 180),
    empty: normalizeText(source.empty, PRICING_UPGRADE_COPY_DEFAULTS.empty, 180),
  };
};

export const normalizePricingContent = (content) => {
  const source = content && typeof content === "object" ? content : {};
  return {
    section: {
      title: normalizeText(source?.section?.title, PRICING_SECTION_DEFAULTS.title, 120),
      subtitle: normalizeText(source?.section?.subtitle, PRICING_SECTION_DEFAULTS.subtitle, 300),
    },
    faq: normalizeFaq(source?.faq),
    upgradeCopy: normalizeUpgradeCopy(source?.upgradeCopy),
    bullets: normalizeBullets(source?.bullets),
    compareRows: normalizeCompareRows(source?.compareRows),
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt ? source.updatedAt : null,
  };
};

export const resolvePlanCopy = (plan) => {
  const planId = normalizePlanId(plan?.id) || normalizePlanId(plan?.name) || "FREE";
  const defaults = PLAN_COPY_DEFAULTS[planId];

  return {
    tagline: normalizeText(plan?.tagline, defaults.tagline, 191),
    description: normalizeText(plan?.subtitle, defaults.description, 400),
    badge: normalizeText(plan?.badgeText, defaults.badge, 80),
    cta: normalizeText(plan?.ctaText, defaults.cta, 80),
  };
};

export const resolvePlanDisplayName = (plan) => String(plan?.displayName || plan?.name || "").trim() || "Plan";

export const resolvePricingSectionCopy = (content) => {
  const resolved = normalizePricingContent(content);
  return resolved.section;
};

export const resolvePricingFaq = (content) => normalizePricingContent(content).faq;

export const resolvePricingUpgradeCopy = (content, targetPlan) => {
  const resolved = normalizePricingContent(content);
  const normalizedPlan = normalizePlanId(targetPlan);
  if (!normalizedPlan) return resolved.upgradeCopy.transitions.PRO;
  return resolved.upgradeCopy.transitions[normalizedPlan] || resolved.upgradeCopy.transitions.PRO;
};

export const formatPricingTemplate = (template, values = {}) => {
  const text = String(template || "");
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const replacement = values[key];
    return replacement === null || replacement === undefined || replacement === "" ? "" : String(replacement);
  });
};

export const resolveUsagePrompt = (content, kind, values = {}) => {
  const resolved = normalizePricingContent(content);
  const template = resolved.upgradeCopy?.[kind] || PRICING_UPGRADE_COPY_DEFAULTS[kind] || "";
  return formatPricingTemplate(template, values);
};

export const resolvePricingCardBullets = (content, planId) => {
  const normalized = normalizePlanId(planId) || "FREE";
  const resolved = normalizePricingContent(content);
  return resolved.bullets[normalized] || DEFAULT_BULLETS[normalized];
};

export const resolvePricingComparisonRows = (content) => normalizePricingContent(content).compareRows;
