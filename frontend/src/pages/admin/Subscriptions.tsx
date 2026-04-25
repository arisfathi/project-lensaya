import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useToast } from "../../contexts/ToastContext";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import {
  DEFAULT_LIMITS,
  DEFAULT_PRICING,
  DEFAULT_PUBLIC_PRICING_CONTENT,
  PRICING_PLAN_ENTRIES,
} from "./subscriptions/constants";
import { PlanConfigurationSection } from "./subscriptions/components/PlanConfigurationSection";
import { PublicPricingContentSection } from "./subscriptions/components/PublicPricingContentSection";
import { RecentSubscriptionChangesSection } from "./subscriptions/components/RecentSubscriptionChangesSection";
import { SubscriptionChartsSection } from "./subscriptions/components/SubscriptionChartsSection";
import { SubscriptionPlanCards } from "./subscriptions/components/SubscriptionPlanCards";
import { SubscriptionsHeader } from "./subscriptions/components/SubscriptionsHeader";
import type { ChangesItem, LimitsShape, PlanKey, PlanName, PricingShape, PublicPricingContent, RevenueByPlanItem } from "./subscriptions/types";
import {
  buildPlanDistribution,
  buildRevenueByPlanMap,
  buildUpgradeDowngradeData,
  coerceChanges,
  coerceDistribution,
  coerceOverviewPlanStats,
  coerceRevenueByPlan,
  DEFAULT_PLAN_STATS,
  formatCurrency,
  formatDateTime,
  formatPlan,
  normalizeLimits,
  normalizePricing,
  normalizePublicPricingContent,
  shortUser,
} from "./subscriptions/utils";

export default function Subscriptions() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [planStats, setPlanStats] = useState<Record<PlanName, number>>(DEFAULT_PLAN_STATS);
  const [distribution, setDistribution] = useState<Array<{ plan: string; count: number }>>([]);
  const [changes, setChanges] = useState<ChangesItem[]>([]);
  const [planRevenue, setPlanRevenue] = useState<RevenueByPlanItem[]>([]);

  const [limits, setLimits] = useState<LimitsShape>(DEFAULT_LIMITS);
  const [draftLimits, setDraftLimits] = useState<LimitsShape>(DEFAULT_LIMITS);
  const [pricing, setPricing] = useState<PricingShape>(DEFAULT_PRICING);
  const [draftPricing, setDraftPricing] = useState<PricingShape>(DEFAULT_PRICING);
  const [editingLimits, setEditingLimits] = useState(false);
  const [savingPublicPricing, setSavingPublicPricing] = useState(false);
  const [publicPricingDraft, setPublicPricingDraft] = useState<PublicPricingContent>(DEFAULT_PUBLIC_PRICING_CONTENT);
  const [publicPricingUpdatedAt, setPublicPricingUpdatedAt] = useState<string | null>(null);

  const { success, error } = useToast();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [overviewResult, limitsResult, changesResult, revenueByPlanResult, plansResult, publicPricingResult] = await Promise.all([
          adminApi.subscriptionsOverview(),
          adminApi.planLimits(),
          adminApi.subscriptionChanges({ page: 1, limit: 10 }),
          adminApi.revenueByPlan(),
          adminApi.plans(),
          adminApi.publicPricingContent(),
        ]);

        if (!mounted) return;

        setPlanStats(coerceOverviewPlanStats(overviewResult.planStats));
        setDistribution(coerceDistribution(overviewResult.distribution));
        setChanges(coerceChanges(changesResult.items));

        const normalizedLimits = normalizeLimits(limitsResult as Record<string, unknown>);
        const normalizedPricing = normalizePricing(plansResult);
        const normalizedPublicPricing = normalizePublicPricingContent(publicPricingResult as Record<string, unknown>);

        setLimits(normalizedLimits);
        setDraftLimits(normalizedLimits);
        setPricing(normalizedPricing);
        setDraftPricing(normalizedPricing);
        setPlanRevenue(coerceRevenueByPlan(revenueByPlanResult.items));
        setPublicPricingDraft(normalizedPublicPricing);
        setPublicPricingUpdatedAt(normalizedPublicPricing.updatedAt);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load subscriptions"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error]);

  const revenueByPlanMap = useMemo(() => buildRevenueByPlanMap(planRevenue), [planRevenue]);

  const planCards = useMemo(
    () => [
      {
        code: "FREE" as const,
        name: "Free",
        users: Number(planStats.FREE || 0),
        revenue: formatCurrency(revenueByPlanMap.FREE || 0),
        colorClassName: "bg-gray-500",
      },
      {
        code: "PRO" as const,
        name: "Pro",
        users: Number(planStats.PRO || 0),
        revenue: formatCurrency(revenueByPlanMap.PRO || 0),
        colorClassName: "bg-cyan-500",
      },
      {
        code: "STUDIO" as const,
        name: "Studio",
        users: Number(planStats.STUDIO || 0),
        revenue: formatCurrency(revenueByPlanMap.STUDIO || 0),
        colorClassName: "bg-purple-500",
      },
    ],
    [planStats, revenueByPlanMap]
  );

  const planDistribution = useMemo(() => buildPlanDistribution(distribution), [distribution]);

  const upgradeDowngradeData = useMemo(() => buildUpgradeDowngradeData(changes), [changes]);

  const onLimitChange = (
    plan: PlanKey,
    field:
      | "services"
      | "portfolioPhotos"
      | "packagesPerService"
      | "packageFeatures"
      | "storageGb"
      | "leadHistoryDays"
      | "leadVisibilityLimit"
      | "leadTemplatesCount"
      | "teamSeats",
    value: string
  ) => {
    setDraftLimits((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        [field]: Number(value || 0),
      },
    }));
  };

  const onToggleFeature = (
    plan: PlanKey,
    field:
      | "customDomain"
      | "analyticsTools"
      | "hideBrandingEnabled"
      | "leadFiltersEnabled"
      | "leadExportEnabled"
      | "leadRemindersEnabled"
      | "leadAdvancedAnalyticsEnabled"
      | "teamSectionTools"
      | "isVisible"
      | "isActive"
      | "isMostPopular",
    value: boolean
  ) => {
    setDraftLimits((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        [field]: value,
      },
    }));
  };

  const onPricingNumberChange = (plan: PlanKey, field: "price" | "yearlyPrice" | "trialDays", value: string) => {
    setDraftPricing((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        [field]: field === "trialDays" ? Math.max(0, Math.trunc(Number(value || 0))) : Number(value || 0),
      },
    }));
  };

  const onPricingTextChange = (
    plan: PlanKey,
    field:
      | "displayName"
      | "tagline"
      | "subtitle"
      | "badgeText"
      | "ctaText"
      | "monthlyPriceDisplay"
      | "yearlyPriceDisplay",
    value: string
  ) => {
    setDraftPricing((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        [field]: value,
      },
    }));
  };

  const onSortOrderChange = (plan: PlanKey, value: string) => {
    setDraftPricing((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        sortOrder: Math.max(0, Math.trunc(Number(value || 0))),
      },
    }));
  };

  const onModeChange = (
    plan: PlanKey,
    field: "analyticsMode" | "leadAnalyticsMode" | "supportTier" | "brandingMode",
    value: string
  ) => {
    setDraftLimits((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        [field]: value,
      },
    }));
  };

  const onLeadChannelToggle = (plan: PlanKey, channel: "whatsapp" | "email", value: boolean) => {
    setDraftLimits((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        leadChannels: {
          ...current[plan].leadChannels,
          [channel]: value,
        },
      },
    }));
  };

  const onPricingCurrencyChange = (plan: PlanKey, value: string) => {
    setDraftPricing((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        currency: String(value || "USD").toUpperCase().slice(0, 3),
      },
    }));
  };

  const saveLimits = async () => {
    try {
      setSaving(true);
      await Promise.all([adminApi.updatePlanLimits(draftLimits), adminApi.updateSettingsPlanLimits(draftLimits)]);

      await Promise.all(
        PRICING_PLAN_ENTRIES.map(async ({ key, label }) => {
          const record = draftPricing[key];
          if (!record.id) {
            throw new Error(`Plan record for ${label} is missing`);
          }
          await adminApi.updatePlan(record.id, {
            displayName: record.displayName,
            tagline: record.tagline || null,
            subtitle: record.subtitle || null,
            badgeText: record.badgeText || null,
            ctaText: record.ctaText || null,
            monthlyPriceDisplay: record.monthlyPriceDisplay || null,
            yearlyPriceDisplay: record.yearlyPriceDisplay || null,
            sortOrder: Number(record.sortOrder),
            isVisible: Boolean(draftLimits[key].isVisible),
            isActive: Boolean(draftLimits[key].isActive),
            isMostPopular: Boolean(draftLimits[key].isMostPopular),
            price: Number(record.price),
            yearlyPrice: Number(record.yearlyPrice),
            currency: String(record.currency || "USD").toUpperCase(),
            trialDays: Number(record.trialDays),
            maxServices: Number(draftLimits[key].services),
            maxPortfolioImages: Number(draftLimits[key].portfolioPhotos),
            maxPackagesPerService: Number(draftLimits[key].packagesPerService),
            maxPackageFeaturesPerPackage: Number(draftLimits[key].packageFeatures),
            storageGb: Number(draftLimits[key].storageGb),
            leadHistoryDays: Number(draftLimits[key].leadHistoryDays),
            leadVisibilityLimit: Number(draftLimits[key].leadVisibilityLimit),
            leadTemplatesCount: Number(draftLimits[key].leadTemplatesCount),
            teamSeats: Number(draftLimits[key].teamSeats),
            customDomainEnabled: Boolean(draftLimits[key].customDomain),
            analyticsEnabled: Boolean(draftLimits[key].analyticsTools),
            hideBrandingEnabled: Boolean(draftLimits[key].hideBrandingEnabled),
            leadFiltersEnabled: Boolean(draftLimits[key].leadFiltersEnabled),
            leadExportEnabled: Boolean(draftLimits[key].leadExportEnabled),
            leadRemindersEnabled: Boolean(draftLimits[key].leadRemindersEnabled),
            leadAdvancedAnalyticsEnabled: Boolean(draftLimits[key].leadAdvancedAnalyticsEnabled),
            teamToolsEnabled: Boolean(draftLimits[key].teamSectionTools),
            analyticsMode: draftLimits[key].analyticsMode,
            leadAnalyticsMode: draftLimits[key].leadAnalyticsMode,
            supportTier: draftLimits[key].supportTier,
            brandingMode: draftLimits[key].brandingMode,
            leadChannels: draftLimits[key].leadChannels,
          });
        })
      );

      setLimits(draftLimits);
      setPricing(draftPricing);
      setEditingLimits(false);
      success("Plan configuration updated");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to save plan configuration"));
    } finally {
      setSaving(false);
    }
  };

  const onPublicBulletChange = useCallback((plan: PlanName, value: string) => {
    const items = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12);

    setPublicPricingDraft((current) => ({
      ...current,
      bullets: {
        ...current.bullets,
        [plan]: items,
      },
    }));
  }, []);

  const onPublicSectionChange = useCallback((field: "title" | "subtitle", value: string) => {
    setPublicPricingDraft((current) => ({
      ...current,
      section: {
        ...current.section,
        [field]: value,
      },
    }));
  }, []);

  const onPublicFaqChange = useCallback((index: number, field: "question" | "answer", value: string) => {
    setPublicPricingDraft((current) => ({
      ...current,
      faq: current.faq.map((item, itemIndex) => (itemIndex !== index ? item : { ...item, [field]: value })),
    }));
  }, []);

  const onAddFaq = useCallback(() => {
    setPublicPricingDraft((current) => ({
      ...current,
      faq: [
        ...current.faq,
        {
          question: "New pricing question",
          answer: "Add the answer that should appear on the public pricing page.",
        },
      ],
    }));
  }, []);

  const onRemoveFaq = useCallback((index: number) => {
    setPublicPricingDraft((current) => ({
      ...current,
      faq: current.faq.filter((_, itemIndex) => itemIndex !== index),
    }));
  }, []);

  const onMoveFaq = useCallback((index: number, direction: -1 | 1) => {
    setPublicPricingDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.faq.length) return current;
      const faq = [...current.faq];
      const temp = faq[index];
      faq[index] = faq[target];
      faq[target] = temp;
      return {
        ...current,
        faq,
      };
    });
  }, []);

  const onUpgradeTransitionChange = useCallback(
    (plan: "PRO" | "STUDIO", field: "title" | "description", value: string) => {
      setPublicPricingDraft((current) => ({
        ...current,
        upgradeCopy: {
          ...current.upgradeCopy,
          transitions: {
            ...current.upgradeCopy.transitions,
            [plan]: {
              ...current.upgradeCopy.transitions[plan],
              [field]: value,
            },
          },
        },
      }));
    },
    []
  );

  const onUpgradeCopyChange = useCallback((field: "warning" | "blocked" | "empty", value: string) => {
    setPublicPricingDraft((current) => ({
      ...current,
      upgradeCopy: {
        ...current.upgradeCopy,
        [field]: value,
      },
    }));
  }, []);

  const onPublicRowFieldChange = useCallback(
    (rowIndex: number, field: "label" | "FREE" | "PRO" | "STUDIO", value: string) => {
      setPublicPricingDraft((current) => {
        const rows = current.compareRows.map((row, index) => {
          if (index !== rowIndex) return row;
          if (field === "label") {
            return { ...row, label: value };
          }
          return {
            ...row,
            values: {
              ...row.values,
              [field]: value,
            },
          };
        });

        return {
          ...current,
          compareRows: rows,
        };
      });
    },
    []
  );

  const addPublicCompareRow = useCallback(() => {
    setPublicPricingDraft((current) => {
      const nextSortOrder = current.compareRows.length;
      return {
        ...current,
        compareRows: [
          ...current.compareRows,
          {
            id: `row-${Date.now()}`,
            label: "New Feature",
            sortOrder: nextSortOrder,
            values: {
              FREE: "-",
              PRO: "Included",
              STUDIO: "Included",
            },
          },
        ],
      };
    });
  }, []);

  const removePublicCompareRow = useCallback((rowIndex: number) => {
    setPublicPricingDraft((current) => {
      const rows = current.compareRows
        .filter((_, index) => index !== rowIndex)
        .map((row, index) => ({ ...row, sortOrder: index }));
      return {
        ...current,
        compareRows: rows,
      };
    });
  }, []);

  const movePublicCompareRow = useCallback((rowIndex: number, direction: -1 | 1) => {
    setPublicPricingDraft((current) => {
      const target = rowIndex + direction;
      if (target < 0 || target >= current.compareRows.length) {
        return current;
      }

      const rows = [...current.compareRows];
      const temp = rows[rowIndex];
      rows[rowIndex] = rows[target];
      rows[target] = temp;

      return {
        ...current,
        compareRows: rows.map((row, index) => ({ ...row, sortOrder: index })),
      };
    });
  }, []);

  const savePublicPricingContent = async () => {
    try {
      setSavingPublicPricing(true);
      const payload = {
        section: {
          title: String(publicPricingDraft.section?.title || "").trim(),
          subtitle: String(publicPricingDraft.section?.subtitle || "").trim(),
        },
        faq: (publicPricingDraft.faq || [])
          .map((item) => ({
            question: String(item.question || "").trim(),
            answer: String(item.answer || "").trim(),
          }))
          .filter((item) => Boolean(item.question) && Boolean(item.answer)),
        upgradeCopy: {
          transitions: {
            PRO: {
              title: String(publicPricingDraft.upgradeCopy?.transitions?.PRO?.title || "").trim(),
              description: String(publicPricingDraft.upgradeCopy?.transitions?.PRO?.description || "").trim(),
            },
            STUDIO: {
              title: String(publicPricingDraft.upgradeCopy?.transitions?.STUDIO?.title || "").trim(),
              description: String(publicPricingDraft.upgradeCopy?.transitions?.STUDIO?.description || "").trim(),
            },
          },
          warning: String(publicPricingDraft.upgradeCopy?.warning || "").trim(),
          blocked: String(publicPricingDraft.upgradeCopy?.blocked || "").trim(),
          empty: String(publicPricingDraft.upgradeCopy?.empty || "").trim(),
        },
        bullets: {
          FREE: (publicPricingDraft.bullets.FREE || []).map((item) => String(item || "").trim()).filter(Boolean),
          PRO: (publicPricingDraft.bullets.PRO || []).map((item) => String(item || "").trim()).filter(Boolean),
          STUDIO: (publicPricingDraft.bullets.STUDIO || []).map((item) => String(item || "").trim()).filter(Boolean),
        },
        compareRows: (publicPricingDraft.compareRows || [])
          .map((row, index) => ({
            id: String(row.id || `row-${index + 1}`),
            label: String(row.label || "").trim(),
            sortOrder: index,
            values: {
              FREE: String(row.values?.FREE || "-").trim() || "-",
              PRO: String(row.values?.PRO || "-").trim() || "-",
              STUDIO: String(row.values?.STUDIO || "-").trim() || "-",
            },
          }))
          .filter((row) => Boolean(row.label)),
      };

      const result = await adminApi.updatePublicPricingContent(payload);
      const normalized = normalizePublicPricingContent(result as Record<string, unknown>);
      setPublicPricingDraft(normalized);
      setPublicPricingUpdatedAt(normalized.updatedAt);
      success("Public pricing content updated");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to save public pricing content"));
    } finally {
      setSavingPublicPricing(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading subscriptions..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <SubscriptionsHeader
        title="Subscriptions"
        description="Manage subscription plan pricing, limits, and billing configuration."
      />

      <SubscriptionPlanCards plans={planCards} />

      <SubscriptionChartsSection distribution={planDistribution} trend={upgradeDowngradeData} />

      <PlanConfigurationSection
        data={{
          editingLimits,
          saving,
          limits,
          draftLimits,
          pricing,
          draftPricing,
        }}
        actions={{
          onStartEdit: () => setEditingLimits(true),
          onCancelEdit: () => {
            setDraftLimits(limits);
            setDraftPricing(pricing);
            setEditingLimits(false);
          },
          onSave: () => {
            void saveLimits();
          },
          onLimitChange,
          onToggleFeature,
          onPricingNumberChange,
          onPricingTextChange,
          onPricingCurrencyChange,
          onSortOrderChange,
          onModeChange,
          onLeadChannelToggle,
        }}
        formatCurrency={formatCurrency}
      />

      <PublicPricingContentSection
        data={{
          draft: publicPricingDraft,
          updatedAt: publicPricingUpdatedAt,
          saving: savingPublicPricing,
        }}
        actions={{
          onSave: () => {
            void savePublicPricingContent();
          },
          onPublicSectionChange,
          onPublicFaqChange,
          onAddFaq,
          onRemoveFaq,
          onMoveFaq,
          onUpgradeTransitionChange,
          onUpgradeCopyChange,
          onPublicBulletChange,
          onPublicRowFieldChange,
          onAddRow: addPublicCompareRow,
          onRemoveRow: removePublicCompareRow,
          onMoveRow: movePublicCompareRow,
        }}
        formatDateTime={formatDateTime}
      />

      <RecentSubscriptionChangesSection
        changes={changes}
        formatPlan={formatPlan}
        formatDateTime={formatDateTime}
        shortUser={shortUser}
      />
    </AdminLayout>
  );
}
