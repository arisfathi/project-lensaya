import type { analyticsApi } from "../../../lib/api";
import type { LucideIcon } from "lucide-react";

export type OverviewPayload = Awaited<ReturnType<typeof analyticsApi.overview>>;
export type ActivityPayload = Awaited<ReturnType<typeof analyticsApi.activity>>;
export type ActivityItem = ActivityPayload["items"][number];
export type PreviewCategoryItem = OverviewPayload["preview"]["topCategories"][number];

export type MetricCardConfig = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconWrapClass: string;
  iconClass: string;
};

export type SourcePreviewRow = {
  label: string;
  width: string;
  visible: boolean;
};
