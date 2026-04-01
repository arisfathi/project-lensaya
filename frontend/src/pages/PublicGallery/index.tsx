import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Camera, ChevronLeft, ChevronRight, MessageCircle, X } from "lucide-react";
import { useParams } from "react-router-dom";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { PublicSiteUnavailable } from "../../components/public/PublicSiteUnavailable";
import { getApiErrorMessage, publicApi } from "../../lib/api";
import { buildAppUrl, buildPublicStudioUrl } from "../../lib/platform";
import { useSeoMeta } from "../../lib/seo";
import { usePublicSiteContext } from "../../hooks/usePublicSiteContext";
import { DEFAULT_THEME_COLOR } from "./constants";
import type { GalleryItem } from "./types";
import { hexToRgba, normalizeThemeColor, toWhatsAppUrl } from "./utils";

export default function PublicGallery() {
  const { username: routeUsername } = useParams<{ username: string }>();
  const publicSiteContext = usePublicSiteContext(!routeUsername);
  const username = String(routeUsername || publicSiteContext.photographer?.username || "").trim();

  const [studioName, setStudioName] = useState("Photographer");
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState(DEFAULT_THEME_COLOR);
  const [showLensayaBranding, setShowLensayaBranding] = useState(true);
  const [allItems, setAllItems] = useState<GalleryItem[]>([]);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const appHomeUrl = buildAppUrl("/");

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(
        allItems
          .map((item) => item.category)
          .filter((category): category is string => Boolean(category && category.trim()))
          .map((category) => category.trim())
      )
    ).sort((a, b) => a.localeCompare(b));

    return ["All", ...values];
  }, [allItems]);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const moveLightbox = useCallback(
    (direction: "prev" | "next") => {
      if (lightboxIndex === null || items.length === 0) return;
      setLightboxIndex((current) => {
        if (current === null) return null;
        if (direction === "prev") {
          return current === 0 ? items.length - 1 : current - 1;
        }
        return current === items.length - 1 ? 0 : current + 1;
      });
    },
    [items.length, lightboxIndex]
  );

  useEffect(() => {
    let mounted = true;

    const loadGallery = async () => {
      if (!username) {
        if (publicSiteContext.loading) {
          return;
        }

        if (publicSiteContext.hostCandidate) {
          setAllItems([]);
          setItems([]);
          setSelectedCategory("All");
          setErrorMessage(null);
        } else {
          setErrorMessage("Gallery is unavailable.");
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [profileResult, galleryResult] = await Promise.all([publicApi.profile(username), publicApi.gallery(username)]);
        if (!mounted) return;

        const fetchedItems = (galleryResult?.items || []) as GalleryItem[];
        setStudioName(profileResult?.studioName || username);
        setWhatsappNumber(profileResult?.whatsappNumber || null);
        setThemeColor(normalizeThemeColor(profileResult?.themeColor));
        setShowLensayaBranding(profileResult?.showLensayaBranding !== false);
        setAllItems(fetchedItems);
        setItems(fetchedItems);
        setSelectedCategory("All");
        setErrorMessage(null);
      } catch (err) {
        if (!mounted) return;
        setErrorMessage(getApiErrorMessage(err, "Failed to load gallery"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadGallery();

    return () => {
      mounted = false;
    };
  }, [publicSiteContext.hostCandidate, publicSiteContext.loading, username]);

  useEffect(() => {
    let mounted = true;

    const loadByCategory = async () => {
      if (!username || loading) return;

      if (selectedCategory === "All") {
        setItems(allItems);
        return;
      }

      try {
        setFiltering(true);
        const result = await publicApi.gallery(username, { category: selectedCategory });
        if (!mounted) return;
        setItems((result?.items || []) as GalleryItem[]);
      } catch (err) {
        if (!mounted) return;
        setErrorMessage(getApiErrorMessage(err, "Failed to filter gallery"));
      } finally {
        if (mounted) {
          setFiltering(false);
        }
      }
    };

    void loadByCategory();

    return () => {
      mounted = false;
    };
  }, [allItems, loading, selectedCategory, username]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    if (items.length === 0) {
      setLightboxIndex(null);
      return;
    }
    if (lightboxIndex >= items.length) {
      setLightboxIndex(0);
    }
  }, [items, lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
        return;
      }
      if (event.key === "ArrowLeft") {
        moveLightbox("prev");
        return;
      }
      if (event.key === "ArrowRight") {
        moveLightbox("next");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeLightbox, lightboxIndex, moveLightbox]);

  const lightboxItem = lightboxIndex === null ? null : items[lightboxIndex] || null;
  const showSiteUnavailable = !routeUsername && publicSiteContext.hostCandidate && !publicSiteContext.loading && !publicSiteContext.resolved;
  const routePhotographerUrl = username ? buildAppUrl(`/p/${encodeURIComponent(username)}`) : "";
  const routeGalleryUrl = username ? buildAppUrl(`/p/${encodeURIComponent(username)}/gallery`) : "";
  const photographerUrl = routeUsername
    ? routePhotographerUrl
    : publicSiteContext.siteUrl ||
      (username ? buildPublicStudioUrl(username) : publicSiteContext.fallbackUrl || "");
  const galleryUrl = routeUsername
    ? routeGalleryUrl
    : publicSiteContext.galleryUrl ||
      (username ? buildPublicStudioUrl(username, "/gallery") : publicSiteContext.fallbackGalleryUrl || "");
  const contactUrl = toWhatsAppUrl(whatsappNumber, "Hi, I would like to enquire about your photography services.");
  const themeColorSoft = hexToRgba(themeColor, 0.12);
  const themeColorBorder = hexToRgba(themeColor, 0.35);
  const galleryMetaDescription = showSiteUnavailable
    ? publicSiteContext.message || "This gallery is not currently available."
    : `Browse the full gallery from ${studioName || username || "this photographer"} on Lensaya.`;
  const galleryCanonicalUrl = galleryUrl || publicSiteContext.fallbackGalleryUrl || null;
  const galleryMetaTitle = showSiteUnavailable
    ? `${publicSiteContext.photographer?.studioName || "Photographer"} Gallery | Lensaya`
    : `${studioName || username || "Photographer"} Gallery | Lensaya`;
  const themeVariables: CSSProperties = {
    "--theme-color": themeColor,
    "--theme-color-soft": themeColorSoft,
    "--theme-color-border": themeColorBorder,
  } as CSSProperties;

  useSeoMeta({
    title: galleryMetaTitle,
    description: galleryMetaDescription,
    image: items[0]?.imageUrl || null,
    canonicalUrl: galleryCanonicalUrl,
    type: "website",
  });

  const isPageLoading = loading || (!routeUsername && publicSiteContext.hostCandidate && publicSiteContext.loading);

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-600">Loading gallery...</p>
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
        fallbackUrl={publicSiteContext.fallbackGalleryUrl || publicSiteContext.fallbackUrl}
        fallbackLabel="Open fallback gallery"
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
            <a href={photographerUrl || appHomeUrl} className="flex items-center gap-2">
              <img src="/lensaya-master-icon-1024.svg" alt={studioName} className="h-6 w-6 object-contain" />
              <span className="text-xl font-semibold text-slate-900">{studioName}</span>
            </a>

            <nav className="hidden md:flex items-center gap-6">
              <a href={`${photographerUrl || appHomeUrl}#services`} className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
                Services
              </a>
              <a href={galleryUrl || appHomeUrl} className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
                Portfolio
              </a>
              <a href={`${photographerUrl || appHomeUrl}#packages`} className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
                Packages
              </a>
              <a href={`${photographerUrl || appHomeUrl}#availability`} className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
                Calendar
              </a>
              <a href={`${photographerUrl || appHomeUrl}#contact`} className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
                Contact
              </a>
            </nav>

            <a
              href={contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-color)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Contact</span>
            </a>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-14">
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">My Portfolio</h1>
            <p className="mt-2 text-slate-600">
              Browse the complete pages collection.
              <span className="ml-2 text-slate-500">{allItems.length} photo{allItems.length === 1 ? "" : "s"}</span>
            </p>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === category
                    ? "bg-[var(--theme-color)] text-white"
                    : "bg-white text-slate-600 border border-gray-300 hover:border-[var(--theme-color-border)]"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {filtering ? <p className="mb-4 text-sm text-slate-500">Updating gallery...</p> : null}

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 py-14 text-center text-slate-600">
              No photos found for this category.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white hover:shadow-lg transition-all"
                >
                  <ImageWithFallback
                    src={item.imageUrl || ""}
                    alt={`Gallery image ${index + 1}`}
                    className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {item.category ? (
                    <span className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs">
                      {item.category}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {showLensayaBranding ? (
        <>
          <section className="py-12 bg-slate-50 border-t border-gray-200">
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

          <footer className="bg-slate-900 text-white py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
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
              <p className="text-slate-400 text-sm">
                Copyright 2026 {studioName || username || "Photographer"}. All rights reserved.
              </p>
            </div>
          </footer>

          <a
            href={appHomeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-4 right-4 z-30 rounded-full border border-slate-200 bg-white/95 backdrop-blur px-4 py-2 text-sm font-medium text-slate-700 shadow-lg hover:text-slate-900 hover:border-slate-300 transition-colors"
          >
            {"\u{1F4F7} Made with Lensaya"}
          </a>
        </>
      ) : null}

      {lightboxItem ? (
        <div
          className="fixed inset-0 z-[100] bg-black/90 p-4 sm:p-8 flex items-center justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeLightbox();
            }
          }}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Close lightbox"
          >
            <X className="w-5 h-5" />
          </button>

          {items.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => moveLightbox("prev")}
                className="absolute left-4 sm:left-6 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => moveLightbox("next")}
                className="absolute right-4 sm:right-6 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          ) : null}

          <div className="w-full max-w-6xl">
            <ImageWithFallback
              src={lightboxItem.imageUrl || ""}
              alt="Selected gallery image"
              className="w-full max-h-[82vh] object-contain rounded-lg"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/90">
              <span>{lightboxItem.category || "Uncategorized"}</span>
              <span>
                {lightboxIndex! + 1} / {items.length}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}












