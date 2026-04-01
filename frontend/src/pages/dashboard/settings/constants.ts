import type { ProfileForm } from "./types";

export const DEFAULT_PROFILE: ProfileForm = {
  studioName: "",
  bio: "",
  email: "",
  username: "",
  location: "",
  city: "",
  country: "",
  specialty: "",
  style: "",
  hideBranding: false,
  canHideBranding: false,
  socialLinks: {
    instagram: "",
    facebook: "",
    tiktok: "",
    whatsapp: "",
  },
  themeColor: "#06b6d4",
};

export const THEME_OPTIONS = ["#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
