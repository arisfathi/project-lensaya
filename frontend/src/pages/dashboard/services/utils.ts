import type { ServiceForm } from "./types";

export const getServiceFormError = (form: ServiceForm): string | null => {
  if (!form.name.trim()) {
    return "Service name is required";
  }

  const order = Number(form.order);
  if (!Number.isFinite(order) || order < 0) {
    return "Order must be a non-negative number";
  }

  return null;
};
