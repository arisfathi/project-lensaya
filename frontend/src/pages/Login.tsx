import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { CredentialResponse } from "@react-oauth/google";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { BrandWordmark } from "../components/BrandWordmark";
import { SocialAuthSection } from "../components/auth/SocialAuthSection";
import { useAuth, getAuthErrorMessage } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getRoleHomePath } from "../lib/roles";
import { trackLogin, setExternalUserID } from "../lib/metaPixel";
import {
  getAppleSignInConfig,
  getAppleSignInErrorMessage,
  isAppleSignInReady,
  signInWithApple,
} from "../lib/appleSignIn";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, googleAuth, appleAuth } = useAuth();
  const { success, error } = useToast();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const appleConfig = getAppleSignInConfig();
  const appleReady = isAppleSignInReady(appleConfig);

  const redirect = searchParams.get("redirect");

  const validate = () => {
    const nextErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required";
    }

    if (!password.trim()) {
      nextErrors.password = "Password is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);
      const user = await login({ email: email.trim(), password });

      // Track login in Meta Pixel.
      trackLogin({ email: email.trim() });
      setExternalUserID(user.id);

      success("Welcome back. You are now logged in.");
      navigate(redirect || getRoleHomePath(user.role), { replace: true });
    } catch (err) {
      error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      error("Google login failed. Missing ID token.");
      return;
    }

    try {
      setGoogleLoading(true);
      const user = await googleAuth(credentialResponse.credential);

      // Track successful login and sync external ID for matching.
      trackLogin({ email: user.email });
      setExternalUserID(user.id);

      success("Logged in with Google successfully.");
      navigate(redirect || getRoleHomePath(user.role), { replace: true });
    } catch (err) {
      error(getAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };


  const handleAppleLogin = async () => {
    if (!appleReady) {
      error("Apple sign-in is not configured for this environment.");
      return;
    }

    try {
      setAppleLoading(true);
      const result = await signInWithApple({
        clientId: appleConfig.clientId,
        redirectUri: appleConfig.redirectUri,
      });
      const user = await appleAuth(result.idToken, { code: result.code, fullName: result.fullName });

      trackLogin({ email: user.email });
      setExternalUserID(user.id);

      success("Logged in with Apple successfully.");
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
            src="https://images.unsplash.com/photo-1770365299688-d5ed70b2ad2b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaG90b2dyYXBoeSUyMGNhbWVyYSUyMGxlbnMlMjBjcmVhdGl2ZXxlbnwxfHx8fDE3NzI5NDQ5ODh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Photography camera and lens"
            className="h-full w-full object-cover opacity-20"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/50 via-slate-900/20 to-cyan-900/40" />
        <div className="relative z-10 flex flex-col justify-center px-12">
          <BrandWordmark className="mb-12 gap-4 text-white" iconClassName="h-16 w-16 sm:h-20 sm:w-20" textClassName="text-6xl font-black leading-none sm:text-7xl" />
          <h2 className="mb-4 text-4xl font-bold">Welcome back to Lensaya</h2>
          <p className="text-xl text-cyan-50/90">Continue building your photography portfolio</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-12 flex justify-center text-slate-900">
            <BrandWordmark className="gap-4 text-slate-900" iconClassName="h-14 w-14 sm:h-16 sm:w-16" textClassName="text-6xl font-black leading-none sm:text-7xl" />
          </Link>

          <div className="brand-panel rounded-3xl border border-slate-200/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            <div className="mb-8">
              <h1 className="mb-2 text-2xl font-bold text-slate-900">Log in to your account</h1>
              <p className="text-slate-600">Welcome back! Please enter your details</p>
            </div>

            <SocialAuthSection
              className="mb-6"
              googleClientId={googleClientId}
              appleEnabled={appleReady}
              googleText="Sign in with Google"
              appleText="Sign in with Apple"
              onGoogleSuccess={(credentialResponse) => {
                void handleGoogleSuccess(credentialResponse);
              }}
              onGoogleError={() => error("Google login failed. Please try again.")}
              onAppleClick={() => {
                void handleAppleLogin();
              }}
              googleLoading={googleLoading}
              googleLoadingLabel="Signing in with Google..."
              googleUnavailableLabel="Google login unavailable"
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
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-sm text-cyan-500 hover:text-cyan-600">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
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
                {loading ? "Logging in..." : "Log In"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Don't have an account?{" "}
              <Link to="/signup" className="font-medium text-cyan-500 hover:text-cyan-600">
                Start Free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
      );
    }

      





