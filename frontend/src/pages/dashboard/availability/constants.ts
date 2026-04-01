import type { AvailabilityLegendItem, BookingLeadPeriodPreset, BookingLeadsPagination } from "./types";

export const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MONTHS = [
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

export const AVAILABILITY_LEGEND: AvailabilityLegendItem[] = [
  {
    key: "available",
    label: "Available",
    swatchClass: "bg-green-100 border-green-400",
    textClass: "text-green-700",
  },
  {
    key: "booked",
    label: "Booked",
    swatchClass: "bg-red-100 border-red-400",
    textClass: "text-red-700",
  },
  {
    key: "past",
    label: "Past Dates",
    swatchClass: "bg-gray-200 border-gray-400",
    textClass: "text-slate-600",
  },
];

export const BOOKING_LEAD_PERIOD_PRESETS: Array<{ value: BookingLeadPeriodPreset; label: string }> = [
  { value: "all", label: "All" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export const DEFAULT_BOOKING_LEADS_PAGINATION: BookingLeadsPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
};
