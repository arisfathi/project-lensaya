import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
import { Button } from "../../../../components/ui/Button";
import { Avatar } from "../../../../components/ui/Avatar";
import type { ProfileForm } from "../types";

type ProfileInformationCardProps = {
  data: {
    profile: ProfileForm;
    avatarUrl: string | null;
    avatarFallbackName: string;
    displayedUsername: string;
    usernameStatusClass: string;
    usernameStatusMessage: string;
    usernameWillChange: boolean;
    previewUsername: string;
    publicAppDomain: string;
  };
  state: {
    uploadingAvatar: boolean;
    removingAvatar: boolean;
  };
  avatarInputRef: RefObject<HTMLInputElement | null>;
  actions: {
    setProfile: Dispatch<SetStateAction<ProfileForm>>;
    onAvatarFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
    onAvatarRemove: () => void;
  };
};

export function ProfileInformationCard({ data, state, avatarInputRef, actions }: ProfileInformationCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Profile Information</h3>
        <p className="mt-1 text-xs text-slate-500 md:text-sm">Update your studio identity, public URL, and profile details.</p>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 md:mb-6 md:p-4">
        <p className="mb-3 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Profile Photo</p>
        <div className="flex flex-wrap items-center gap-3 md:flex-nowrap md:gap-4">
          <Avatar src={data.avatarUrl} name={data.avatarFallbackName} size={64} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => avatarInputRef.current?.click()}
              disabled={state.uploadingAvatar || state.removingAvatar}
              className="px-3 py-2 text-sm"
            >
              {state.uploadingAvatar ? "Uploading..." : "Upload New Photo"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={actions.onAvatarRemove}
              disabled={!data.avatarUrl || state.uploadingAvatar || state.removingAvatar}
              className="border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {state.removingAvatar ? "Removing..." : "Remove Photo"}
            </Button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={actions.onAvatarFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="studio-name" className="block text-sm font-medium text-slate-700 mb-1">
          Studio Name
        </label>
        <input
          id="studio-name"
          type="text"
          value={data.profile.studioName}
          onChange={(event) => actions.setProfile((current) => ({ ...current, studioName: event.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
        />
        <p className="mt-1 text-xs text-slate-500">
          Your pages username is generated automatically from your studio name.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <label className="block text-sm font-medium text-slate-700 mb-1">Pages Username</label>
        <div className="flex flex-col overflow-hidden rounded-lg border border-gray-300 bg-white sm:flex-row">
          <span className="inline-flex items-center border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-slate-600 sm:border-b-0 sm:border-r sm:py-0">
            https://
          </span>
          <input
            type="text"
            value={data.displayedUsername || "yourstudio"}
            readOnly
            className="min-w-0 flex-1 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none"
          />
          <span className="inline-flex items-center border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-slate-600 sm:border-t-0 sm:border-l sm:py-0">
            .{data.publicAppDomain}
          </span>
        </div>
        <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${data.usernameStatusClass}`}>
          {data.usernameStatusMessage}
        </div>
        {data.usernameWillChange ? (
          <p className="mt-2 text-xs text-amber-700">
            Saving this studio name changes your public pages URL to {data.previewUsername}.{data.publicAppDomain}.
          </p>
        ) : null}
      </div>

      <div className="mb-4">
        <label htmlFor="bio" className="block text-sm font-medium text-slate-700 mb-1">
          Bio
        </label>
        <textarea
          id="bio"
          rows={4}
          value={data.profile.bio}
          onChange={(event) => actions.setProfile((current) => ({ ...current, bio: event.target.value }))}
          className="w-full resize-none rounded-lg border border-gray-300 px-3.5 py-2.5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
        />
        <p className="mt-1 text-xs text-slate-500">
          Tip: Describe your photography style and experience to build trust.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-1">
            Location
          </label>
          <input
            id="location"
            type="text"
            placeholder="Kuala Lumpur, Malaysia"
            value={data.profile.location}
            onChange={(event) => actions.setProfile((current) => ({ ...current, location: event.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
          />
        </div>
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1">
            City
          </label>
          <input
            id="city"
            type="text"
            placeholder="Kuala Lumpur"
            value={data.profile.city}
            onChange={(event) => actions.setProfile((current) => ({ ...current, city: event.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
          />
        </div>
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-slate-700 mb-1">
            Country
          </label>
          <input
            id="country"
            type="text"
            placeholder="Malaysia"
            value={data.profile.country}
            onChange={(event) => actions.setProfile((current) => ({ ...current, country: event.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
          />
        </div>
        <div>
          <label htmlFor="specialty" className="block text-sm font-medium text-slate-700 mb-1">
            Specialty
          </label>
          <input
            id="specialty"
            type="text"
            placeholder="Wedding"
            value={data.profile.specialty}
            onChange={(event) => actions.setProfile((current) => ({ ...current, specialty: event.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
          />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="style" className="block text-sm font-medium text-slate-700 mb-1">
          Style
        </label>
        <input
          id="style"
          type="text"
          placeholder="Documentary, cinematic, editorial"
          value={data.profile.style}
          onChange={(event) => actions.setProfile((current) => ({ ...current, style: event.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={data.profile.email}
          onChange={(event) => actions.setProfile((current) => ({ ...current, email: event.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
        />
      </div>
    </div>
  );
}
