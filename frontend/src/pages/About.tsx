import { useEffect, useState } from "react";
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

export default function About() {
  const [items, setItems] = useState<CmsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useSeoMeta({
    title: "About | Lensaya",
    description: "Learn about Lensaya and how we help photographers build premium portfolio experiences.",
    canonicalUrl: buildAppUrl("/about"),
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await publicApi.content({ section: "ABOUT", limit: 50 });
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
        <section className="mx-auto max-w-5xl px-4 pb-14 pt-10 sm:px-6 sm:pt-16 lg:px-8">
          <div className="brand-panel rounded-[32px] border border-white/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10 lg:p-12">
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">About Lensaya</h1>
            <p className="mt-4 text-lg text-slate-600">Platform story, mission, and product direction.</p>
          </div>

          <div className="mt-8 space-y-5">
            {loading ? <p className="text-sm text-slate-600">Loading about content...</p> : null}
            {!loading && items.length === 0 ? (
              <p className="text-sm text-slate-600">No published about content yet. Add entries from Admin Content CMS.</p>
            ) : null}
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
        </section>
      </main>
      <Footer />
    </div>
  );
}
