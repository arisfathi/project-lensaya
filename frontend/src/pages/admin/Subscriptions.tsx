import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Edit2, Check } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from "recharts";
import { AdminLayout } from "../../layouts/AdminLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type PlanName = "FREE" | "PRO" | "STUDIO";
type PlanKey = "free" | "pro" | "studio";

type LimitsShape = {
  free: {
    services: number;
    portfolioPhotos: number;
    packagesPerService: number;
    storage: number;
    customDomain: boolean;
    analyticsTools: boolean;
  };
  pro: {
    services: number;
    portfolioPhotos: number;
    packagesPerService: number;
    storage: number;
    customDomain: boolean;
    analyticsTools: boolean;
  };
  studio: {
    services: number;
    portfolioPhotos: number;
    packagesPerService: number;
    storage: number;
    customDomain: boolean;
    analyticsTools: boolean;
  };
};

type ChangesItem = {
  user: string;
  from: string;
  to: string;
  action: string;
  at: string;
};

type RevenueByPlanItem = {
  plan: string;
  revenue: number;
};

type PlanPricingRecord = {
  id: string;
  price: number;
  yearlyPrice: number;
  currency: string;
  trialDays: number;
  referralReward: number;
  storageCostPerGB: number;
};

type PricingShape = {
  free: PlanPricingRecord;
  pro: PlanPricingRecord;
  studio: PlanPricingRecord;
};

const defaultLimits: LimitsShape = {
  free: { services: 0, portfolioPhotos: 0, packagesPerService: 0, storage: 0, customDomain: false, analyticsTools: false },
  pro: { services: 0, portfolioPhotos: 0, packagesPerService: 0, storage: 0, customDomain: true, analyticsTools: true },
  studio: { services: -1, portfolioPhotos: -1, packagesPerService: 10, storage: -1, customDomain: true, analyticsTools: true },
};

const defaultPricing: PricingShape = {
  free: { id: "", price: 0, yearlyPrice: 0, currency: "USD", trialDays: 0, referralReward: 0, storageCostPerGB: 0 },
  pro: { id: "", price: 0, yearlyPrice: 0, currency: "USD", trialDays: 0, referralReward: 0, storageCostPerGB: 0 },
  studio: { id: "", price: 0, yearlyPrice: 0, currency: "USD", trialDays: 0, referralReward: 0, storageCostPerGB: 0 },
};

const planColorHex = {
  FREE: "#64748b",
  PRO: "#06b6d4",
  STUDIO: "#a855f7",
};

const formatPlan = (plan: string) => {
  if (plan === "FREE") return "Free";
  if (plan === "PRO") return "Pro";
  if (plan === "STUDIO") return "Studio";
  return plan || "Unknown";
};

const formatCurrency = (value: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `$${Number(value || 0).toFixed(2)}`;
  }
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const shortUser = (value: string) => {
  if (!value) return "Unknown user";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const monthBuckets = () => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
      month: date.toLocaleString(undefined, { month: "short" }),
      upgrades: 0,
      downgrades: 0,
    };
  });
};

export default function Subscriptions() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [planStats, setPlanStats] = useState<Record<PlanName, number>>({ FREE: 0, PRO: 0, STUDIO: 0 });
  const [distribution, setDistribution] = useState<Array<{ plan: string; count: number }>>([]);
  const [changes, setChanges] = useState<ChangesItem[]>([]);
  const [planRevenue, setPlanRevenue] = useState<RevenueByPlanItem[]>([]);

  const [limits, setLimits] = useState<LimitsShape>(defaultLimits);
  const [draftLimits, setDraftLimits] = useState<LimitsShape>(defaultLimits);
  const [pricing, setPricing] = useState<PricingShape>(defaultPricing);
  const [draftPricing, setDraftPricing] = useState<PricingShape>(defaultPricing);
  const [editingLimits, setEditingLimits] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [overviewResult, limitsResult, changesResult, revenueByPlanResult, plansResult] = await Promise.all([
          adminApi.subscriptionsOverview(),
          adminApi.planLimits(),
          adminApi.subscriptionChanges({ page: 1, limit: 10 }),
          adminApi.revenueByPlan(),
          adminApi.plans(),
        ]);
        if (!mounted) return;

        setPlanStats(
          (overviewResult.planStats as Record<PlanName, number>) || {
            FREE: 0,
            PRO: 0,
            STUDIO: 0,
          }
        );
        setDistribution((overviewResult.distribution || []) as Array<{ plan: string; count: number }>);
        setChanges((changesResult.items || []) as ChangesItem[]);

        const normalizedLimits = {
          free: {
            services: Number((limitsResult.free as Record<string, unknown>)?.services || 0),
            portfolioPhotos: Number(
              (limitsResult.free as Record<string, unknown>)?.portfolioPhotos ||
                (limitsResult.free as Record<string, unknown>)?.portfolioImages ||
                0
            ),
            packagesPerService: Number(
              (limitsResult.free as Record<string, unknown>)?.packagesPerService ||
                (limitsResult.free as Record<string, unknown>)?.packages ||
                0
            ),
            storage: Number((limitsResult.free as Record<string, unknown>)?.storage || 0),
            customDomain: Boolean((limitsResult.free as Record<string, unknown>)?.customDomain),
            analyticsTools: Boolean((limitsResult.free as Record<string, unknown>)?.analyticsTools),
          },
          pro: {
            services: Number((limitsResult.pro as Record<string, unknown>)?.services || 0),
            portfolioPhotos: Number(
              (limitsResult.pro as Record<string, unknown>)?.portfolioPhotos ||
                (limitsResult.pro as Record<string, unknown>)?.portfolioImages ||
                0
            ),
            packagesPerService: Number(
              (limitsResult.pro as Record<string, unknown>)?.packagesPerService ||
                (limitsResult.pro as Record<string, unknown>)?.packages ||
                0
            ),
            storage: Number((limitsResult.pro as Record<string, unknown>)?.storage || 0),
            customDomain: Boolean((limitsResult.pro as Record<string, unknown>)?.customDomain),
            analyticsTools: Boolean((limitsResult.pro as Record<string, unknown>)?.analyticsTools ?? true),
          },
          studio: {
            services: Number((limitsResult.studio as Record<string, unknown>)?.services || -1),
            portfolioPhotos: Number(
              (limitsResult.studio as Record<string, unknown>)?.portfolioPhotos ||
                (limitsResult.studio as Record<string, unknown>)?.portfolioImages ||
                -1
            ),
            packagesPerService: Number(
              (limitsResult.studio as Record<string, unknown>)?.packagesPerService ||
                (limitsResult.studio as Record<string, unknown>)?.packages ||
                -1
            ),
            storage: Number((limitsResult.studio as Record<string, unknown>)?.storage || -1),
            customDomain: Boolean((limitsResult.studio as Record<string, unknown>)?.customDomain ?? true),
            analyticsTools: Boolean((limitsResult.studio as Record<string, unknown>)?.analyticsTools ?? true),
          },
        } satisfies LimitsShape;

        const byPlanName = new Map(
          ((plansResult.items || []) as Array<Record<string, unknown>>).map((plan) => [
            String(plan.name || "").toUpperCase(),
            plan,
          ])
        );
        const toPricingRecord = (planName: PlanName): PlanPricingRecord => {
          const row = byPlanName.get(planName);
          return {
            id: String(row?.id || ""),
            price: Number(row?.price || 0),
            yearlyPrice: Number(row?.yearlyPrice || 0),
            currency: String(row?.currency || "USD").toUpperCase(),
            trialDays: Number(row?.trialDays || 0),
            referralReward: Number(row?.referralReward || 0),
            storageCostPerGB: Number(row?.storageCostPerGB || 0),
          };
        };
        const normalizedPricing = {
          free: toPricingRecord("FREE"),
          pro: toPricingRecord("PRO"),
          studio: toPricingRecord("STUDIO"),
        } satisfies PricingShape;

        setLimits(normalizedLimits);
        setDraftLimits(normalizedLimits);
        setPricing(normalizedPricing);
        setDraftPricing(normalizedPricing);
        setPlanRevenue((revenueByPlanResult.items || []) as RevenueByPlanItem[]);
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

  const revenueByPlanMap = useMemo(() => {
    return planRevenue.reduce<Record<string, number>>((acc, row) => {
      acc[row.plan] = Number(row.revenue || 0);
      return acc;
    }, {});
  }, [planRevenue]);

  const planCards = [
    {
      code: "FREE" as const,
      name: "Free",
      users: Number(planStats.FREE || 0),
      revenue: formatCurrency(revenueByPlanMap.FREE || 0),
      color: "bg-gray-500",
    },
    {
      code: "PRO" as const,
      name: "Pro",
      users: Number(planStats.PRO || 0),
      revenue: formatCurrency(revenueByPlanMap.PRO || 0),
      color: "bg-cyan-500",
    },
    {
      code: "STUDIO" as const,
      name: "Studio",
      users: Number(planStats.STUDIO || 0),
      revenue: formatCurrency(revenueByPlanMap.STUDIO || 0),
      color: "bg-purple-500",
    },
  ];

  const planDistribution = useMemo(() => {
    if (!distribution.length) {
      return [
        { id: "free", name: "Free", value: 0, color: planColorHex.FREE },
        { id: "pro", name: "Pro", value: 0, color: planColorHex.PRO },
        { id: "studio", name: "Studio", value: 0, color: planColorHex.STUDIO },
      ];
    }
    return distribution.map((item, index) => {
      const key = (item.plan || "FREE") as keyof typeof planColorHex;
      return {
        id: `${item.plan || "plan"}-${index + 1}`,
        name: formatPlan(item.plan || "FREE"),
        value: Number(item.count || 0),
        color: planColorHex[key] || planColorHex.FREE,
      };
    });
  }, [distribution]);

  const upgradeDowngradeData = useMemo(() => {
    const buckets = monthBuckets();
    const bucketMap = new Map(buckets.map((item) => [item.key, item]));

    changes.forEach((change) => {
      const date = new Date(change.at);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const target = bucketMap.get(key);
      if (!target) return;

      if ((change.action || "").toLowerCase().includes("down")) {
        target.downgrades += 1;
      } else {
        target.upgrades += 1;
      }
    });

    return buckets.map((item, index) => ({ ...item, id: `upgrade-${index + 1}` }));
  }, [changes]);

  const onLimitChange = (
    plan: PlanKey,
    field: "services" | "portfolioPhotos" | "packagesPerService" | "storage",
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

  const onToggleFeature = (plan: "free" | "pro" | "studio", field: "customDomain" | "analyticsTools", value: boolean) => {
    setDraftLimits((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        [field]: value,
      },
    }));
  };

  const onPricingNumberChange = (
    plan: PlanKey,
    field: "price" | "yearlyPrice" | "trialDays" | "referralReward" | "storageCostPerGB",
    value: string
  ) => {
    setDraftPricing((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        [field]:
          field === "trialDays"
            ? Math.max(0, Math.trunc(Number(value || 0)))
            : Number(value || 0),
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
      await Promise.all([
        adminApi.updatePlanLimits(draftLimits),
        adminApi.updateSettingsPlanLimits(draftLimits),
      ]);

      const pricingEntries: Array<{ key: PlanKey; label: PlanName }> = [
        { key: "free", label: "FREE" },
        { key: "pro", label: "PRO" },
        { key: "studio", label: "STUDIO" },
      ];
      await Promise.all(
        pricingEntries.map(async ({ key, label }) => {
          const record = draftPricing[key];
          if (!record.id) {
            throw new Error(`Plan record for ${label} is missing`);
          }
          await adminApi.updatePlan(record.id, {
            price: Number(record.price),
            yearlyPrice: Number(record.yearlyPrice),
            currency: String(record.currency || "USD").toUpperCase(),
            trialDays: Number(record.trialDays),
            referralReward: Number(record.referralReward),
            storageCostPerGB: Number(record.storageCostPerGB),
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

  if (loading) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading subscriptions..." />
      </AdminLayout>
    );
  }

  const editable = editingLimits ? draftLimits : limits;
  const editablePricing = editingLimits ? draftPricing : pricing;

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Subscriptions</h1>
        <p className="text-slate-600">Manage subscription plan pricing, limits, and billing configuration.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {planCards.map((plan) => (
          <div key={plan.name} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">{plan.name} Plan</h3>
              <div className={`w-3 h-3 rounded-full ${plan.color}`} />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-600">Active Users</p>
                <p className="text-2xl font-bold text-slate-900">{plan.users.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Revenue</p>
                <p className="text-xl font-bold text-cyan-500">{plan.revenue}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Plan Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={planDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {planDistribution.map((entry) => (
                  <Cell key={entry.id || entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Upgrades vs Downgrades</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={upgradeDowngradeData}>
              <XAxis dataKey="month" stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Line type="monotone" dataKey="upgrades" stroke="#10b981" strokeWidth={2} name="Upgrades" />
              <Line type="monotone" dataKey="downgrades" stroke="#ef4444" strokeWidth={2} name="Downgrades" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Plan Configuration</h3>
          <div className="flex items-center gap-2">
            {editingLimits ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDraftLimits(limits);
                    setDraftPricing(pricing);
                    setEditingLimits(false);
                  }}
                  className="px-4 py-2 border border-gray-200 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveLimits()}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save Configuration"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditingLimits(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Edit Configuration
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Feature</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Free</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Pro</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Studio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Monthly Price</td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.free.price}
                      onChange={(event) => onPricingNumberChange("free", "price", event.target.value)}
                      className="w-24 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.free.price, editablePricing.free.currency)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.pro.price}
                      onChange={(event) => onPricingNumberChange("pro", "price", event.target.value)}
                      className="w-24 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.pro.price, editablePricing.pro.currency)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.studio.price}
                      onChange={(event) => onPricingNumberChange("studio", "price", event.target.value)}
                      className="w-24 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.studio.price, editablePricing.studio.currency)
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Yearly Price</td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.free.yearlyPrice}
                      onChange={(event) => onPricingNumberChange("free", "yearlyPrice", event.target.value)}
                      className="w-24 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.free.yearlyPrice, editablePricing.free.currency)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.pro.yearlyPrice}
                      onChange={(event) => onPricingNumberChange("pro", "yearlyPrice", event.target.value)}
                      className="w-24 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.pro.yearlyPrice, editablePricing.pro.currency)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.studio.yearlyPrice}
                      onChange={(event) => onPricingNumberChange("studio", "yearlyPrice", event.target.value)}
                      className="w-24 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.studio.yearlyPrice, editablePricing.studio.currency)
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Currency</td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="text"
                      maxLength={3}
                      value={editablePricing.free.currency}
                      onChange={(event) => onPricingCurrencyChange("free", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center uppercase"
                    />
                  ) : (
                    editablePricing.free.currency
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="text"
                      maxLength={3}
                      value={editablePricing.pro.currency}
                      onChange={(event) => onPricingCurrencyChange("pro", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center uppercase"
                    />
                  ) : (
                    editablePricing.pro.currency
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="text"
                      maxLength={3}
                      value={editablePricing.studio.currency}
                      onChange={(event) => onPricingCurrencyChange("studio", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center uppercase"
                    />
                  ) : (
                    editablePricing.studio.currency
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Trial Days</td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editablePricing.free.trialDays}
                      onChange={(event) => onPricingNumberChange("free", "trialDays", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    editablePricing.free.trialDays
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editablePricing.pro.trialDays}
                      onChange={(event) => onPricingNumberChange("pro", "trialDays", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    editablePricing.pro.trialDays
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editablePricing.studio.trialDays}
                      onChange={(event) => onPricingNumberChange("studio", "trialDays", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    editablePricing.studio.trialDays
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Referral Reward</td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.free.referralReward}
                      onChange={(event) => onPricingNumberChange("free", "referralReward", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.free.referralReward, editablePricing.free.currency)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.pro.referralReward}
                      onChange={(event) => onPricingNumberChange("pro", "referralReward", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.pro.referralReward, editablePricing.pro.currency)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.studio.referralReward}
                      onChange={(event) => onPricingNumberChange("studio", "referralReward", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.studio.referralReward, editablePricing.studio.currency)
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Storage Cost Per GB</td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.free.storageCostPerGB}
                      onChange={(event) => onPricingNumberChange("free", "storageCostPerGB", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.free.storageCostPerGB, editablePricing.free.currency)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.pro.storageCostPerGB}
                      onChange={(event) => onPricingNumberChange("pro", "storageCostPerGB", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.pro.storageCostPerGB, editablePricing.pro.currency)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editablePricing.studio.storageCostPerGB}
                      onChange={(event) => onPricingNumberChange("studio", "storageCostPerGB", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : (
                    formatCurrency(editablePricing.studio.storageCostPerGB, editablePricing.studio.currency)
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Max Services</td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.free.services}
                      onChange={(event) => onLimitChange("free", "services", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.free.services < 0 ? (
                    "Unlimited"
                  ) : (
                    editable.free.services
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.pro.services}
                      onChange={(event) => onLimitChange("pro", "services", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.pro.services < 0 ? (
                    "Unlimited"
                  ) : (
                    editable.pro.services
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.studio.services}
                      onChange={(event) => onLimitChange("studio", "services", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.studio.services < 0 ? (
                    "Unlimited"
                  ) : (
                    editable.studio.services
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Portfolio Photos</td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.free.portfolioPhotos}
                      onChange={(event) => onLimitChange("free", "portfolioPhotos", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.free.portfolioPhotos < 0 ? (
                    "Unlimited"
                  ) : (
                    editable.free.portfolioPhotos
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.pro.portfolioPhotos}
                      onChange={(event) => onLimitChange("pro", "portfolioPhotos", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.pro.portfolioPhotos < 0 ? (
                    "Unlimited"
                  ) : (
                    editable.pro.portfolioPhotos
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.studio.portfolioPhotos}
                      onChange={(event) => onLimitChange("studio", "portfolioPhotos", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.studio.portfolioPhotos < 0 ? (
                    "Unlimited"
                  ) : (
                    editable.studio.portfolioPhotos
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Max Packages per Service</td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.free.packagesPerService}
                      onChange={(event) => onLimitChange("free", "packagesPerService", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.free.packagesPerService < 0 ? (
                    "Unlimited"
                  ) : (
                    editable.free.packagesPerService
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.pro.packagesPerService}
                      onChange={(event) => onLimitChange("pro", "packagesPerService", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.pro.packagesPerService < 0 ? (
                    "Unlimited"
                  ) : (
                    editable.pro.packagesPerService
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.studio.packagesPerService}
                      onChange={(event) => onLimitChange("studio", "packagesPerService", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.studio.packagesPerService < 0 ? (
                    "Unlimited"
                  ) : (
                    editable.studio.packagesPerService
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Storage Limit (GB)</td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.free.storage}
                      onChange={(event) => onLimitChange("free", "storage", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.free.storage < 0 ? (
                    "Unlimited"
                  ) : (
                    `${editable.free.storage} GB`
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.pro.storage}
                      onChange={(event) => onLimitChange("pro", "storage", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.pro.storage < 0 ? (
                    "Unlimited"
                  ) : (
                    `${editable.pro.storage} GB`
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-center text-slate-600">
                  {editingLimits ? (
                    <input
                      type="number"
                      value={editable.studio.storage}
                      onChange={(event) => onLimitChange("studio", "storage", event.target.value)}
                      className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
                    />
                  ) : editable.studio.storage < 0 ? (
                    "Unlimited"
                  ) : (
                    `${editable.studio.storage} GB`
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Custom Domain</td>
                <td className="px-6 py-4 text-center">
                  {editingLimits ? (
                    <input
                      type="checkbox"
                      checked={editable.free.customDomain}
                      onChange={(event) => onToggleFeature("free", "customDomain", event.target.checked)}
                      className="w-4 h-4"
                    />
                  ) : editable.free.customDomain ? (
                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {editingLimits ? (
                    <input
                      type="checkbox"
                      checked={editable.pro.customDomain}
                      onChange={(event) => onToggleFeature("pro", "customDomain", event.target.checked)}
                      className="w-4 h-4"
                    />
                  ) : editable.pro.customDomain ? (
                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {editingLimits ? (
                    <input
                      type="checkbox"
                      checked={editable.studio.customDomain}
                      onChange={(event) => onToggleFeature("studio", "customDomain", event.target.checked)}
                      className="w-4 h-4"
                    />
                  ) : editable.studio.customDomain ? (
                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Analytics Tools</td>
                <td className="px-6 py-4 text-center">
                  {editingLimits ? (
                    <input
                      type="checkbox"
                      checked={editable.free.analyticsTools}
                      onChange={(event) => onToggleFeature("free", "analyticsTools", event.target.checked)}
                      className="w-4 h-4"
                    />
                  ) : editable.free.analyticsTools ? (
                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {editingLimits ? (
                    <input
                      type="checkbox"
                      checked={editable.pro.analyticsTools}
                      onChange={(event) => onToggleFeature("pro", "analyticsTools", event.target.checked)}
                      className="w-4 h-4"
                    />
                  ) : editable.pro.analyticsTools ? (
                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {editingLimits ? (
                    <input
                      type="checkbox"
                      checked={editable.studio.analyticsTools}
                      onChange={(event) => onToggleFeature("studio", "analyticsTools", event.target.checked)}
                      className="w-4 h-4"
                    />
                  ) : editable.studio.analyticsTools ? (
                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-slate-900">Recent Subscription Changes</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {changes.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No subscription changes yet.</div>
          ) : (
            changes.map((change, index) => (
              <div key={`${change.user}-${index + 1}`} className="p-6 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${change.action.toLowerCase().includes("down") ? "bg-orange-50" : "bg-green-50"}`}>
                    {change.action.toLowerCase().includes("down") ? (
                      <TrendingDown className="w-5 h-5 text-orange-600" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{shortUser(change.user)}</p>
                    <p className="text-sm text-slate-600">
                      {change.action.toLowerCase().includes("down") ? "Downgraded" : "Upgraded"} from{" "}
                      <span className="font-medium">{formatPlan(change.from)}</span> to <span className="font-medium">{formatPlan(change.to)}</span>
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-500">{formatDateTime(change.at)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
