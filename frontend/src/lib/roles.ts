export type AppRole = "ADMIN" | "PHOTOGRAPHER";

export const getRoleHomePath = (role?: string | null) => {
  if (role === "ADMIN") {
    return "/admin";
  }
  return "/dashboard";
};
