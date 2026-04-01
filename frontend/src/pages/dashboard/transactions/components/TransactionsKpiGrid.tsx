import { CheckCircle, Clock3, CreditCard, DollarSign } from "lucide-react";
import type { TransactionSummary } from "../types";
import { formatCurrency } from "../utils";

type TransactionsKpiGridProps = {
  summary: TransactionSummary;
};

export function TransactionsKpiGrid({ summary }: TransactionsKpiGridProps) {
  const kpiCards = [
    {
      name: "Total Transactions",
      value: new Intl.NumberFormat().format(summary.totalTransactions),
      icon: CreditCard,
      bgColor: "bg-cyan-50",
      iconColor: "text-cyan-600",
    },
    {
      name: "Successful Payments",
      value: new Intl.NumberFormat().format(summary.successfulPayments),
      icon: CheckCircle,
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      name: "Pending Payments",
      value: new Intl.NumberFormat().format(summary.pendingPayments),
      icon: Clock3,
      bgColor: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      name: "Paid Amount",
      value: formatCurrency(summary.paidAmount, summary.currency),
      icon: DollarSign,
      bgColor: "bg-slate-100",
      iconColor: "text-slate-600",
    },
  ];

  return (
    <section className="mb-4 grid grid-cols-2 gap-2.5 sm:mb-6 sm:grid-cols-4 sm:gap-3">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.name} className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-3 sm:rounded-lg sm:px-4 sm:py-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{card.name}</p>
              <div className={`rounded-md p-1.5 ${card.bgColor}`}>
                <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${card.iconColor}`} />
              </div>
            </div>
            <p className="mt-1.5 text-lg font-semibold text-slate-900 sm:text-2xl">{card.value}</p>
          </article>
        );
      })}
    </section>
  );
}
