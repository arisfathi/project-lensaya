import { Check, Edit2 } from "lucide-react";
import type { LimitsShape, PlanKey, PricingShape } from "../types";
import { formatLimitValue } from "../utils";

type LimitNumberField = "services" | "portfolioPhotos" | "packagesPerService" | "packageFeatures";
type FeatureField = "customDomain" | "analyticsTools" | "teamSectionTools";
type PricingNumberField = "price" | "yearlyPrice" | "trialDays";

type PlanConfigurationData = {
  editingLimits: boolean;
  saving: boolean;
  limits: LimitsShape;
  draftLimits: LimitsShape;
  pricing: PricingShape;
  draftPricing: PricingShape;
};

type PlanConfigurationActions = {
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onLimitChange: (plan: PlanKey, field: LimitNumberField, value: string) => void;
  onToggleFeature: (plan: PlanKey, field: FeatureField, value: boolean) => void;
  onPricingNumberChange: (plan: PlanKey, field: PricingNumberField, value: string) => void;
  onPricingCurrencyChange: (plan: PlanKey, value: string) => void;
};

type PlanConfigurationSectionProps = {
  data: PlanConfigurationData;
  actions: PlanConfigurationActions;
  formatCurrency: (value: number, currency?: string) => string;
};

export function PlanConfigurationSection({ data, actions, formatCurrency }: PlanConfigurationSectionProps) {
  const editable = data.editingLimits ? data.draftLimits : data.limits;
  const editablePricing = data.editingLimits ? data.draftPricing : data.pricing;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Plan Configuration</h3>
        <div className="flex items-center gap-2">
          {data.editingLimits ? (
            <>
              <button
                type="button"
                onClick={actions.onCancelEdit}
                className="px-4 py-2 border border-gray-200 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={actions.onSave}
                disabled={data.saving}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {data.saving ? "Saving..." : "Save Configuration"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={actions.onStartEdit}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm"
            >
              <Edit2 className="w-4 h-4" />
              Edit Configuration
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Feature</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Free</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Pro</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Studio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Monthly Price</td>
              <PricingNumberCell
                editing={data.editingLimits}
                value={editablePricing.free.price}
                onChange={(value) => actions.onPricingNumberChange("free", "price", value)}
                displayValue={formatCurrency(editablePricing.free.price, editablePricing.free.currency)}
                step="0.01"
              />
              <PricingNumberCell
                editing={data.editingLimits}
                value={editablePricing.pro.price}
                onChange={(value) => actions.onPricingNumberChange("pro", "price", value)}
                displayValue={formatCurrency(editablePricing.pro.price, editablePricing.pro.currency)}
                step="0.01"
              />
              <PricingNumberCell
                editing={data.editingLimits}
                value={editablePricing.studio.price}
                onChange={(value) => actions.onPricingNumberChange("studio", "price", value)}
                displayValue={formatCurrency(editablePricing.studio.price, editablePricing.studio.currency)}
                step="0.01"
              />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Yearly Price</td>
              <PricingNumberCell
                editing={data.editingLimits}
                value={editablePricing.free.yearlyPrice}
                onChange={(value) => actions.onPricingNumberChange("free", "yearlyPrice", value)}
                displayValue={formatCurrency(editablePricing.free.yearlyPrice, editablePricing.free.currency)}
                step="0.01"
              />
              <PricingNumberCell
                editing={data.editingLimits}
                value={editablePricing.pro.yearlyPrice}
                onChange={(value) => actions.onPricingNumberChange("pro", "yearlyPrice", value)}
                displayValue={formatCurrency(editablePricing.pro.yearlyPrice, editablePricing.pro.currency)}
                step="0.01"
              />
              <PricingNumberCell
                editing={data.editingLimits}
                value={editablePricing.studio.yearlyPrice}
                onChange={(value) => actions.onPricingNumberChange("studio", "yearlyPrice", value)}
                displayValue={formatCurrency(editablePricing.studio.yearlyPrice, editablePricing.studio.currency)}
                step="0.01"
              />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Currency</td>
              <PricingTextCell
                editing={data.editingLimits}
                value={editablePricing.free.currency}
                onChange={(value) => actions.onPricingCurrencyChange("free", value)}
              />
              <PricingTextCell
                editing={data.editingLimits}
                value={editablePricing.pro.currency}
                onChange={(value) => actions.onPricingCurrencyChange("pro", value)}
              />
              <PricingTextCell
                editing={data.editingLimits}
                value={editablePricing.studio.currency}
                onChange={(value) => actions.onPricingCurrencyChange("studio", value)}
              />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Trial Days</td>
              <PricingNumberCell
                editing={data.editingLimits}
                value={editablePricing.free.trialDays}
                onChange={(value) => actions.onPricingNumberChange("free", "trialDays", value)}
                displayValue={editablePricing.free.trialDays}
                step="1"
              />
              <PricingNumberCell
                editing={data.editingLimits}
                value={editablePricing.pro.trialDays}
                onChange={(value) => actions.onPricingNumberChange("pro", "trialDays", value)}
                displayValue={editablePricing.pro.trialDays}
                step="1"
              />
              <PricingNumberCell
                editing={data.editingLimits}
                value={editablePricing.studio.trialDays}
                onChange={(value) => actions.onPricingNumberChange("studio", "trialDays", value)}
                displayValue={editablePricing.studio.trialDays}
                step="1"
              />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Max Services</td>
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.free.services}
                onChange={(value) => actions.onLimitChange("free", "services", value)}
              />
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.pro.services}
                onChange={(value) => actions.onLimitChange("pro", "services", value)}
              />
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.studio.services}
                onChange={(value) => actions.onLimitChange("studio", "services", value)}
              />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Portfolio Photos</td>
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.free.portfolioPhotos}
                onChange={(value) => actions.onLimitChange("free", "portfolioPhotos", value)}
              />
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.pro.portfolioPhotos}
                onChange={(value) => actions.onLimitChange("pro", "portfolioPhotos", value)}
              />
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.studio.portfolioPhotos}
                onChange={(value) => actions.onLimitChange("studio", "portfolioPhotos", value)}
              />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Max Packages per Service</td>
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.free.packagesPerService}
                onChange={(value) => actions.onLimitChange("free", "packagesPerService", value)}
              />
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.pro.packagesPerService}
                onChange={(value) => actions.onLimitChange("pro", "packagesPerService", value)}
              />
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.studio.packagesPerService}
                onChange={(value) => actions.onLimitChange("studio", "packagesPerService", value)}
              />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Max Features per Package</td>
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.free.packageFeatures}
                onChange={(value) => actions.onLimitChange("free", "packageFeatures", value)}
              />
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.pro.packageFeatures}
                onChange={(value) => actions.onLimitChange("pro", "packageFeatures", value)}
              />
              <LimitNumberCell
                editing={data.editingLimits}
                value={editable.studio.packageFeatures}
                onChange={(value) => actions.onLimitChange("studio", "packageFeatures", value)}
              />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Custom Domain</td>
              <FeatureToggleCell
                editing={data.editingLimits}
                checked={editable.free.customDomain}
                onChange={(value) => actions.onToggleFeature("free", "customDomain", value)}
              />
              <FeatureToggleCell
                editing={data.editingLimits}
                checked={editable.pro.customDomain}
                onChange={(value) => actions.onToggleFeature("pro", "customDomain", value)}
              />
              <FeatureToggleCell
                editing={data.editingLimits}
                checked={editable.studio.customDomain}
                onChange={(value) => actions.onToggleFeature("studio", "customDomain", value)}
              />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Our Team</td>
              <FeatureToggleCell
                editing={data.editingLimits}
                checked={editable.free.teamSectionTools}
                onChange={(value) => actions.onToggleFeature("free", "teamSectionTools", value)}
              />
              <FeatureToggleCell
                editing={data.editingLimits}
                checked={editable.pro.teamSectionTools}
                onChange={(value) => actions.onToggleFeature("pro", "teamSectionTools", value)}
              />
              <FeatureToggleCell
                editing={data.editingLimits}
                checked={editable.studio.teamSectionTools}
                onChange={(value) => actions.onToggleFeature("studio", "teamSectionTools", value)}
              />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Analytics Tools</td>
              <FeatureToggleCell
                editing={data.editingLimits}
                checked={editable.free.analyticsTools}
                onChange={(value) => actions.onToggleFeature("free", "analyticsTools", value)}
              />
              <FeatureToggleCell
                editing={data.editingLimits}
                checked={editable.pro.analyticsTools}
                onChange={(value) => actions.onToggleFeature("pro", "analyticsTools", value)}
              />
              <FeatureToggleCell
                editing={data.editingLimits}
                checked={editable.studio.analyticsTools}
                onChange={(value) => actions.onToggleFeature("studio", "analyticsTools", value)}
              />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

type PricingNumberCellProps = {
  editing: boolean;
  value: number;
  onChange: (value: string) => void;
  displayValue: number | string;
  step: "0.01" | "1";
};

function PricingNumberCell({ editing, value, onChange, displayValue, step }: PricingNumberCellProps) {
  return (
    <td className="px-6 py-4 text-sm text-center text-slate-600">
      {editing ? (
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-24 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
        />
      ) : (
        displayValue
      )}
    </td>
  );
}

type PricingTextCellProps = {
  editing: boolean;
  value: string;
  onChange: (value: string) => void;
};

function PricingTextCell({ editing, value, onChange }: PricingTextCellProps) {
  return (
    <td className="px-6 py-4 text-sm text-center text-slate-600">
      {editing ? (
        <input
          type="text"
          maxLength={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center uppercase"
        />
      ) : (
        value
      )}
    </td>
  );
}

type LimitNumberCellProps = {
  editing: boolean;
  value: number;
  onChange: (value: string) => void;
};

function LimitNumberCell({ editing, value, onChange }: LimitNumberCellProps) {
  return (
    <td className="px-6 py-4 text-sm text-center text-slate-600">
      {editing ? (
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-20 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
        />
      ) : (
        formatLimitValue(value)
      )}
    </td>
  );
}

type FeatureToggleCellProps = {
  editing: boolean;
  checked: boolean;
  onChange: (value: boolean) => void;
};

function FeatureToggleCell({ editing, checked, onChange }: FeatureToggleCellProps) {
  return (
    <td className="px-6 py-4 text-center">
      {editing ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="w-4 h-4"
        />
      ) : checked ? (
        <Check className="w-5 h-5 text-green-500 mx-auto" />
      ) : (
        <span className="text-slate-400">-</span>
      )}
    </td>
  );
}
