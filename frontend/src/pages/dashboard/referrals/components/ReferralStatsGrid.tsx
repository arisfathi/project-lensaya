import type { ReferralStatCard } from "../types";

type ReferralStatsGridProps = {
  stats: ReferralStatCard[];
};

export function ReferralStatsGrid({ stats }: ReferralStatsGridProps) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-2.5 sm:mb-8 sm:gap-4 lg:grid-cols-4 lg:gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.name} className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 sm:border-gray-200 sm:p-5">
            <div className="mb-2.5 flex items-center justify-between sm:mb-4">
              <div className={`rounded-lg p-1.5 sm:p-2.5 ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`} />
              </div>
            </div>
            <p className="text-lg font-semibold leading-none text-slate-900 sm:mb-1 sm:text-3xl sm:font-bold">{stat.value}</p>
            <p className="mt-1 text-[11px] text-slate-600 sm:text-sm">{stat.name}</p>
          </div>
        );
      })}
    </div>
  );
}
