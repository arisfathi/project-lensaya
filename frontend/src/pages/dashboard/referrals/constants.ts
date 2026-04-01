import type { ReferralSummary } from "./types";

export const FALLBACK_SUMMARY: ReferralSummary = {
  referralCode: null,
  totalReferrals: 0,
  clicks: 0,
  signups: 0,
  conversions: 0,
  conversionRate: 0,
  rewardsEarned: 0,
  activeReferrals: 0,
};

export const REFERRAL_EVENTS_PAGE = 1;
export const REFERRAL_EVENTS_LIMIT = 20;

export const STATUS_CLASS_MAP: Record<string, string> = {
  CLICKED: "bg-blue-100 text-blue-700",
  SIGNED_UP: "bg-cyan-100 text-cyan-700",
  CONVERTED: "bg-green-100 text-green-700",
  REWARDED: "bg-emerald-100 text-emerald-700",
};
