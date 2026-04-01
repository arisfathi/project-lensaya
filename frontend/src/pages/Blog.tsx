import { useEffect, useState } from "react";
import { CalendarDays, FileText, Megaphone, Rocket } from "lucide-react";
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
  publishedAt: string | null;
};

const formatMonth = (value: string | null) => {
  if (!value) return "Unscheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

export default function Blog() {
  const [items, setItems] = useState<CmsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useSeoMeta({
    title: "Blog | Lensaya",
    description: "Product updates and portfolio growth insights from the Lensaya team.",
    canonicalUrl: buildAppUrl("/blog"),
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await publicApi.content({ section: "BLOG", limit: 50 });
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
                <Megaphone className="h-3.5 w-3.5" />
                Lensaya Blog
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Product updates and growth playbooks
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                Follow release notes, operational insights, and tactical improvements for photography businesses.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          {loading ? <p className="text-sm text-slate-600">Loading blog posts...</p> : null}
          {!loading && items.length === 0 ? (
            <p className="text-sm text-slate-600">No published blog posts yet. Add entries from Admin Content CMS.</p>
          ) : null}

          <div className="space-y-5">
            {items.map((post) => (
              <article
                key={post.id}
                className="rounded-[24px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
              >
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1">
                    <FileText className="h-3.5 w-3.5" />
                    Post
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatMonth(post.publishedAt)}
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-slate-950">{post.title}</h2>
                {post.excerpt ? <p className="mt-2 text-sm leading-7 text-slate-600">{post.excerpt}</p> : null}
                <div className="mt-4 rounded-xl border border-cyan-100/70 bg-cyan-50/40 p-4">
                  <MarkdownContent markdown={post.contentMarkdown} />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-slate-200/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
            <div className="flex items-center gap-3">
              <Rocket className="h-5 w-5 text-cyan-300" />
              <p className="text-sm text-slate-200">This blog is now driven by published CMS Markdown content from admin.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
