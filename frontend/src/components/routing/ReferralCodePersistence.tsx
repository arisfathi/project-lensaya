import { useEffect } from "react";
import { publicApi } from "../../lib/api";

const REFERRAL_STORAGE_KEY = "lensaya_referral_code";
const VISITOR_ID_STORAGE_KEY = "lensaya_visitor_id";
const REFERRAL_TRACK_SESSION_PREFIX = "lensaya_referral_tracked";

const safeGet = (storage: Storage | undefined, key: string) => {
  if (!storage) return "";
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
};

const safeSet = (storage: Storage | undefined, key: string, value: string) => {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
};

const safeRemove = (storage: Storage | undefined, key: string) => {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
};

const normalizeReferralCode = (value = "") => String(value || "").trim();

const setStoredReferralCode = (value: string) => {
  if (typeof window === "undefined") return;
  const normalized = normalizeReferralCode(value);
  if (!normalized) {
    safeRemove(window.localStorage, REFERRAL_STORAGE_KEY);
    return;
  }
  safeSet(window.localStorage, REFERRAL_STORAGE_KEY, normalized);
};

const createVisitorId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `visitor_${crypto.randomUUID()}`;
  }
  return `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const getOrCreateVisitorId = () => {
  if (typeof window === "undefined") return "";

  const existing = safeGet(window.localStorage, VISITOR_ID_STORAGE_KEY);
  if (existing) return existing;

  const created = createVisitorId();
  safeSet(window.localStorage, VISITOR_ID_STORAGE_KEY, created);
  return created;
};

const getReferralTrackSessionKey = (referralCode: string, visitorId: string) =>
  `${REFERRAL_TRACK_SESSION_PREFIX}:${normalizeReferralCode(referralCode)}:${String(visitorId || "").trim()}`;

const hasTrackedReferralClick = (referralCode: string, visitorId: string) => {
  if (typeof window === "undefined") return false;
  return safeGet(window.sessionStorage, getReferralTrackSessionKey(referralCode, visitorId)) === "1";
};

const markTrackedReferralClick = (referralCode: string, visitorId: string) => {
  if (typeof window === "undefined") return;
  safeSet(window.sessionStorage, getReferralTrackSessionKey(referralCode, visitorId), "1");
};

const isReferralCaptureBlockedPath = (pathname = "") =>
  pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

type CaptureReferralOptions = {
  pathname?: string;
  search?: string;
  trackClick?: boolean;
  onTrackClick?: (referralCode: string, visitorId: string) => Promise<void> | void;
};

const captureReferralFromLocation = async ({
  pathname = "",
  search = "",
  trackClick = true,
  onTrackClick,
}: CaptureReferralOptions) => {
  if (typeof window === "undefined" || isReferralCaptureBlockedPath(pathname)) {
    return { referralCode: "", visitorId: "" };
  }

  const params = new URLSearchParams(search);
  const referralCode = normalizeReferralCode(params.get("ref") || "");
  if (!referralCode) {
    return { referralCode: "", visitorId: "" };
  }

  setStoredReferralCode(referralCode);

  const visitorId = getOrCreateVisitorId();
  if (!trackClick || !visitorId || !onTrackClick) {
    return { referralCode, visitorId };
  }

  if (hasTrackedReferralClick(referralCode, visitorId)) {
    return { referralCode, visitorId };
  }

  markTrackedReferralClick(referralCode, visitorId);

  try {
    await onTrackClick(referralCode, visitorId);
  } catch {
    // Ignore tracking failures so referral persistence remains intact.
  }

  return { referralCode, visitorId };
};

export function ReferralCodePersistence() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncReferral = () => {
      void captureReferralFromLocation({
        pathname: window.location.pathname,
        search: window.location.search,
        trackClick: window.location.pathname !== "/signup",
        onTrackClick: (referralCode, visitorId) =>
          publicApi.trackReferral({ referralCode, visitorId }).then(() => undefined),
      });
    };

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function pushState(...args) {
      const result = originalPushState(...(args as Parameters<History["pushState"]>));
      syncReferral();
      return result;
    } as typeof window.history.pushState;

    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState(...(args as Parameters<History["replaceState"]>));
      syncReferral();
      return result;
    } as typeof window.history.replaceState;

    window.addEventListener("popstate", syncReferral);
    syncReferral();

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", syncReferral);
    };
  }, []);

  return null;
}

