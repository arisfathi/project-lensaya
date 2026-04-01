import type { LucideIcon } from "lucide-react";

export type ReferralSummary = {
  referralCode: string | null;
  totalReferrals: number;
  clicks: number;
  signups: number;
  conversions: number;
  conversionRate: number;
  rewardsEarned: number;
  activeReferrals: number;
};

export type ReferralEvent = {
  visitorEmail: string | null;
  status: string;
  reward: number;
  date: string;
};

export type GrowthPoint = {
  month: string;
  referrals: number;
};

export type ReferralStatCard = {
  name: string;
  value: string;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
};
