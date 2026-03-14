import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Camera } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { authApi, getApiErrorMessage } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const { success, error } = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      setErrorText("Email is required");
      return;
    }

    try {
      setLoading(true);
      setErrorText(null);
      const result = await authApi.forgotPassword({ email: email.trim() });
      setSubmitted(true);
      success(result.message || "If that email exists, reset instructions were sent.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to request password reset"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-cyan-500 to-cyan-600 relative overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
            alt="Reset password"
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <h2 className="text-4xl font-bold mb-4">Reset your password</h2>
          <p className="text-xl text-cyan-50">We will send secure reset instructions to your email</p>
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
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Forgot your password?</h1>
              <p className="text-slate-600">Enter your account email to receive reset instructions.</p>
            </div>

            {submitted ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                Reset instructions were sent if the email exists in our system.
              </div>
            ) : null}

            <form className="space-y-4 mt-4" onSubmit={handleSubmit}>
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
                    errorText ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errorText ? <p className="text-xs text-red-600 mt-1">{errorText}</p> : null}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-500 text-white py-3 rounded-lg hover:bg-cyan-600 transition-colors font-medium disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send Reset Link"}
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
