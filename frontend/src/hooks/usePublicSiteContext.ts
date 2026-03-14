import { useEffect, useState } from "react";
import { getApiErrorMessage, publicApi } from "../lib/api";
import { getRuntimePublicHost, isPublicSiteHostCandidate } from "../lib/platform";

type ResolutionStatus =
  | "resolved"
  | "not_public_host"
  | "not_found"
  | "inactive"
  | "broken"
  | "upgrade_required";

type HostType = "platform" | "managed_subdomain" | "custom_domain" | "unknown";

type PhotographerSummary = {
  username: string;
  studioName: string;
};

export type PublicSiteContextState = {
  loading: boolean;
  error: string | null;
  host: string;
  hostCandidate: boolean;
  hostType: HostType;
  resolved: boolean;
  resolutionStatus: ResolutionStatus;
  message: string | null;
  photographer: PhotographerSummary | null;
  domain: string | null;
  domainStatus: string | null;
  sslStatus: string | null;
  failureReason: string | null;
  siteUrl: string | null;
  galleryUrl: string | null;
  fallbackUrl: string | null;
  fallbackGalleryUrl: string | null;
  isCustomDomain: boolean;
};

const createDefaultState = (enabled: boolean, host: string): PublicSiteContextState => ({
  loading: false,
  error: null,
  host,
  hostCandidate: enabled && isPublicSiteHostCandidate(host),
  hostType: "unknown",
  resolved: false,
  resolutionStatus: "not_public_host",
  message: null,
  photographer: null,
  domain: null,
  domainStatus: null,
  sslStatus: null,
  failureReason: null,
  siteUrl: null,
  galleryUrl: null,
  fallbackUrl: null,
  fallbackGalleryUrl: null,
  isCustomDomain: false,
});

export const usePublicSiteContext = (enabled = true) => {
  const host = getRuntimePublicHost();
  const hostCandidate = enabled && isPublicSiteHostCandidate(host);
  const [state, setState] = useState<PublicSiteContextState>(() => createDefaultState(enabled, host));

  useEffect(() => {
    if (!hostCandidate) {
      setState(createDefaultState(enabled, host));
      return;
    }

    let active = true;
    setState((current) => ({
      ...current,
      host,
      hostCandidate,
      loading: true,
      error: null,
    }));

    void publicApi
      .siteContext()
      .then((data) => {
        if (!active) return;
        setState({
          loading: false,
          error: null,
          host,
          hostCandidate,
          hostType: (data.hostType || "unknown") as HostType,
          resolved: data.resolutionStatus === "resolved",
          resolutionStatus: (data.resolutionStatus || "not_public_host") as ResolutionStatus,
          message: data.message || null,
          photographer: data.photographer || null,
          domain: data.domain || null,
          domainStatus: data.domainStatus || null,
          sslStatus: data.sslStatus || null,
          failureReason: data.failureReason || null,
          siteUrl: data.siteUrl || null,
          galleryUrl: data.galleryUrl || null,
          fallbackUrl: data.fallbackUrl || null,
          fallbackGalleryUrl: data.fallbackGalleryUrl || null,
          isCustomDomain: Boolean(data.isCustomDomain),
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          ...createDefaultState(enabled, host),
          host,
          hostCandidate,
          loading: false,
          error: getApiErrorMessage(error, "Failed to resolve this public site."),
          resolutionStatus: "not_found",
        });
      });

    return () => {
      active = false;
    };
  }, [enabled, host, hostCandidate]);

  return state;
};
