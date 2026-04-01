import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Instagram, Facebook, MessageCircle, Music2 } from "lucide-react";
import { PublicSiteUnavailable } from "../../components/public/PublicSiteUnavailable";
import { TeamSection } from "../../components/TeamSection";
import { useParams } from "react-router-dom";
import { analyticsApi, publicApi, getApiErrorMessage } from "../../lib/api";
import { buildAppUrl, buildPublicStudioUrl } from "../../lib/platform";
import { useSeoMeta } from "../../lib/seo";
import { usePublicSiteContext } from "../../hooks/usePublicSiteContext";
import { buildPortfolioShareMessage } from "../../lib/share";
import {
  monthNames,
  SERVICE_PLACEHOLDER_IMAGE,
  EMAIL_PATTERN,
  TIME_24H_PATTERN,
  VISITOR_ID_STORAGE_KEY,
  SESSION_ID_STORAGE_KEY,
  SESSION_SOURCE_STORAGE_KEY,
} from "./constants";
import {
  normalizeThemeColor,
  hexToRgba,
  mixHexColors,
  toDateKey,
  normalizeAvailabilityStatus,
  isBookedAvailabilityStatus,
  toAvailabilityStatusLabel,
  todayLocalDateKey,
  toInstagramUrl,
  toFacebookUrl,
  toTiktokUrl,
  toWhatsAppUrl,
  getOrCreateStorageValue,
  classifySource,
  resolveInitialSource,
} from "./utils";
import type {
  AvailabilityDayStatus,
  BookingInquiryForm,
  HeroSocialLink,
  PublicAvailability,
  PublicPackage,
  PublicPortfolioItem,
  PublicProfile,
  PublicService,
  ServicePreviewImage,
} from "./types";
import { BookingInquirySection } from "./components/BookingInquirySection";
import { ContactSection } from "./components/ContactSection";
import { PortfolioFooter } from "./components/PortfolioFooter";
import { AvailabilitySection, HeroSection, PackagesSection, PortfolioHeader, PortfolioSection, ServicesSection } from "./components/PortfolioSections";

const hasUsableImageUrl = (value: string | null | undefined) =>
  Boolean(value && /^https?:\/\//i.test(String(value).trim()));


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
    source: "",
    preferredTime: "",
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
  const headerRef = useRef<HTMLElement | null>(null);
  const availabilitySectionRef = useRef<HTMLElement | null>(null);
  const bookingInquirySectionRef = useRef<HTMLElement | null>(null);

  const scrollToSection = useCallback((target: HTMLElement | null) => {
    if (!target) return;
    requestAnimationFrame(() => {
      const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 64;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    });
  }, []);

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
        const eventPath = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : undefined;
        const pageUrl = typeof window !== "undefined" ? window.location.href : undefined;
        const referrer = typeof document !== "undefined" ? document.referrer || undefined : undefined;

        await analyticsApi.track({
          eventType: payload.eventType,
          photographerId,
          serviceId: payload.serviceId,
          packageId: payload.packageId,
          portfolioItemId: payload.portfolioItemId,
          sessionId: visitorContext.sessionId,
          visitorId: visitorContext.visitorId,
          source: visitorContext.source,
          path: eventPath,
          pageUrl,
          referrer,
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
        const fetchedServicePreviewImages = (servicesResult?.portfolioImages || []) as ServicePreviewImage[];
        const fetchedPortfolioItems = (portfolioResult?.items || []) as PublicPortfolioItem[];
        const nextPortfolioItems = fetchedPortfolioItems;
        const nextServicePreviewImages = fetchedServicePreviewImages;

        setResolvedUsername(username);
        setProfile(profileResult as PublicProfile);
        setServices(nextServices);
        setServicePreviewImages(nextServicePreviewImages);
        setPortfolioItems(nextPortfolioItems);
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
      ? portfolioItems.filter((item) => item.serviceId === selectedService)
      : portfolioItems;

    const featured = scopedItems.filter((item) => item.featured);
    const nonFeatured = scopedItems.filter((item) => !item.featured);
    return [...featured, ...nonFeatured].slice(0, 6);
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
    for (const service of services) {
      if (!service.id || !hasUsableImageUrl(service.thumbnailUrl) || map.has(service.id)) {
        continue;
      }
      map.set(service.id, String(service.thumbnailUrl));
    }
    for (const item of servicePreviewImages) {
      if (!item.serviceId || !hasUsableImageUrl(item.imageUrl) || map.has(item.serviceId)) {
        continue;
      }
      map.set(item.serviceId, String(item.imageUrl));
    }
    return map;
  }, [servicePreviewImages, services]);
  const heroImage = profile?.heroImageUrl || currentPortfolio[0]?.imageUrl || profile?.avatarUrl || "";
  const heroBackgroundImageUrl = heroImage ? heroImage.replace(/"/g, '\\"') : "";
  // Keep avatar independent from cover image.
  const avatarImage = profile?.avatarUrl || "";
  const showHeroSection = profile?.showHero !== false;
  const coverTitle = profile?.studioName?.trim() || profile?.name || "Photographer Pages";
  const heroSubtitle = profile?.heroSubtitle?.trim() || "";
  const heroSocialLinks: HeroSocialLink[] = [
    {
      key: "instagram",
      label: "Instagram",
      href: toInstagramUrl(profile?.socialLinks.instagram) || "",
      icon: Instagram,
      bgClass: "bg-pink-500/95",
      eventType: "PROFILE_CLICK" as const,
      origin: "hero_instagram",
    },
    {
      key: "facebook",
      label: "Facebook",
      href: toFacebookUrl(profile?.socialLinks.facebook) || "",
      icon: Facebook,
      bgClass: "bg-blue-600/95",
      eventType: "PROFILE_CLICK" as const,
      origin: "hero_facebook",
    },
    {
      key: "tiktok",
      label: "TikTok",
      href: toTiktokUrl(profile?.socialLinks.tiktok) || "",
      icon: Music2,
      bgClass: "bg-slate-900/95",
      eventType: "PROFILE_CLICK" as const,
      origin: "hero_tiktok",
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: toWhatsAppUrl(profile?.whatsappNumber, "Hi, I would like to enquire about your photography services."),
      icon: MessageCircle,
      bgClass: "bg-emerald-500/95",
      eventType: "WHATSAPP_CLICK" as const,
      origin: "hero_whatsapp",
    },
  ].filter((link) => Boolean(link.href));
  const todayKey = todayLocalDateKey();
  const showSiteUnavailable = !routeUsername && publicSiteContext.hostCandidate && !publicSiteContext.loading && !publicSiteContext.resolved;
  const galleryUsername =
    profile?.username ||
    resolvedUsername ||
    publicSiteContext.photographer?.username ||
    String(routeUsername || "").trim();
  const routePortfolioUrl = galleryUsername ? buildAppUrl(`/p/${encodeURIComponent(galleryUsername)}`) : "";
  const routeGalleryUrl = galleryUsername ? buildAppUrl(`/p/${encodeURIComponent(galleryUsername)}/gallery`) : "";
  const portfolioUrl = routeUsername
    ? routePortfolioUrl
    : publicSiteContext.siteUrl ||
      (galleryUsername ? buildPublicStudioUrl(galleryUsername) : publicSiteContext.fallbackUrl || "");
  const galleryUrl = routeUsername
    ? routeGalleryUrl
    : publicSiteContext.galleryUrl ||
      (galleryUsername ? buildPublicStudioUrl(galleryUsername, "/gallery") : publicSiteContext.fallbackGalleryUrl || "");
  const themeColor = normalizeThemeColor(profile?.themeColor);
  const themeColorSoft = hexToRgba(themeColor, 0.12);
  const themeColorBorder = hexToRgba(themeColor, 0.35);
  const themePageBg = mixHexColors(themeColor, "#ffffff", 0.82);
  const themeSectionBg = mixHexColors(themeColor, "#ffffff", 0.72);
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
    "--theme-page-bg": themePageBg,
    "--theme-section-bg": themeSectionBg,
    "--theme-page-highlight": hexToRgba(themeColor, 0.2),
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
    scrollToSection(availabilitySectionRef.current);
  };

  const handleDateSelect = (dayKey: string) => {
    setSelectedDate(dayKey);
    setBookingInquiryFeedback(null);
    scrollToSection(bookingInquirySectionRef.current);
  };

  const handleMoreThumbnailSelect = (item: PublicPortfolioItem) => {
    const indexInCurrent = currentPortfolio.findIndex((entry) => entry.id === item.id);
    if (indexInCurrent >= 0) {
      setCurrentImageIndex(indexInCurrent);
    }
  };

  const handleSubmitBookingInquiry = async () => {
    const trimmedName = bookingInquiryForm.name.trim();
    const trimmedEmail = bookingInquiryForm.email.trim();
    const trimmedPhone = bookingInquiryForm.phone.trim();
    const trimmedSource = String(bookingInquiryForm.source || "").trim().toUpperCase();
    const trimmedPreferredTime = bookingInquiryForm.preferredTime.trim();
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
    if (!trimmedSource) {
      setBookingInquiryFeedback({ type: "error", message: "Please tell us where you heard about us." });
      return;
    }
    if (!TIME_24H_PATTERN.test(trimmedPreferredTime)) {
      setBookingInquiryFeedback({ type: "error", message: "Please select a preferred time before submitting inquiry." });
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

    setBookingInquirySubmitting(true);
    setBookingInquiryFeedback(null);

    void trackAnalyticsEvent({
      eventType: "BOOKING_INTENT",
      serviceId: selectedService || selectedPackage.serviceId || undefined,
      packageId: selectedPackage.id,
      metadata: {
        stage: "form_submit_clicked",
        preferredDate: selectedDate,
        preferredTime: trimmedPreferredTime,
      },
    });

    try {
      const response = await publicApi.createBooking({
        photographerUsername: resolvedUsername,
        serviceId: selectedService || selectedPackage.serviceId || undefined,
        packageId: selectedPackage.id,
        preferredDate: selectedDate,
        preferredTime: trimmedPreferredTime,
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone || undefined,
        message: trimmedMessage || undefined,
        source: trimmedSource as "WEBSITE" | "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "DIRECT" | "OTHER",
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
          eventType: "WHATSAPP_CLICK" as const,
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

  const handleBookingInquiryFieldChange = <K extends keyof BookingInquiryForm>(field: K, value: BookingInquiryForm[K]) => {
    setBookingInquiryForm((current) => ({
      ...current,
      [field]: value,
    }));
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
    <div
      className="min-h-screen"
      style={{
        ...themeVariables,
        backgroundColor: "var(--theme-page-bg)",
        backgroundImage:
          "radial-gradient(circle at 15% -10%, var(--theme-page-highlight) 0%, transparent 58%), radial-gradient(circle at 100% 0%, var(--theme-page-highlight) 0%, transparent 48%), radial-gradient(circle at 50% 110%, var(--theme-page-highlight) 0%, transparent 52%)",
      }}
    >
      <PortfolioHeader
        headerRef={headerRef}
        portfolioUrl={portfolioUrl || appHomeUrl}
        appHomeUrl={appHomeUrl}
        studioName={profile?.studioName || "Lensaya Pages"}
        galleryUrl={galleryUrl || appHomeUrl}
        onShare={() => {
          void handleSharePortfolio();
        }}
      />

      <HeroSection
        showHeroSection={showHeroSection}
        heroBackgroundImageUrl={heroBackgroundImageUrl}
        coverTitle={coverTitle}
        heroSubtitle={heroSubtitle}
        heroSocialLinks={heroSocialLinks}
        onSocialClick={(social) => {
          void trackAnalyticsEvent({
            eventType: social.eventType,
            serviceId: selectedService || undefined,
            metadata: { origin: social.origin },
          });
        }}
      />

      <ServicesSection
        showHeroSection={showHeroSection}
        services={services}
        selectedService={selectedService}
        servicePreviewById={servicePreviewById}
        servicePlaceholderImage={SERVICE_PLACEHOLDER_IMAGE}
        onServiceSelect={handleServiceSelect}
      />

      <PortfolioSection
        selectedServiceInfoName={selectedServiceInfo?.name}
        currentPortfolio={currentPortfolio}
        currentImageIndex={currentImageIndex}
        moreFromServicePortfolio={moreFromServicePortfolio}
        galleryUrl={galleryUrl || appHomeUrl}
        appHomeUrl={appHomeUrl}
        onPrevImage={handlePrevImage}
        onNextImage={handleNextImage}
        onImageSelect={setCurrentImageIndex}
        onMoreThumbnailSelect={handleMoreThumbnailSelect}
      />

      <PackagesSection
        currentPackages={currentPackages}
        selectedPackageId={selectedPackageId}
        onPackageSelect={handlePackageSelect}
      />

      <AvailabilitySection
        availabilitySectionRef={availabilitySectionRef}
        monthLabel={monthLabel}
        yearLabel={yearLabel}
        firstDay={firstDay}
        daysInMonth={daysInMonth}
        availabilityMonth={availabilityMonth}
        availabilityStatusByDate={availabilityStatusByDate}
        todayKey={todayKey}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />

      <BookingInquirySection
        bookingInquirySectionRef={bookingInquirySectionRef}
        selectedServiceName={selectedServiceInfo?.name || ""}
        selectedPackage={selectedPackage}
        selectedDate={selectedDate}
        bookingInquiryForm={bookingInquiryForm}
        bookingInquiryFeedback={bookingInquiryFeedback}
        bookingInquirySubmitting={bookingInquirySubmitting}
        onFieldChange={handleBookingInquiryFieldChange}
        onSubmit={() => {
          void handleSubmitBookingInquiry();
        }}
      />

      <ContactSection
        profile={profile}
        avatarImage={avatarImage}
        selectedService={selectedService}
        selectedPackageId={selectedPackage?.id}
        themeColor={themeColor}
        themeColorSoft={themeColorSoft}
        onTrackEvent={(payload) => {
          void trackAnalyticsEvent(payload);
        }}
      />

      {profile?.teamSection?.enabled ? <TeamSection members={profile.teamSection.members} /> : null}

      <PortfolioFooter
        showLensayaBranding={showLensayaBranding}
        appHomeUrl={appHomeUrl}
        themeColor={themeColor}
        studioName={profile?.studioName || resolvedUsername || "Photographer"}
      />
    </div>
  );
}