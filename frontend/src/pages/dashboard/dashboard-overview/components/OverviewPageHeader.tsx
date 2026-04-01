import { DashboardPageHero } from "../../../../components/dashboard/DashboardPageHero";

export function OverviewPageHeader() {
  const now = new Date();
  const dayLabel = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <DashboardPageHero
      eyebrow="Studio Command Center"
      title="Dashboard"
      description="Track your live performance, usage limits, and website momentum at a glance."
      badge={
        <span className="rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
          {dayLabel}
        </span>
      }
    />
  );
}
