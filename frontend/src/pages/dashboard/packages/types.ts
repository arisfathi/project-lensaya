export type ServiceItem = {
  id: string;
  name: string;
};

export type PackageItem = {
  id: string;
  serviceId: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationLabel: string;
  features: string[];
  isPopular: boolean;
};

export type PackageForm = {
  serviceId: string;
  name: string;
  price: string;
  duration: string;
  featuresText: string;
  popular: boolean;
};
