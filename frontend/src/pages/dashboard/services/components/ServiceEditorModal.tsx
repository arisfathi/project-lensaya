import type { RefObject } from "react";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { FormInput, FormTextArea } from "../../../../components/ui/FormInput";
import { DEFAULT_SERVICE_EMOJI } from "../constants";
import type { EmojiPickerComponent, EmojiSelection, ServiceForm } from "../types";

type ServiceEditorModalProps = {
  modal: {
    open: boolean;
    saving: boolean;
    title: string;
  };
  formState: {
    form: ServiceForm;
    formError: string | null;
  };
  emojiState: {
    showEmojiPicker: boolean;
    isEmojiPickerLoading: boolean;
    emojiData: unknown;
    EmojiPicker: EmojiPickerComponent | null;
  };
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  handlers: {
    onClose: () => void;
    onSave: () => void;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onOrderChange: (value: string) => void;
    onToggleEmojiPicker: () => void;
    onEmojiSelect: (emoji: EmojiSelection) => void;
  };
};

export function ServiceEditorModal({ modal, formState, emojiState, emojiPickerRef, handlers }: ServiceEditorModalProps) {
  const Picker = emojiState.EmojiPicker;

  return (
    <Modal
      open={modal.open}
      onClose={handlers.onClose}
      title={modal.title}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handlers.onClose} disabled={modal.saving}>
            Cancel
          </Button>
          <Button onClick={handlers.onSave} disabled={modal.saving}>
            {modal.saving ? "Saving..." : modal.title === "Edit Service" ? "Save Changes" : "Create Service"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormInput
          label="Service Name"
          value={formState.form.name}
          onChange={(event) => handlers.onNameChange(event.target.value)}
          placeholder="Wedding Photography"
        />
        <FormTextArea
          label="Description"
          value={formState.form.description}
          onChange={(event) => handlers.onDescriptionChange(event.target.value)}
          placeholder="Describe what this service includes"
          rows={4}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative" ref={emojiPickerRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1">Emoji</label>
            <button
              type="button"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-left hover:border-cyan-400 transition-colors"
              onClick={handlers.onToggleEmojiPicker}
            >
              <span className="inline-flex items-center gap-3">
                <span className="text-2xl leading-none">{formState.form.emoji || DEFAULT_SERVICE_EMOJI}</span>
                <span className="text-sm text-slate-600">{formState.form.emoji ? "Change emoji" : "Select an emoji"}</span>
              </span>
            </button>

            {emojiState.showEmojiPicker ? (
              <div className="absolute z-[80] mt-2">
                {Picker && emojiState.emojiData ? (
                  <Picker
                    data={emojiState.emojiData}
                    previewPosition="none"
                    theme="light"
                    onEmojiSelect={handlers.onEmojiSelect}
                  />
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-lg">
                    {emojiState.isEmojiPickerLoading ? "Loading emoji picker..." : "Unable to load emoji picker."}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <FormInput
            label="Display Order"
            type="number"
            min={0}
            value={formState.form.order}
            onChange={(event) => handlers.onOrderChange(event.target.value)}
          />
        </div>
        {formState.formError ? <p className="text-sm text-red-600">{formState.formError}</p> : null}
      </div>
    </Modal>
  );
}
