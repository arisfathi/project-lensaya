import { ChevronLeft, ChevronRight, CreditCard, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { TRANSACTION_STATUS_CONFIG } from "../constants";
import type { PaginationMeta, StatusFilter, TransactionItem } from "../types";
import { toPlanLabel } from "../../../../lib/entitlements";
import {
  formatBillingCycleLabel,
  formatCurrency,
  formatDate,
  normalizeTransactionStatus,
  shortId,
  toLower,
} from "../utils";

type TransactionsHistoryProps = {
  data: {
    rows: TransactionItem[];
    pagination: PaginationMeta;
    page: number;
    statusFilter: StatusFilter;
    currentPlan: string;
    upgradeTarget: string;
    rangeStart: number;
    rangeEnd: number;
  };
  handlers: {
    onStatusFilterChange: (value: StatusFilter) => void;
    onPreviousPage: () => void;
    onNextPage: () => void;
  };
};

export function TransactionsHistory({ data, handlers }: TransactionsHistoryProps) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 sm:rounded-xl sm:border-slate-200 sm:p-6 sm:shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Transaction History</h2>
          <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">View payments and plan changes.</p>
        </div>

        <div className="flex items-center gap-2 sm:justify-end">
          <label htmlFor="status-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
          </label>
          <select
            id="status-filter"
            value={data.statusFilter}
            onChange={(event) => {
              handlers.onStatusFilterChange(event.target.value as StatusFilter);
            }}
            className="min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="CANCELED">Canceled</option>
          </select>
        </div>
      </div>

      {data.rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 py-10 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <CreditCard className="h-5 w-5 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No Transactions Found</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
            {data.statusFilter === "ALL"
              ? "You don't have any payment transactions yet."
              : `No ${toLower(data.statusFilter)} transactions found.`}
          </p>
          {data.currentPlan === "FREE" ? (
            <Link
              to="/dashboard/pricing"
              className="mt-4 inline-flex rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-600"
            >
              Upgrade to {toPlanLabel(data.upgradeTarget)}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[840px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Transaction</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Plan</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Receipt</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((transaction) => {
                  const status = normalizeTransactionStatus(transaction.status);
                  const config = TRANSACTION_STATUS_CONFIG[status];
                  const StatusIcon = config.icon;

                  return (
                    <tr key={transaction.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="rounded-lg bg-slate-100 p-1.5">
                            <CreditCard className="h-3.5 w-3.5 text-slate-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 capitalize">{transaction.description || "Subscription payment"}</p>
                            <p className="text-xs text-slate-500">
                              {shortId(transaction.id)} - {String(transaction.provider || "manual").toUpperCase()}
                            </p>
                            {transaction.failureReason ? <p className="mt-0.5 text-xs text-red-600">{transaction.failureReason}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-700">
                        <div className="font-medium text-slate-900">{transaction.plan || "N/A"}</div>
                        <div className="text-xs text-slate-500">{formatBillingCycleLabel(transaction.billingCycle || "monthly")}</div>
                      </td>
                      <td className="px-3 py-3.5 text-sm font-semibold text-slate-900">
                        {formatCurrency(Number(transaction.amount || 0), transaction.currency || "USD")}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.color}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-700">
                        {transaction.receiptAvailable && transaction.receiptUrl ? (
                          <a href={transaction.receiptUrl} target="_blank" rel="noreferrer" className="font-medium text-cyan-700 hover:text-cyan-800">
                            Download
                          </a>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <FileText className="h-3.5 w-3.5" />
                            <span>
                              {transaction.receiptLabel &&
                              /live provider integration|receipt placeholder/i.test(transaction.receiptLabel)
                                ? "Receipt not available in-app yet."
                                : (transaction.receiptLabel || "Receipt not available in-app yet.")}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-slate-700">{formatDate(transaction.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2.5 lg:hidden">
            {data.rows.map((transaction) => {
              const status = normalizeTransactionStatus(transaction.status);
              const config = TRANSACTION_STATUS_CONFIG[status];
              const StatusIcon = config.icon;

              return (
                <article key={transaction.id} className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium capitalize text-slate-900">{transaction.description || "Subscription payment"}</p>
                      <p className="text-xs text-slate-500">{shortId(transaction.id)}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCurrency(Number(transaction.amount || 0), transaction.currency || "USD")}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {config.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {(transaction.plan || "N/A") + " - " + formatBillingCycleLabel(transaction.billingCycle || "monthly")}
                    </span>
                  </div>

                  {transaction.failureReason ? <p className="mt-2 text-xs text-red-600">{transaction.failureReason}</p> : null}

                  <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span>{formatDate(transaction.createdAt)}</span>
                    <span className="truncate text-right">
                      {transaction.receiptLabel && /live provider integration|receipt placeholder/i.test(transaction.receiptLabel)
                        ? "Receipt not available in-app yet."
                        : (transaction.receiptLabel || "Receipt not available in-app yet.")}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          {data.pagination.totalPages > 1 ? (
            <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-3.5 sm:flex-row sm:items-center">
              <p className="text-xs text-slate-600 sm:text-sm">
                Showing {data.rangeStart}-{data.rangeEnd} of {data.pagination.total} transactions
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlers.onPreviousPage}
                  disabled={data.page <= 1}
                  className="rounded-lg border border-slate-200 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                </button>
                <span className="rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-white">{data.pagination.page}</span>
                <button
                  type="button"
                  onClick={handlers.onNextPage}
                  disabled={data.page >= (data.pagination.totalPages || 1)}
                  className="rounded-lg border border-slate-200 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
