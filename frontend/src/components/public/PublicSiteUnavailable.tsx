import { AlertTriangle, ExternalLink, Globe } from "lucide-react";
import { buildAppUrl } from "../../lib/platform";

type Props = {
  resolutionStatus: "not_found" | "inactive" | "broken" | "upgrade_required" | string;
  studioName?: string | null;
  message?: string | null;
  failureReason?: string | null;
  fallbackUrl?: string | null;
  fallbackLabel?: string;
};

const getDefaultTitle = (resolutionStatus: Props["resolutionStatus"], studioName?: string | null) => {
  const label = studioName || "This site";
  if (resolutionStatus === "broken") {
    return `${label} is temporarily unavailable`;
  }
  if (resolutionStatus === "upgrade_required") {
    return `${label} is using its Lensaya fallback URL`;
  }
  if (resolutionStatus === "inactive") {
    return `${label} is not live yet`;
  }
  return `${label} could not be found`;
};

const getDefaultMessage = (resolutionStatus: Props["resolutionStatus"]) => {
  if (resolutionStatus === "broken") {
    return "This custom domain is currently failing verification or DNS resolution.";
  }
  if (resolutionStatus === "upgrade_required") {
    return "The custom domain is no longer active on the current plan. Use the fallback Lensaya URL instead.";
  }
  if (resolutionStatus === "inactive") {
    return "This custom domain is still being configured and is not serving the public site yet.";
  }
  return "This domain is not connected to an active public Lensaya portfolio.";
};

export function PublicSiteUnavailable({
  resolutionStatus,
  studioName,
  message,
  failureReason,
  fallbackUrl,
  fallbackLabel = "Open fallback Lensaya URL",
}: Props) {
  const appHomeUrl = buildAppUrl("/");
  const title = getDefaultTitle(resolutionStatus, studioName);
  const body = message || getDefaultMessage(resolutionStatus);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              <Globe className="h-4 w-4" />
              <span>Custom Domain</span>
            </div>
            <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">{body}</p>
            {failureReason ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {failureReason}
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              {fallbackUrl ? (
                <a
                  href={fallbackUrl}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>{fallbackLabel}</span>
                </a>
              ) : null}
              <a
                href={appHomeUrl}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
              >
                Return to Lensaya
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
