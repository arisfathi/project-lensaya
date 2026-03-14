import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getRoleHomePath } from "../lib/roles";
import { LoadingSpinner } from "./ui/LoadingSpinner";

type RoleProtectedRouteProps = {
  children: ReactNode;
  role: "ADMIN" | "PHOTOGRAPHER";
};

export function RoleProtectedRoute({ children, role }: RoleProtectedRouteProps) {
  const location = useLocation();
  const { isBootstrapping, isAuthenticated, user } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner label="Loading your workspace..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === "ADMIN" && user.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  if (role === "PHOTOGRAPHER" && user.role !== "PHOTOGRAPHER") {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

export function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { isBootstrapping, isAuthenticated, user } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getRoleHomePath(user?.role)} replace />;
  }

  return <>{children}</>;
}
