import { Plus } from "lucide-react";
import { Button } from "../../../../components/ui/Button";

type PackagesHeaderProps = {
  canCreate: boolean;
  onCreate: () => void;
};

export function PackagesHeader({ canCreate, onCreate }: PackagesHeaderProps) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-6 sm:rounded-xl sm:border-slate-200 sm:bg-linear-to-br sm:from-white sm:to-slate-50 sm:p-6 sm:shadow-sm">
      <div className="flex justify-end">
        <Button className="w-full sm:w-auto" onClick={onCreate} disabled={!canCreate}>
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
          Add Package
        </Button>
      </div>
    </div>
  );
}
