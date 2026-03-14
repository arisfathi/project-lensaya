import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { Camera } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useAuth, getAuthErrorMessage } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { publicApi } from "../lib/api";
import { getRoleHomePath } from "../lib/roles";

const REFERRAL_STORAGE_KEY = "lensaya_referral_code";
const VISITOR_ID_STORAGE_KEY = "lensaya_visitor_id";

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

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signup, googleAuth } = useAuth();
  const { success, error } = useToast();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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
      if (visitorId) {
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
      success("Account created with Google successfully.");
      navigate(redirect || getRoleHomePath(user.role), { replace: true });
    } catch (err) {
      error(getAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-cyan-500 to-cyan-600 relative overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1752650735608-6895f65de119?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaG90b2dyYXBoZXIlMjB3b3Jrc3BhY2UlMjBhZXN0aGV0aWN8ZW58MXx8fHwxNzcyOTQ0OTg3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Photography workspace"
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <h2 className="text-4xl font-bold mb-4">Launch your photography website in minutes</h2>
          <p className="text-xl text-cyan-50">Join photographers showcasing their work on Lensaya</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <Camera className="w-8 h-8 text-cyan-500" />
            <span className="text-2xl font-semibold text-slate-900">Lensaya</span>
          </Link>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Create your account</h1>
              <p className="text-slate-600">Get started with your free pages site</p>
            </div>

            <div className="mb-6">
              {googleClientId ? (
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={(credentialResponse) => {
                      void handleGoogleSuccess(credentialResponse);
                    }}
                    onError={() => error("Google sign-up failed. Please try again.")}
                    text="continue_with"
                    shape="rectangular"
                    theme="outline"
                    size="large"
                    width="350"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => error("VITE_GOOGLE_CLIENT_ID is missing in frontend .env.")}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-300 rounded-lg transition-colors bg-white"
                >
                  <span className="font-medium text-slate-700">Google sign-up unavailable</span>
                </button>
              )}
              {googleLoading ? <p className="text-xs text-slate-500 mt-2 text-center">Signing up with Google...</p> : null}
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">or continue with email</span>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all ${
                    errors.fullName ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errors.fullName ? <p className="text-xs text-red-600 mt-1">{errors.fullName}</p> : null}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all ${
                    errors.email ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errors.email ? <p className="text-xs text-red-600 mt-1">{errors.email}</p> : null}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all ${
                    errors.password ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errors.password ? <p className="text-xs text-red-600 mt-1">{errors.password}</p> : null}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-500 text-white py-3 rounded-lg hover:bg-cyan-600 transition-colors font-medium disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Start Free"}
              </button>
            </form>

            <p className="text-center text-sm text-slate-600 mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-cyan-500 font-medium hover:text-cyan-600">
                Log in
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-slate-500 mt-6">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
