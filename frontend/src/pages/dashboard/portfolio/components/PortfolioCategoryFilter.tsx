import { Filter } from "lucide-react";

type PortfolioCategoryFilterProps = {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
};

export function PortfolioCategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
}: PortfolioCategoryFilterProps) {
  return (
    <div className="mb-4 sm:mb-6">
      <div className="mb-2 flex items-center gap-2 sm:mb-4">
        <Filter className="h-4 w-4 text-slate-500 sm:h-5 sm:w-5 sm:text-slate-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:text-base sm:font-medium sm:normal-case sm:tracking-normal sm:text-slate-900">Category</span>
      </div>
      <div className="scrollbar-hide -mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-full gap-1.5 sm:flex sm:min-w-0 sm:flex-wrap sm:gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors sm:rounded-lg sm:px-4 sm:py-2 sm:text-sm sm:font-medium ${
              selectedCategory === category
                ? "bg-slate-900 text-white sm:bg-cyan-500"
                : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-300"
            }`}
          >
            {category}
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}
