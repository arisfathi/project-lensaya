import type { PlanName, PublicPricingContent } from "../types";

type PublicPricingData = {
  draft: PublicPricingContent;
  updatedAt: string | null;
  saving: boolean;
};

type PublicPricingActions = {
  onSave: () => void;
  onPublicSectionChange: (field: "title" | "subtitle", value: string) => void;
  onPublicFaqChange: (index: number, field: "question" | "answer", value: string) => void;
  onAddFaq: () => void;
  onRemoveFaq: (index: number) => void;
  onMoveFaq: (index: number, direction: -1 | 1) => void;
  onUpgradeTransitionChange: (plan: "PRO" | "STUDIO", field: "title" | "description", value: string) => void;
  onUpgradeCopyChange: (field: "warning" | "blocked" | "empty", value: string) => void;
  onPublicBulletChange: (plan: PlanName, value: string) => void;
  onPublicRowFieldChange: (rowIndex: number, field: "label" | "FREE" | "PRO" | "STUDIO", value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (rowIndex: number) => void;
  onMoveRow: (rowIndex: number, direction: -1 | 1) => void;
};

type PublicPricingContentSectionProps = {
  data: PublicPricingData;
  actions: PublicPricingActions;
  formatDateTime: (value: string) => string;
};

export function PublicPricingContentSection({ data, actions, formatDateTime }: PublicPricingContentSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Public Pricing Content</h3>
          <p className="text-sm text-slate-600 mt-1">
            Controls `/pricing` feature bullets and compare table rows. Prices still follow real billing plans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/pricing"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 border border-gray-200 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Preview /pricing
          </a>
          <button
            type="button"
            onClick={actions.onSave}
            disabled={data.saving}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {data.saving ? "Saving..." : "Save Public Pricing"}
          </button>
        </div>
      </div>

      <div className="p-6 border-b border-gray-200">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600 mb-4">Pricing Section Copy</h4>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Section Title</label>
            <input
              type="text"
              value={data.draft.section.title}
              onChange={(event) => actions.onPublicSectionChange("title", event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              maxLength={120}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Section Subtitle</label>
            <textarea
              value={data.draft.section.subtitle}
              onChange={(event) => actions.onPublicSectionChange("subtitle", event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              maxLength={300}
            />
          </div>
        </div>
      </div>

      <div className="p-6 border-b border-gray-200">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">FAQ Entries</h4>
            <p className="mt-1 text-xs text-slate-500">These appear on the public pricing page below the plan cards.</p>
          </div>
          <button
            type="button"
            onClick={actions.onAddFaq}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Add FAQ
          </button>
        </div>

        <div className="space-y-4">
          {(data.draft.faq || []).map((item, index) => (
            <div key={`${item.question}-${index + 1}`} className="rounded-lg border border-gray-200 p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Question</label>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(event) => actions.onPublicFaqChange(index, "question", event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Answer</label>
                  <textarea
                    value={item.answer}
                    onChange={(event) => actions.onPublicFaqChange(index, "answer", event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => actions.onMoveFaq(index, -1)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                  disabled={index === 0}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => actions.onMoveFaq(index, 1)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                  disabled={index === data.draft.faq.length - 1}
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => actions.onRemoveFaq(index)}
                  className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 border-b border-gray-200">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600 mb-4">Upgrade Copy</h4>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UpgradeCopyEditor
            label="Free to Pro"
            title={data.draft.upgradeCopy.transitions.PRO.title}
            description={data.draft.upgradeCopy.transitions.PRO.description}
            onTitleChange={(value) => actions.onUpgradeTransitionChange("PRO", "title", value)}
            onDescriptionChange={(value) => actions.onUpgradeTransitionChange("PRO", "description", value)}
          />
          <UpgradeCopyEditor
            label="Pro to Studio"
            title={data.draft.upgradeCopy.transitions.STUDIO.title}
            description={data.draft.upgradeCopy.transitions.STUDIO.description}
            onTitleChange={(value) => actions.onUpgradeTransitionChange("STUDIO", "title", value)}
            onDescriptionChange={(value) => actions.onUpgradeTransitionChange("STUDIO", "description", value)}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TemplateEditor
            label="Pre-limit warning"
            value={data.draft.upgradeCopy.warning}
            onChange={(value) => actions.onUpgradeCopyChange("warning", value)}
            placeholder="You are close to your limit. Upgrade to {plan} for up to {limit}."
          />
          <TemplateEditor
            label="Blocked-state prompt"
            value={data.draft.upgradeCopy.blocked}
            onChange={(value) => actions.onUpgradeCopyChange("blocked", value)}
            placeholder="Limit reached. Upgrade to {plan} for up to {limit}."
          />
          <TemplateEditor
            label="Empty-state prompt"
            value={data.draft.upgradeCopy.empty}
            onChange={(value) => actions.onUpgradeCopyChange("empty", value)}
            placeholder="No extra room left on {plan}. Upgrade to {nextPlan} to keep moving without hard stops."
          />
        </div>
      </div>

      <div className="p-6 border-b border-gray-200">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600 mb-4">Feature Bullets</h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BulletEditor
            label="Free"
            value={(data.draft.bullets.FREE || []).join("\n")}
            onChange={(value) => actions.onPublicBulletChange("FREE", value)}
          />
          <BulletEditor
            label="Pro"
            value={(data.draft.bullets.PRO || []).join("\n")}
            onChange={(value) => actions.onPublicBulletChange("PRO", value)}
          />
          <BulletEditor
            label="Studio"
            value={(data.draft.bullets.STUDIO || []).join("\n")}
            onChange={(value) => actions.onPublicBulletChange("STUDIO", value)}
          />
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Compare Table Rows</h4>
          <button
            type="button"
            onClick={actions.onAddRow}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Add Row
          </button>
        </div>

        <div className="space-y-4">
          {(data.draft.compareRows || []).map((row, index) => (
            <div key={row.id || `row-${index + 1}`} className="rounded-lg border border-gray-200 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-end">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Row Label</label>
                  <input
                    type="text"
                    value={row.label}
                    onChange={(event) => actions.onPublicRowFieldChange(index, "label", event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <RowInput
                  label="Free"
                  value={row.values.FREE}
                  onChange={(value) => actions.onPublicRowFieldChange(index, "FREE", value)}
                />
                <RowInput
                  label="Pro"
                  value={row.values.PRO}
                  onChange={(value) => actions.onPublicRowFieldChange(index, "PRO", value)}
                />
                <RowInput
                  label="Studio"
                  value={row.values.STUDIO}
                  onChange={(value) => actions.onPublicRowFieldChange(index, "STUDIO", value)}
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => actions.onMoveRow(index, -1)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                  disabled={index === 0}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => actions.onMoveRow(index, 1)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                  disabled={index === data.draft.compareRows.length - 1}
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => actions.onRemoveRow(index)}
                  className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Last updated: {data.updatedAt ? formatDateTime(data.updatedAt) : "Never"}
        </p>
      </div>
    </div>
  );
}

type BulletEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function BulletEditor({ label, value, onChange }: BulletEditorProps) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-900 mb-2">{label}</p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        placeholder="One bullet per line"
      />
    </div>
  );
}

type UpgradeCopyEditorProps = {
  label: string;
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
};

function UpgradeCopyEditor({ label, title, description, onTitleChange, onDescriptionChange }: UpgradeCopyEditorProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-sm font-medium text-slate-900 mb-3">{label}</p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            maxLength={320}
          />
        </div>
      </div>
    </div>
  );
}

type TemplateEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

function TemplateEditor({ label, value, onChange, placeholder }: TemplateEditorProps) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        placeholder={placeholder}
        maxLength={180}
      />
    </div>
  );
}

type RowInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function RowInput({ label, value, onChange }: RowInputProps) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
    </div>
  );
}
