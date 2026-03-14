import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Save,
  Instagram,
  Facebook,
  MessageCircle,
  Music2,
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ExternalLink,
  TrendingUp,
  XCircle,
} from "lucide-react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { AvatarCropModal } from "../../components/avatar/AvatarCropModal";
import { CustomDomainCard } from "../../components/settings/CustomDomainCard";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { authApi, billingApi, profileApi, getApiErrorMessage } from "../../lib/api";
import { useStudioUsernamePreview } from "../../hooks/useStudioUsernamePreview";
import { PUBLIC_APP_DOMAIN } from "../../lib/platform";
import { getUsernamePreviewReasonMessage } from "../../lib/usernames";

type ProfileForm = {
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
type SubscriptionState = Awaited<ReturnType<typeof billingApi.subscription>>;

const defaultProfile: ProfileForm = {
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

const themeOptions = ["#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
type ProfileResponse = Awaited<ReturnType<typeof profileApi.get>>;

const normalizeSocialSlug = (value: string, domain: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  let normalized = trimmed.replace(/^@+/, "");

  try {
    const candidate = /^[a-z]+:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === domain || host.endsWith(`.${domain}`)) {
      normalized = parsed.pathname.split("/").filter(Boolean)[0] || "";
    }
  } catch {
    // Fall back to string parsing.
  }

  const escapedDomain = domain.replace(/\./g, "\\.");
  normalized = normalized
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(new RegExp(`^(?:m\\.)?${escapedDomain}\\/?`, "i"), "")
    .split(/[?#]/)[0];

  normalized = (normalized.split("/").filter(Boolean)[0] || normalized).replace(/^@+/, "").trim();
  return normalized;
};

const normalizeInstagramUsername = (value: string) => normalizeSocialSlug(value, "instagram.com");
const normalizeFacebookSlug = (value: string) => normalizeSocialSlug(value, "facebook.com");
const normalizeTiktokHandle = (value: string) => normalizeSocialSlug(value, "tiktok.com");
const normalizeWhatsAppNumber = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};
const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};
const formatBillingCycleLabel = (value: string | null | undefined) => {
  if (value === "yearly") return "Yearly";
  if (value === "monthly") return "Monthly";
  return "Not applicable";
};
const describePendingChange = (subscription: SubscriptionState | null) => {
  const pending = subscription?.pendingChange;
  if (!pending) return null;
  if (pending.type === "cancellation") {
    return "Free plan starts " + formatDateTime(pending.effectiveAt) + ".";
  }
  const interval = pending.billingCycle ? " (" + formatBillingCycleLabel(pending.billingCycle) + ")" : "";
  return String(pending.plan || "Plan") + interval + " starts " + formatDateTime(pending.effectiveAt) + ".";
};

const getPlanBadgeClass = (plan: string) => {
  const normalized = String(plan || "").toUpperCase();
  if (normalized === "PRO") return "bg-cyan-100 text-cyan-700";
  if (normalized === "STUDIO") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-700";
};

const getPaymentStatusConfig = ({
  plan,
  status,
  cancelAtPeriodEnd,
}: {
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
}) => {
  if (String(plan).toUpperCase() === "FREE") {
    return {
      label: "Free Plan",
      color: "text-slate-600",
      icon: CheckCircle,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      tone: "neutral" as const,
    };
  }

  if (cancelAtPeriodEnd) {
    return {
      label: "Cancel Scheduled",
      color: "text-amber-700",
      icon: AlertTriangle,
      badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
      tone: "warning" as const,
    };
  }

  if (["ACTIVE", "TRIALING"].includes(status)) {
    return {
      label: "Active",
      color: "text-green-600",
      icon: CheckCircle,
      badgeClass: "bg-green-100 text-green-700 border-green-200",
      tone: "success" as const,
    };
  }

  if (["PAST_DUE", "INCOMPLETE"].includes(status)) {
    return {
      label: "Past Due",
      color: "text-red-600",
      icon: AlertCircle,
      badgeClass: "bg-red-100 text-red-700 border-red-200",
      tone: "danger" as const,
    };
  }

  if (["CANCELED", "EXPIRED"].includes(status)) {
    return {
      label: "Canceled",
      color: "text-slate-600",
      icon: XCircle,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      tone: "neutral" as const,
    };
  }

  return {
    label: status || "Unknown",
    color: "text-slate-600",
    icon: AlertCircle,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    tone: "neutral" as const,
  };
};

export default function Settings() {
  const [profile, setProfile] = useState<ProfileForm>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState("avatar.jpg");
  const [planName, setPlanName] = useState("FREE");
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [billingActionLoading, setBillingActionLoading] = useState<"portal" | "cancel" | "resume" | "renew" | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savedIdentity, setSavedIdentity] = useState({ studioName: "", username: "" });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { logout, refreshUser } = useAuth();
  const { success, error } = useToast();
  const avatarFallbackName = profile.studioName || profile.email || profile.username || "Lensaya";
  const usernamePreview = useStudioUsernamePreview(profile.studioName);
  const studioNameChanged = profile.studioName.trim() !== savedIdentity.studioName.trim();
  const previewUsername = usernamePreview.username || "";
  const displayedUsername =
    (studioNameChanged ? previewUsername : profile.username) || previewUsername || profile.username || "";
  const usernameWillChange =
    studioNameChanged && Boolean(previewUsername) && previewUsername !== savedIdentity.username;
  const fallbackLensayaHost = `${profile.username || displayedUsername || "yourstudio"}.${PUBLIC_APP_DOMAIN}`;
  const usernameStatusMessage = studioNameChanged
    ? usernamePreview.isChecking
      ? "Checking pages username availability..."
      : usernamePreview.error
        ? usernamePreview.error
        : usernamePreview.available
          ? "Available. Saving this studio name will update your public pages URL."
          : getUsernamePreviewReasonMessage(usernamePreview.reason) ||
            "This studio name is unavailable. Please choose a different studio name."
    : "Generated from your studio name. Edit the studio name to change your public pages URL.";
  const usernameStatusClass = studioNameChanged
    ? usernamePreview.error || !usernamePreview.available
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-green-200 bg-green-50 text-green-700"
    : "border-slate-200 bg-slate-50 text-slate-600";

  const syncProfileState = (profileResult: ProfileResponse) => {
    setProfile({
      studioName: profileResult.studioName || "",
      bio: profileResult.bio || "",
      email: profileResult.email || "",
      username: profileResult.username || "",
      location: profileResult.location || "",
      city: profileResult.city || "",
      country: profileResult.country || "",
      specialty: profileResult.specialty || "",
      style: profileResult.style || "",
      hideBranding: Boolean(profileResult.hideBranding),
      canHideBranding: Boolean(profileResult.canHideBranding),
      socialLinks: {
        instagram: normalizeInstagramUsername(profileResult.socialLinks?.instagram || ""),
        facebook: normalizeFacebookSlug(profileResult.socialLinks?.facebook || ""),
        tiktok: normalizeTiktokHandle(profileResult.socialLinks?.tiktok || ""),
        whatsapp: normalizeWhatsAppNumber(profileResult.socialLinks?.whatsapp || ""),
      },
      themeColor: profileResult.themeColor || "#06b6d4",
    });
    setAvatarUrl(profileResult.avatarUrl || null);
    setSavedIdentity({
      studioName: profileResult.studioName || "",
      username: profileResult.username || "",
    });
  };

  const disposeCropImageSrc = (src: string | null) => {
    if (!src || !src.startsWith("blob:")) {
      return;
    }
    URL.revokeObjectURL(src);
  };

  const closeCropModal = () => {
    setCropOpen(false);
    setCropFileName("avatar.jpg");
    setCropImageSrc((current) => {
      disposeCropImageSrc(current);
      return null;
    });
  };

  const refreshProfile = async () => {
    const refreshedProfile = await profileApi.get();
    syncProfileState(refreshedProfile);
  };

  const syncSubscriptionState = (nextSubscription: SubscriptionState) => {
    setSubscription(nextSubscription);
    setPlanName((nextSubscription.plan || "FREE").toUpperCase());
  };

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      setLoading(true);
      try {
        const [profileResult, subscriptionResult] = await Promise.all([profileApi.get(), billingApi.subscription()]);
        if (!mounted) return;
        syncProfileState(profileResult);
        syncSubscriptionState(subscriptionResult);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load settings"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, [error]);

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (!checkoutStatus) return;

    if (checkoutStatus === "success") {
      success("Payment completed. Your subscription is active.");
    } else if (checkoutStatus === "trial") {
      success("Trial started successfully.");
    } else if (checkoutStatus === "failed") {
      error("Payment failed. Your subscription was not changed.");
    } else if (checkoutStatus === "canceled") {
      error("Checkout was canceled. You can try again anytime.");
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("checkout");
    setSearchParams(nextParams, { replace: true });
  }, [error, searchParams, setSearchParams, success]);

  useEffect(
    () => () => {
      disposeCropImageSrc(cropImageSrc);
    },
    [cropImageSrc]
  );

  const handleOpenBillingPortal = async () => {
    try {
      setBillingActionLoading("portal");
      const result = await billingApi.portalSession({ returnUrl: window.location.href });
      if (result.portalUrl) {
        window.location.assign(result.portalUrl);
        return;
      }
      error("Billing center URL is unavailable");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to open billing center"));
    } finally {
      setBillingActionLoading(null);
    }
  };

  const handleScheduleCancellation = async () => {
    try {
      setBillingActionLoading("cancel");
      const result = await billingApi.cancelSubscription({ atPeriodEnd: true });
      syncSubscriptionState(result);
      success("Subscription cancellation has been scheduled.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to schedule cancellation"));
    } finally {
      setBillingActionLoading(null);
    }
  };

  const handleResumeSubscription = async () => {
    try {
      setBillingActionLoading("resume");
      const result = await billingApi.resumeSubscription();
      setSubscription(result);
      setPlanName((result.plan || "FREE").toUpperCase());
      success("Subscription auto-renew has been resumed.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to resume subscription"));
    } finally {
      setBillingActionLoading(null);
    }
  };

  const handleRenewSubscription = async () => {
    if (planName === "FREE") {
      navigate("/dashboard/pricing");
      return;
    }

    try {
      setBillingActionLoading("renew");
      const origin = window.location.origin;
      const result = await billingApi.changePlan({
        targetPlanId: planName as "PRO" | "STUDIO",
        billingCycle: ((subscription?.billingCycle as "monthly" | "yearly" | null) || "monthly"),
        successUrl: `${origin}/dashboard/settings?checkout=success`,
        cancelUrl: `${origin}/dashboard/settings?checkout=canceled`,
        forceCheckout: true,
      });

      if (result.action === "checkout_required" && result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      syncSubscriptionState(result as SubscriptionState);
      success("Subscription details refreshed.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to start renewal"));
    } finally {
      setBillingActionLoading(null);
    }
  };

  const handleAvatarFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      error("Only image files are supported");
      return;
    }

    const nextImageSrc = URL.createObjectURL(file);
    setCropImageSrc((current) => {
      disposeCropImageSrc(current);
      return nextImageSrc;
    });
    setCropFileName(file.name || "avatar.jpg");
    setCropOpen(true);
  };

  const toAvatarFileName = (name: string, mimeType: string) => {
    const safeBase = (name || "avatar")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 80) || "avatar";

    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    return `${safeBase}.${extension}`;
  };

  const handleAvatarUpload = async (croppedBlob: Blob) => {
    try {
      setUploadingAvatar(true);
      const mimeType = croppedBlob.type || "image/jpeg";
      const fileName = toAvatarFileName(cropFileName, mimeType);
      const formData = new FormData();
      formData.append("avatar", croppedBlob, fileName);
      await profileApi.uploadAvatar(formData);
      await refreshProfile();
      closeCropModal();
      success("Profile photo updated successfully");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to upload profile photo"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!avatarUrl) {
      return;
    }

    try {
      setRemovingAvatar(true);
      await profileApi.removeAvatar();
      await refreshProfile();
      success("Profile photo removed");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to remove profile photo"));
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSave = async () => {
    const trimmedStudioName = profile.studioName.trim();
    if (!trimmedStudioName) {
      error("Studio name is required");
      return;
    }

    if (studioNameChanged) {
      if (usernamePreview.isChecking) {
        error("Checking pages username availability. Please wait.");
        return;
      }
      if (usernamePreview.error) {
        error(usernamePreview.error);
        return;
      }
      if (!usernamePreview.username || !usernamePreview.available) {
        error(
          getUsernamePreviewReasonMessage(usernamePreview.reason) ||
            "This studio name is unavailable. Please choose a different studio name."
        );
        return;
      }
    }

    const normalizedSocialLinks = {
      instagram: normalizeInstagramUsername(profile.socialLinks.instagram),
      facebook: normalizeFacebookSlug(profile.socialLinks.facebook),
      tiktok: normalizeTiktokHandle(profile.socialLinks.tiktok),
      whatsapp: normalizeWhatsAppNumber(profile.socialLinks.whatsapp),
    };
    if (normalizedSocialLinks.whatsapp && !isValidPhoneNumber(normalizedSocialLinks.whatsapp)) {
      error("Please enter a valid WhatsApp number.");
      return;
    }

    try {
      setSaving(true);
      setProfile((current) => ({
        ...current,
        socialLinks: normalizedSocialLinks,
      }));
      await profileApi.update({
        studioName: trimmedStudioName,
        bio: profile.bio.trim() || undefined,
        email: profile.email.trim() || undefined,
        location: profile.location.trim() || undefined,
        city: profile.city.trim() || undefined,
        country: profile.country.trim() || undefined,
        specialty: profile.specialty.trim() || undefined,
        style: profile.style.trim() || undefined,
        hideBranding: profile.canHideBranding ? profile.hideBranding : false,
        socialLinks: {
          instagram: normalizedSocialLinks.instagram || undefined,
          facebook: normalizedSocialLinks.facebook || undefined,
          tiktok: normalizedSocialLinks.tiktok || undefined,
          whatsapp: normalizedSocialLinks.whatsapp || undefined,
        },
        themeColor: profile.themeColor,
      });
      await Promise.all([refreshProfile(), refreshUser()]);
      success(
        studioNameChanged && usernameWillChange
          ? "Profile updated. Your public pages URL has been updated."
          : "Profile updated successfully"
      );
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to save profile"));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      error("New password must be at least 8 characters");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      error("Password confirmation does not match");
      return;
    }

    try {
      setChangingPassword(true);
      await authApi.changePassword({
        currentPassword: passwordForm.currentPassword || undefined,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      setShowPasswordForm(false);
      success("Password updated successfully");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to change password"));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      error("Type DELETE to confirm account deletion");
      return;
    }

    try {
      setDeletingAccount(true);
      await authApi.deleteAccount({
        password: deletePassword || undefined,
        confirmation: "DELETE",
      });
      await logout();
      navigate("/login", { replace: true });
      success("Your account has been deleted");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to delete account"));
    } finally {
      setDeletingAccount(false);
    }
  };

  const currentPlan = String(planName || "FREE").toUpperCase();
  const currentStatus = String(subscription?.status || "ACTIVE").toUpperCase();
  const cancelAtPeriodEnd = Boolean(subscription?.cancelAtPeriodEnd);
  const nextPaymentDate =
    currentPlan === "FREE" ? "No active paid cycle" : formatDateTime(subscription?.nextRenewalAt || subscription?.renewAt || null);
  const currentBillingCycle = formatBillingCycleLabel(subscription?.billingCycle);
  const pendingChange = describePendingChange(subscription);
  const autoRenewEnabled = currentPlan !== "FREE" && !cancelAtPeriodEnd;
  const paymentStatus = getPaymentStatusConfig({
    plan: currentPlan,
    status: currentStatus,
    cancelAtPeriodEnd,
  });
  const PaymentStatusIcon = paymentStatus.icon;

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading settings..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Settings</h1>
        <p className="text-slate-600">Manage your profile and website settings</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Profile Information</h3>

            <div className="mb-6">
              <p className="block text-sm font-medium text-slate-700 mb-3">Profile Photo</p>
              <div className="flex items-center gap-4">
                <Avatar src={avatarUrl} name={avatarFallbackName} size={64} />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar || removingAvatar}
                  >
                    {uploadingAvatar ? "Uploading..." : "Upload New Photo"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void handleAvatarRemove()}
                    disabled={!avatarUrl || uploadingAvatar || removingAvatar}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
                  >
                    {removingAvatar ? "Removing..." : "Remove Photo"}
                  </Button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      handleAvatarFileSelect(event);
                    }}
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
                value={profile.studioName}
                onChange={(event) => setProfile((current) => ({ ...current, studioName: event.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
              />
              <p className="mt-1 text-xs text-slate-500">
                Your pages username is generated automatically from your studio name.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Pages Username</label>
              <div className="flex">
                <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-slate-600 text-sm">
                  https://
                </span>
                <input
                  type="text"
                  value={displayedUsername || "yourstudio"}
                  readOnly
                  className="flex-1 px-4 py-2.5 border border-gray-300 border-r-0 bg-slate-50 text-slate-900 outline-none"
                />
                <span className="inline-flex items-center px-4 rounded-r-lg border border-gray-300 bg-gray-50 text-slate-600 text-sm">
                  .{PUBLIC_APP_DOMAIN}
                </span>
              </div>
              <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${usernameStatusClass}`}>{usernameStatusMessage}</div>
              {usernameWillChange ? (
                <p className="mt-2 text-xs text-amber-700">
                  Saving this studio name changes your public pages URL to {previewUsername}.{PUBLIC_APP_DOMAIN}.
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
                value={profile.bio}
                onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all resize-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Tip: Describe your photography style and experience to build trust.
              </p>
            </div>

            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-1">
                  Location
                </label>
                <input
                  id="location"
                  type="text"
                  placeholder="Kuala Lumpur, Malaysia"
                  value={profile.location}
                  onChange={(event) => setProfile((current) => ({ ...current, location: event.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
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
                  value={profile.city}
                  onChange={(event) => setProfile((current) => ({ ...current, city: event.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
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
                  value={profile.country}
                  onChange={(event) => setProfile((current) => ({ ...current, country: event.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
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
                  value={profile.specialty}
                  onChange={(event) => setProfile((current) => ({ ...current, specialty: event.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
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
                value={profile.style}
                onChange={(event) => setProfile((current) => ({ ...current, style: event.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={profile.email}
                onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
              />
            </div>

          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Social Media</h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="instagram" className="block text-sm font-medium text-slate-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-pink-500" />
                    Instagram
                  </div>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-slate-600 text-sm">
                    instagram.com/
                  </span>
                  <input
                    id="instagram"
                    type="text"
                    placeholder="johnstudio"
                    value={profile.socialLinks.instagram}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        socialLinks: { ...current.socialLinks, instagram: event.target.value },
                      }))
                    }
                    onBlur={() =>
                      setProfile((current) => ({
                        ...current,
                        socialLinks: {
                          ...current.socialLinks,
                          instagram: normalizeInstagramUsername(current.socialLinks.instagram),
                        },
                      }))
                    }
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Paste username, @handle, or full URL.</p>
              </div>

              <div>
                <label htmlFor="facebook" className="block text-sm font-medium text-slate-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-blue-600" />
                    Facebook
                  </div>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-slate-600 text-sm">
                    facebook.com/
                  </span>
                  <input
                    id="facebook"
                    type="text"
                    placeholder="johnstudio"
                    value={profile.socialLinks.facebook}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        socialLinks: { ...current.socialLinks, facebook: event.target.value },
                      }))
                    }
                    onBlur={() =>
                      setProfile((current) => ({
                        ...current,
                        socialLinks: {
                          ...current.socialLinks,
                          facebook: normalizeFacebookSlug(current.socialLinks.facebook),
                        },
                      }))
                    }
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Paste page slug or full URL.</p>
              </div>

              <div>
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
                  value={profile.socialLinks.whatsapp}
                  onChange={(value) =>
                    setProfile((current) => ({
                      ...current,
                      socialLinks: { ...current.socialLinks, whatsapp: value || "" },
                    }))
                  }
                  onBlur={() =>
                    setProfile((current) => ({
                      ...current,
                      socialLinks: {
                        ...current.socialLinks,
                        whatsapp: normalizeWhatsAppNumber(current.socialLinks.whatsapp),
                      },
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-cyan-500 focus-within:border-cyan-500 outline-none transition-all bg-white"
                />
                <p className="mt-1 text-xs text-slate-500">Stored as international format (for example +60123456789).</p>
              </div>

              <div>
                <label htmlFor="tiktok" className="block text-sm font-medium text-slate-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Music2 className="w-4 h-4 text-slate-900" />
                    TikTok
                  </div>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-slate-600 text-sm">
                    tiktok.com/@
                  </span>
                  <input
                    id="tiktok"
                    type="text"
                    placeholder="johnstudio"
                    value={profile.socialLinks.tiktok}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        socialLinks: { ...current.socialLinks, tiktok: event.target.value },
                      }))
                    }
                    onBlur={() =>
                      setProfile((current) => ({
                        ...current,
                        socialLinks: {
                          ...current.socialLinks,
                          tiktok: normalizeTiktokHandle(current.socialLinks.tiktok),
                        },
                      }))
                    }
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Paste handle, @username, or full URL.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Website Customization</h3>
            <label className="block text-sm font-medium text-slate-700 mb-3">Theme Color</label>
            <div className="flex gap-3 flex-wrap">
              {themeOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setProfile((current) => ({ ...current, themeColor: color }))}
                  className={`w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110 ${
                    profile.themeColor === color ? "border-slate-900" : "border-gray-300"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <CustomDomainCard currentPlan={currentPlan} fallbackHost={fallbackLensayaHost} />

          <div className="flex justify-end">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-60"
            >
              <Save className="w-5 h-5" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Current Plan</h3>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100">
                Subscription & Payments
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${paymentStatus.badgeClass}`}
              >
                {cancelAtPeriodEnd ? "CANCEL SCHEDULED" : paymentStatus.label.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Keep track of your plan, payment status, and next payment date.
            </p>

            <div className="grid grid-cols-1 gap-3 mb-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Plan</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${getPlanBadgeClass(currentPlan)}`}>
                    {currentPlan}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Payment Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <PaymentStatusIcon className={`w-4 h-4 ${paymentStatus.color}`} />
                  <p className={`text-sm font-semibold ${paymentStatus.color}`}>{paymentStatus.label}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Billing Interval</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{currentBillingCycle}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Next Payment Date</p>
                <div className="mt-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-900">{nextPaymentDate}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Auto-Renewal</p>
                <div className="mt-1 flex items-center gap-2">
                  {autoRenewEnabled ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-slate-500" />
                  )}
                  <p className={`text-sm font-semibold ${autoRenewEnabled ? "text-green-600" : "text-slate-600"}`}>
                    {currentPlan === "FREE" ? "Not applicable" : autoRenewEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>
            </div>

            {subscription?.provider ? (
              <p className="mb-3 text-xs text-slate-500">Provider: {String(subscription.provider).toUpperCase()}</p>
            ) : null}

            {cancelAtPeriodEnd ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Your subscription is set to cancel at period end
                {subscription?.renewAt ? ` (${formatDateTime(subscription.renewAt)}).` : "."}
              </div>
            ) : null}

            {pendingChange ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Pending change: {pendingChange}
              </div>
            ) : null}

            {subscription?.billingState === "past_due" && subscription?.graceEndsAt ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                Payment issue detected. Grace period ends {formatDateTime(subscription.graceEndsAt)}.
              </div>
            ) : null}

            <div className="mb-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={profile.hideBranding}
                  disabled={!profile.canHideBranding}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      hideBranding: event.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded border-gray-300"
                />
                <span>
                  Hide Lensaya branding on public pages
                  <span className="block text-xs text-slate-500">
                    {profile.canHideBranding
                      ? "Available on your current plan."
                      : "Upgrade to Pro or Studio to remove branding."}
                  </span>
                </span>
              </label>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm font-medium text-slate-900 mb-1">Quick Actions</p>
              <p className="text-xs text-slate-600 mb-3">Manage your subscription lifecycle, billing status, and payment settings.</p>

              <div className="space-y-2">
                {currentPlan !== "FREE" ? (
                  <>
                    {!cancelAtPeriodEnd ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleRenewSubscription();
                        }}
                        disabled={billingActionLoading === "renew"}
                        className="inline-flex w-full items-center justify-center px-4 py-2 border border-cyan-300 text-cyan-700 rounded-lg hover:bg-cyan-50 transition-colors disabled:opacity-60"
                      >
                        {billingActionLoading === "renew" ? "Starting..." : "Renew Now"}
                      </button>
                    ) : null}

                    {cancelAtPeriodEnd ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleResumeSubscription();
                        }}
                        disabled={billingActionLoading === "resume"}
                        className="inline-flex w-full items-center justify-center px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-60"
                      >
                        {billingActionLoading === "resume" ? "Resuming..." : "Resume Auto-Renew"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          void handleScheduleCancellation();
                        }}
                        disabled={billingActionLoading === "cancel"}
                        className="inline-flex w-full items-center justify-center px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-60"
                      >
                        {billingActionLoading === "cancel" ? "Scheduling..." : "Cancel At Period End"}
                      </button>
                    )}
                  </>
                ) : null}

                <Link
                  to="/dashboard/pricing"
                  className={`inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    currentPlan === "FREE"
                      ? "bg-cyan-500 text-white hover:bg-cyan-600"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  {currentPlan === "FREE" ? "Upgrade Plan" : "Change Plan"}
                </Link>

                <Link
                  to="/dashboard/transactions"
                  className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-slate-700 hover:bg-gray-50 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  View Transactions
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    void handleOpenBillingPortal();
                  }}
                  disabled={billingActionLoading === "portal"}
                  className={`inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    paymentStatus.tone === "danger"
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "border border-cyan-300 text-cyan-700 hover:bg-cyan-50"
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  {billingActionLoading === "portal" ? "Opening..." : "Open Billing Center"}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Upgrades apply immediately after successful payment. Downgrades and cancellations remain active until the current billing period ends.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Account</h3>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowPasswordForm((current) => !current)}
                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Change Password
              </button>
              {showPasswordForm ? (
                <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="current-password">
                      Current Password
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={passwordForm.currentPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="new-password">
                      New Password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="confirm-new-password">
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-new-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.confirmNewPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({ ...current, confirmNewPassword: event.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleChangePassword();
                    }}
                    disabled={changingPassword}
                    className="w-full px-4 py-2 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-60"
                  >
                    {changingPassword ? "Updating..." : "Update Password"}
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setShowDeleteConfirm((current) => !current)}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Delete Account
              </button>
              {showDeleteConfirm ? (
                <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-xs text-red-700">
                    This action is permanent. Enter your password (if you have one) and type DELETE to confirm.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-red-700 mb-1" htmlFor="delete-password">
                      Password
                    </label>
                    <input
                      id="delete-password"
                      type="password"
                      autoComplete="current-password"
                      value={deletePassword}
                      onChange={(event) => setDeletePassword(event.target.value)}
                      className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition-all bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-red-700 mb-1" htmlFor="delete-confirmation">
                      Type DELETE
                    </label>
                    <input
                      id="delete-confirmation"
                      type="text"
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition-all bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteAccount();
                    }}
                    disabled={deletingAccount}
                    className="w-full px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    {deletingAccount ? "Deleting..." : "Permanently Delete Account"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <AvatarCropModal
        open={cropOpen}
        imageSrc={cropImageSrc}
        saving={uploadingAvatar}
        onCancel={closeCropModal}
        onSave={handleAvatarUpload}
      />
    </DashboardLayout>
  );
}
