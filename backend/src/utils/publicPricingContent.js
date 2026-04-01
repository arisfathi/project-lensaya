const PUBLIC_PRICING_PLAN_NAMES = ["FREE", "PRO", "STUDIO"];

export const PUBLIC_PRICING_CONTENT_SETTING_KEY = "public_pricing_content";

export const DEFAULT_PUBLIC_PRICING_CONTENT = {
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

export const normalizePublicPricingContent = (value, fallback = DEFAULT_PUBLIC_PRICING_CONTENT) => {
  const source = value && typeof value === "object" ? value : {};
  const fallbackSafe = fallback && typeof fallback === "object" ? fallback : DEFAULT_PUBLIC_PRICING_CONTENT;

  return {
    bullets: normalizeBullets(source?.bullets, fallbackSafe.bullets || DEFAULT_PUBLIC_PRICING_CONTENT.bullets),
    compareRows: normalizeCompareRows(
      source?.compareRows,
      fallbackSafe.compareRows || DEFAULT_PUBLIC_PRICING_CONTENT.compareRows
    ),
  };
};
