import { useEffect, useState } from "react";
import { LifeBuoy, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { MarkdownContent } from "../components/content/MarkdownContent";
import { publicApi } from "../lib/api";
import { buildAppUrl } from "../lib/platform";
import { useSeoMeta } from "../lib/seo";

type CmsItem = {
  id: string;
  title: string;
  excerpt: string | null;
  contentMarkdown: string;
  updatedAt: string;
};

export default function HelpCenter() {
  const [items, setItems] = useState<CmsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useSeoMeta({
    title: "Help Center | Lensaya",
    description: "Find answers for setup, billing, and workflow questions in the Lensaya Help Center.",
    canonicalUrl: buildAppUrl("/help-center"),
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await publicApi.content({ section: "HELP_CENTER", limit: 50 });
        if (!mounted) return;
        setItems((result.items || []) as CmsItem[]);
      } catch {
        if (!mounted) return;
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="brand-shell">
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16 lg:px-8">
          <div className="brand-panel relative overflow-hidden rounded-[32px] border border-white/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10 lg:p-12">
            <div className="absolute right-[-8%] top-[-18%] h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute bottom-[-20%] left-[-10%] h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                <LifeBuoy className="h-3.5 w-3.5" />
                Help Center
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Answers for your day-to-day operations
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                Use this page as your first stop for onboarding, account setup, and booking workflow support.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          {loading ? <p className="text-sm text-slate-600">Loading help articles...</p> : null}
          {!loading && items.length === 0 ? (
            <p className="text-sm text-slate-600">No published help content yet. Add entries from Admin Content CMS.</p>
          ) : null}

          <div className="space-y-5">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-[24px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
              >
                <h2 className="text-2xl font-bold text-slate-950">{item.title}</h2>
                {item.excerpt ? <p className="mt-2 text-sm text-slate-600">{item.excerpt}</p> : null}
                <div className="mt-4 rounded-xl border border-cyan-100/70 bg-cyan-50/40 p-4">
                  <MarkdownContent markdown={item.contentMarkdown} />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 text-cyan-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Need account-specific support?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Contact Lensaya support from your dashboard for tenant-specific troubleshooting and billing questions.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <MessageCircleQuestion className="h-4 w-4" />
              This page renders published Markdown entries from your CMS.
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
