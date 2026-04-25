import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { usePricingContent } from "../../../../hooks/usePricingContent";
import { trackPricingEventSafe } from "../../../../lib/pricingAnalytics";
import { resolvePricingUpgradeCopy } from "../../../../lib/pricingContent";
import type { UsageCard } from "../types";
import { formatUsageLimit } from "../utils";

type PlanUsageSectionProps = {
  usageCards: UsageCard[];
  currentPlan: string;
  photographerId?: string | null;
};

export function PlanUsageSection({ usageCards, currentPlan, photographerId = null }: PlanUsageSectionProps) {
  const [activeUpgradeCardId, setActiveUpgradeCardId] = useState<string | null>(null);
  const pricingContent = usePricingContent();
  const shownUsageEventsRef = useRef<Set<string>>(new Set());

  const activeUpgradeCard = useMemo(
    () => usageCards.find((card) => card.id === activeUpgradeCardId) || null,
    [activeUpgradeCardId, usageCards]
  );

  const activeUpgradeCopy = resolvePricingUpgradeCopy(pricingContent, activeUpgradeCard?.upgradeTarget);

  useEffect(() => {
    for (const card of usageCards) {
      if (card.status !== "warning" && card.status !== "critical") continue;

      const eventName = card.status === "critical" ? "usage_limit_blocked" : "usage_warning_shown";
      const dedupeKey = `${eventName}:${card.id}:${card.used}:${card.limit}:${card.upgradeTarget || "none"}`;
      if (shownUsageEventsRef.current.has(dedupeKey)) continue;
      shownUsageEventsRef.current.add(dedupeKey);

      trackPricingEventSafe({
        eventName,
        pageContext: "dashboard_overview_usage",
        currentPlan,
        targetPlan: card.upgradeTarget,
        featureKey: card.id,
        currentUsage: card.used,
        allowedLimit: card.limit,
        photographerId,
        source: "dashboard",
      });
    }
  }, [currentPlan, photographerId, usageCards]);

  if (usageCards.length === 0) return null;

  return (
    <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-8 sm:rounded-xl sm:border-gray-200 sm:p-6 sm:shadow-sm">
      <div className="mb-3.5 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Plan Usage</h3>
          <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">Track limits before hard stops.</p>
        </div>
        <Link
          to="/dashboard/pricing"
          className="inline-flex items-center rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 sm:px-3 sm:py-2 sm:text-sm"
        >
          Compare Plans
        </Link>
      </div>

      <div className="space-y-2.5 sm:grid sm:grid-cols-1 sm:gap-3 md:grid-cols-3 md:gap-4 md:space-y-0">
        {usageCards.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 sm:rounded-lg sm:border-gray-200 sm:bg-white sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{item.label}</p>
                {item.nearLimit && item.status !== "critical" ? (
                  <p className="mt-1 text-[11px] font-semibold text-amber-700">Approaching limit</p>
                ) : null}
                {item.status === "critical" ? (
                  <p className="mt-1 text-[11px] font-semibold text-red-700">Limit reached on current plan</p>
                ) : null}
              </div>
              <p className="text-xs font-semibold text-slate-700">
                {item.used} / {formatUsageLimit(item.limit, item.unit)}
              </p>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 sm:mt-3 sm:h-2 sm:bg-slate-100">
              <div
                className={`h-1.5 transition-all sm:h-2 ${
                  item.status === "critical"
                    ? "bg-red-500"
                    : item.status === "warning"
                      ? "bg-amber-500"
                      : "bg-cyan-500"
                }`}
                style={{ width: `${item.percent}%` }}
              />
            </div>
            {item.context ? <p className="mt-2 text-[11px] text-slate-500 sm:text-xs">{item.context}</p> : null}
            {item.status !== "unlimited" ? (
              <p className="mt-2 text-[11px] text-slate-600 sm:text-xs">Remaining: {item.remainingLabel}</p>
            ) : null}
            {item.suggestionText ? (
              <p className="mt-2 text-[11px] font-medium text-cyan-700 sm:text-xs">{item.suggestionText}</p>
            ) : item.status === "unlimited" ? (
              <p className="mt-2 text-[11px] text-slate-500 sm:text-xs">Unlimited on your current plan.</p>
            ) : null}
            {item.upgradeTarget ? (
              <button
                type="button"
                onClick={() => {
                  trackPricingEventSafe({
                    eventName: "upgrade_modal_opened",
                    pageContext: "dashboard_overview_usage",
                    currentPlan,
                    targetPlan: item.upgradeTarget,
                    featureKey: item.id,
                    currentUsage: item.used,
                    allowedLimit: item.limit,
                    photographerId,
                    source: "dashboard",
                  });
                  setActiveUpgradeCardId(item.id);
                }}
                className="mt-2 text-[11px] font-semibold text-cyan-700 underline decoration-cyan-300 underline-offset-2 transition-colors hover:text-cyan-800 sm:text-xs"
              >
                See unlock details
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(activeUpgradeCard)}
        title={activeUpgradeCopy.title}
        onClose={() => {
          if (activeUpgradeCard) {
            trackPricingEventSafe({
              eventName: "upgrade_modal_dismissed",
              pageContext: "dashboard_overview_usage",
              currentPlan,
              targetPlan: activeUpgradeCard.upgradeTarget,
              featureKey: activeUpgradeCard.id,
              currentUsage: activeUpgradeCard.used,
              allowedLimit: activeUpgradeCard.limit,
              photographerId,
              source: "dashboard",
              metadata: {
                dismiss_reason: "overlay_or_escape",
              },
            });
          }
          setActiveUpgradeCardId(null);
        }}
        footer={
          activeUpgradeCard?.upgradeTarget ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  trackPricingEventSafe({
                    eventName: "upgrade_modal_dismissed",
                    pageContext: "dashboard_overview_usage",
                    currentPlan,
                    targetPlan: activeUpgradeCard.upgradeTarget,
                    featureKey: activeUpgradeCard.id,
                    currentUsage: activeUpgradeCard.used,
                    allowedLimit: activeUpgradeCard.limit,
                    photographerId,
                    source: "dashboard",
                    metadata: {
                      dismiss_reason: "button_maybe_later",
                    },
                  });
                  setActiveUpgradeCardId(null);
                }}
              >
                Maybe Later
              </Button>
              <Link to="/dashboard/pricing" className="inline-flex">
                <Button
                  onClick={() => {
                    trackPricingEventSafe({
                      eventName: "upgrade_modal_confirmed",
                      pageContext: "dashboard_overview_usage",
                      currentPlan,
                      targetPlan: activeUpgradeCard.upgradeTarget,
                      featureKey: activeUpgradeCard.id,
                      currentUsage: activeUpgradeCard.used,
                      allowedLimit: activeUpgradeCard.limit,
                      photographerId,
                      source: "dashboard",
                    });
                    setActiveUpgradeCardId(null);
                  }}
                >
                  Upgrade to {activeUpgradeCard.upgradeTarget}
                </Button>
              </Link>
            </div>
          ) : null
        }
      >
        {activeUpgradeCard ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current usage</p>
              <p className="mt-1 text-sm text-slate-700">
                {activeUpgradeCard.used} / {formatUsageLimit(activeUpgradeCard.limit, activeUpgradeCard.unit)}
              </p>
              <p className="mt-1 text-xs text-slate-600">Remaining: {activeUpgradeCard.remainingLabel}</p>
            </div>

            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Unlock on next plan</p>
              <p className="mt-1 text-sm font-semibold text-cyan-900">{activeUpgradeCard.unlockValueLabel || "Higher limits available"}</p>
              <p className="mt-1 text-xs text-cyan-800">{activeUpgradeCopy.description}</p>
            </div>

            {activeUpgradeCard.comparisonBenefits.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current plan vs next plan</p>
                <ul className="mt-2 space-y-1.5">
                  {activeUpgradeCard.comparisonBenefits.map((benefit) => (
                    <li key={benefit} className="text-sm text-slate-700">
                      - {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
