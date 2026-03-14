import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { Camera } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useAuth, getAuthErrorMessage } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getRoleHomePath } from "../lib/roles";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, googleAuth } = useAuth();
  const { success, error } = useToast();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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
      success("Logged in with Google successfully.");
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
            src="https://images.unsplash.com/photo-1770365299688-d5ed70b2ad2b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaG90b2dyYXBoeSUyMGNhbWVyYSUyMGxlbnMlMjBjcmVhdGl2ZXxlbnwxfHx8fDE3NzI5NDQ5ODh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Photography camera and lens"
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <h2 className="text-4xl font-bold mb-4">Welcome back to Lensaya</h2>
          <p className="text-xl text-cyan-50">Continue building your photography portfolio</p>
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
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Log in to your account</h1>
              <p className="text-slate-600">Welcome back! Please enter your details</p>
            </div>

            <div className="mb-6">
              {googleClientId ? (
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={(credentialResponse) => {
                      void handleGoogleSuccess(credentialResponse);
                    }}
                    onError={() => error("Google login failed. Please try again.")}
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
                  <span className="font-medium text-slate-700">Google login unavailable</span>
                </button>
              )}
              {googleLoading ? <p className="text-xs text-slate-500 mt-2 text-center">Signing in with Google...</p> : null}
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
                <div className="flex items-center justify-between mb-1">
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
                {loading ? "Logging in..." : "Log In"}
              </button>
            </form>

            <p className="text-center text-sm text-slate-600 mt-6">
              Don't have an account?{" "}
              <Link to="/signup" className="text-cyan-500 font-medium hover:text-cyan-600">
                Start Free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
