import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { buildPlatformRouteUrl, isActualPublicSiteHostCandidate } from "../../lib/platform";
import { LoadingSpinner } from "../ui/LoadingSpinner";

type PlatformTarget = "app" | "public" | "admin";

type PlatformHostBoundaryProps = {
  children: ReactNode;
  target: PlatformTarget;
};

const redirectMessages: Record<PlatformTarget, string> = {
  app: "Redirecting to the Lensaya workspace...",
  public: "Redirecting to the Lensaya website...",
  admin: "Redirecting to the Lensaya admin workspace...",
};

export function PlatformHostBoundary({ children, target }: PlatformHostBoundaryProps) {
  const location = useLocation();
  const shouldRedirect = isActualPublicSiteHostCandidate();
  const nextPath = `${location.pathname}${location.search}${location.hash}`;
  const redirectUrl = buildPlatformRouteUrl(nextPath, target);

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
        <LoadingSpinner label={redirectMessages[target]} />
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Platform routes are served from Lensaya hosts, not from public portfolio domains.
        </p>
      </div>
    </div>
  );
}
