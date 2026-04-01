import type { Dispatch, SetStateAction } from "react";
import { THEME_OPTIONS } from "../constants";
import type { ProfileForm } from "../types";

type WebsiteCustomizationCardProps = {
  data: {
    profile: ProfileForm;
  };
  actions: {
    setProfile: Dispatch<SetStateAction<ProfileForm>>;
  };
};

export function WebsiteCustomizationCard({ data, actions }: WebsiteCustomizationCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
      <h3 className="text-lg font-semibold text-slate-900">Website Customization</h3>
      <p className="mt-1 text-xs text-slate-500 md:text-sm">Choose a studio accent color for your public pages.</p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/65 p-3 md:p-4">
        <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Theme Color</label>
        <div className="flex flex-wrap gap-2.5 md:gap-3">
        {THEME_OPTIONS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => actions.setProfile((current) => ({ ...current, themeColor: color }))}
            className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 md:h-10 md:w-10 ${
              data.profile.themeColor === color ? "border-slate-900 ring-2 ring-slate-200" : "border-gray-300"
            }`}
            style={{ backgroundColor: color }}
            aria-label={`Select theme color ${color}`}
          />
        ))}
        </div>
      </div>
    </div>
  );
}
