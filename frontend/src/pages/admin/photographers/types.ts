export type PhotographerPlan = "FREE" | "PRO" | "STUDIO";
export type PhotographerStatus = "ACTIVE" | "SUSPENDED";

export type PhotographerItem = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  plan: PhotographerPlan;
  portfolioCount: number;
  imagesStored: number;
  status: PhotographerStatus;
  joinDate: string;
  lastActive: string | null;
};

export type PhotographerDetail = {
  photographer: {
    id: string;
    fullName: string;
    email: string;
    username: string | null;
    status: string;
  };
  subscription: { plan?: string } | null;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PlanFilter = "All" | "FREE" | "PRO" | "STUDIO";
export type StatusFilter = "All" | "ACTIVE" | "SUSPENDED";

export type PlanCounts = Record<PhotographerPlan, number>;
