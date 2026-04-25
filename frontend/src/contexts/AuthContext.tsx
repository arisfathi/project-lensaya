/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, getApiErrorMessage } from "../lib/api";
import { clearAuthTokens } from "../lib/auth";
import { PUBLIC_DIRECTORY_ENABLED } from "../lib/marketingFlags";
import { isActualPublicSiteHostCandidate } from "../lib/platform";
import { clearUserData } from "../lib/metaPixel";

type AuthUser = {
  id: string;
  role: string;
  fullName: string;
  email: string;
  emailVerifiedAt: string | null;
  username: string | null;
  plan: string | null;
  status: string;
  leadFeatures?: {
    plan: string;
    filters: boolean;
    export: boolean;
    reminders: boolean;
    historyDays: number;
    maxVisibleLeads: number;
    advancedAnalytics: boolean;
    templatePack: string;
    templateLimit: number;
    channels: {
      whatsapp: boolean;
      email: boolean;
    };
    upgradeTarget: string | null;
  };
  entitlements?: {
    name: string;
    displayName?: string;
    upgradeTarget: string | null;
    limits?: {
      maxServices?: number;
      maxPortfolioImages?: number;
      maxPackagesPerService?: number;
      maxStorageBytes?: number;
    };
    features?: {
      analyticsEnabled?: boolean;
      customDomainEnabled?: boolean;
      hideBrandingEnabled?: boolean;
      leadFiltersEnabled?: boolean;
      leadExportEnabled?: boolean;
      leadRemindersEnabled?: boolean;
      teamToolsEnabled?: boolean;
    };
  };
  planFeatures?: {
    teamSectionTools: boolean;
    hideBrandingEnabled?: boolean;
    customDomainEnabled?: boolean;
    analyticsEnabled?: boolean;
  };
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  signup: (input: { fullName: string; email: string; password: string; referralCode?: string }) => Promise<AuthUser>;
  googleAuth: (idToken: string, referralCode?: string) => Promise<AuthUser>;
  appleAuth: (idToken: string, options?: { code?: string; fullName?: string; referralCode?: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isGoogleRedirectReferrer = () => {
  if (typeof document === "undefined" || !document.referrer) return false;
  try {
    const host = new URL(document.referrer).hostname;
    return host === "accounts.google.com" || host.endsWith(".accounts.google.com");
  } catch {
    return false;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const fetchUserProfile = useCallback(async (options: { silent?: boolean } = {}) => {
    try {
      const me = await authApi.me();
      setUser(me);
      return me;
    } catch (error) {
      setUser(null);
      if (options.silent) {
        return null;
      }
      throw error;
    }
  }, []);

  const refreshUser = useCallback(async () => fetchUserProfile({ silent: true }), [fetchUserProfile]);

  const ensureUserAfterAuth = useCallback(
    async (provider: string, options: { profileDelayMs?: number } = {}) => {
      const profileDelayMs = Math.max(0, Number(options.profileDelayMs || 0));
      if (profileDelayMs > 0) {
        // Allow the browser time to persist auth cookies before /auth/me.
        await wait(profileDelayMs);
      }

      let firstProfileError = null;
      try {
        const profile = await fetchUserProfile();
        if (profile) return profile;
      } catch (error) {
        firstProfileError = error;
      }

      let refreshError = null;
      try {
        await authApi.refresh();
      } catch (error) {
        refreshError = error;
        // Ignore and retry /auth/me once more for better resilience.
      }

      const retriedProfile = await fetchUserProfile();
      if (retriedProfile) {
        return retriedProfile;
      }

      throw (
        firstProfileError ||
        refreshError ||
        new Error(`Unable to load user profile after ${provider}`)
      );
    },
    [fetchUserProfile]
  );

  useEffect(() => {
    let canceled = false;
      const bootstrap = async () => {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      const isPublicMarketingRoute =
        pathname === "/" ||
        pathname === "/pricing" ||
        (PUBLIC_DIRECTORY_ENABLED && pathname === "/photographers");

      if (isActualPublicSiteHostCandidate() || isPublicMarketingRoute) {
        clearAuthTokens();
        setUser(null);
        setIsBootstrapping(false);
        return;
      }

      try {
        if (isGoogleRedirectReferrer()) {
          await wait(500);
        }
        await refreshUser();
      } catch {
        if (!canceled) {
          clearAuthTokens();
          setUser(null);
        }
      } finally {
        if (!canceled) {
          setIsBootstrapping(false);
        }
      }
    };
    bootstrap();
    return () => {
      canceled = true;
    };
  }, [refreshUser]);

  const login = useCallback(async (input: { email: string; password: string }) => {
    await authApi.login(input);
    return ensureUserAfterAuth("login");
  }, [ensureUserAfterAuth]);

  const signup = useCallback(async (input: { fullName: string; email: string; password: string; referralCode?: string }) => {
    await authApi.signup(input);
    return ensureUserAfterAuth("signup");
  }, [ensureUserAfterAuth]);

  const googleAuth = useCallback(async (idToken: string, referralCode?: string) => {
    await authApi.google({ idToken, referralCode });
    return ensureUserAfterAuth("Google login", { profileDelayMs: 500 });
  }, [ensureUserAfterAuth]);
  const appleAuth = useCallback(
    async (idToken: string, options: { code?: string; fullName?: string; referralCode?: string } = {}) => {
      await authApi.apple({ idToken, code: options.code, fullName: options.fullName, referralCode: options.referralCode });
      return ensureUserAfterAuth("Apple login", { profileDelayMs: 500 });
    },
    [ensureUserAfterAuth]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API failures and clear local session anyway.
    } finally {
      clearAuthTokens();
      clearUserData();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      signup,
      googleAuth,
      appleAuth,
      logout,
      refreshUser,
    }),
    [appleAuth, googleAuth, isBootstrapping, login, logout, refreshUser, signup, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function getAuthErrorMessage(error: unknown) {
  return getApiErrorMessage(error, "Authentication failed");
}

