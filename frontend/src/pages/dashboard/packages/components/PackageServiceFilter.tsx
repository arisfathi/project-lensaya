import { Dropdown } from "../../../../components/ui/Dropdown";

type PackageServiceFilterProps = {
  selectedServiceId: string;
  serviceOptions: Array<{ value: string; label: string }>;
  onChange: (serviceId: string) => void;
};

export function PackageServiceFilter({ selectedServiceId, serviceOptions, onChange }: PackageServiceFilterProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mb-6">
      <Dropdown
        label="Filter by service"
        value={selectedServiceId}
        options={serviceOptions}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
