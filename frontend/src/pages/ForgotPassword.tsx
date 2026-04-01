import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { BrandWordmark } from "../components/BrandWordmark";
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
    <div className="min-h-screen flex flex-col lg:flex-row brand-shell">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-900 to-slate-900 text-white lg:flex lg:w-1/2">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
            alt="Reset password"
            className="h-full w-full object-cover opacity-20"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/50 via-slate-900/20 to-cyan-900/40" />
        <div className="relative z-10 flex flex-col justify-center px-12">
          <BrandWordmark className="mb-8 text-white" />
          <h2 className="mb-4 text-4xl font-bold">Reset your password</h2>
          <p className="text-xl text-cyan-50/90">We will send secure reset instructions to your email</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 text-slate-900">
            <BrandWordmark />
          </Link>

          <div className="brand-panel rounded-3xl border border-slate-200/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            <div className="mb-6">
              <h1 className="mb-2 text-2xl font-bold text-slate-900">Forgot your password?</h1>
              <p className="text-slate-600">Enter your account email to receive reset instructions.</p>
            </div>

            {submitted ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                Reset instructions were sent if the email exists in our system.
              </div>
            ) : null}

            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
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
                    errorText ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-cyan-500"
                  }`}
                />
                {errorText ? <p className="mt-1 text-xs text-red-600">{errorText}</p> : null}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 py-3 font-medium text-white shadow-sm transition-all hover:from-cyan-400 hover:to-sky-400 hover:shadow-md disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send Reset Link"}
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
