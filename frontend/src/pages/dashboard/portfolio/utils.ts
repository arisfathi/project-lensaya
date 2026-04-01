import type { PortfolioItem, ServiceItem } from "./types";

export const getCategoryLabel = (item: PortfolioItem, services: ServiceItem[]) => {
  if (item.category) return item.category;
  if (!item.serviceId) return "Uncategorized";
  return services.find((service) => service.id === item.serviceId)?.name || "Service";
};
