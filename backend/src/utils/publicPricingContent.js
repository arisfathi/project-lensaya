const PUBLIC_PRICING_PLAN_NAMES = ["FREE", "PRO", "STUDIO"];

export const PUBLIC_PRICING_CONTENT_SETTING_KEY = "public_pricing_content";

export const DEFAULT_PUBLIC_PRICING_CONTENT = {
  section: {
    title: "Simple pricing for photographers at every stage",
    subtitle:
      "Build your portfolio, receive inquiries, and grow your photography business with the tools you need - from first bookings to full studio operations.",
  },
  faq: [
    {
      question: "Can I start for free?",
      answer:
        "Yes. The Free plan lets you launch a professional portfolio page and begin receiving inquiries with no credit card required. ",
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
  ],
  upgradeCopy: {
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
  },
  bullets: {
    FREE: ["No credit card required", "Publish your portfolio fast", "Best for trying Lensaya"],
    PRO: ["Most popular for active photographers", "Higher limits for growth", "Priority support included"],
    STUDIO: ["For high-volume studios", "Large catalogs and team workflows", "Maximum flexibility and scale"],
  },
  compareRows: [
    {
      id: "portfolio-photos",
      label: "Portfolio Photos",
      values: { FREE: "100", PRO: "1000", STUDIO: "Unlimited" },
      sortOrder: 0,
    },
    {
      id: "services",
      label: "Services",
      values: { FREE: "3", PRO: "15", STUDIO: "Unlimited" },
      sortOrder: 1,
    },
    {
      id: "custom-domain",
      label: "Custom Domain",
      values: { FREE: "Not included", PRO: "Included", STUDIO: "Included" },
      sortOrder: 2,
    },
  ],
};

const normalizeText = (value, max = 191) => String(value || "").trim().slice(0, max);

const normalizeTemplate = (value, fallback, max = 400) => {
  const text = normalizeText(value, max);
  return text || fallback;
};

const slugifyId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const normalizeBullets = (input, fallback) => {
  const source = input && typeof input === "object" ? input : {};
  const next = {};

  for (const plan of PUBLIC_PRICING_PLAN_NAMES) {
    const fallbackList = Array.isArray(fallback?.[plan]) ? fallback[plan] : [];
    const rawList = Array.isArray(source?.[plan]) ? source[plan] : fallbackList;
    const cleaned = rawList
      .map((item) => normalizeText(item, 160))
      .filter(Boolean)
      .slice(0, 12);
    next[plan] = cleaned.length ? cleaned : fallbackList.slice(0, 12);
  }

  return next;
};

const normalizeCompareRows = (rows, fallbackRows) => {
  const sourceRows = Array.isArray(rows) ? rows : fallbackRows;
  const normalized = sourceRows
    .map((row, index) => {
      const label = normalizeText(row?.label, 100);
      if (!label) return null;

      const valuesSource = row?.values && typeof row.values === "object" ? row.values : {};
      const values = {};
      for (const plan of PUBLIC_PRICING_PLAN_NAMES) {
        const raw = valuesSource?.[plan];
        values[plan] = normalizeText(raw, 120) || "-";
      }

      const id = slugifyId(row?.id || label) || `row-${index + 1}`;
      const sortOrder = Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index;

      return {
        id,
        label,
        values,
        sortOrder,
      };
    })
    .filter(Boolean)
    .slice(0, 30)
    .sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder));

  return normalized.length ? normalized : fallbackRows;
};

const normalizeFaq = (items, fallbackItems) => {
  const source = Array.isArray(items) ? items : fallbackItems;
  const normalized = source
    .map((item) => {
      const question = normalizeText(item?.question, 120);
      const answer = normalizeText(item?.answer, 500);
      if (!question || !answer) return null;
      return {
        question,
        answer,
      };
    })
    .filter(Boolean)
    .slice(0, 10);

  return normalized.length ? normalized : fallbackItems;
};

const normalizeUpgradeCopy = (upgradeCopy, fallbackUpgradeCopy) => {
  const source = upgradeCopy && typeof upgradeCopy === "object" ? upgradeCopy : {};
  const fallbackSafe = fallbackUpgradeCopy && typeof fallbackUpgradeCopy === "object" ? fallbackUpgradeCopy : DEFAULT_PUBLIC_PRICING_CONTENT.upgradeCopy;
  const transitionsSource = source.transitions && typeof source.transitions === "object" ? source.transitions : {};
  const transitionsFallback = fallbackSafe.transitions || DEFAULT_PUBLIC_PRICING_CONTENT.upgradeCopy.transitions;

  return {
    transitions: {
      PRO: {
        title: normalizeTemplate(transitionsSource?.PRO?.title, transitionsFallback.PRO.title, 120),
        description: normalizeTemplate(transitionsSource?.PRO?.description, transitionsFallback.PRO.description, 320),
      },
      STUDIO: {
        title: normalizeTemplate(transitionsSource?.STUDIO?.title, transitionsFallback.STUDIO.title, 120),
        description: normalizeTemplate(transitionsSource?.STUDIO?.description, transitionsFallback.STUDIO.description, 320),
      },
    },
    warning: normalizeTemplate(source.warning, fallbackSafe.warning, 180),
    blocked: normalizeTemplate(source.blocked, fallbackSafe.blocked, 180),
    empty: normalizeTemplate(source.empty, fallbackSafe.empty, 180),
  };
};

export const normalizePublicPricingContent = (value, fallback = DEFAULT_PUBLIC_PRICING_CONTENT) => {
  const source = value && typeof value === "object" ? value : {};
  const fallbackSafe = fallback && typeof fallback === "object" ? fallback : DEFAULT_PUBLIC_PRICING_CONTENT;

  return {
    section: {
      title: normalizeTemplate(source?.section?.title, fallbackSafe.section?.title || DEFAULT_PUBLIC_PRICING_CONTENT.section.title, 120),
      subtitle: normalizeTemplate(
        source?.section?.subtitle,
        fallbackSafe.section?.subtitle || DEFAULT_PUBLIC_PRICING_CONTENT.section.subtitle,
        300
      ),
    },
    faq: normalizeFaq(source?.faq, fallbackSafe.faq || DEFAULT_PUBLIC_PRICING_CONTENT.faq),
    upgradeCopy: normalizeUpgradeCopy(source?.upgradeCopy, fallbackSafe.upgradeCopy || DEFAULT_PUBLIC_PRICING_CONTENT.upgradeCopy),
    bullets: normalizeBullets(source?.bullets, fallbackSafe.bullets || DEFAULT_PUBLIC_PRICING_CONTENT.bullets),
    compareRows: normalizeCompareRows(
      source?.compareRows,
      fallbackSafe.compareRows || DEFAULT_PUBLIC_PRICING_CONTENT.compareRows
    ),
  };
};
