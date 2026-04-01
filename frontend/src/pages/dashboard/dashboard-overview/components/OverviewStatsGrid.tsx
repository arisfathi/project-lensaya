import { Eye, MessageCircle, MousePointerClick, Percent } from "lucide-react";
import type { OverviewResponse } from "../types";
import { formatNumber } from "../utils";

type OverviewStatsGridProps = {
  stats: OverviewResponse["stats"] | undefined;
};

export function OverviewStatsGrid({ stats }: OverviewStatsGridProps) {
  const cards = [
    {
      name: "Portfolio Views",
      value: formatNumber(stats?.portfolioViews || 0),
      icon: Eye,
      bgColor: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
    {
      name: "WhatsApp Clicks",
      value: formatNumber(stats?.whatsappClicks || 0),
      icon: MessageCircle,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      name: "Inquiries",
      value: formatNumber(stats?.inquiries || 0),
      icon: MousePointerClick,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      name: "Conversion Rate",
      value: `${Number(stats?.conversionRate || 0).toFixed(2)}%`,
      icon: Percent,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-500",
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-2.5 sm:mb-8 sm:gap-4 lg:grid-cols-4 lg:gap-6">
      {cards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.name} className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 sm:border-gray-200 sm:p-5 sm:shadow-sm">
            <div className="mb-2.5 flex items-center justify-between sm:mb-4">
              <div className={`rounded-lg p-1.5 sm:p-2 ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`} />
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 sm:text-xs sm:text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Live
              </span>
            </div>
            <p className="text-lg font-semibold leading-none text-slate-900 sm:mb-1 sm:text-2xl sm:font-bold">{stat.value}</p>
            <p className="mt-1 text-[11px] text-slate-600 sm:text-sm">{stat.name}</p>
          </div>
        );
      })}
    </div>
  );
}
