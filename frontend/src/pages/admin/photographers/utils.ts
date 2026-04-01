import { DEFAULT_COUNTS_BY_PLAN, DEFAULT_PAGINATION } from "./constants";
import type { PaginationMeta, PhotographerDetail, PhotographerItem, PlanCounts } from "./types";

export const formatPlan = (plan: string) => {
  if (plan === "FREE") return "Free";
  if (plan === "PRO") return "Pro";
  if (plan === "STUDIO") return "Studio";
  return plan || "Unknown";
};

export const formatStatus = (status: string) => (status === "ACTIVE" ? "Active" : "Suspended");

export const formatDate = (value: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export const coercePhotographerItems = (raw: unknown): PhotographerItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw as PhotographerItem[];
};

export const coerceCountsByPlan = (raw: unknown): PlanCounts => {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_COUNTS_BY_PLAN;
  }

  const value = raw as Record<string, unknown>;
  return {
    FREE: Number(value.FREE || 0),
    PRO: Number(value.PRO || 0),
    STUDIO: Number(value.STUDIO || 0),
  };
};

export const coercePagination = (raw: unknown): PaginationMeta => {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_PAGINATION;
  }

  const value = raw as Record<string, unknown>;
  return {
    page: Number(value.page || 1),
    limit: Number(value.limit || 20),
    total: Number(value.total || 0),
    totalPages: Number(value.totalPages || 1),
  };
};

export const coercePhotographerDetail = (raw: unknown): PhotographerDetail => {
  return raw as PhotographerDetail;
};

export const getPlanBadgeClassName = (plan: string) => {
  if (plan === "STUDIO") return "bg-purple-100 text-purple-700";
  if (plan === "PRO") return "bg-cyan-100 text-cyan-700";
  return "bg-gray-100 text-gray-700";
};

export const getStatusBadgeClassName = (status: string) => {
  return status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
};
