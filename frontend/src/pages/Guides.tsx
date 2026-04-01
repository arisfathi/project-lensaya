import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck, ChartSpline, LayoutTemplate, WandSparkles } from "lucide-react";
import { Link } from "react-router-dom";
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
};

const guideIcons = [LayoutTemplate, ChartSpline, WandSparkles];

export default function Guides() {
  const [items, setItems] = useState<CmsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useSeoMeta({
    title: "Guides | Lensaya",
    description: "Step-by-step Lensaya guides for setup, conversion optimization, and portfolio growth.",
    canonicalUrl: buildAppUrl("/guides"),
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await publicApi.content({ section: "GUIDES", limit: 50 });
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
                <BookOpenCheck className="h-3.5 w-3.5" />
                Step-by-Step Guides
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Practical playbooks to run your studio better
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                Choose a track based on your current stage, then apply one guide at a time for measurable progress.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          {loading ? <p className="text-sm text-slate-600">Loading guides...</p> : null}
          {!loading && items.length === 0 ? (
            <p className="text-sm text-slate-600">No published guides yet. Add entries from Admin Content CMS.</p>
          ) : null}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {items.map((guide, index) => {
              const Icon = guideIcons[index % guideIcons.length];
              return (
                <article
                  key={guide.id}
                  className="rounded-[24px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
                >
                  <div className="inline-flex rounded-xl bg-cyan-50 p-2 text-cyan-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-slate-950">{guide.title}</h2>
                  {guide.excerpt ? <p className="mt-2 text-sm leading-7 text-slate-600">{guide.excerpt}</p> : null}
                  <div className="mt-4 rounded-xl border border-cyan-100/70 bg-cyan-50/40 p-4">
                    <MarkdownContent markdown={guide.contentMarkdown} />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-8 rounded-[24px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-slate-600">Looking for all reference material in one place?</p>
            <Link
              to="/resources"
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 transition-colors hover:text-cyan-600"
            >
              Browse the full resource hub
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
