import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Camera } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
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
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-cyan-500 to-cyan-600 relative overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1515879218367-8466d910aaa4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
            alt="Secure password reset"
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <h2 className="text-4xl font-bold mb-4">Create a new password</h2>
          <p className="text-xl text-cyan-50">Use a strong password to secure your account</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <Camera className="w-8 h-8 text-cyan-500" />
            <span className="text-2xl font-semibold text-slate-900">Lensaya</span>
          </Link>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Reset password</h1>
              <p className="text-slate-600">Set a new password for your account.</p>
            </div>

            {errors.token ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-4">
                {errors.token}
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all ${
                    errors.newPassword ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errors.newPassword ? <p className="text-xs text-red-600 mt-1">{errors.newPassword}</p> : null}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all ${
                    errors.confirmPassword ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errors.confirmPassword ? <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p> : null}
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-cyan-500 text-white py-3 rounded-lg hover:bg-cyan-600 transition-colors font-medium disabled:opacity-60"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <p className="text-center text-sm text-slate-600 mt-6">
              Back to{" "}
              <Link to="/login" className="text-cyan-500 font-medium hover:text-cyan-600">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
