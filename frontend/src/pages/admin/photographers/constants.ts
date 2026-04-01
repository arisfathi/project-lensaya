import type { PaginationMeta, PlanCounts } from "./types";

export const DEFAULT_PAGINATION: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

export const DEFAULT_COUNTS_BY_PLAN: PlanCounts = {
  FREE: 0,
  PRO: 0,
  STUDIO: 0,
};

export const PAGE_SIZE = 20;
