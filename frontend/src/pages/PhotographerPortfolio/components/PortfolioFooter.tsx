import { Camera } from "lucide-react";

type PortfolioFooterProps = {
  showLensayaBranding: boolean;
  appHomeUrl: string;
  themeColor: string;
  studioName: string;
};

export function PortfolioFooter({ showLensayaBranding, appHomeUrl, themeColor, studioName }: PortfolioFooterProps) {
  return (
    <>
      {showLensayaBranding ? (
        <section className="py-12 sm:py-16 bg-white border-t border-[var(--theme-color-border)]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Want a portfolio like this?</h2>
            <p className="text-slate-600 mb-6">Create yours in minutes with Lensaya.</p>
            <a
              href={appHomeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-white font-medium transition-colors"
              style={{ backgroundColor: themeColor }}
            >
              Create your own portfolio
            </a>
          </div>
        </section>
      ) : null}

      <footer className="bg-slate-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          {showLensayaBranding ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Camera className="w-5 h-5 text-[var(--theme-color)]" />
                <span className="font-semibold">Powered by Lensaya</span>
              </div>
              <a
                href={appHomeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-cyan-300 hover:text-cyan-200 transition-colors mb-4"
              >
                Create your own portfolio -&gt;
              </a>
            </>
          ) : null}
          <p className="text-slate-400 text-sm">
            www.lensaya.com
            <br />
            Copyright 2026 {studioName}. All rights reserved.
          </p>
        </div>
      </footer>

      {showLensayaBranding ? (
        <a
          href={appHomeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 z-30 rounded-full border border-[var(--theme-color-border)] bg-white/85 backdrop-blur px-4 py-2 text-sm font-medium text-slate-700 shadow-lg hover:text-slate-900 hover:border-[var(--theme-color)] transition-colors"
        >
          {"\u{1F4F7} Made with Lensaya"}
        </a>
      ) : null}
    </>
  );
}
