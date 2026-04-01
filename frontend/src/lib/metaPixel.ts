/**
 * Meta Pixel (Facebook Pixel) tracking utility for Lensaya
 * 
 * Handles initialization, event tracking, and deduplication.
 * Only tracks on platform app/marketing hosts (not public portrait sites).
 * 
 * Events:
 * - PageView: Automatic on route changes
 * - Lead: Email capture (newsletter)
 * - CompleteRegistration: Account creation completion
 * - Login: Successful login
 * - Purchase: Subscription confirmation (sent from backend)
 */

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || "";
const IS_DEVELOPMENT = import.meta.env.MODE === "development";

// Debounce tracking of same event type within short window
const eventCache = new Map<string, number>();
const DEDUP_WINDOW_MS = 1000;

interface WindowWithPixel extends Window {
  fbq?: {
    (action: string, event: string, data?: Record<string, unknown>): void;
    queue?: unknown[];
    set?: (...args: unknown[]) => void;
    track?: (...args: unknown[]) => void;
    loadEvent?: (...args: unknown[]) => void;
  };
}

/**
 * Initialize Meta Pixel on page load
 * Called from main.tsx
 */
export function initializeMetaPixel(): void {
  if (!PIXEL_ID || IS_DEVELOPMENT) {
    return;
  }

  // Inject Meta Pixel script
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://connect.facebook.net/en_US/fbevents.js`;
  document.head.appendChild(script);

  // Initialize fbq function
  const w = window as WindowWithPixel;
  w.fbq = w.fbq || function (this: unknown, ...args: unknown[]) {
    const fbq = w.fbq as WindowWithPixel["fbq"];
    if (fbq && fbq.queue) {
      (fbq.queue as unknown[]).push(args);
    }
  };

  w.fbq.queue = w.fbq.queue || [];
  w.fbq.set = w.fbq.set || function (...args: unknown[]) {
    const fbq = w.fbq as unknown as { queue: unknown[] };
    if (fbq.queue) {
      fbq.queue.push(["set", ...args]);
    }
  };
  w.fbq.track = w.fbq.track || function (...args: unknown[]) {
    const fbq = w.fbq as unknown as { queue: unknown[] };
    if (fbq.queue) {
      fbq.queue.push(["track", ...args]);
    }
  };
  w.fbq.loadEvent = w.fbq.loadEvent || function (...args: unknown[]) {
    const fbq = w.fbq as unknown as { queue: unknown[] };
    if (fbq.queue) {
      fbq.queue.push(["loadEvent", ...args]);
    }
  };

  // Initialize pixel. PageView is tracked by the SPA route hook.
  w.fbq("init", PIXEL_ID);
}

/**
 * Track a Meta Pixel event with deduplication
 * @param eventName - Event type (PageView, Lead, CompleteRegistration, etc.)
 * @param data - Additional event data
 */
function trackEvent(eventName: string, data?: Record<string, unknown>): void {
  if (!PIXEL_ID || IS_DEVELOPMENT || typeof window === "undefined") {
    return;
  }

  // Deduplication: don't track same event twice within DEDUP_WINDOW_MS
  const cacheKey = `${eventName}:${JSON.stringify(data || {})}`;
  const lastTrackedTime = eventCache.get(cacheKey);
  const now = Date.now();

  if (lastTrackedTime && now - lastTrackedTime < DEDUP_WINDOW_MS) {
    return;
  }

  eventCache.set(cacheKey, now);

  const w = window as WindowWithPixel;
  if (w.fbq) {
    w.fbq("track", eventName, data || {});
  }
}

/**
 * Track PageView event
 * Typically called automatically by route change listener
 */
export function trackPageView(path?: string): void {
  trackEvent("PageView", path ? { page_path: path } : undefined);
}

/**
 * Track successful account registration using Meta standard event naming.
 */
export function trackSignUp(data?: { email?: string; referral_source?: string }): void {
  trackEvent("CompleteRegistration", data);
}

/**
 * Track Login event
 */
export function trackLogin(data?: { email?: string }): void {
  trackEvent("Login", data);
}

/**
 * Track Lead event (email capture like newsletter signup)
 */
export function trackLead(data?: { email?: string; lead_type?: string }): void {
  trackEvent("Lead", data);
}

/**
 * Track Purchase event
 * Usually called from backend via pixel HTML in receipt email
 * But can also be called from frontend if needed
 */
export function trackPurchase(data?: {
  currency?: string;
  value?: number;
  content_name?: string;
  content_type?: string;
}): void {
  trackEvent("Purchase", data);
}

/**
 * Set user external ID for cross-domain tracking
 * Call after successful login/signup
 */
export function setExternalUserID(userId: string): void {
  if (!PIXEL_ID || IS_DEVELOPMENT || typeof window === "undefined") {
    return;
  }

  const w = window as WindowWithPixel;
  if (w.fbq && w.fbq.set) {
    w.fbq.set("external_id", userId);
  }
}

/**
 * Clear user data
 * Call after logout
 */
export function clearUserData(): void {
  if (!PIXEL_ID || IS_DEVELOPMENT || typeof window === "undefined") {
    return;
  }

  const w = window as WindowWithPixel;
  if (w.fbq && w.fbq.set) {
    // Clear by setting empty external_id
    w.fbq.set("external_id", "");
  }
}
