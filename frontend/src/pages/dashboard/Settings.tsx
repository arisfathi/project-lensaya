import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Save } from "lucide-react";
import { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { AvatarCropModal } from "../../components/avatar/AvatarCropModal";
import { CustomDomainCard } from "../../components/settings/CustomDomainCard";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { authApi, billingApi, profileApi, getApiErrorMessage, isApiAccessError } from "../../lib/api";
import { useStudioUsernamePreview } from "../../hooks/useStudioUsernamePreview";
import { PUBLIC_APP_DOMAIN } from "../../lib/platform";
import { getUsernamePreviewReasonMessage } from "../../lib/usernames";
import { DEFAULT_PROFILE } from "./settings/constants";
import { AccountSecurityCard } from "./settings/components/AccountSecurityCard";
import { ProfileInformationCard } from "./settings/components/ProfileInformationCard";
import { SettingsPageHeader } from "./settings/components/SettingsPageHeader";
import { SocialMediaCard } from "./settings/components/SocialMediaCard";
import { WebsiteCustomizationCard } from "./settings/components/WebsiteCustomizationCard";
import type { PasswordForm, ProfileForm, ProfileResponse, SavedIdentity } from "./settings/types";
import {
  normalizeFacebookSlug,
  normalizeInstagramUsername,
  normalizeTiktokHandle,
  normalizeWhatsAppNumber,
  toAvatarFileName,
} from "./settings/utils";

export default function Settings() {
  const [profile, setProfile] = useState<ProfileForm>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState("avatar.jpg");
  const [planName, setPlanName] = useState("FREE");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savedIdentity, setSavedIdentity] = useState<SavedIdentity>({ studioName: "", username: "" });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
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

  const syncSubscriptionState = (nextSubscription: { plan?: string | null }) => {
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
        if (!mounted || isApiAccessError(err)) return;
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

  useEffect(
    () => () => {
      disposeCropImageSrc(cropImageSrc);
    },
    [cropImageSrc]
  );

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
  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading settings..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl overflow-x-hidden">
        <SettingsPageHeader />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <ProfileInformationCard
            data={{
              profile,
              avatarUrl,
              avatarFallbackName,
              displayedUsername,
              usernameStatusClass,
              usernameStatusMessage,
              usernameWillChange,
              previewUsername,
              publicAppDomain: PUBLIC_APP_DOMAIN,
            }}
            state={{
              uploadingAvatar,
              removingAvatar,
            }}
            avatarInputRef={avatarInputRef}
            actions={{
              setProfile,
              onAvatarFileSelect: handleAvatarFileSelect,
              onAvatarRemove: () => {
                void handleAvatarRemove();
              },
            }}
          />

          <SocialMediaCard
            data={{ profile }}
            actions={{ setProfile }}
          />

          <WebsiteCustomizationCard
            data={{ profile }}
            actions={{ setProfile }}
          />
          <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-200/80 bg-white/90 p-2.5 shadow-sm backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-white transition-colors hover:bg-cyan-600 disabled:opacity-60 md:ml-auto md:w-auto"
            >
              <Save className="w-5 h-5" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
          
          <CustomDomainCard currentPlan={currentPlan} fallbackHost={fallbackLensayaHost} />


        </div>

        <div className="space-y-4 lg:space-y-6">
          <AccountSecurityCard
            data={{
              showPasswordForm,
              passwordForm,
              changingPassword,
              showDeleteConfirm,
              deletePassword,
              deleteConfirmation,
              deletingAccount,
            }}
            actions={{
              onTogglePasswordForm: () => {
                setShowPasswordForm((current) => !current);
              },
              onPasswordFormChange: setPasswordForm,
              onChangePassword: () => {
                void handleChangePassword();
              },
              onToggleDeleteConfirm: () => {
                setShowDeleteConfirm((current) => !current);
              },
              onDeletePasswordChange: setDeletePassword,
              onDeleteConfirmationChange: setDeleteConfirmation,
              onDeleteAccount: () => {
                void handleDeleteAccount();
              },
            }}
          />
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
