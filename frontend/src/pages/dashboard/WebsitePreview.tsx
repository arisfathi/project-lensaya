import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  Monitor,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Copy,
  Edit,
  Calendar,
  Image as ImageIcon,
  Briefcase,
  Package,
  Clock,
  Check,
} from "lucide-react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { dashboardApi, publicApi, profileApi, uploadsApi, getApiErrorMessage } from "../../lib/api";
import { buildPublicStudioHost, toAbsoluteWebsiteUrl } from "../../lib/platform";

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
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
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
  const previewFrameSrc = `${publicPath}?preview=${previewVersion}`;

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

  const refreshLivePreview = () => {
    setPreviewVersion((current) => current + 1);
  };

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
      refreshLivePreview();

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
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Website Preview</h1>
        <p className="text-slate-600">Preview and manage your public pages website</p>
      </div>

      {errorMessage ? (
        <div className="bg-white rounded-xl p-6 border border-red-200 text-red-700 mb-8">{errorMessage}</div>
      ) : null}

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          type="button"
          onClick={handleEditCoverSettings}
          className="px-4 py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Edit Cover Section
        </button>
        <Link
          to={publicPath}
          target="_blank"
          className="px-4 py-2.5 border border-gray-200 text-slate-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          View Public Site
        </Link>
        <button
          type="button"
          onClick={() => {
            void handleCopyUrl();
          }}
          className="px-4 py-2.5 border border-gray-200 text-slate-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
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
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Website Info</h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">Website URL</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-medium text-cyan-600 bg-cyan-50 px-3 py-1.5 rounded-lg flex-1 truncate">
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

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm">Portfolio Images</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{summary?.portfolioCount ?? portfolio.length}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Briefcase className="w-4 h-4" />
                    <span className="text-sm">Total Services</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{summary?.serviceCount ?? services.length}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Package className="w-4 h-4" />
                    <span className="text-sm">Packages</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{summary?.packageCount ?? packages.length}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Last Updated</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{formatLastUpdated(summary?.lastUpdated)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Live Preview</h2>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshLivePreview}
                  className="px-3 py-2 rounded-md font-medium text-sm border border-gray-200 text-slate-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
                <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode("desktop")}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-colors flex items-center gap-2 ${
                      viewMode === "desktop" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("mobile")}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-colors flex items-center gap-2 ${
                      viewMode === "mobile" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    Mobile
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 rounded-lg p-4 sm:p-8 flex justify-center">
              <div
                className={`bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300 border border-gray-200 ${
                  viewMode === "mobile" ? "w-[375px] max-w-full" : "w-full"
                }`}
              >
                <div className="h-[720px]">
                  <iframe
                    key={previewFrameSrc}
                    title="Live public website preview"
                    src={previewFrameSrc}
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Powered by Lensaya
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Edit</h2>

            <div className="space-y-2">
              <Link
                to="/dashboard/portfolio"
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-cyan-200 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-50 text-cyan-500 rounded-lg group-hover:bg-cyan-100 transition-colors">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-slate-900">Edit Portfolio</span>
                </div>
                <Edit className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
              </Link>

              <Link
                to="/dashboard/services"
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-cyan-200 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-500 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-slate-900">Edit Services</span>
                </div>
                <Edit className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
              </Link>

              <Link
                to="/dashboard/packages"
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-cyan-200 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 text-purple-500 rounded-lg group-hover:bg-purple-100 transition-colors">
                    <Package className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-slate-900">Edit Packages</span>
                </div>
                <Edit className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
              </Link>

              <Link
                to="/dashboard/availability"
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-cyan-200 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 text-green-500 rounded-lg group-hover:bg-green-100 transition-colors">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-slate-900">Edit Availability</span>
                </div>
                <Edit className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
              </Link>
            </div>
          </div>

          <div ref={coverSettingsRef} className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Cover Section Settings</h2>
            <p className="mb-6 text-sm text-slate-600">
              Your studio name is used automatically as the cover title. You can still manage the subtitle, background image, and visibility here.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="cover-subtitle">
                  Cover Subtitle
                </label>
                <textarea
                  id="cover-subtitle"
                  value={heroSettings.heroSubtitle}
                  onChange={(event) => handleHeroInputChange("heroSubtitle", event.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cover Background Image</label>
                <p className="mb-2 text-xs text-slate-500">
                  Tip: Upload a strong cover image to make a good first impression.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => heroImageInputRef.current?.click()}
                    disabled={uploadingHeroImage}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-slate-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                  >
                    {uploadingHeroImage ? "Uploading..." : "Upload Image"}
                  </button>
                  <button
                    type="button"
                    onClick={handleHeroImageRemove}
                    disabled={!heroSettings.heroImageUrl || uploadingHeroImage || savingHeroSettings}
                    className="px-4 py-2.5 border border-red-200 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
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
                  {heroSettings.heroImageUrl ? (
                    <span className="text-xs text-slate-500">Image selected</span>
                  ) : (
                    <span className="text-xs text-slate-500">No image selected</span>
                  )}
                </div>
                {heroSettings.heroImageUrl ? (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-slate-50 p-2">
                    <ImageWithFallback
                      src={heroSettings.heroImageUrl}
                      alt="Cover preview"
                      className="block mx-auto w-auto max-w-full h-auto max-h-[420px] object-contain"
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

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveHeroSettings();
                  }}
                  disabled={savingHeroSettings}
                  className="px-6 py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-60"
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
