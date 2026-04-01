import type { LucideIcon } from "lucide-react";

export type PublicProfile = {
  id: string;
  username: string;
  name?: string;
  studioName: string;
  bio: string | null;
  avatarUrl: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  showHero: boolean;
  teamSection: {
    enabled: boolean;
    members: Array<{
      name: string;
      role: string;
      image: string;
    }>;
  };
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

export type PublicService = {
  id: string;
  name: string;
  emoji: string | null;
  thumbnailUrl: string | null;
  order: number;
};

export type PublicPortfolioItem = {
  id: string;
  imageUrl: string | null;
  serviceId: string | null;
  category: string | null;
  featured: boolean;
  views: number;
};

export type ServicePreviewImage = {
  id: string;
  imageUrl: string | null;
  serviceId: string | null;
};

export type PublicPackage = {
  id: string;
  serviceId: string;
  name: string;
  price: number;
  currency: string;
  duration: string;
  features: string[];
};

export type PublicAvailability = {
  date: string;
  status: string;
};

export type AvailabilityDayStatus = "available" | "booked";

export type BookingInquiryForm = {
  name: string;
  email: string;
  phone: string;
  source: "" | "WEBSITE" | "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "DIRECT" | "OTHER";
  preferredTime: string;
  message: string;
};

export type HeroSocialLink = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  bgClass: string;
  eventType: "PROFILE_CLICK" | "WHATSAPP_CLICK";
  origin: string;
};
