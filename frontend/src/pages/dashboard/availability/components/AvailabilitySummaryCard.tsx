import { Save } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import type { AvailabilityLegendItem } from "../types";

type AvailabilitySummaryCardProps = {
  changedCount: number;
  saving: boolean;
  onSave: () => void;
  availabilityLegend: AvailabilityLegendItem[];
};

export function AvailabilitySummaryCard({
  changedCount,
  saving,
  onSave,
  availabilityLegend,
}: AvailabilitySummaryCardProps) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-6 sm:rounded-xl sm:border-slate-200 sm:bg-linear-to-br sm:from-white sm:to-slate-50 sm:p-6 sm:shadow-sm">
      <div className="flex flex-col gap-3.5 sm:gap-4 xl:flex-row xl:items-start xl:justify-between xl:gap-5">
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {availabilityLegend.map((item) => (
              <div key={item.key} className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 sm:px-3 sm:py-2">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded border sm:h-3.5 sm:w-3.5 ${item.swatchClass}`} />
                  <span className={`text-[11px] font-medium sm:text-xs ${item.textClass}`}>{item.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full xl:w-auto">
          <Button onClick={onSave} disabled={saving || changedCount === 0} className="w-full text-sm xl:w-auto">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : `Save Changes${changedCount ? ` (${changedCount})` : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
