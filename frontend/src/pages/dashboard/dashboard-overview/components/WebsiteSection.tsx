import { Copy, ExternalLink, Share2 } from "lucide-react";

type WebsiteSectionProps = {
  data: {
    websiteLink: string;
    websiteError: string | null;
  };
  actions: {
    onCopyLink: () => void;
    onShareLink: () => void;
  };
};

export function WebsiteSection({ data, actions }: WebsiteSectionProps) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:mb-8 sm:rounded-xl sm:border-gray-200 sm:p-6 sm:shadow-sm">
      <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Website</h3>
      <p className="mt-1 text-xs text-slate-600 sm:text-sm">Share your public website with clients.</p>
      {data.websiteError ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:text-sm">
          Website summary is unavailable right now. Showing fallback URL.
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50/80 px-3 py-3 sm:mt-4 sm:rounded-lg sm:p-4">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Website URL</p>
        <p className="mt-1.5 break-all text-xs font-semibold text-cyan-700 sm:mt-2 sm:text-base sm:font-medium">{data.websiteLink}</p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:flex sm:flex-wrap sm:gap-2">
        <a
          href={data.websiteLink}
          target="_blank"
          rel="noopener noreferrer"
          className="col-span-3 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 sm:col-span-1 sm:bg-cyan-500 sm:px-4 sm:text-sm sm:hover:bg-cyan-600"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View Website</span>
        </a>
        <button
          type="button"
          onClick={actions.onCopyLink}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-gray-50 sm:gap-2 sm:px-4 sm:text-sm"
        >
          <Copy className="w-4 h-4" />
          <span>Copy Link</span>
        </button>
        <button
          type="button"
          onClick={actions.onShareLink}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-gray-50 sm:gap-2 sm:px-4 sm:text-sm"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
}
