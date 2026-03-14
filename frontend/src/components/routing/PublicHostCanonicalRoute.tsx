import { useEffect, type ReactNode } from "react";
import { buildRuntimePublicUrl, isActualPublicSiteHostCandidate } from "../../lib/platform";
import { LoadingSpinner } from "../ui/LoadingSpinner";

type PublicHostCanonicalRouteProps = {
  children: ReactNode;
  targetPath: "/" | "/gallery";
};

const routeLabels: Record<PublicHostCanonicalRouteProps["targetPath"], string> = {
  "/": "Redirecting to the portfolio home...",
  "/gallery": "Redirecting to the gallery...",
};

export function PublicHostCanonicalRoute({ children, targetPath }: PublicHostCanonicalRouteProps) {
  const shouldRedirect = isActualPublicSiteHostCandidate();
  const redirectUrl = buildRuntimePublicUrl(targetPath);

  useEffect(() => {
    if (!shouldRedirect || typeof window === "undefined") return;
    if (window.location.href === redirectUrl) return;
    window.location.replace(redirectUrl);
  }, [redirectUrl, shouldRedirect]);

  if (!shouldRedirect) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-sm text-center">
        <LoadingSpinner label={routeLabels[targetPath]} />
        <p className="mt-4 text-sm leading-6 text-slate-600">
          This public host serves the canonical site root instead of path-based profile routes.
        </p>
      </div>
    </div>
  );
}
