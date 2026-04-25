import { Check, ChevronLeft, ChevronRight, MessageCircle, Share2 } from "lucide-react";
import { useMemo, useState, type CSSProperties, type RefObject } from "react";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import { ImageWithFallback } from "../../../components/figma/ImageWithFallback";
import { formatDateLabel, formatPackagePrice, isBookedAvailabilityStatus, toAvailabilityStatusLabel } from "../utils";
import type { AvailabilityDayStatus, HeroSocialLink, PublicPackage, PublicPortfolioItem, PublicService } from "../types";

type PortfolioHeaderProps = {
  headerRef: RefObject<HTMLElement | null>;
  portfolioUrl: string;
  appHomeUrl: string;
  studioName: string;
  galleryUrl: string;
  onShare: () => void;
};

export function PortfolioHeader({ headerRef, portfolioUrl, appHomeUrl, studioName, galleryUrl, onShare }: PortfolioHeaderProps) {
  return (
    <header ref={headerRef} className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-[var(--theme-color-border)] z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <a href={portfolioUrl || appHomeUrl} className="flex items-center gap-2">
            <img src="/lensaya-master-icon-1024.svg" alt={studioName} className="h-6 w-6 object-contain" />
            <span className="text-xl font-semibold text-slate-900">{studioName}</span>
          </a>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#services" className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
              Services
            </a>
            <a href={galleryUrl || appHomeUrl} className="text-sm text-slate-600 hover:text-[var(--theme-color)] transition-colors">
              Portfolio
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
              onClick={onShare}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 border border-[var(--theme-color-border)] text-slate-700 rounded-lg hover:bg-[var(--theme-color-soft)] transition-colors text-sm"
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
  );
}

type HeroSectionProps = {
  showHeroSection: boolean;
  heroBackgroundImageUrl: string;
  coverTitle: string;
  heroSubtitle: string;
  heroSocialLinks: HeroSocialLink[];
  onSocialClick: (social: HeroSocialLink) => void;
};

export function HeroSection({
  showHeroSection,
  heroBackgroundImageUrl,
  coverTitle,
  heroSubtitle,
  heroSocialLinks,
  onSocialClick,
}: HeroSectionProps) {
  if (!showHeroSection) return null;

  return (
    <section
      className="relative h-[60vh] sm:h-[70vh] mt-16 overflow-hidden bg-cover bg-center bg-gradient-to-br from-slate-900 to-slate-700"
      style={heroBackgroundImageUrl ? { backgroundImage: `url("${heroBackgroundImageUrl}")` } : undefined}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/30 z-10" />
      <div className="relative z-20 h-full flex items-center justify-center text-center px-4">
        <div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">{coverTitle}</h1>
          {heroSubtitle ? <p className="mt-4 text-lg sm:text-xl text-white/90 max-w-2xl mx-auto">{heroSubtitle}</p> : null}
          {heroSocialLinks.length > 0 ? (
            <div className="mt-6 flex flex-wrap justify-center gap-3 sm:gap-4">
              {heroSocialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.key}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    title={social.label}
                    onClick={() => onSocialClick(social)}
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg ring-1 ring-white/20 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 hover:scale-105 ${social.bgClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type ServicesSectionProps = {
  showHeroSection: boolean;
  services: PublicService[];
  selectedService: string;
  servicePreviewById: Map<string, string>;
  servicePlaceholderImage: string;
  onServiceSelect: (serviceId: string) => void;
};

export function ServicesSection({
  showHeroSection,
  services,
  selectedService,
  servicePreviewById,
  servicePlaceholderImage,
  onServiceSelect,
}: ServicesSectionProps) {
  return (
    <section id="services" className={`py-12 sm:py-16 bg-[var(--theme-section-bg)] ${showHeroSection ? "" : "mt-16"}`}>
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
                onClick={() => onServiceSelect(service.id)}
                className={`flex-shrink-0 w-40 sm:w-48 rounded-xl overflow-hidden border-2 transition-all ${
                  selectedService === service.id ? "border-[var(--theme-color)] shadow-lg scale-105" : "border-[var(--theme-color-border)] hover:border-[var(--theme-color)]"
                }`}
              >
                <div className="relative h-32 sm:h-40">
                  <ImageWithFallback
                    src={servicePreviewById.get(service.id) || servicePlaceholderImage}
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
  );
}

type PortfolioSectionProps = {
  selectedServiceInfoName?: string;
  currentPortfolio: PublicPortfolioItem[];
  currentImageIndex: number;
  moreFromServicePortfolio: PublicPortfolioItem[];
  galleryUrl: string;
  appHomeUrl: string;
  onPrevImage: () => void;
  onNextImage: () => void;
  onImageSelect: (index: number) => void;
  onMoreThumbnailSelect: (item: PublicPortfolioItem) => void;
};

export function PortfolioSection({
  selectedServiceInfoName,
  currentPortfolio,
  currentImageIndex,
  moreFromServicePortfolio,
  galleryUrl,
  appHomeUrl,
  onPrevImage,
  onNextImage,
  onImageSelect,
  onMoreThumbnailSelect,
}: PortfolioSectionProps) {
  return (
    <section id="portfolio" className="py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{selectedServiceInfoName ? `${selectedServiceInfoName} Pages` : "Pages"}</h2>
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
                  onClick={onPrevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 border border-[var(--theme-color-border)] backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                >
                  <ChevronLeft className="w-6 h-6 text-slate-900" />
                </button>
                <button
                  type="button"
                  onClick={onNextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 border border-[var(--theme-color-border)] backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                >
                  <ChevronRight className="w-6 h-6 text-slate-900" />
                </button>

                <div className="flex justify-center gap-2 mt-4">
                  {currentPortfolio.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onImageSelect(idx)}
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
                    onClick={() => onMoreThumbnailSelect(item)}
                    className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                      isActive
                        ? "border-[var(--theme-color)] shadow"
                        : item.featured
                          ? "border-[var(--theme-color-border)] hover:border-[var(--theme-color)]"
                          : "border-[var(--theme-color-border)] hover:border-[var(--theme-color)]"
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
  );
}

type PackagesSectionProps = {
  currentPackages: PublicPackage[];
  selectedPackageId: string | null;
  onPackageSelect: (pkg: PublicPackage) => void;
};

export function PackagesSection({ currentPackages, selectedPackageId, onPackageSelect }: PackagesSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);

  const initialSlide = useMemo(() => {
    if (!selectedPackageId) return 0;
    const index = currentPackages.findIndex((item) => item.id === selectedPackageId);
    return Math.max(0, index);
  }, [currentPackages, selectedPackageId]);

  const swiperStyle = useMemo(
    () =>
      ({
        "--swiper-pagination-color": "var(--theme-color)",
        "--swiper-pagination-bullet-inactive-color": "rgba(15, 23, 42, 0.25)",
        "--swiper-pagination-bullet-inactive-opacity": "1",
      }) as CSSProperties,
    []
  );

  return (
    <section id="packages" className="py-12 sm:py-16 bg-[var(--theme-section-bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8 text-center">Choose Your Package</h2>
        {currentPackages.length === 0 ? (
          <p className="text-center text-slate-600">No packages published for this service.</p>
        ) : (
          <>
            {/* Mobile: swipeable cards */}
            <div className="md:hidden">
              <div className="relative">
                {currentPackages.length > 1 && !hasInteracted ? (
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2">
                      <div className="h-18 w-14 bg-gradient-to-r from-[var(--theme-section-bg)] to-transparent" />
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-[var(--theme-color-border)] bg-white/80 p-2 shadow-sm backdrop-blur animate-[pulse_2.2s_ease-in-out_infinite]">
                        <ChevronLeft className="h-5 w-5 text-slate-600" />
                      </div>
                    </div>

                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                      <div className="h-18 w-14 bg-gradient-to-l from-[var(--theme-section-bg)] to-transparent" />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-[var(--theme-color-border)] bg-white/80 p-2 shadow-sm backdrop-blur animate-[pulse_2.2s_ease-in-out_infinite]">
                        <ChevronRight className="h-5 w-5 text-slate-600" />
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="rounded-full border border-[var(--theme-color-border)] bg-white/85 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur">
                        Swipe to see more
                      </div>
                    </div>
                  </div>
                ) : null}

                <Swiper
                  className="!pb-10"
                  modules={[Pagination]}
                  pagination={{ clickable: true }}
                  centeredSlides
                  spaceBetween={16}
                  slidesPerView={1.08}
                  initialSlide={initialSlide}
                  style={swiperStyle}
                  speed={350}
                  grabCursor
                  onSwiper={(swiper) => setActiveIndex(swiper.activeIndex)}
                  onTouchStart={() => setHasInteracted(true)}
                  onSlideChange={(swiper) => {
                    setHasInteracted(true);
                    setActiveIndex(swiper.activeIndex);
                  }}
                >
                  {currentPackages.map((pkg, index) => {
                    const isSelected = selectedPackageId === pkg.id;
                    const isActive = index === activeIndex;

                    return (
                      <SwiperSlide key={pkg.id} className="flex justify-center px-1">
                        <div
                          onClick={() => onPackageSelect(pkg)}
                          className={`w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-2xl p-6 border-2 cursor-pointer transition-transform duration-300 ease-out ${
                            isSelected
                              ? "border-[var(--theme-color)] shadow-lg"
                              : "border-[var(--theme-color-border)] shadow-sm"
                          } ${isActive ? "scale-[1.02]" : "scale-[0.98] opacity-90"}`}
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
                              isSelected ? "bg-[var(--theme-color)] text-white" : "bg-gray-100 text-slate-600"
                            }`}
                          >
                            {isSelected ? "Selected" : "Select Package"}
                          </div>
                        </div>
                      </SwiperSlide>
                    );
                  })}
                </Swiper>
              </div>
            </div>

            {/* Desktop/tablet: grid */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {currentPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => onPackageSelect(pkg)}
                  className={`bg-white/80 backdrop-blur-sm rounded-xl p-6 border-2 cursor-pointer transition-all ${
                    selectedPackageId === pkg.id
                      ? "border-[var(--theme-color)] shadow-lg scale-105"
                      : "border-[var(--theme-color-border)] hover:border-[var(--theme-color)] hover:shadow-md"
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
          </>
        )}
      </div>
    </section>
  );
}

type AvailabilitySectionProps = {
  availabilitySectionRef: RefObject<HTMLElement | null>;
  monthLabel: string;
  yearLabel: number;
  firstDay: number;
  daysInMonth: number;
  availabilityMonth: string;
  availabilityStatusByDate: Map<string, AvailabilityDayStatus>;
  todayKey: string;
  selectedDate: string | null;
  onDateSelect: (dayKey: string) => void;
};

export function AvailabilitySection({
  availabilitySectionRef,
  monthLabel,
  yearLabel,
  firstDay,
  daysInMonth,
  availabilityMonth,
  availabilityStatusByDate,
  todayKey,
  selectedDate,
  onDateSelect,
}: AvailabilitySectionProps) {
  return (
    <section id="availability" ref={availabilitySectionRef} className="py-12 sm:py-16 bg-[var(--theme-section-bg)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8 text-center">Choose Your Date</h2>
        <p className="text-center text-sm text-slate-600 mb-6">Select your preferred date and package, then submit an inquiry form.</p>

        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-[var(--theme-color-border)] p-6">
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
                    onDateSelect(dayKey);
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
  );
}
