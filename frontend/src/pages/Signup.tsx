import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { CredentialResponse } from "@react-oauth/google";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { BrandWordmark } from "../components/BrandWordmark";
import { SocialAuthSection } from "../components/auth/SocialAuthSection";
import { useAuth, getAuthErrorMessage } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { publicApi } from "../lib/api";
import { getRoleHomePath } from "../lib/roles";
import { trackSignUp, setExternalUserID } from "../lib/metaPixel";
import {
  getAppleSignInConfig,
  getAppleSignInErrorMessage,
  isAppleSignInReady,
  signInWithApple,
} from "../lib/appleSignIn";

const REFERRAL_STORAGE_KEY = "lensaya_referral_code";
const VISITOR_ID_STORAGE_KEY = "lensaya_visitor_id";
const REFERRAL_TRACK_SESSION_PREFIX = "lensaya_referral_tracked";

const createVisitorId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `visitor_${crypto.randomUUID()}`;
  }
  return `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const getOrCreateVisitorId = () => {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY) || "";
  if (existing) return existing;

  const created = createVisitorId();
  window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, created);
  return created;
};

const getReferralTrackSessionKey = (referralCode: string, visitorId: string) =>
  `${REFERRAL_TRACK_SESSION_PREFIX}:${referralCode}:${visitorId}`;

const hasTrackedReferralClick = (referralCode: string, visitorId: string) => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(getReferralTrackSessionKey(referralCode, visitorId)) === "1";
};

const markTrackedReferralClick = (referralCode: string, visitorId: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(getReferralTrackSessionKey(referralCode, visitorId), "1");
};

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signup, googleAuth, appleAuth } = useAuth();
  const { success, error } = useToast();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const appleConfig = getAppleSignInConfig();
  const appleReady = isAppleSignInReady(appleConfig);

  const redirect = searchParams.get("redirect");

  const readStoredReferralCode = () => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(REFERRAL_STORAGE_KEY) || "";
  };

  const clearStoredReferralCode = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
    setReferralCode("");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const codeFromQuery = searchParams.get("ref");
    if (codeFromQuery && codeFromQuery.trim()) {
      const normalizedCode = codeFromQuery.trim();
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, normalizedCode);
      setReferralCode(normalizedCode);
      const visitorId = getOrCreateVisitorId();
      if (visitorId && !hasTrackedReferralClick(normalizedCode, visitorId)) {
        markTrackedReferralClick(normalizedCode, visitorId);
        void publicApi
          .trackReferral({
            referralCode: normalizedCode,
            visitorId,
          })
          .catch(() => undefined);
      }
      return;
    }

    setReferralCode(readStoredReferralCode());
  }, [searchParams]);

  const validate = () => {
    const nextErrors: { fullName?: string; email?: string; password?: string } = {};

    if (fullName.trim().length < 2) {
      nextErrors.fullName = "Full name must be at least 2 characters";
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required";
    }

    if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);
      const activeReferralCode = referralCode || readStoredReferralCode();
      const user = await signup({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        referralCode: activeReferralCode || undefined,
      });
      clearStoredReferralCode();
      // Track signup in Meta Pixel
      trackSignUp({
        email: email.trim(),
        referral_source: activeReferralCode || undefined,
      });
      setExternalUserID(user.id);


      success("Account created. Welcome to Lensaya.");
      navigate(redirect || getRoleHomePath(user.role), { replace: true });
    } catch (err) {
      error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      error("Google sign-up failed. Missing ID token.");
      return;
    }

    try {
      setGoogleLoading(true);
      const activeReferralCode = referralCode || readStoredReferralCode();
      const user = await googleAuth(credentialResponse.credential, activeReferralCode || undefined);
      clearStoredReferralCode();

      // Track signup completion in Meta Pixel.
      trackSignUp({
        email: user.email,
        referral_source: activeReferralCode || undefined,
      });
      setExternalUserID(user.id);

      success("Account created with Google successfully.");
      navigate(redirect || getRoleHomePath(user.role), { replace: true });
    } catch (err) {
      error(getAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };


  const handleAppleSignup = async () => {
    if (!appleReady) {
      error("Apple sign-in is not configured for this environment.");
      return;
    }

    try {
      setAppleLoading(true);
      const activeReferralCode = referralCode || readStoredReferralCode();
      const result = await signInWithApple({
        clientId: appleConfig.clientId,
        redirectUri: appleConfig.redirectUri,
      });
      const user = await appleAuth(result.idToken, {
        code: result.code,
        fullName: result.fullName,
        referralCode: activeReferralCode || undefined,
      });
      clearStoredReferralCode();

      trackSignUp({
        email: user.email,
        referral_source: activeReferralCode || undefined,
      });
      setExternalUserID(user.id);

      success("Account created with Apple successfully.");
      navigate(redirect || getRoleHomePath(user.role), { replace: true });
    } catch (err) {
      error(getAppleSignInErrorMessage(err) || getAuthErrorMessage(err));
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row brand-shell">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-900 to-slate-900 text-white lg:flex lg:w-1/2">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1752650735608-6895f65de119?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaG90b2dyYXBoZXIlMjB3b3Jrc3BhY2UlMjBhZXN0aGV0aWN8ZW58MXx8fHwxNzcyOTQ0OTg3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Photography workspace"
            className="h-full w-full object-cover opacity-20"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/50 via-slate-900/20 to-cyan-900/40" />
        <div className="relative z-10 flex flex-col justify-center px-12">
          <BrandWordmark className="mb-12 gap-4 text-white" iconClassName="h-16 w-16 sm:h-20 sm:w-20" textClassName="text-6xl font-black leading-none sm:text-7xl" />
          <h2 className="mb-4 text-4xl font-bold">Launch your photography website in minutes</h2>
          <p className="text-xl text-cyan-50/90">Join photographers showcasing their work on Lensaya</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-12 flex justify-center text-slate-900">
            <BrandWordmark className="gap-4 text-slate-900" iconClassName="h-14 w-14 sm:h-16 sm:w-16" textClassName="text-6xl font-black leading-none sm:text-7xl" />
          </Link>

          <div className="brand-panel rounded-3xl border border-slate-200/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            <div className="mb-8">
              <h1 className="mb-2 text-2xl font-bold text-slate-900">Create your account</h1>
              <p className="text-slate-600">Get started with your free pages site</p>
              {referralCode ? (
                <div className="mt-4 rounded-lg border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                  You have been invited to Lensaya. Start your 14-day Pro trial as soon as your account is created. If you become a paying customer later, your referrer will receive a 1-month extension.
                </div>
              ) : null}
            </div>

            <SocialAuthSection
              className="mb-6"
              googleClientId={googleClientId}
              appleEnabled={appleReady}
              googleText="Sign up with Google"
              appleText="Sign up with Apple"
              onGoogleSuccess={(credentialResponse) => {
                void handleGoogleSuccess(credentialResponse);
              }}
              onGoogleError={() => error("Google sign-up failed. Please try again.")}
              onAppleClick={() => {
                void handleAppleSignup();
              }}
              googleLoading={googleLoading}
              googleLoadingLabel="Signing up with Google..."
              googleUnavailableLabel="Google sign-up unavailable"
              onGoogleUnavailableClick={() => error("VITE_GOOGLE_CLIENT_ID is missing in frontend .env.")}
              appleLoading={appleLoading}
            />

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-4 text-slate-500">or continue with email</span>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  className={`w-full rounded-lg border px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-cyan-500 ${
                    errors.fullName ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errors.fullName ? <p className="mt-1 text-xs text-red-600">{errors.fullName}</p> : null}
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={`w-full rounded-lg border px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-cyan-500 ${
                    errors.email ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password"
                  className={`w-full rounded-lg border px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-cyan-500 ${
                    errors.password ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password}</p> : null}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 py-3 font-medium text-white shadow-sm transition-all hover:from-cyan-400 hover:to-sky-400 hover:shadow-md disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-cyan-500 hover:text-cyan-600">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
      );
    }

      