import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { Dropdown } from "../../../../components/ui/Dropdown";
import { FormInput } from "../../../../components/ui/FormInput";
import type { EditForm, ServiceItem } from "../types";

type EditPortfolioModalProps = {
  modal: {
    open: boolean;
    saving: boolean;
  };
  formState: {
    form: EditForm;
    services: ServiceItem[];
  };
  handlers: {
    onClose: () => void;
    onSave: () => void;
    onServiceIdChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
    onFeaturedChange: (value: boolean) => void;
  };
};

export function EditPortfolioModal({ modal, formState, handlers }: EditPortfolioModalProps) {
  return (
    <Modal
      open={modal.open}
      onClose={handlers.onClose}
      title="Edit Portfolio Item"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handlers.onClose} disabled={modal.saving}>
            Cancel
          </Button>
          <Button onClick={handlers.onSave} disabled={modal.saving}>
            {modal.saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Dropdown
          label="Service"
          value={formState.form.serviceId}
          onChange={(event) => handlers.onServiceIdChange(event.target.value)}
          options={[{ value: "", label: "No service" }, ...formState.services.map((service) => ({ value: service.id, label: service.name }))]}
        />

        <FormInput
          label="Category"
          value={formState.form.category}
          onChange={(event) => handlers.onCategoryChange(event.target.value)}
          placeholder="Portrait"
        />

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={formState.form.featured}
            onChange={(event) => handlers.onFeaturedChange(event.target.checked)}
          />
          Mark as featured
        </label>
      </div>
    </Modal>
  );
}
