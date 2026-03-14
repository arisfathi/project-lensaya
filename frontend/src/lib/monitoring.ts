const MAX_REPORTS_PER_SESSION = 10;
const CLIENT_ERROR_ENDPOINT = "/api/v1/public/client-errors";

let initialized = false;
let reportedCount = 0;

const truncate = (value: unknown, maxLength: number) => {
  const text = String(value || "");
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const postClientError = (payload: Record<string, unknown>) => {
  if (reportedCount >= MAX_REPORTS_PER_SESSION) return;
  reportedCount += 1;

  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "application/json" });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(CLIENT_ERROR_ENDPOINT, blob);
    if (sent) return;
  }

  void fetch(CLIENT_ERROR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
    credentials: "omit",
  }).catch(() => {
    // Client error logging should never impact UX.
  });
};

export const initRuntimeErrorMonitoring = () => {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;

  initialized = true;

  window.addEventListener("error", (event) => {
    postClientError({
      type: "error",
      message: truncate(event.message || "Unknown runtime error", 2000),
      stack: truncate(event.error?.stack || "", 12000),
      source: truncate(event.filename || "", 1024),
      context: {
        line: event.lineno || 0,
        column: event.colno || 0,
      },
      url: truncate(window.location.href, 2048),
      userAgent: truncate(window.navigator?.userAgent || "", 1024),
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : truncate(String(reason || "Unhandled promise rejection"), 2000);
    const stack = reason instanceof Error ? reason.stack || "" : "";

    postClientError({
      type: "unhandledrejection",
      message: truncate(message, 2000),
      stack: truncate(stack, 12000),
      source: "unhandledrejection",
      url: truncate(window.location.href, 2048),
      userAgent: truncate(window.navigator?.userAgent || "", 1024),
      timestamp: new Date().toISOString(),
    });
  });
};
