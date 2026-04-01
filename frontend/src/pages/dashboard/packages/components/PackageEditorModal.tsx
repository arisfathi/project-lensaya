import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { FormInput, FormTextArea } from "../../../../components/ui/FormInput";
import { Dropdown } from "../../../../components/ui/Dropdown";
import type { PackageForm } from "../types";

type PackageEditorModalProps = {
  modal: {
    open: boolean;
    title: string;
    saving: boolean;
  };
  formState: {
    form: PackageForm;
    formError: string | null;
    featureHint: string;
    serviceOptions: Array<{ value: string; label: string }>;
  };
  handlers: {
    onClose: () => void;
    onSave: () => void;
    onServiceIdChange: (value: string) => void;
    onNameChange: (value: string) => void;
    onPriceChange: (value: string) => void;
    onDurationChange: (value: string) => void;
    onFeaturesTextChange: (value: string) => void;
    onPopularChange: (value: boolean) => void;
  };
};

export function PackageEditorModal({ modal, formState, handlers }: PackageEditorModalProps) {
  return (
    <Modal
      open={modal.open}
      title={modal.title}
      onClose={handlers.onClose}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handlers.onClose} disabled={modal.saving}>
            Cancel
          </Button>
          <Button onClick={handlers.onSave} disabled={modal.saving}>
            {modal.saving ? "Saving..." : modal.title === "Edit Package" ? "Save Changes" : "Create Package"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Dropdown
          label="Service"
          value={formState.form.serviceId}
          onChange={(event) => handlers.onServiceIdChange(event.target.value)}
          options={formState.serviceOptions}
        />

        <FormInput
          label="Package Name"
          value={formState.form.name}
          onChange={(event) => handlers.onNameChange(event.target.value)}
          placeholder="Premium Wedding Package"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Price"
            type="number"
            min={0}
            step="0.01"
            value={formState.form.price}
            onChange={(event) => handlers.onPriceChange(event.target.value)}
            placeholder="1500"
          />
          <FormInput
            label="Duration"
            value={formState.form.duration}
            onChange={(event) => handlers.onDurationChange(event.target.value)}
            placeholder="6 hours"
            hint="Example: 2 hours, 4 hours, half day, full day"
          />
        </div>

        <FormTextArea
          label="Features (one per line)"
          value={formState.form.featuresText}
          onChange={(event) => handlers.onFeaturesTextChange(event.target.value)}
          rows={5}
          placeholder={"6 hours coverage\n300 edited photos\nOnline gallery"}
          hint={formState.featureHint}
        />

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={formState.form.popular}
            onChange={(event) => handlers.onPopularChange(event.target.checked)}
            className="rounded border-gray-300"
          />
          Mark as popular package
        </label>

        {formState.formError ? <p className="text-sm text-red-600">{formState.formError}</p> : null}
      </div>
    </Modal>
  );
}
