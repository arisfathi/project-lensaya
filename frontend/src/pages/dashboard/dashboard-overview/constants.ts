import type { QuickActionItem } from "./types";

export const PLAN_ORDER = ["FREE", "PRO", "STUDIO"] as const;
export const PREVIEW_BAR_WIDTHS = ["92%", "72%", "54%"];
export const REFERRAL_PROMPT_DISMISS_KEY = "lensaya_dashboard_referral_prompt_dismissed";

export const QUICK_ACTIONS: QuickActionItem[] = [
  {
    name: "Add Service",
    description: "Create new service",
    color: "bg-blue-500",
    icon: "service",
    path: "/dashboard/services?new=1",
  },
  {
    name: "Add Package",
    description: "Define pricing package",
    color: "bg-purple-500",
    icon: "package",
    path: "/dashboard/packages?new=1",
  },
  {
    name: "Upload Portfolio Image",
    description: "Add new portfolio photo",
    color: "bg-cyan-500",
    icon: "portfolio",
    path: "/dashboard/portfolio?new=1",
  },
  {
    name: "Edit Profile",
    description: "Update studio profile",
    color: "bg-green-500",
    icon: "profile",
    path: "/dashboard/settings",
  },
  {
    name: "Upgrade Plan",
    description: "Unlock advanced limits",
    color: "bg-slate-900",
    icon: "upgrade",
    path: "/dashboard/pricing",
  },
];
