import type { Dispatch, SetStateAction } from "react";
import { Facebook, Instagram, MessageCircle, Music2 } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import type { ProfileForm } from "../types";
import {
  normalizeFacebookSlug,
  normalizeInstagramUsername,
  normalizeTiktokHandle,
  normalizeWhatsAppNumber,
} from "../utils";

type SocialMediaCardProps = {
  data: {
    profile: ProfileForm;
  };
  actions: {
    setProfile: Dispatch<SetStateAction<ProfileForm>>;
  };
};

export function SocialMediaCard({ data, actions }: SocialMediaCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 md:mb-6">Social Media</h3>

      <div className="space-y-3 md:space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/65 p-3">
          <label htmlFor="instagram" className="block text-sm font-medium text-slate-700 mb-1">
            <div className="flex items-center gap-2">
              <Instagram className="w-4 h-4 text-pink-500" />
              Instagram
            </div>
          </label>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white">
            <span className="inline-flex items-center border-r border-gray-200 bg-gray-50 px-3 text-xs text-slate-600">
              instagram.com/
            </span>
            <input
              id="instagram"
              type="text"
              placeholder="johnstudio"
              value={data.profile.socialLinks.instagram}
              onChange={(event) =>
                actions.setProfile((current) => ({
                  ...current,
                  socialLinks: { ...current.socialLinks, instagram: event.target.value },
                }))
              }
              onBlur={() =>
                actions.setProfile((current) => ({
                  ...current,
                  socialLinks: {
                    ...current.socialLinks,
                    instagram: normalizeInstagramUsername(current.socialLinks.instagram),
                  },
                }))
              }
              className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Paste username, @handle, or full URL.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/65 p-3">
          <label htmlFor="facebook" className="block text-sm font-medium text-slate-700 mb-1">
            <div className="flex items-center gap-2">
              <Facebook className="w-4 h-4 text-blue-600" />
              Facebook
            </div>
          </label>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white">
            <span className="inline-flex items-center border-r border-gray-200 bg-gray-50 px-3 text-xs text-slate-600">
              facebook.com/
            </span>
            <input
              id="facebook"
              type="text"
              placeholder="johnstudio"
              value={data.profile.socialLinks.facebook}
              onChange={(event) =>
                actions.setProfile((current) => ({
                  ...current,
                  socialLinks: { ...current.socialLinks, facebook: event.target.value },
                }))
              }
              onBlur={() =>
                actions.setProfile((current) => ({
                  ...current,
                  socialLinks: {
                    ...current.socialLinks,
                    facebook: normalizeFacebookSlug(current.socialLinks.facebook),
                  },
                }))
              }
              className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Paste page slug or full URL.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/65 p-3">
          <label htmlFor="whatsapp" className="block text-sm font-medium text-slate-700 mb-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-500" />
              WhatsApp
            </div>
          </label>
          <PhoneInput
            id="whatsapp"
            defaultCountry="MY"
            international
            withCountryCallingCode
            countryCallingCodeEditable={false}
            value={data.profile.socialLinks.whatsapp}
            onChange={(value) =>
              actions.setProfile((current) => ({
                ...current,
                socialLinks: { ...current.socialLinks, whatsapp: value || "" },
              }))
            }
            onBlur={() =>
              actions.setProfile((current) => ({
                ...current,
                socialLinks: {
                  ...current.socialLinks,
                  whatsapp: normalizeWhatsAppNumber(current.socialLinks.whatsapp),
                },
              }))
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none transition-all focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500"
          />
          <p className="mt-1 text-xs text-slate-500">Stored as international format (for example +60123456789).</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/65 p-3">
          <label htmlFor="tiktok" className="block text-sm font-medium text-slate-700 mb-1">
            <div className="flex items-center gap-2">
              <Music2 className="w-4 h-4 text-slate-900" />
              TikTok
            </div>
          </label>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white">
            <span className="inline-flex items-center border-r border-gray-200 bg-gray-50 px-3 text-xs text-slate-600">
              tiktok.com/@
            </span>
            <input
              id="tiktok"
              type="text"
              placeholder="johnstudio"
              value={data.profile.socialLinks.tiktok}
              onChange={(event) =>
                actions.setProfile((current) => ({
                  ...current,
                  socialLinks: { ...current.socialLinks, tiktok: event.target.value },
                }))
              }
              onBlur={() =>
                actions.setProfile((current) => ({
                  ...current,
                  socialLinks: {
                    ...current.socialLinks,
                    tiktok: normalizeTiktokHandle(current.socialLinks.tiktok),
                  },
                }))
              }
              className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Paste handle, @username, or full URL.</p>
        </div>
      </div>
    </div>
  );
}
