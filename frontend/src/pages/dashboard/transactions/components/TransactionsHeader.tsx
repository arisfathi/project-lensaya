import { DashboardPageHero } from "../../../../components/dashboard/DashboardPageHero";

export function TransactionsHeader() {
  return (
    <DashboardPageHero
      eyebrow="Studio Billing"
      title="Billing Center"
      description="Track payments, manage renewals, and control your plan from one place."
      badge={
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
          Live
        </span>
      }
    />
  );
}
