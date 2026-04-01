import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { getRoleHomePath } from "../lib/roles";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { isBootstrapping, isAuthenticated, user } = useAuth();
  const redirect = searchParams.get("redirect");

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to={redirect || getRoleHomePath(user.role)} replace />;
  }

  return <Navigate to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`} replace />;
}
