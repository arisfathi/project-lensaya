export type ServiceItem = {
  id: string;
  name: string;
};

export type PortfolioItem = {
  id: string;
  imageUrl: string | null;
  serviceId: string | null;
  category: string | null;
  featured: boolean;
  views: number;
  createdAt: string;
};

export type EditForm = {
  serviceId: string;
  category: string;
  featured: boolean;
};
