import { ArrowRight, Lock, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePricingContent } from "../../../../hooks/usePricingContent";
import { resolvePricingUpgradeCopy } from "../../../../lib/pricingContent";
import { formatNumber } from "../utils";

type GoalTrackerData = {
  locked: boolean;
  monthLabel: string;
  inquiriesMonthToDate: number;
  daysElapsedInMonth: number;
  daysInMonth: number;
  daysRemainingInMonth: number;
  currentDailyPace: number;
  projectedInquiries: number;
  suggestedGoal: number;
  requiredDailyRateToGoal: number;
  onTrackForSuggestedGoal: boolean;
  history: Array<{
    key: string;
    label: string;
    monthLabel: string;
    inquiries: number;
    target: number;
    attainmentPercent: number;
    achieved: boolean;
    isCurrentMonth: boolean;
  }>;
  streak: {
    current: number;
    best: number;
    totalMonthsAchieved: number;
  };
  badges: Array<{
    id: string;
    label: string;
    threshold: number;
    earned: boolean;
  }>;
};

type AnalyticsGoalTrackerSectionProps = {
  data: {
    hasFullAccess: boolean;
    upgradeTarget: string;
    goalTracker: GoalTrackerData | null;
    activeGoal: number;
  };
  actions: {
    onGoalChange: (nextGoal: number) => void;
    onGoalSave: (nextGoal: number) => void;
    saving: boolean;
    onUpgradeClick: (surface: string) => void;
  };
};

export function AnalyticsGoalTrackerSection({ data, actions }: AnalyticsGoalTrackerSectionProps) {
  const [historyRange, setHistoryRange] = useState<4 | 12>(4);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const pricingContent = usePricingContent();
  const upgradeCopy = resolvePricingUpgradeCopy(pricingContent, data.upgradeTarget);

  const goalTracker = data.goalTracker;
  const goalHistory = useMemo(() => goalTracker?.history ?? [], [goalTracker?.history]);

  const visibleHistory = useMemo(() => {
    const sorted = [...goalHistory];
    return historyRange === 12 ? sorted : sorted.slice(-4);
  }, [goalHistory, historyRange]);

  const selectedHistoryMonth = useMemo(() => {
    if (visibleHistory.length === 0) return null;
    const fallback = visibleHistory[visibleHistory.length - 1];
    if (!selectedMonthKey) return fallback;
    return visibleHistory.find((item) => item.key === selectedMonthKey) || fallback;
  }, [selectedMonthKey, visibleHistory]);

  if (!goalTracker) return null;

  const target = Math.max(1, Math.floor(data.activeGoal || goalTracker.suggestedGoal || 1));
  const progressPercent = Math.min(100, Number(((goalTracker.inquiriesMonthToDate / target) * 100).toFixed(1)));
  const remaining = Math.max(target - goalTracker.inquiriesMonthToDate, 0);
  const requiredDailyRate = remaining > 0
    ? Number((remaining / Math.max(goalTracker.daysRemainingInMonth, 1)).toFixed(2))
    : 0;
  const projectedVsTarget = goalTracker.projectedInquiries - target;

  return (
    <section className="mb-6 rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-sm md:mb-8 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 md:text-xl">Inquiry Goal Tracker</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
            Set a monthly target and track whether current pace can hit it by month end.
          </p>
        </div>
        {!data.hasFullAccess || goalTracker.locked ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <Lock className="h-3.5 w-3.5" />
            Preview
          </span>
        ) : null}
      </div>

      {!data.hasFullAccess || goalTracker.locked ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 md:mt-6">
          <p className="text-sm font-semibold text-slate-900">Goal pacing is locked on Free.</p>
          <p className="mt-1 text-xs text-slate-600 md:text-sm">{upgradeCopy.description}</p>
          <Link
            to="/dashboard/pricing"
            onClick={() => {
              actions.onUpgradeClick("analytics_goal_tracker_cta");
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Unlock Goal Tracker
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-3">
            <div className="md:col-span-2 rounded-2xl border border-cyan-100 bg-linear-to-br from-cyan-50 to-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">{goalTracker.monthLabel}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{formatNumber(goalTracker.inquiriesMonthToDate)} / {formatNumber(target)}</p>
                  <p className="mt-1 text-xs text-slate-600">Inquiries completed against your target</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                  <Target className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-cyan-100">
                <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(progressPercent, 4)}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-600">{progressPercent}% complete</span>
                <span className={projectedVsTarget >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                  {projectedVsTarget >= 0 ? `Projected +${projectedVsTarget.toFixed(1)}` : `Projected ${projectedVsTarget.toFixed(1)}`}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <label htmlFor="inquiry-goal-target" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Monthly Inquiry Goal
              </label>
              <input
                id="inquiry-goal-target"
                type="number"
                min={1}
                step={1}
                value={target}
                onChange={(event) => {
                  const next = Number(event.target.value || 0);
                  actions.onGoalChange(next > 0 ? Math.floor(next) : 1);
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none ring-cyan-200 transition focus:border-cyan-400 focus:ring-2"
              />
              <p className="mt-3 text-xs text-slate-600">
                Suggested goal: <span className="font-semibold text-slate-900">{formatNumber(goalTracker.suggestedGoal)}</span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Required pace: <span className="font-semibold text-slate-900">{requiredDailyRate.toFixed(2)}/day</span> for the next {goalTracker.daysRemainingInMonth} days.
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Current pace: <span className="font-semibold text-slate-900">{goalTracker.currentDailyPace.toFixed(2)}/day</span>
              </p>
              <button
                type="button"
                disabled={actions.saving}
                onClick={() => {
                  actions.onGoalSave(target);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {actions.saving ? "Saving..." : "Save Goal"}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:mt-5">
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Current Streak</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{goalTracker.streak.current} mo</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Best Streak</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{goalTracker.streak.best} mo</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Months Achieved</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{goalTracker.streak.totalMonthsAchieved}</p>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {goalTracker.badges.map((badge) => (
                <span
                  key={badge.id}
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.earned ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Goal Attainment Timeline</p>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => {
                    setHistoryRange(4);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${historyRange === 4 ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  4M
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryRange(12);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${historyRange === 12 ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  12M
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <label htmlFor="goal-history-month" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Month Snapshot
              </label>
              <select
                id="goal-history-month"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900"
                value={selectedHistoryMonth?.key || ""}
                onChange={(event) => {
                  setSelectedMonthKey(event.target.value || null);
                }}
              >
                {visibleHistory.map((item) => (
                  <option key={item.key} value={item.key}>{item.monthLabel}</option>
                ))}
              </select>

              {selectedHistoryMonth ? (
                <p className="mt-2 text-xs text-slate-600">
                  {formatNumber(selectedHistoryMonth.inquiries)} inquiries against {formatNumber(selectedHistoryMonth.target)} target ({selectedHistoryMonth.attainmentPercent.toFixed(1)}%).
                </p>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {visibleHistory.map((item) => {
                const progressWidth = Math.max(4, Math.min(100, item.attainmentPercent));
                return (
                  <div key={item.key} className={`rounded-xl border bg-white p-3 ${selectedHistoryMonth?.key === item.key ? "border-cyan-300 ring-1 ring-cyan-200" : "border-slate-200"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.achieved ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {item.achieved ? "Hit" : "Miss"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{formatNumber(item.inquiries)} / {formatNumber(item.target)}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${item.achieved ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${progressWidth}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{item.attainmentPercent.toFixed(1)}% attainment</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
