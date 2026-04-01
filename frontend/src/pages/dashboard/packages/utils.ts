import type { PackageForm } from "./types";

export const formatPrice = (cents: number) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export const parseFeatures = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export const getPackageFormError = (form: PackageForm, packageFeatureLimit: number): string | null => {
  if (!form.serviceId) {
    return "Service is required";
  }

  if (!form.name.trim()) {
    return "Package name is required";
  }

  const price = Number(form.price);
  if (!Number.isFinite(price) || price < 0) {
    return "Price must be a valid non-negative number";
  }

  if (!form.duration.trim()) {
    return "Duration is required";
  }

  const features = parseFeatures(form.featuresText);
  if (packageFeatureLimit >= 0 && features.length > packageFeatureLimit) {
    return `You can add up to ${packageFeatureLimit} features on your current plan`;
  }

  return null;
};
