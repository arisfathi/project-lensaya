import { Upload } from "lucide-react";
import { Button } from "../../../../components/ui/Button";

type PortfolioHeaderProps = {
  totalItems: number;
  featuredCount: number;
  onUploadClick: () => void;
};

export function PortfolioHeader({ totalItems, featuredCount, onUploadClick }: PortfolioHeaderProps) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-6 sm:rounded-xl sm:border-slate-200 sm:bg-linear-to-br sm:from-white sm:to-slate-50 sm:p-6 sm:shadow-sm">
      <div className="flex flex-col gap-3.5 sm:gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-5">
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <span className="rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 sm:text-xs">
            {totalItems} photos
          </span>
          <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 sm:text-xs">
            {featuredCount} featured
          </span>
        </div>
        <Button className="w-full sm:w-auto" onClick={onUploadClick}>
          <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
          Upload Photos
        </Button>
      </div>
    </div>
  );
}
