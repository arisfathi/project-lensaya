import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { BrandWordmark } from "../components/BrandWordmark";
import { authApi, getApiErrorMessage } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string; token?: string }>({});

  const validate = () => {
    const next: { newPassword?: string; confirmPassword?: string; token?: string } = {};
    if (!token) {
      next.token = "Reset token is missing. Open the link from your email.";
    }
    if (newPassword.length < 8) {
      next.newPassword = "Password must be at least 8 characters";
    }
    if (confirmPassword !== newPassword) {
      next.confirmPassword = "Passwords do not match";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);
      await authApi.resetPassword({ token, newPassword });
      success("Password reset successful. You can now log in.");
      navigate("/login", { replace: true });
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row brand-shell">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-900 to-slate-900 text-white lg:flex lg:w-1/2">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1515879218367-8466d910aaa4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
            alt="Secure password reset"
            className="h-full w-full object-cover opacity-20"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/50 via-slate-900/20 to-cyan-900/40" />
        <div className="relative z-10 flex flex-col justify-center px-12">
          <BrandWordmark className="mb-8 text-white" />
          <h2 className="mb-4 text-4xl font-bold">Create a new password</h2>
          <p className="text-xl text-cyan-50/90">Use a strong password to secure your account</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 text-slate-900">
            <BrandWordmark />
          </Link>

          <div className="brand-panel rounded-3xl border border-slate-200/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            <div className="mb-6">
              <h1 className="mb-2 text-2xl font-bold text-slate-900">Reset password</h1>
              <p className="text-slate-600">Set a new password for your account.</p>
            </div>

            {errors.token ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {errors.token}
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-slate-700">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                  className={`w-full rounded-lg border px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-cyan-500 ${
                    errors.newPassword ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errors.newPassword ? <p className="mt-1 text-xs text-red-600">{errors.newPassword}</p> : null}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-700">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  className={`w-full rounded-lg border px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-cyan-500 ${
                    errors.confirmPassword ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errors.confirmPassword ? <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p> : null}
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 py-3 font-medium text-white shadow-sm transition-all hover:from-cyan-400 hover:to-sky-400 hover:shadow-md disabled:opacity-60"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Back to{" "}
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
