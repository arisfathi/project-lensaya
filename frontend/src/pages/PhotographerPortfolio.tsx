import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Camera, ChevronLeft, ChevronRight, Check, Instagram, Facebook, MessageCircle, Phone, Music2, Share2 } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Avatar } from "../components/ui/Avatar";
import { PublicSiteUnavailable } from "../components/public/PublicSiteUnavailable";
import { useParams } from "react-router-dom";
import { analyticsApi, publicApi, getApiErrorMessage } from "../lib/api";
import { buildAppUrl, buildPublicStudioUrl } from "../lib/platform";
import { useSeoMeta } from "../lib/seo";
import { usePublicSiteContext } from "../hooks/usePublicSiteContext";
import { buildPortfolioShareMessage } from "../lib/share";

type PublicProfile = {
  id: string;
  username: string;
  name?: string;
  studioName: string;
  bio: string | null;
  avatarUrl: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  showHero: boolean;
  location: string | null;
  city: string | null;
  country: string | null;
  specialty: string | null;
  style: string | null;
  showLensayaBranding: boolean;
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

type ServicePreviewImage = {
  id: string;
  imageUrl: string | null;
  serviceId: string | null;
};

type PublicPackage = {
  id: string;
  serviceId: string;
  name: string;
  price: number;
  currency: string;
  duration: string;
  features: string[];
};

type PublicAvailability = {
  date: string;
  status: string;
};
type AvailabilityDayStatus = "available" | "booked";

type BookingInquiryForm = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SERVICE_PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%23e2e8f0'/%3E%3Cstop offset='100%25' stop-color='%23cbd5e1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='600' height='400' fill='url(%23g)'/%3E%3Cpath d='M120 280l95-100 85 85 60-65 120 120H120z' fill='%2394a3b8'/%3E%3Ccircle cx='215' cy='145' r='28' fill='%23cbd5e1'/%3E%3C/svg%3E";

const DEFAULT_THEME_COLOR = "#06b6d4";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeThemeColor = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw) ? raw : DEFAULT_THEME_COLOR;
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "").trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return `rgba(6, 182, 212, ${alpha})`;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const formatPackagePrice = (pkg: PublicPackage) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: pkg.currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pkg.price || 0);

const toDateKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const normalizeAvailabilityStatus = (value: unknown): AvailabilityDayStatus => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "booked" || normalized === "unavailable" || normalized === "blocked"
    ? "booked"
    : "available";
};
const isBookedAvailabilityStatus = (value: AvailabilityDayStatus) => value === "booked";
const toAvailabilityStatusLabel = (value: AvailabilityDayStatus) => (value === "booked" ? "Booked" : "Available");

const formatDateLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not selected";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

const todayLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toInstagramUrl = (value: string | null | undefined) => {
  const username = String(value || "").trim();
  if (!username) return null;
  return `https://instagram.com/${encodeURIComponent(username)}`;
};

const toFacebookUrl = (value: string | null | undefined) => {
  const slug = String(value || "").trim();
  if (!slug) return null;
  return `https://facebook.com/${encodeURIComponent(slug)}`;
};

const toTiktokUrl = (value: string | null | undefined) => {
  const handle = String(value || "").trim().replace(/^@+/, "");
  if (!handle) return null;
  return `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
};

const toWhatsAppUrl = (value: string | null | undefined, message: string) => {
  const text = encodeURIComponent(message);
  const raw = String(value || "").replace(/\D/g, "");
  return raw ? `https://wa.me/${raw}?text=${text}` : `https://wa.me/?text=${text}`;
};

const VISITOR_ID_STORAGE_KEY = "lensaya_visitor_id";
const SESSION_ID_STORAGE_KEY = "lensaya_session_id";
const SESSION_SOURCE_STORAGE_KEY = "lensaya_session_source";

const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const getOrCreateStorageValue = (storage: Storage, key: string, prefix: string) => {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const created = createId(prefix);
  storage.setItem(key, created);
  return created;
};

const classifySource = (rawValue: string) => {
  const value = String(rawValue || "").trim().toLowerCase();
  if (!value) return "";
  if (value.includes("instagram") || value === "ig") return "instagram";
  if (value.includes("facebook") || value === "fb") return "facebook";
  if (value.includes("whatsapp") || value.includes("wa.me")) return "whatsapp";
  if (value.includes("youtube") || value.includes("youtu")) return "youtube";
  if (value.includes("tiktok")) return "tiktok";
  if (value.includes("x") || value.includes("twitter") || value.includes("t.co")) return "x";
  if (value.includes("google") || value.includes("bing") || value.includes("yahoo") || value.includes("duckduckgo")) return "search";
  if (value === "direct") return "direct";
  return value.replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "referral";
};

const sourceFromReferrer = (referrer: string) => {
  const value = String(referrer || "").trim();
  if (!value) return "direct";

  try {
    const host = new URL(value).hostname.toLowerCase();
    if (!host || host === window.location.hostname) return "direct";
    return classifySource(host) || "referral";
  } catch {
    return "referral";
  }
};

const resolveInitialSource = () => {
  const params = new URLSearchParams(window.location.search);
  const explicitSource =
    params.get("utm_source") ||
    params.get("source") ||
    (params.get("ref") ? "referral" : "") ||
    (params.get("gclid") ? "search" : "") ||
    (params.get("fbclid") ? "facebook" : "") ||
    (params.get("ttclid") ? "tiktok" : "") ||
    "";

  const classified = classifySource(explicitSource);
  if (classified) return classified;
  return sourceFromReferrer(document.referrer || "");
};

const toBookingSource = (
  source: string
): "WEBSITE" | "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "DIRECT" | "OTHER" => {
  const normalized = String(source || "").trim().toLowerCase();
  if (!normalized || normalized === "website") return "WEBSITE";
  if (normalized.includes("whatsapp")) return "WHATSAPP";
  if (normalized.includes("instagram")) return "INSTAGRAM";
  if (normalized.includes("facebook")) return "FACEBOOK";
  if (normalized === "direct") return "DIRECT";
  return "OTHER";
};

export default function PhotographerPortfolio() {
  const { username: routeUsername } = useParams<{ username: string }>();
  const appHomeUrl = buildAppUrl("/");
  const publicSiteContext = usePublicSiteContext(!routeUsername);

  const [resolvedUsername, setResolvedUsername] = useState("");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [servicePreviewImages, setServicePreviewImages] = useState<ServicePreviewImage[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PublicPortfolioItem[]>([]);
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [availability, setAvailability] = useState<PublicAvailability[]>([]);
  const [availabilityMonth, setAvailabilityMonth] = useState(new Date().toISOString().slice(0, 7));

  const [selectedService, setSelectedService] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookingInquiryForm, setBookingInquiryForm] = useState<BookingInquiryForm>({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [bookingInquirySubmitting, setBookingInquirySubmitting] = useState(false);
  const [bookingInquiryFeedback, setBookingInquiryFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const visitorIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sourceRef = useRef<string | null>(null);
  const pageViewTrackedRef = useRef<string | null>(null);
  const portfolioViewTrackedRef = useRef<string | null>(null);
  const packageViewTrackedRef = useRef<Set<string>>(new Set());

  const ensureVisitorContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!visitorIdRef.current) {
      visitorIdRef.current = getOrCreateStorageValue(window.localStorage, VISITOR_ID_STORAGE_KEY, "visitor");
    }

    if (!sessionIdRef.current) {
      sessionIdRef.current = getOrCreateStorageValue(window.sessionStorage, SESSION_ID_STORAGE_KEY, "session");
    }

    if (!sourceRef.current) {
      const existingSource = window.sessionStorage.getItem(SESSION_SOURCE_STORAGE_KEY) || "";
      const resolvedSource = classifySource(existingSource) || resolveInitialSource();
      sourceRef.current = resolvedSource || "direct";
      window.sessionStorage.setItem(SESSION_SOURCE_STORAGE_KEY, sourceRef.current);
    }

    return {
      visitorId: visitorIdRef.current,
      sessionId: sessionIdRef.current,
      source: sourceRef.current || "direct",
    };
  }, []);

  const trackAnalyticsEvent = useCallback(
    async (payload: {
      eventType:
        | "PAGE_VIEW"
        | "PORTFOLIO_VIEW"
        | "PROFILE_CLICK"
        | "PACKAGE_VIEW"
        | "WHATSAPP_CLICK"
        | "BOOKING_INTENT"
        | "PORTFOLIO_SHARE"
        | "SERVICE_SELECT"
        | "PACKAGE_SELECT";
      serviceId?: string;
      packageId?: string;
      portfolioItemId?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const photographerId = profile?.id;
      if (!photographerId) return;
      if (typeof window !== "undefined" && window.self !== window.top && /\/dashboard\//i.test(document.referrer || "")) {
        return;
      }

      const visitorContext = ensureVisitorContext();
      if (!visitorContext) return;

      try {
        await analyticsApi.track({
          eventType: payload.eventType,
          photographerId,
          serviceId: payload.serviceId,
          packageId: payload.packageId,
          portfolioItemId: payload.portfolioItemId,
          sessionId: visitorContext.sessionId,
          visitorId: visitorContext.visitorId,
          source: visitorContext.source,
          metadata: payload.metadata,
        });
      } catch {
        // Analytics should never block portfolio interactions.
      }
    },
    [ensureVisitorContext, profile?.id]
  );

  useEffect(() => {
    let mounted = true;

    const loadPublicProfile = async () => {
      setLoading(true);
      try {
        const monthKey = new Date().toISOString().slice(0, 7);

        let username = routeUsername || "";
        if (!username) {
          if (publicSiteContext.loading) {
            return;
          }

          if (publicSiteContext.resolved && publicSiteContext.photographer?.username) {
            username = publicSiteContext.photographer.username;
          } else if (publicSiteContext.hostCandidate) {
            setResolvedUsername("");
            setProfile(null);
            setServices([]);
            setServicePreviewImages([]);
            setPortfolioItems([]);
            setPackages([]);
            setAvailability([]);
            setSelectedService("");
            setSelectedPackageId(null);
            setSelectedDate(null);
            setBookingInquiryFeedback(null);
            setCurrentImageIndex(0);
            setErrorMessage(null);
            return;
          } else {
            const featured = await publicApi.featured({ limit: 1 });
            username = featured.items?.[0]?.username || "";
          }
        }

        if (!username) {
          throw new Error("No photographer profile found.");
        }

        const [photographerResult, servicesResult, portfolioResult, packagesResult, availabilityResult] = await Promise.all([
          publicApi.photographer(username),
          publicApi.services(username),
          publicApi.portfolio(username, { page: 1, limit: 100 }),
          publicApi.packages(username),
          publicApi.availability(username, monthKey),
        ]);

        if (!mounted) return;

        const profileResult = photographerResult?.photographer || null;
        if (!profileResult) {
          throw new Error("Photographer profile is unavailable.");
        }

        const nextServices = (servicesResult?.services || []) as PublicService[];
        const nextServicePreviewImages = (servicesResult?.portfolioImages || []) as ServicePreviewImage[];

        setResolvedUsername(username);
        setProfile(profileResult as PublicProfile);
        setServices(nextServices);
        setServicePreviewImages(nextServicePreviewImages);
        setPortfolioItems((portfolioResult?.items || []) as PublicPortfolioItem[]);
        setPackages((packagesResult?.items || []) as PublicPackage[]);
        setAvailability((availabilityResult?.days || []) as PublicAvailability[]);
        setAvailabilityMonth(availabilityResult?.month || monthKey);

        setSelectedService((current) => {
          if (current && nextServices.some((item) => item.id === current)) {
            return current;
          }
          return nextServices[0]?.id || "";
        });
        setSelectedPackageId(null);
        setSelectedDate(null);
        setBookingInquiryFeedback(null);
        setCurrentImageIndex(0);
        setErrorMessage(null);
      } catch (err) {
        if (!mounted) return;
        setErrorMessage(getApiErrorMessage(err, "Failed to load photographer pages"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadPublicProfile();

    return () => {
      mounted = false;
    };
  }, [
    publicSiteContext.hostCandidate,
    publicSiteContext.loading,
    publicSiteContext.photographer?.username,
    publicSiteContext.resolved,
    routeUsername,
  ]);

  const currentPortfolio = useMemo(() => {
    if (!selectedService) return portfolioItems;
    return portfolioItems.filter((item) => item.serviceId === selectedService);
  }, [portfolioItems, selectedService]);

  const moreFromServicePortfolio = useMemo(() => {
    const scopedItems = selectedService
      ? portfolioItems.filter((item) => item.serviceId === selectedService || item.featured)
      : portfolioItems;

    const seen = new Set<string>();
    return scopedItems.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [portfolioItems, selectedService]);

  const currentPackages = useMemo(() => {
    if (!selectedService) return packages;
    return packages.filter((pkg) => pkg.serviceId === selectedService);
  }, [packages, selectedService]);

  const selectedPackage = useMemo(
    () => currentPackages.find((pkg) => pkg.id === selectedPackageId) || null,
    [currentPackages, selectedPackageId]
  );

  useEffect(() => {
    if (!profile?.id) return;

    for (const pkg of currentPackages) {
      const key = `${profile.id}:${pkg.id}`;
      if (packageViewTrackedRef.current.has(key)) {
        continue;
      }
      packageViewTrackedRef.current.add(key);
      void trackAnalyticsEvent({
        eventType: "PACKAGE_VIEW",
        serviceId: pkg.serviceId || selectedService || undefined,
        packageId: pkg.id,
        metadata: {
          origin: "package_list_render",
        },
      });
    }
  }, [currentPackages, profile?.id, selectedService, trackAnalyticsEvent]);

  useEffect(() => {
    setSelectedPackageId((current) => {
      if (!current) return current;
      return currentPackages.some((pkg) => pkg.id === current) ? current : null;
    });
  }, [currentPackages]);

  useEffect(() => {
    if (!profile?.id || !resolvedUsername) {
      return;
    }

    const key = `${profile.id}:${resolvedUsername}`;
    if (pageViewTrackedRef.current === key) {
      return;
    }
    pageViewTrackedRef.current = key;

    void trackAnalyticsEvent({
      eventType: "PAGE_VIEW",
      metadata: {
        username: resolvedUsername,
        page: "public_portfolio",
      },
    });
  }, [profile?.id, resolvedUsername, trackAnalyticsEvent]);

  const { monthLabel, yearLabel, daysInMonth, firstDay } = useMemo(() => {
    const [year, month] = availabilityMonth.split("-").map(Number);
    const date = Number.isFinite(year) && Number.isFinite(month) ? new Date(year, month - 1, 1) : new Date();
    const monthIndex = date.getMonth();
    const yearValue = date.getFullYear();
    return {
      monthLabel: monthNames[monthIndex],
      yearLabel: yearValue,
      daysInMonth: new Date(yearValue, monthIndex + 1, 0).getDate(),
      firstDay: new Date(yearValue, monthIndex, 1).getDay(),
    };
  }, [availabilityMonth]);

  const availabilityStatusByDate = useMemo(() => {
    const map = new Map<string, AvailabilityDayStatus>();
    availability.forEach((item) => {
      map.set(toDateKey(item.date), normalizeAvailabilityStatus(item.status));
    });
    return map;
  }, [availability]);
  const nonBookableDates = useMemo(() => {
    const set = new Set<string>();
    availabilityStatusByDate.forEach((status, dateKey) => {
      if (isBookedAvailabilityStatus(status)) {
        set.add(dateKey);
      }
    });
    return set;
  }, [availabilityStatusByDate]);

  const selectedServiceInfo = services.find((service) => service.id === selectedService) || null;
  const servicePreviewById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of servicePreviewImages) {
      if (!item.serviceId || !item.imageUrl || map.has(item.serviceId)) {
        continue;
      }
      map.set(item.serviceId, item.imageUrl);
    }
    return map;
  }, [servicePreviewImages]);
  const heroImage = profile?.heroImageUrl || currentPortfolio[0]?.imageUrl || profile?.avatarUrl || "";
  const heroBackgroundImageUrl = heroImage ? heroImage.replace(/"/g, '\\"') : "";
  // Keep avatar independent from cover image; fall back to Avatar component placeholder.
  const avatarImage = profile?.avatarUrl || "";
  const showHeroSection = profile?.showHero !== false;
  const coverTitle = profile?.studioName?.trim() || profile?.name || "Photographer Pages";
  const heroSubtitle = profile?.heroSubtitle?.trim() || "";
  const todayKey = todayLocalDateKey();
  const showSiteUnavailable = !routeUsername && publicSiteContext.hostCandidate && !publicSiteContext.loading && !publicSiteContext.resolved;
  const galleryUsername =
    profile?.username ||
    resolvedUsername ||
    publicSiteContext.photographer?.username ||
    String(routeUsername || "").trim();
  const portfolioUrl =
    publicSiteContext.siteUrl ||
    (galleryUsername ? buildPublicStudioUrl(galleryUsername) : publicSiteContext.fallbackUrl || "");
  const galleryUrl =
    publicSiteContext.galleryUrl ||
    (galleryUsername ? buildPublicStudioUrl(galleryUsername, "/gallery") : publicSiteContext.fallbackGalleryUrl || "");
  const themeColor = normalizeThemeColor(profile?.themeColor);
  const themeColorSoft = hexToRgba(themeColor, 0.12);
  const themeColorBorder = hexToRgba(themeColor, 0.35);
  const showLensayaBranding = profile?.showLensayaBranding !== false;
  const portfolioMetaDescription = showSiteUnavailable
    ? publicSiteContext.message || "This public site is not currently available."
    : profile?.bio?.trim()
      ? profile.bio.trim().slice(0, 160)
      : `View ${profile?.studioName || "photographer"}'s portfolio, packages, and availability on Lensaya.`;
  const portfolioMetaTitle = showSiteUnavailable
    ? publicSiteContext.photographer?.studioName
      ? `${publicSiteContext.photographer.studioName} | Lensaya`
      : "Portfolio unavailable | Lensaya"
    : profile?.studioName
      ? `${profile.studioName} | Lensaya`
      : "Lensaya Photographer Portfolio";
  const themeVariables: CSSProperties = {
    "--theme-color": themeColor,
    "--theme-color-soft": themeColorSoft,
    "--theme-color-border": themeColorBorder,
  } as CSSProperties;

  useSeoMeta({
    title: portfolioMetaTitle,
    description: portfolioMetaDescription,
    image: heroImage || null,
    canonicalUrl: portfolioUrl || publicSiteContext.fallbackUrl || null,
    type: "profile",
  });

  useEffect(() => {
    if (!selectedDate) return;
    if (selectedDate < todayKey || nonBookableDates.has(selectedDate)) {
      setSelectedDate(null);
    }
  }, [nonBookableDates, selectedDate, todayKey]);

  useEffect(() => {
    const currentItem = currentPortfolio[currentImageIndex];
    if (!profile?.id || !currentItem?.id) {
      return;
    }

    const key = `${profile.id}:${currentItem.id}:${currentImageIndex}`;
    if (portfolioViewTrackedRef.current === key) {
      return;
    }
    portfolioViewTrackedRef.current = key;

    void trackAnalyticsEvent({
      eventType: "PORTFOLIO_VIEW",
      serviceId: currentItem.serviceId || selectedService || undefined,
      portfolioItemId: currentItem.id,
      metadata: {
        imageIndex: currentImageIndex + 1,
      },
    });
  }, [profile?.id, currentImageIndex, currentPortfolio, selectedService, trackAnalyticsEvent]);

  const handlePrevImage = () => {
    if (currentPortfolio.length === 0) return;
    setCurrentImageIndex((prev) => (prev === 0 ? currentPortfolio.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    if (currentPortfolio.length === 0) return;
    setCurrentImageIndex((prev) => (prev === currentPortfolio.length - 1 ? 0 : prev + 1));
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId);
    setSelectedPackageId(null);
    setBookingInquiryFeedback(null);
    setCurrentImageIndex(0);

    void trackAnalyticsEvent({
      eventType: "SERVICE_SELECT",
      serviceId,
    });
  };

  const handlePackageSelect = (pkg: PublicPackage) => {
    setSelectedPackageId(pkg.id);
    setBookingInquiryFeedback(null);
    void trackAnalyticsEvent({
      eventType: "PACKAGE_VIEW",
      serviceId: pkg.serviceId || selectedService || undefined,
      packageId: pkg.id,
      metadata: {
        origin: "package_card_select",
      },
    });
    void trackAnalyticsEvent({
      eventType: "PACKAGE_SELECT",
      serviceId: pkg.serviceId || selectedService || undefined,
      packageId: pkg.id,
    });
  };

  const handleMoreThumbnailSelect = (item: PublicPortfolioItem) => {
    const indexInCurrent = currentPortfolio.findIndex((entry) => entry.id === item.id);
    if (indexInCurrent >= 0) {
      setCurrentImageIndex(indexInCurrent);
      return;
    }

    if (item.serviceId) {
      const targetPortfolio = portfolioItems.filter((entry) => entry.serviceId === item.serviceId);
      if (targetPortfolio.length > 0) {
        const targetIndex = targetPortfolio.findIndex((entry) => entry.id === item.id);
        handleServiceSelect(item.serviceId);
        setCurrentImageIndex(targetIndex >= 0 ? targetIndex : 0);
        return;
      }
    }

    const indexInAll = portfolioItems.findIndex((entry) => entry.id === item.id);
    if (indexInAll >= 0) {
      setSelectedService("");
      setSelectedPackageId(null);
      setCurrentImageIndex(indexInAll);
    }
  };

  const handleSubmitBookingInquiry = async () => {
    const trimmedName = bookingInquiryForm.name.trim();
    const trimmedEmail = bookingInquiryForm.email.trim();
    const trimmedPhone = bookingInquiryForm.phone.trim();
    const trimmedMessage = bookingInquiryForm.message.trim();

    if (!resolvedUsername) {
      setBookingInquiryFeedback({ type: "error", message: "Photographer profile is unavailable." });
      return;
    }
    if (!selectedPackage) {
      setBookingInquiryFeedback({ type: "error", message: "Please select a package before submitting inquiry." });
      return;
    }
    if (!selectedDate) {
      setBookingInquiryFeedback({ type: "error", message: "Please select a preferred date before submitting inquiry." });
      return;
    }
    if (selectedDate < todayKey) {
      setBookingInquiryFeedback({ type: "error", message: "Past dates cannot be selected for booking." });
      return;
    }
    const selectedDateStatus = availabilityStatusByDate.get(selectedDate) || "available";
    if (isBookedAvailabilityStatus(selectedDateStatus)) {
      setBookingInquiryFeedback({
        type: "error",
        message: `Selected date is ${toAvailabilityStatusLabel(selectedDateStatus).toLowerCase()}. Please choose another date.`,
      });
      return;
    }
    if (trimmedName.length < 2) {
      setBookingInquiryFeedback({ type: "error", message: "Please enter your name." });
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setBookingInquiryFeedback({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    const preferredDate = new Date(`${selectedDate}T00:00:00.000Z`);
    if (Number.isNaN(preferredDate.getTime())) {
      setBookingInquiryFeedback({ type: "error", message: "Selected date is invalid." });
      return;
    }

    setBookingInquirySubmitting(true);
    setBookingInquiryFeedback(null);

    void trackAnalyticsEvent({
      eventType: "BOOKING_INTENT",
      serviceId: selectedService || selectedPackage.serviceId || undefined,
      packageId: selectedPackage.id,
      metadata: {
        stage: "form_submit_clicked",
        preferredDate: selectedDate,
      },
    });

    try {
      const response = await publicApi.createBooking({
        photographerUsername: resolvedUsername,
        serviceId: selectedService || selectedPackage.serviceId || undefined,
        packageId: selectedPackage.id,
        preferredDate: preferredDate.toISOString(),
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone || undefined,
        message: trimmedMessage || undefined,
        source: toBookingSource(sourceRef.current || "website"),
      });

      setBookingInquiryFeedback({
        type: "success",
        message: "Inquiry submitted. We have sent your details to the photographer.",
      });

      void trackAnalyticsEvent({
        eventType: "BOOKING_INTENT",
        serviceId: selectedService || selectedPackage.serviceId || undefined,
        packageId: selectedPackage.id,
        metadata: {
          stage: "submitted",
          bookingId: response.bookingId,
        },
      });

      if (response.whatsappUrl) {
        void trackAnalyticsEvent({
          eventType: "WHATSAPP_CLICK",
          serviceId: selectedService || selectedPackage.serviceId || undefined,
          packageId: selectedPackage.id,
          metadata: {
            origin: "booking_inquiry_submit",
            bookingId: response.bookingId,
          },
        });
        window.open(response.whatsappUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setBookingInquiryFeedback({
        type: "error",
        message: getApiErrorMessage(err, "Unable to submit booking inquiry"),
      });
    } finally {
      setBookingInquirySubmitting(false);
    }
  };

  const handleSharePortfolio = async () => {
    if (typeof window === "undefined") return;

    const shareUrl = portfolioUrl || appHomeUrl;
    const shareTitle = profile?.studioName || "Photographer Portfolio";
    const shareMessage = buildPortfolioShareMessage(shareUrl);
    let method = "copy_message";

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareMessage,
        });
        method = "native_share";
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareMessage);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareMessage);
      }
    }

    void trackAnalyticsEvent({
      eventType: "PORTFOLIO_SHARE",
      serviceId: selectedService || undefined,
      packageId: selectedPackage?.id || undefined,
      metadata: {
        method,
      },
    });
  };

  const isPageLoading = loading || (!routeUsername && publicSiteContext.hostCandidate && publicSiteContext.loading);

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-600">Loading pages...</p>
      </div>
    );
  }

  if (showSiteUnavailable) {
    return (
      <PublicSiteUnavailable
        resolutionStatus={publicSiteContext.resolutionStatus}
        studioName={publicSiteContext.photographer?.studioName || null}
        message={publicSiteContext.message}
        failureReason={publicSiteContext.failureReason}
        fallbackUrl={publicSiteContext.fallbackUrl}
      />
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="w-full max-w-xl bg-white border border-red-200 rounded-xl p-6 text-red-700">{errorMessage}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={themeVariables}>
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <a href={portfolioUrl || appHomeUrl} className="flex items-center gap-2">
              <Camera className="w-6 h-6 text-[var(--theme-color)]" />
              <span className="text-xl font-semibold text-slate-900">{profile?.studioName || "Lensaya Pages"}</span>
            </a>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#services" className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
                Services
              </a>
              <a href={galleryUrl || appHomeUrl} className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
                Pages
              </a>
              <a href="#packages" className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
                Packages
              </a>
              <a href="#availability" className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
                Calendar
              </a>
              <a href="#contact" className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
                Contact
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleSharePortfolio();
                }}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
              <a
                href="#booking-inquiry"
                className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-color)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Start Inquiry</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {showHeroSection ? (
        <section
          className="relative h-[60vh] sm:h-[70vh] mt-16 overflow-hidden bg-cover bg-center bg-gradient-to-br from-slate-900 to-slate-700"
          style={heroBackgroundImageUrl ? { backgroundImage: `url("${heroBackgroundImageUrl}")` } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/30 z-10" />
          <div className="relative z-20 h-full flex items-center justify-center text-center px-4">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">{coverTitle}</h1>
              {heroSubtitle ? (
                <p className="mt-4 text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto">{heroSubtitle}</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section id="services" className={`py-12 sm:py-16 bg-gray-50 ${showHeroSection ? "" : "mt-16"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8 text-center">Choose Your Service</h2>
          {services.length === 0 ? (
            <p className="text-center text-slate-600">No services published yet.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    handleServiceSelect(service.id);
                  }}
                  className={`flex-shrink-0 w-40 sm:w-48 rounded-xl overflow-hidden border-2 transition-all ${
                    selectedService === service.id
                      ? "border-[var(--theme-color)] shadow-lg scale-105"
                      : "border-gray-200 hover:border-[var(--theme-color-border)]"
                  }`}
                >
                  <div className="relative h-32 sm:h-40">
                    <ImageWithFallback
                      src={servicePreviewById.get(service.id) || SERVICE_PLACEHOLDER_IMAGE}
                      alt={service.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <div className="text-2xl mb-1">{service.emoji || "*"}</div>
                      <div className="font-semibold">{service.name}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="portfolio" className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {selectedServiceInfo?.name ? `${selectedServiceInfo.name} Pages` : "Pages"}
            </h2>
          </div>

          {currentPortfolio.length > 0 ? (
            <div className="relative">
              <div className="relative aspect-[16/10] sm:aspect-[21/9] rounded-2xl overflow-hidden">
                <ImageWithFallback
                  src={currentPortfolio[currentImageIndex]?.imageUrl || ""}
                  alt={`Portfolio ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {currentPortfolio.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                  >
                    <ChevronLeft className="w-6 h-6 text-slate-900" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                  >
                    <ChevronRight className="w-6 h-6 text-slate-900" />
                  </button>

                  <div className="flex justify-center gap-2 mt-4">
                    {currentPortfolio.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`h-2 rounded-full transition-all ${
                          idx === currentImageIndex ? "w-8 bg-[var(--theme-color)]" : "w-2 bg-gray-300 hover:bg-gray-400"
                        }`}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-600">No portfolio images available for this service.</div>
          )}

          {moreFromServicePortfolio.length > 0 ? (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">More from this service</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {moreFromServicePortfolio.map((item, idx) => {
                  const isActive = currentPortfolio[currentImageIndex]?.id === item.id;

                  return (
                  <button
                    key={`${item.id}-thumb`}
                    type="button"
                    onClick={() => handleMoreThumbnailSelect(item)}
                    className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                      isActive
                        ? "border-[var(--theme-color)] shadow"
                        : item.featured
                          ? "border-[var(--theme-color-border)] hover:border-[var(--theme-color)]"
                          : "border-gray-200 hover:border-[var(--theme-color-border)]"
                    }`}
                  >
                    {item.featured ? (
                      <span className="absolute top-1.5 left-1.5 z-10 rounded bg-[var(--theme-color)] px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Featured
                      </span>
                    ) : null}
                    <ImageWithFallback
                      src={item.imageUrl || ""}
                      alt={`Gallery photo ${idx + 1}`}
                      className="w-full aspect-[4/3] object-cover transition-transform hover:scale-105"
                    />
                  </button>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-center">
                <a
                  href={galleryUrl || appHomeUrl}
                  className="inline-flex items-center px-6 py-3 bg-[var(--theme-color)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm"
                >
                  View all photos by me
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section id="packages" className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8 text-center">Choose Your Package</h2>
          {currentPackages.length === 0 ? (
            <p className="text-center text-slate-600">No packages published for this service.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {currentPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => handlePackageSelect(pkg)}
                  className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${
                    selectedPackageId === pkg.id
                      ? "border-[var(--theme-color)] shadow-lg scale-105"
                      : "border-gray-200 hover:border-[var(--theme-color-border)] hover:shadow-md"
                  }`}
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{pkg.name}</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold text-[var(--theme-color)]">{formatPackagePrice(pkg)}</span>
                    </div>
                    <p className="text-sm text-slate-600">{pkg.duration}</p>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {(pkg.features || []).map((feature) => (
                      <li key={`${pkg.id}-${feature}`} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-[var(--theme-color)] flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className={`px-4 py-2 rounded-lg text-center font-medium transition-colors ${
                      selectedPackageId === pkg.id ? "bg-[var(--theme-color)] text-white" : "bg-gray-100 text-slate-600"
                    }`}
                  >
                    {selectedPackageId === pkg.id ? "Selected" : "Select Package"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="availability" className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8 text-center">Check Availability</h2>
          <p className="text-center text-sm text-slate-600 mb-6">
            Select your preferred date and package, then submit an inquiry form. We will create a lead and open WhatsApp for fast follow-up.
          </p>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-900">
                {monthLabel} {yearLabel}
              </h3>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
                <div key={`${day}-${idx + 1}`} className="text-center text-sm font-semibold text-slate-600 py-2">
                  {day}
                </div>
              ))}

              {Array.from({ length: firstDay }, (_, idx) => (
                <div key={`empty-${idx + 1}`} />
              ))}

              {Array.from({ length: daysInMonth }, (_, idx) => {
                const day = idx + 1;
                const dayKey = `${availabilityMonth}-${String(day).padStart(2, "0")}`;
                const status = availabilityStatusByDate.get(dayKey) || "available";
                const isBooked = status === "booked";
                const isPast = dayKey < todayKey;
                const isDisabled = isPast || isBookedAvailabilityStatus(status);
                const isSelected = selectedDate === dayKey;

                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => {
                      if (isDisabled) return;
                      setSelectedDate(dayKey);
                      setBookingInquiryFeedback(null);
                    }}
                    disabled={isDisabled}
                    title={`${formatDateLabel(dayKey)}: ${toAvailabilityStatusLabel(status)}${isPast ? " (Past date)" : ""}`}
                    className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all ${
                      isBooked
                        ? "bg-red-100 border-2 border-red-400 text-red-700 cursor-not-allowed"
                        : isPast
                          ? "bg-slate-100 border-2 border-slate-300 text-slate-500 cursor-not-allowed"
                          : isSelected
                            ? "bg-[var(--theme-color)] text-white scale-110 shadow-lg"
                            : "bg-green-100 border-2 border-green-400 text-green-700 hover:bg-green-200 hover:scale-105"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded" />
                <span className="text-slate-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border-2 border-red-500 rounded" />
                <span className="text-slate-600">Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-100 border-2 border-slate-300 rounded" />
                <span className="text-slate-600">Past date (not selectable)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="booking-inquiry" className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8 text-center">Booking Summary</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <span className="text-slate-600">Service:</span>
                  <span className="font-semibold text-slate-900">{selectedServiceInfo?.name || "Not selected"}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <span className="text-slate-600">Package:</span>
                  <span className="font-semibold text-slate-900">{selectedPackage?.name || "Not selected"}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <span className="text-slate-600">Date:</span>
                  <span className="font-semibold text-slate-900">{selectedDate ? formatDateLabel(selectedDate) : "Not selected"}</span>
                </div>
                {selectedPackage ? (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total:</span>
                    <span className="text-2xl font-bold text-[var(--theme-color)]">{formatPackagePrice(selectedPackage)}</span>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Submit Inquiry</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="inquiry-name" className="block text-sm font-medium text-slate-700 mb-1">
                      Your Name
                    </label>
                    <input
                      id="inquiry-name"
                      type="text"
                      value={bookingInquiryForm.name}
                      onChange={(event) =>
                        setBookingInquiryForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Lensaya"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="inquiry-email" className="block text-sm font-medium text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      id="inquiry-email"
                      type="email"
                      value={bookingInquiryForm.email}
                      onChange={(event) =>
                        setBookingInquiryForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      placeholder="lensaya@example.com"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)] outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="inquiry-phone" className="block text-sm font-medium text-slate-700 mb-1">
                    Phone / WhatsApp (optional)
                  </label>
                  <input
                    id="inquiry-phone"
                    type="text"
                    value={bookingInquiryForm.phone}
                    onChange={(event) =>
                      setBookingInquiryForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="+60123456789"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)] outline-none transition-all"
                  />
                </div>

                <div className="mb-5">
                  <label htmlFor="inquiry-message" className="block text-sm font-medium text-slate-700 mb-1">
                    Message (optional)
                  </label>
                  <textarea
                    id="inquiry-message"
                    rows={4}
                    value={bookingInquiryForm.message}
                    onChange={(event) =>
                      setBookingInquiryForm((current) => ({
                        ...current,
                        message: event.target.value,
                      }))
                    }
                    placeholder="Tell the photographer more about your event."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)] outline-none transition-all resize-none"
                  />
                </div>

                {bookingInquiryFeedback ? (
                  <div
                    className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                      bookingInquiryFeedback.type === "success"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {bookingInquiryFeedback.message}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    void handleSubmitBookingInquiry();
                  }}
                  disabled={bookingInquirySubmitting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-medium disabled:opacity-60"
                >
                  <MessageCircle className="w-5 h-5" />
                  {bookingInquirySubmitting ? "Submitting Inquiry..." : "Submit Inquiry"}
                </button>
                <p className="mt-3 text-sm text-slate-600 text-center">
                  After submitting, we will create a booking lead and open WhatsApp so you can continue with the photographer.
                </p>
              </div>
          </div>
        </div>
      </section>

      <section id="contact" className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <Avatar
                src={avatarImage || null}
                name={profile?.studioName || "Photographer"}
                size={128}
                className="flex-shrink-0"
                imageClassName="border-4 border-[var(--theme-color-soft)]"
              />

              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{profile?.studioName || "Photographer"}</h3>
                <p className="text-slate-600 mb-6">{profile?.bio || "Professional photographer profile on Lensaya."}</p>

                <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                  {toInstagramUrl(profile?.socialLinks.instagram) ? (
                    <a
                      href={toInstagramUrl(profile?.socialLinks.instagram) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        void trackAnalyticsEvent({
                          eventType: "PROFILE_CLICK",
                          serviceId: selectedService || undefined,
                          metadata: { origin: "contact_instagram" },
                        });
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100 transition-colors"
                    >
                      <Instagram className="w-5 h-5" />
                      <span>Instagram</span>
                    </a>
                  ) : null}
                  {toFacebookUrl(profile?.socialLinks.facebook) ? (
                    <a
                      href={toFacebookUrl(profile?.socialLinks.facebook) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        void trackAnalyticsEvent({
                          eventType: "PROFILE_CLICK",
                          serviceId: selectedService || undefined,
                          metadata: { origin: "contact_facebook" },
                        });
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Facebook className="w-5 h-5" />
                      <span>Facebook</span>
                    </a>
                  ) : null}
                  {toTiktokUrl(profile?.socialLinks.tiktok) ? (
                    <a
                      href={toTiktokUrl(profile?.socialLinks.tiktok) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        void trackAnalyticsEvent({
                          eventType: "PROFILE_CLICK",
                          serviceId: selectedService || undefined,
                          metadata: { origin: "contact_tiktok" },
                        });
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <Music2 className="w-5 h-5" />
                      <span>TikTok</span>
                    </a>
                  ) : null}
                  <a
                    href={toWhatsAppUrl(profile?.whatsappNumber, "Hi, I would like to enquire about your photography services.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      void trackAnalyticsEvent({
                        eventType: "WHATSAPP_CLICK",
                        serviceId: selectedService || undefined,
                        packageId: selectedPackage?.id,
                        metadata: { origin: "contact_whatsapp" },
                      });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>WhatsApp</span>
                  </a>
                  {profile?.phone ? (
                    <a
                      href={`tel:${profile.phone}`}
                      onClick={() => {
                        void trackAnalyticsEvent({
                          eventType: "PROFILE_CLICK",
                          serviceId: selectedService || undefined,
                          metadata: { origin: "contact_phone" },
                        });
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                      style={{ backgroundColor: themeColorSoft, color: themeColor }}
                    >
                      <Phone className="w-5 h-5" />
                      <span>Call</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showLensayaBranding ? (
        <section className="py-12 sm:py-16 bg-slate-50 border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Want a portfolio like this?</h2>
            <p className="text-slate-600 mb-6">Create yours in minutes with Lensaya.</p>
            <a
              href={appHomeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-white font-medium transition-colors"
              style={{ backgroundColor: themeColor }}
            >
              Create your own portfolio
            </a>
          </div>
        </section>
      ) : null}

      <footer className="bg-slate-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          {showLensayaBranding ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Camera className="w-5 h-5 text-[var(--theme-color)]" />
                <span className="font-semibold">Powered by Lensaya</span>
              </div>
              <a
                href={appHomeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-cyan-300 hover:text-cyan-200 transition-colors mb-4"
              >
                Create your own portfolio -&gt;
              </a>
            </>
          ) : null}
          <p className="text-slate-400 text-sm">
            Copyright 2026 {profile?.studioName || resolvedUsername || "Photographer"}. All rights reserved.
          </p>
        </div>
      </footer>

      {showLensayaBranding ? (
        <a
          href={appHomeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 z-30 rounded-full border border-slate-200 bg-white/95 backdrop-blur px-4 py-2 text-sm font-medium text-slate-700 shadow-lg hover:text-slate-900 hover:border-slate-300 transition-colors"
        >
          {"\u{1F4F7} Made with Lensaya"}
        </a>
      ) : null}
    </div>
  );
}








