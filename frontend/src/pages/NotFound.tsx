import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "../components/ui/Button";
import { useAuth } from "../contexts/AuthContext";
import { getRoleHomePath } from "../lib/roles";

export default function NotFound() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const dashboardPath = getRoleHomePath(user?.role);
  const primaryPath = isAuthenticated ? dashboardPath : "/";

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-200/70 via-cyan-100/60 to-sky-200/70 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-cyan-100 bg-white/95 p-8 shadow-xl backdrop-blur sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            <Compass className="h-4 w-4" />
            Page Not Found
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-6xl font-black tracking-tight text-slate-900 sm:text-7xl">404</p>
              <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">This page does not exist</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                The link may be outdated, the page may have moved, or the URL may be incorrect. Use the dashboard
                shortcut below to recover quickly.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={primaryPath} className="sm:min-w-[220px]">
                  <Button className="w-full">{isAuthenticated ? "Go back to dashboard" : "Go back home"}</Button>
                </Link>
                <Button
                  variant="secondary"
                  className="w-full sm:min-w-[180px]"
                  onClick={() => {
                    navigate(-1);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go back
                </Button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
              <p className="text-sm font-semibold text-slate-900">Quick recovery</p>
              <p className="mt-2 text-sm text-slate-600">
                Return to your main workspace and continue from a known route.
              </p>
              <div className="mt-5 rounded-xl border border-dashed border-cyan-200 bg-cyan-50/70 p-4">
                <p className="text-xs uppercase tracking-wide text-cyan-700">Recommended path</p>
                <p className="mt-2 break-all text-sm font-semibold text-slate-900">{primaryPath}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
