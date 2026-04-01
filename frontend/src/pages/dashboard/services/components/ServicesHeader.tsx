import { Plus } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { DashboardPageHero } from "../../../../components/dashboard/DashboardPageHero";

type ServicesHeaderProps = {
  onCreate: () => void;
};

export function ServicesHeader({ onCreate }: ServicesHeaderProps) {
  return (
    <DashboardPageHero
      eyebrow="Creative Services"
      title="Services"
      description="Manage your photography services and offerings"
      action={
        <Button className="w-full sm:w-auto" onClick={onCreate}>
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
          Add Service
        </Button>
      }
    />
  );
}
