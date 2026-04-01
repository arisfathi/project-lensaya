import { Briefcase, ImagePlus, Package, Plus, Sparkles, User } from "lucide-react";
import { Link } from "react-router-dom";
import type { QuickActionItem } from "../types";

type QuickActionsSectionProps = {
  quickActions: QuickActionItem[];
};

export function QuickActionsSection({ quickActions }: QuickActionsSectionProps) {
  const iconByAction: Record<QuickActionItem["icon"], typeof Plus> = {
    service: Briefcase,
    package: Package,
    portfolio: ImagePlus,
    profile: User,
    upgrade: Sparkles,
  };

  return (
    <div className="mb-6 sm:mb-8">
      <h3 className="mb-3 text-base font-semibold text-slate-900 sm:mb-4 sm:text-lg">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
        {quickActions.map((action) => (
          <Link key={action.name} to={action.path} className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 transition-all hover:border-cyan-300 hover:shadow-md sm:border-gray-200 sm:p-6">
            <div className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg ${action.color} sm:mb-3 sm:h-10 sm:w-10`}>
              {(() => {
                const Icon = iconByAction[action.icon];
                return <Icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />;
              })()}
            </div>
            <h4 className="mb-1 text-sm font-semibold leading-tight text-slate-900 sm:text-base">{action.name}</h4>
            <p className="text-[11px] leading-4 text-slate-600 sm:text-sm">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
