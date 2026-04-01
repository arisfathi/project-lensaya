import type { ReactNode } from "react";

type DashboardPageHeroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
};

export function DashboardPageHero({
  eyebrow,
  title,
  description,
  badge,
  children,
  action,
}: DashboardPageHeroProps) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-6 sm:rounded-xl sm:border-slate-200 sm:px-6 sm:py-5 sm:shadow-sm">
      <div className="flex flex-col gap-3.5 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">{eyebrow}</p>
          )}
          <div className={`flex flex-wrap items-center gap-2 ${eyebrow ? "mt-2 sm:mt-0" : "mt-0"}`}>
            <h1 className={`font-semibold text-slate-900 ${eyebrow ? "text-lg" : "text-xl"} sm:text-3xl sm:font-bold`}>
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {description && <p className="mt-1 text-sm text-slate-600 sm:text-base">{description}</p>}
          {children && <div className="mt-3">{children}</div>}
        </div>
        {action && <div className="w-full sm:w-auto sm:shrink-0">{action}</div>}
      </div>
    </section>
  );
}
