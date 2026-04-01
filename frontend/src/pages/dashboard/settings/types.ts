import type { billingApi, profileApi } from "../../../lib/api";

export type ProfileForm = {
  studioName: string;
  bio: string;
  email: string;
  username: string;
  location: string;
  city: string;
  country: string;
  specialty: string;
  style: string;
  hideBranding: boolean;
  canHideBranding: boolean;
  socialLinks: {
    instagram: string;
    facebook: string;
    tiktok: string;
    whatsapp: string;
  };
  themeColor: string;
};

export type SubscriptionState = Awaited<ReturnType<typeof billingApi.subscription>>;
export type ProfileResponse = Awaited<ReturnType<typeof profileApi.get>>;

export type BillingActionLoading = "portal" | "cancel" | "resume" | "renew" | null;

export type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

export type SavedIdentity = {
  studioName: string;
  username: string;
};

export type PaymentStatusConfig = {
  label: string;
  color: string;
  icon: typeof import("lucide-react").CheckCircle;
  badgeClass: string;
  tone: "neutral" | "warning" | "success" | "danger";
};
