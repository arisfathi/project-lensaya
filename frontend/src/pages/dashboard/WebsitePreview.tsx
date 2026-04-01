import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  ExternalLink,
  Copy,
  Edit,
  Calendar,
  Image as ImageIcon,
  Briefcase,
  Package,
  Clock,
  Check,
  Instagram,
  Facebook,
  Music2,
  MessageCircle,
} from "lucide-react";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { DashboardPageHero } from "../../components/dashboard/DashboardPageHero";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { dashboardApi, publicApi, profileApi, uploadsApi, getApiErrorMessage, isApiAccessError } from "../../lib/api";
import { buildPublicStudioHost, toAbsoluteWebsiteUrl } from "../../lib/platform";
import { HeroSection } from "../PhotographerPortfolio/components/PortfolioSections";
import type { HeroSocialLink } from "../PhotographerPortfolio/types";

type WebsiteSummary = {
  websiteUrl: string;
  portfolioCount: number;
  serviceCount: number;
  packageCount: number;
  lastUpdated: string;
};

type PublicProfile = {
  username: string;
  name?: string;
  studioName: string;
  bio: string | null;
  avatarUrl: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  showHero: boolean;
  socialLinks: {
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
  };
  whatsappNumber: string | null;
  phone: string | null;
  themeColor: string | null;
};

type PublicService = {
  id: string;
  name: string;
  emoji: string | null;
  thumbnailUrl: string | null;
  order: number;
};

type PublicPortfolioItem = {
  id: string;
  imageUrl: string | null;
  serviceId: string | null;
  category: string | null;
  featured: boolean;
  views: number;
};

type PublicPackageItem = {
  id: string;
  serviceId: string;
  name: string;
  price: number;
  currency: string;
  duration: string;
  features: string[];
};

type HeroSettingsForm = {
  heroSubtitle: string;
  heroImageUrl: string;
  showHero: boolean;
};


const formatLastUpdated = (value: string | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

export default function WebsitePreview() {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [portfolio, setPortfolio] = useState<PublicPortfolioItem[]>([]);
  const [packages, setPackages] = useState<PublicPackageItem[]>([]);
  const [summary, setSummary] = useState<WebsiteSummary | null>(null);
  const [heroSettings, setHeroSettings] = useState<HeroSettingsForm>({
    heroSubtitle: "",
    heroImageUrl: "",
    showHero: true,
  });
  const [savingHeroSettings, setSavingHeroSettings] = useState(false);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);

  const { user } = useAuth();
  const { success, error } = useToast();
  const heroImageInputRef = useRef<HTMLInputElement | null>(null);
  const coverSettingsRef = useRef<HTMLDivElement | null>(null);

  const username = user?.username || "";
  const fallbackDomain = buildPublicStudioHost(username);
  const websiteUrl = summary?.websiteUrl || fallbackDomain;
  const publicUsername = profile?.username || username;
  const publicPath = publicUsername ? `/p/${publicUsername}` : "/portfolio";

  const buildHeroSocialLinks = (): HeroSocialLink[] => {
    if (!profile) return [];
    const links: HeroSocialLink[] = [];

    if (profile.socialLinks.instagram) {
      links.push({
        key: "instagram",
        label: "Instagram",
        href: profile.socialLinks.instagram,
        icon: Instagram,
        bgClass: "bg-gradient-to-br from-pink-500 to-rose-500",
        eventType: "PROFILE_CLICK",
        origin: "instagram_hero",
      });
    }

    if (profile.socialLinks.facebook) {
      links.push({
        key: "facebook",
        label: "Facebook",
        href: profile.socialLinks.facebook,
        icon: Facebook,
        bgClass: "bg-blue-600",
        eventType: "PROFILE_CLICK",
        origin: "facebook_hero",
      });
    }

    if (profile.socialLinks.tiktok) {
      links.push({
        key: "tiktok",
        label: "TikTok",
        href: profile.socialLinks.tiktok,
        icon: Music2,
        bgClass: "bg-slate-900",
        eventType: "PROFILE_CLICK",
        origin: "tiktok_hero",
      });
    }

    if (profile.whatsappNumber) {
      const whatsappUrl = `https://wa.me/${profile.whatsappNumber.replace(/\D/g, "")}`;
      links.push({
        key: "whatsapp",
        label: "WhatsApp",
        href: whatsappUrl,
        icon: MessageCircle,
        bgClass: "bg-green-500",
        eventType: "WHATSAPP_CLICK",
        origin: "whatsapp_hero",
      });
    }

    return links;
  };

  useEffect(() => {
    let mounted = true;

    const loadPreview = async () => {
      if (!username) {
        setErrorMessage("Username is required before website preview can be loaded.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [photographerResult, servicesResult, portfolioResult, packagesResult, summaryResult] = await Promise.all([
          publicApi.photographer(username),
          publicApi.services(username),
          publicApi.portfolio(username, { page: 1, limit: 24 }),
          publicApi.packages(username),
          dashboardApi.websiteSummary(),
        ]);

        if (!mounted) return;

        const profileResult = photographerResult?.photographer || null;
        if (!profileResult) {
          setErrorMessage("Public profile is not available yet.");
          setLoading(false);
          return;
        }

        setProfile(profileResult as PublicProfile);
        setHeroSettings({
          heroSubtitle: profileResult.heroSubtitle || "",
          heroImageUrl: profileResult.heroImageUrl || "",
          showHero: profileResult.showHero !== false,
        });
        setServices((servicesResult?.services || []) as PublicService[]);
        setPortfolio((portfolioResult?.items || []) as PublicPortfolioItem[]);
        setPackages((packagesResult?.items || []) as PublicPackageItem[]);
        setSummary(summaryResult as WebsiteSummary);
        setErrorMessage(null);
      } catch (err) {
        if (!mounted) return;
        if (isApiAccessError(err)) {
          setErrorMessage("Website preview is temporarily unavailable.");
          return;
        }
        const message = getApiErrorMessage(err, "Failed to load website preview");
        setErrorMessage(message);
        error(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      mounted = false;
    };
  }, [error, username]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(toAbsoluteWebsiteUrl(websiteUrl));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleEditCoverSettings = () => {
    coverSettingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleHeroInputChange = (field: keyof HeroSettingsForm, value: string | boolean) => {
    setHeroSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleHeroImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      error("Only image files are supported");
      return;
    }

    try {
      setUploadingHeroImage(true);
      const presigned = await uploadsApi.presign({
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        purpose: "banner",
      });

      const uploadResponse = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: presigned.headers,
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload cover image");
      }

      const completed = await uploadsApi.complete(presigned.assetId);
      const nextUrl = completed.publicUrl || completed.url || presigned.publicUrl || "";
      if (!nextUrl) {
        throw new Error("Uploaded cover image URL is unavailable");
      }

      handleHeroInputChange("heroImageUrl", nextUrl);
      success("Cover image uploaded. Save changes to publish.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to upload cover image"));
    } finally {
      setUploadingHeroImage(false);
    }
  };

  const handleHeroImageRemove = () => {
    if (!heroSettings.heroImageUrl) return;
    handleHeroInputChange("heroImageUrl", "");
    success("Cover image removed. Save changes to publish.");
  };

  const handleSaveHeroSettings = async () => {
    try {
      setSavingHeroSettings(true);
      const payload = {
        heroSubtitle: heroSettings.heroSubtitle.trim() || undefined,
        heroImageUrl: heroSettings.heroImageUrl.trim(),
        showHero: heroSettings.showHero,
      };

      await profileApi.updateHero(payload);

      setProfile((current) =>
        current
          ? {
              ...current,
              heroSubtitle: payload.heroSubtitle || null,
              heroImageUrl: payload.heroImageUrl || null,
              showHero: payload.showHero,
            }
          : current
      );

      success("Cover settings saved successfully");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to save cover settings"));
    } finally {
      setSavingHeroSettings(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading website preview..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardPageHero
        eyebrow="Site Management Studio"
        title="Website Preview"
        description="Preview and manage your public pages website."
      />

      {errorMessage ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700 sm:mb-8 sm:p-6">{errorMessage}</div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:mb-6 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="button"
          onClick={handleEditCoverSettings}
          className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 sm:col-span-1 sm:bg-cyan-500 sm:font-medium sm:hover:bg-cyan-600"
        >
          <Edit className="w-4 h-4" />
          Edit Cover Section
        </button>
        <Link
          to={publicPath}
          target="_blank"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-gray-50 sm:px-4 sm:text-sm sm:font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          View Public Site
        </Link>
        <button
          type="button"
          onClick={() => {
            void handleCopyUrl();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-gray-50 sm:px-4 sm:text-sm sm:font-medium"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Website URL
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white sm:rounded-xl sm:border-gray-200 sm:shadow-sm">
            {profile && (
              <HeroSection
                showHeroSection={profile.showHero}
                heroBackgroundImageUrl={profile.heroImageUrl || ""}
                coverTitle={profile.studioName}
                heroSubtitle={profile.heroSubtitle || ""}
                heroSocialLinks={buildHeroSocialLinks()}
                onSocialClick={() => {
                  // Non-blocking analytics tracking
                }}
              />
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:rounded-xl sm:border-gray-200 sm:p-6 sm:shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900 sm:mb-4 sm:text-lg">Website Info</h2>

            <div className="space-y-4">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal sm:text-slate-600">Website URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 sm:text-sm sm:font-medium sm:text-cyan-600">
                    {websiteUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyUrl();
                    }}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 border-t border-gray-200 pt-3 sm:pt-4 sm:space-y-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">Portfolio</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 sm:text-sm">{summary?.portfolioCount ?? portfolio.length}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Briefcase className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">Services</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 sm:text-sm">{summary?.serviceCount ?? services.length}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Package className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">Packages</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 sm:text-sm">{summary?.packageCount ?? packages.length}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">Updated</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-900 sm:text-sm">{formatLastUpdated(summary?.lastUpdated)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:rounded-xl sm:border-gray-200 sm:p-6 sm:shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900 sm:mb-4 sm:text-lg">Quick Edit</h2>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-1 sm:space-y-2 sm:gap-0">
              <Link
                to="/dashboard/portfolio"
                className="group flex items-center justify-between rounded-xl border border-slate-200 p-2.5 transition-colors hover:border-cyan-200 hover:bg-gray-50 sm:rounded-lg sm:p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-cyan-50 p-1.5 text-cyan-500 transition-colors group-hover:bg-cyan-100 sm:p-2">
                    <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 sm:text-base sm:font-medium">Portfolio</span>
                </div>
                <Edit className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-cyan-500 sm:h-4 sm:w-4" />
              </Link>

              <Link
                to="/dashboard/services"
                className="group flex items-center justify-between rounded-xl border border-slate-200 p-2.5 transition-colors hover:border-cyan-200 hover:bg-gray-50 sm:rounded-lg sm:p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-1.5 text-blue-500 transition-colors group-hover:bg-blue-100 sm:p-2">
                    <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 sm:text-base sm:font-medium">Services</span>
                </div>
                <Edit className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-cyan-500 sm:h-4 sm:w-4" />
              </Link>

              <Link
                to="/dashboard/packages"
                className="group flex items-center justify-between rounded-xl border border-slate-200 p-2.5 transition-colors hover:border-cyan-200 hover:bg-gray-50 sm:rounded-lg sm:p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-50 p-1.5 text-purple-500 transition-colors group-hover:bg-purple-100 sm:p-2">
                    <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 sm:text-base sm:font-medium">Packages</span>
                </div>
                <Edit className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-cyan-500 sm:h-4 sm:w-4" />
              </Link>

              <Link
                to="/dashboard/availability"
                className="group flex items-center justify-between rounded-xl border border-slate-200 p-2.5 transition-colors hover:border-cyan-200 hover:bg-gray-50 sm:rounded-lg sm:p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-1.5 text-green-500 transition-colors group-hover:bg-green-100 sm:p-2">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 sm:text-base sm:font-medium">Availability</span>
                </div>
                <Edit className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-cyan-500 sm:h-4 sm:w-4" />
              </Link>
            </div>
          </div>

          <div ref={coverSettingsRef} className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:rounded-xl sm:border-gray-200 sm:p-6 sm:shadow-sm">
            <h2 className="mb-2 text-base font-semibold text-slate-900 sm:text-lg">Cover Section Settings</h2>
            <p className="mb-4 text-xs text-slate-600 sm:mb-6 sm:text-sm">
              Your studio name is used automatically as the cover title. You can still manage the subtitle, background image, and visibility here.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 sm:text-sm sm:font-medium sm:normal-case sm:tracking-normal sm:text-slate-700" htmlFor="cover-subtitle">
                  Cover Subtitle
                </label>
                <textarea
                  id="cover-subtitle"
                  value={heroSettings.heroSubtitle}
                  onChange={(event) => handleHeroInputChange("heroSubtitle", event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 sm:px-4"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:rounded-lg sm:bg-transparent sm:p-0">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 sm:text-sm sm:font-medium sm:normal-case sm:tracking-normal sm:text-slate-700">Cover Background Image</label>
                <p className="mb-2 text-[11px] text-slate-500 sm:text-xs">
                  Tip: Upload a strong cover image to make a good first impression.
                </p>
                <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center sm:gap-3">
                  <button
                    type="button"
                    onClick={() => heroImageInputRef.current?.click()}
                    disabled={uploadingHeroImage}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-gray-50 disabled:opacity-60 sm:px-4 sm:py-2.5 sm:text-sm sm:font-medium"
                  >
                    {uploadingHeroImage ? "Uploading..." : "Upload Image"}
                  </button>
                  <button
                    type="button"
                    onClick={handleHeroImageRemove}
                    disabled={!heroSettings.heroImageUrl || uploadingHeroImage || savingHeroSettings}
                    className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-60 sm:px-4 sm:py-2.5 sm:text-sm sm:font-medium"
                  >
                    Delete Image
                  </button>
                  <input
                    ref={heroImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      void handleHeroImageSelect(event);
                    }}
                    className="hidden"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-500 sm:text-xs">
                  {heroSettings.heroImageUrl ? "Image selected" : "No image selected"}
                </p>
                {heroSettings.heroImageUrl ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-slate-100 p-2">
                    <ImageWithFallback
                      src={heroSettings.heroImageUrl}
                      alt="Cover preview"
                      className="block mx-auto w-auto max-w-full h-auto max-h-105 object-contain"
                    />
                  </div>
                ) : null}
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={heroSettings.showHero}
                  onChange={(event) => handleHeroInputChange("showHero", event.target.checked)}
                />
                Show Cover Section
              </label>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveHeroSettings();
                  }}
                  disabled={savingHeroSettings}
                  className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-600 disabled:opacity-60 sm:w-auto sm:px-6 sm:font-medium"
                >
                  {savingHeroSettings ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

