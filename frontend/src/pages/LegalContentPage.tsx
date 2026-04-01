import { useMemo } from "react";
import { useEffect, useState } from "react";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { MarkdownContent } from "../components/content/MarkdownContent";
import { publicApi } from "../lib/api";
import { buildAppUrl } from "../lib/platform";
import { useSeoMeta } from "../lib/seo";

type LegalContentPageProps = {
  slug: "privacy-policy" | "terms-of-service" | "cookie-policy";
  title: string;
  description: string;
  path: string;
};

type CmsItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentMarkdown: string;
};

export function LegalContentPage({ slug, title, description, path }: LegalContentPageProps) {
  const [items, setItems] = useState<CmsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useSeoMeta({ title: `${title} | Lensaya`, description, canonicalUrl: buildAppUrl(path) });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await publicApi.content({ section: "LEGAL", limit: 100 });
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

  const entry = useMemo(() => items.find((item) => item.slug === slug) || null, [items, slug]);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="brand-shell">
        <section className="mx-auto max-w-5xl px-4 pb-14 pt-10 sm:px-6 sm:pt-16 lg:px-8">
          <div className="brand-panel rounded-[32px] border border-white/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10 lg:p-12">
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">{entry?.title || title}</h1>
            <p className="mt-4 text-lg text-slate-600">{entry?.excerpt || description}</p>
          </div>

          <div className="mt-8 rounded-[24px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            {loading ? <p className="text-sm text-slate-600">Loading legal content...</p> : null}
            {!loading && !entry ? (
              <p className="text-sm text-slate-600">No published legal content found for this page. Add it in Admin Content CMS.</p>
            ) : null}
            {entry ? <MarkdownContent markdown={entry.contentMarkdown} /> : null}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
