/**
 * React hook for automatic Meta Pixel PageView tracking
 * Tracks page views on route changes
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../lib/metaPixel";

const EXCLUDED_PREFIXES = ["/dashboard", "/admin"];
const EXCLUDED_EXACT_PATHS = ["/signup", "/login", "/verify-email", "/forgot-password", "/reset-password"];

const shouldTrackPageView = (pathname: string) => {
  if (!pathname) return false;
  if (EXCLUDED_EXACT_PATHS.includes(pathname)) return false;
  return !EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

export function useMetaPixelPageView(): void {
  const location = useLocation();

  useEffect(() => {
    if (!shouldTrackPageView(location.pathname)) return;

    // Track SPA route changes on public/marketing pages only.
    const pagePath = `${location.pathname}${location.search}`;
    trackPageView(pagePath);
  }, [location.pathname, location.search]);
}
