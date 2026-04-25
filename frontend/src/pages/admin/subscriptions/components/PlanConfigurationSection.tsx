import { Check, Edit2 } from "lucide-react";
import type { LimitsShape, PlanKey, PricingShape } from "../types";
import { formatLimitValue } from "../utils";

type LimitNumberField =
  | "services"
  | "portfolioPhotos"
  | "packagesPerService"
  | "packageFeatures"
  | "storageGb"
  | "leadHistoryDays"
  | "leadVisibilityLimit"
  | "leadTemplatesCount"
  | "teamSeats";
type FeatureField =
  | "customDomain"
  | "analyticsTools"
  | "hideBrandingEnabled"
  | "leadFiltersEnabled"
  | "leadExportEnabled"
  | "leadRemindersEnabled"
  | "leadAdvancedAnalyticsEnabled"
  | "teamSectionTools"
  | "isVisible"
  | "isActive"
  | "isMostPopular";
type ModeField = "analyticsMode" | "leadAnalyticsMode" | "supportTier" | "brandingMode";
type PricingNumberField = "price" | "yearlyPrice" | "trialDays";
type PricingTextField =
  | "displayName"
  | "tagline"
  | "subtitle"
  | "badgeText"
  | "ctaText"
  | "monthlyPriceDisplay"
  | "yearlyPriceDisplay";

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
  onPricingTextChange: (plan: PlanKey, field: PricingTextField, value: string) => void;
  onPricingCurrencyChange: (plan: PlanKey, value: string) => void;
  onSortOrderChange: (plan: PlanKey, value: string) => void;
  onModeChange: (plan: PlanKey, field: ModeField, value: string) => void;
  onLeadChannelToggle: (plan: PlanKey, channel: "whatsapp" | "email", value: boolean) => void;
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
                maxLength={3}
                uppercase
              />
              <PricingTextCell
                editing={data.editingLimits}
                value={editablePricing.pro.currency}
                onChange={(value) => actions.onPricingCurrencyChange("pro", value)}
                maxLength={3}
                uppercase
              />
              <PricingTextCell
                editing={data.editingLimits}
                value={editablePricing.studio.currency}
                onChange={(value) => actions.onPricingCurrencyChange("studio", value)}
                maxLength={3}
                uppercase
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
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Display Name</td>
              <PricingTextCell editing={data.editingLimits} value={editablePricing.free.displayName} onChange={(value) => actions.onPricingTextChange("free", "displayName", value)} />
              <PricingTextCell editing={data.editingLimits} value={editablePricing.pro.displayName} onChange={(value) => actions.onPricingTextChange("pro", "displayName", value)} />
              <PricingTextCell editing={data.editingLimits} value={editablePricing.studio.displayName} onChange={(value) => actions.onPricingTextChange("studio", "displayName", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Tagline</td>
              <PricingTextCell editing={data.editingLimits} value={editablePricing.free.tagline} onChange={(value) => actions.onPricingTextChange("free", "tagline", value)} />
              <PricingTextCell editing={data.editingLimits} value={editablePricing.pro.tagline} onChange={(value) => actions.onPricingTextChange("pro", "tagline", value)} />
              <PricingTextCell editing={data.editingLimits} value={editablePricing.studio.tagline} onChange={(value) => actions.onPricingTextChange("studio", "tagline", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">CTA Text</td>
              <PricingTextCell editing={data.editingLimits} value={editablePricing.free.ctaText} onChange={(value) => actions.onPricingTextChange("free", "ctaText", value)} />
              <PricingTextCell editing={data.editingLimits} value={editablePricing.pro.ctaText} onChange={(value) => actions.onPricingTextChange("pro", "ctaText", value)} />
              <PricingTextCell editing={data.editingLimits} value={editablePricing.studio.ctaText} onChange={(value) => actions.onPricingTextChange("studio", "ctaText", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Badge</td>
              <PricingTextCell editing={data.editingLimits} value={editablePricing.free.badgeText} onChange={(value) => actions.onPricingTextChange("free", "badgeText", value)} />
              <PricingTextCell editing={data.editingLimits} value={editablePricing.pro.badgeText} onChange={(value) => actions.onPricingTextChange("pro", "badgeText", value)} />
              <PricingTextCell editing={data.editingLimits} value={editablePricing.studio.badgeText} onChange={(value) => actions.onPricingTextChange("studio", "badgeText", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Display Order</td>
              <PricingNumberCell editing={data.editingLimits} value={editablePricing.free.sortOrder} onChange={(value) => actions.onSortOrderChange("free", value)} displayValue={editablePricing.free.sortOrder} step="1" />
              <PricingNumberCell editing={data.editingLimits} value={editablePricing.pro.sortOrder} onChange={(value) => actions.onSortOrderChange("pro", value)} displayValue={editablePricing.pro.sortOrder} step="1" />
              <PricingNumberCell editing={data.editingLimits} value={editablePricing.studio.sortOrder} onChange={(value) => actions.onSortOrderChange("studio", value)} displayValue={editablePricing.studio.sortOrder} step="1" />
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
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Storage (GB)</td>
              <LimitNumberCell editing={data.editingLimits} value={editable.free.storageGb} onChange={(value) => actions.onLimitChange("free", "storageGb", value)} />
              <LimitNumberCell editing={data.editingLimits} value={editable.pro.storageGb} onChange={(value) => actions.onLimitChange("pro", "storageGb", value)} />
              <LimitNumberCell editing={data.editingLimits} value={editable.studio.storageGb} onChange={(value) => actions.onLimitChange("studio", "storageGb", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Inquiry History (days)</td>
              <LimitNumberCell editing={data.editingLimits} value={editable.free.leadHistoryDays} onChange={(value) => actions.onLimitChange("free", "leadHistoryDays", value)} />
              <LimitNumberCell editing={data.editingLimits} value={editable.pro.leadHistoryDays} onChange={(value) => actions.onLimitChange("pro", "leadHistoryDays", value)} />
              <LimitNumberCell editing={data.editingLimits} value={editable.studio.leadHistoryDays} onChange={(value) => actions.onLimitChange("studio", "leadHistoryDays", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Stored Inquiries</td>
              <LimitNumberCell editing={data.editingLimits} value={editable.free.leadVisibilityLimit} onChange={(value) => actions.onLimitChange("free", "leadVisibilityLimit", value)} />
              <LimitNumberCell editing={data.editingLimits} value={editable.pro.leadVisibilityLimit} onChange={(value) => actions.onLimitChange("pro", "leadVisibilityLimit", value)} />
              <LimitNumberCell editing={data.editingLimits} value={editable.studio.leadVisibilityLimit} onChange={(value) => actions.onLimitChange("studio", "leadVisibilityLimit", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Quick Reply Templates</td>
              <LimitNumberCell editing={data.editingLimits} value={editable.free.leadTemplatesCount} onChange={(value) => actions.onLimitChange("free", "leadTemplatesCount", value)} />
              <LimitNumberCell editing={data.editingLimits} value={editable.pro.leadTemplatesCount} onChange={(value) => actions.onLimitChange("pro", "leadTemplatesCount", value)} />
              <LimitNumberCell editing={data.editingLimits} value={editable.studio.leadTemplatesCount} onChange={(value) => actions.onLimitChange("studio", "leadTemplatesCount", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Team Seats</td>
              <LimitNumberCell editing={data.editingLimits} value={editable.free.teamSeats} onChange={(value) => actions.onLimitChange("free", "teamSeats", value)} />
              <LimitNumberCell editing={data.editingLimits} value={editable.pro.teamSeats} onChange={(value) => actions.onLimitChange("pro", "teamSeats", value)} />
              <LimitNumberCell editing={data.editingLimits} value={editable.studio.teamSeats} onChange={(value) => actions.onLimitChange("studio", "teamSeats", value)} />
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
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Remove Lensaya Branding</td>
              <FeatureToggleCell editing={data.editingLimits} checked={editable.free.hideBrandingEnabled} onChange={(value) => actions.onToggleFeature("free", "hideBrandingEnabled", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.pro.hideBrandingEnabled} onChange={(value) => actions.onToggleFeature("pro", "hideBrandingEnabled", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.studio.hideBrandingEnabled} onChange={(value) => actions.onToggleFeature("studio", "hideBrandingEnabled", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Inquiry Filters</td>
              <FeatureToggleCell editing={data.editingLimits} checked={editable.free.leadFiltersEnabled} onChange={(value) => actions.onToggleFeature("free", "leadFiltersEnabled", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.pro.leadFiltersEnabled} onChange={(value) => actions.onToggleFeature("pro", "leadFiltersEnabled", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.studio.leadFiltersEnabled} onChange={(value) => actions.onToggleFeature("studio", "leadFiltersEnabled", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Inquiry Export</td>
              <FeatureToggleCell editing={data.editingLimits} checked={editable.free.leadExportEnabled} onChange={(value) => actions.onToggleFeature("free", "leadExportEnabled", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.pro.leadExportEnabled} onChange={(value) => actions.onToggleFeature("pro", "leadExportEnabled", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.studio.leadExportEnabled} onChange={(value) => actions.onToggleFeature("studio", "leadExportEnabled", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Follow-up Reminders</td>
              <FeatureToggleCell editing={data.editingLimits} checked={editable.free.leadRemindersEnabled} onChange={(value) => actions.onToggleFeature("free", "leadRemindersEnabled", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.pro.leadRemindersEnabled} onChange={(value) => actions.onToggleFeature("pro", "leadRemindersEnabled", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.studio.leadRemindersEnabled} onChange={(value) => actions.onToggleFeature("studio", "leadRemindersEnabled", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Advanced Lead Analytics</td>
              <FeatureToggleCell editing={data.editingLimits} checked={editable.free.leadAdvancedAnalyticsEnabled} onChange={(value) => actions.onToggleFeature("free", "leadAdvancedAnalyticsEnabled", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.pro.leadAdvancedAnalyticsEnabled} onChange={(value) => actions.onToggleFeature("pro", "leadAdvancedAnalyticsEnabled", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.studio.leadAdvancedAnalyticsEnabled} onChange={(value) => actions.onToggleFeature("studio", "leadAdvancedAnalyticsEnabled", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Visible on Pricing</td>
              <FeatureToggleCell editing={data.editingLimits} checked={editable.free.isVisible} onChange={(value) => actions.onToggleFeature("free", "isVisible", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.pro.isVisible} onChange={(value) => actions.onToggleFeature("pro", "isVisible", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.studio.isVisible} onChange={(value) => actions.onToggleFeature("studio", "isVisible", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Plan Active</td>
              <FeatureToggleCell editing={data.editingLimits} checked={editable.free.isActive} onChange={(value) => actions.onToggleFeature("free", "isActive", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.pro.isActive} onChange={(value) => actions.onToggleFeature("pro", "isActive", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.studio.isActive} onChange={(value) => actions.onToggleFeature("studio", "isActive", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Most Popular</td>
              <FeatureToggleCell editing={data.editingLimits} checked={editable.free.isMostPopular} onChange={(value) => actions.onToggleFeature("free", "isMostPopular", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.pro.isMostPopular} onChange={(value) => actions.onToggleFeature("pro", "isMostPopular", value)} />
              <FeatureToggleCell editing={data.editingLimits} checked={editable.studio.isMostPopular} onChange={(value) => actions.onToggleFeature("studio", "isMostPopular", value)} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Analytics Mode</td>
              <ModeCell editing={data.editingLimits} value={editable.free.analyticsMode} onChange={(value) => actions.onModeChange("free", "analyticsMode", value)} options={["NONE", "BASIC", "ADVANCED"]} />
              <ModeCell editing={data.editingLimits} value={editable.pro.analyticsMode} onChange={(value) => actions.onModeChange("pro", "analyticsMode", value)} options={["NONE", "BASIC", "ADVANCED"]} />
              <ModeCell editing={data.editingLimits} value={editable.studio.analyticsMode} onChange={(value) => actions.onModeChange("studio", "analyticsMode", value)} options={["NONE", "BASIC", "ADVANCED"]} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Lead Analytics Mode</td>
              <ModeCell editing={data.editingLimits} value={editable.free.leadAnalyticsMode} onChange={(value) => actions.onModeChange("free", "leadAnalyticsMode", value)} options={["NONE", "BASIC", "ADVANCED"]} />
              <ModeCell editing={data.editingLimits} value={editable.pro.leadAnalyticsMode} onChange={(value) => actions.onModeChange("pro", "leadAnalyticsMode", value)} options={["NONE", "BASIC", "ADVANCED"]} />
              <ModeCell editing={data.editingLimits} value={editable.studio.leadAnalyticsMode} onChange={(value) => actions.onModeChange("studio", "leadAnalyticsMode", value)} options={["NONE", "BASIC", "ADVANCED"]} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Support Tier</td>
              <ModeCell editing={data.editingLimits} value={editable.free.supportTier} onChange={(value) => actions.onModeChange("free", "supportTier", value)} options={["STANDARD", "PRIORITY"]} />
              <ModeCell editing={data.editingLimits} value={editable.pro.supportTier} onChange={(value) => actions.onModeChange("pro", "supportTier", value)} options={["STANDARD", "PRIORITY"]} />
              <ModeCell editing={data.editingLimits} value={editable.studio.supportTier} onChange={(value) => actions.onModeChange("studio", "supportTier", value)} options={["STANDARD", "PRIORITY"]} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Branding Mode</td>
              <ModeCell editing={data.editingLimits} value={editable.free.brandingMode} onChange={(value) => actions.onModeChange("free", "brandingMode", value)} options={["FORCED_LENSAYA", "REMOVABLE"]} />
              <ModeCell editing={data.editingLimits} value={editable.pro.brandingMode} onChange={(value) => actions.onModeChange("pro", "brandingMode", value)} options={["FORCED_LENSAYA", "REMOVABLE"]} />
              <ModeCell editing={data.editingLimits} value={editable.studio.brandingMode} onChange={(value) => actions.onModeChange("studio", "brandingMode", value)} options={["FORCED_LENSAYA", "REMOVABLE"]} />
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">Lead Channels</td>
              <LeadChannelCell editing={data.editingLimits} value={editable.free.leadChannels} onToggle={(channel, checked) => actions.onLeadChannelToggle("free", channel, checked)} />
              <LeadChannelCell editing={data.editingLimits} value={editable.pro.leadChannels} onToggle={(channel, checked) => actions.onLeadChannelToggle("pro", channel, checked)} />
              <LeadChannelCell editing={data.editingLimits} value={editable.studio.leadChannels} onToggle={(channel, checked) => actions.onLeadChannelToggle("studio", channel, checked)} />
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
  maxLength?: number;
  uppercase?: boolean;
};

function PricingTextCell({ editing, value, onChange, maxLength = 120, uppercase = false }: PricingTextCellProps) {
  return (
    <td className="px-6 py-4 text-sm text-center text-slate-600">
      {editing ? (
        <input
          type="text"
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-28 mx-auto px-2 py-1 border border-gray-200 rounded text-center ${
            uppercase ? "uppercase" : ""
          }`}
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

type ModeCellProps = {
  editing: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
};

function ModeCell({ editing, value, onChange, options }: ModeCellProps) {
  return (
    <td className="px-6 py-4 text-sm text-center text-slate-600">
      {editing ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-32 mx-auto px-2 py-1 border border-gray-200 rounded text-center"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        value
      )}
    </td>
  );
}

type LeadChannelCellProps = {
  editing: boolean;
  value: { whatsapp: boolean; email: boolean };
  onToggle: (channel: "whatsapp" | "email", checked: boolean) => void;
};

function LeadChannelCell({ editing, value, onToggle }: LeadChannelCellProps) {
  if (!editing) {
    const enabled = [value.whatsapp ? "WhatsApp" : null, value.email ? "Email" : null].filter(Boolean);
    return <td className="px-6 py-4 text-sm text-center text-slate-600">{enabled.join(", ") || "-"}</td>;
  }

  return (
    <td className="px-6 py-4 text-sm text-center text-slate-600">
      <div className="mx-auto flex w-fit items-center gap-3">
        <label className="inline-flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={Boolean(value.whatsapp)}
            onChange={(event) => onToggle("whatsapp", event.target.checked)}
            className="w-3.5 h-3.5"
          />
          WhatsApp
        </label>
        <label className="inline-flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={Boolean(value.email)}
            onChange={(event) => onToggle("email", event.target.checked)}
            className="w-3.5 h-3.5"
          />
          Email
        </label>
      </div>
    </td>
  );
}
