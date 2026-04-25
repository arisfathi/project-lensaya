type AppleSignInAuthorization = {
  id_token?: string;
  code?: string;
};

type AppleSignInResponse = {
  authorization?: AppleSignInAuthorization;
  user?: {
    name?: {
      firstName?: string;
      lastName?: string;
    };
  };
};

type AppleAuthInitOptions = {
  clientId: string;
  scope: string;
  redirectURI: string;
  usePopup: boolean;
};

type AppleIDAuth = {
  init: (options: AppleAuthInitOptions) => void;
  signIn: () => Promise<unknown>;
};

type AppleIDGlobal = {
  auth: AppleIDAuth;
};

type AppleSignInConfig = {
  enabled: boolean;
  clientId: string;
  redirectUri: string;
};

const APPLE_SCRIPT_SRC = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

let appleScriptPromise: Promise<void> | null = null;

const cleanString = (value: unknown) => String(value || "").trim();

const parseBoolean = (value: unknown, fallback = false) => {
  const normalized = cleanString(value).toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const ensureAppleScript = () => {
  if (appleScriptPromise) {
    return appleScriptPromise;
  }

  appleScriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Apple Sign-In is only available in the browser"));
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${APPLE_SCRIPT_SRC}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = APPLE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      appleScriptPromise = null;
      reject(new Error("Failed to load Apple Sign-In script"));
    };
    document.head.appendChild(script);
  });
  return appleScriptPromise;
};

const buildFullName = (response: AppleSignInResponse) => {
  const first = response.user?.name?.firstName?.trim() || "";
  const last = response.user?.name?.lastName?.trim() || "";
  const full = `${first} ${last}`.trim();
  return full || undefined;
};

export async function signInWithApple(options: { clientId: string; redirectUri: string }) {
  await ensureAppleScript();

  const AppleID = (window as unknown as { AppleID?: AppleIDGlobal }).AppleID;
  if (!AppleID?.auth?.init || !AppleID?.auth?.signIn) {
    throw new Error("Apple Sign-In is not available");
  }

  AppleID.auth.init({
    clientId: options.clientId,
    scope: "name email",
    redirectURI: options.redirectUri,
    usePopup: true,
  });

  const response = (await AppleID.auth.signIn()) as AppleSignInResponse;
  const idToken = response.authorization?.id_token || "";
  const code = response.authorization?.code || "";
  if (!idToken) {
    throw new Error("Apple Sign-In failed. Missing identity token.");
  }
  if (!code) {
    throw new Error("Apple Sign-In failed. Missing authorization code.");
  }

  return {
    idToken,
    code,
    fullName: buildFullName(response),
  };
}

export function getAppleSignInConfig(): AppleSignInConfig {
  const enabled = parseBoolean(import.meta.env.VITE_APPLE_AUTH_ENABLED, false);
  const clientId = cleanString(import.meta.env.VITE_APPLE_CLIENT_ID);
  const redirectUri = cleanString(import.meta.env.VITE_APPLE_REDIRECT_URI);

  return {
    enabled,
    clientId,
    redirectUri,
  };
}

export function isAppleSignInReady(config: AppleSignInConfig): boolean {
  if (!config.enabled) return false;
  if (!config.clientId) return false;
  if (!isValidHttpUrl(config.redirectUri)) return false;
  return true;
}

export function getAppleSignInErrorMessage(error: unknown): string | null {
  const err = error as { message?: string; error?: string };
  const rawMessage = cleanString(err?.message || err?.error || "").toLowerCase();

  if (rawMessage.includes("popup_closed_by_user") || rawMessage.includes("cancel")) {
    return "Apple sign-in was canceled.";
  }

  if (rawMessage.includes("failed to load apple sign-in script")) {
    return "Apple sign-in is temporarily unavailable. Please try again in a moment.";
  }

  if (rawMessage.includes("missing authorization code") || rawMessage.includes("missing identity token")) {
    return "Apple sign-in failed. Please try again.";
  }

  return null;
}