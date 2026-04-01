import { useEffect, useMemo, useState } from "react";
import { BookOpen, Compass, FileText, LifeBuoy } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { buildAppUrl } from "../lib/platform";
import { publicApi } from "../lib/api";
import { useSeoMeta } from "../lib/seo";

type CmsSection = "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES";

type CmsItem = {
  id: string;
  section: CmsSection;
  slug: string;
  title: string;
  excerpt: string | null;
  contentMarkdown: string;
  sortOrder: number;
  publishedAt: string | null;
  updatedAt: string;
};

const sectionCards = [
  {
    section: "HELP_CENTER" as const,
    title: "Help Center",
    href: "/help-center",
    description: "Product setup, account troubleshooting, and workflow FAQs for photographers.",
    icon: LifeBuoy,
  },
  {
    section: "GUIDES" as const,
    title: "Guides",
    href: "/guides",
    description: "Step-by-step playbooks for onboarding, portfolio optimization, and booking conversion.",
    icon: Compass,
  },
  {
    section: "BLOG" as const,
    title: "Blog",
    href: "/blog",
    description: "Product updates, growth strategies, and studio operation insights from the Lensaya team.",
    icon: FileText,
  },
];

export default function Resources() {
  const [items, setItems] = useState<CmsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useSeoMeta({
    title: "Resources | Lensaya",
    description: "Browse Lensaya resources: Help Center, Guides, and Blog content for photographers.",
    canonicalUrl: buildAppUrl("/resources"),
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await publicApi.content({ limit: 100 });
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

  const latestBySection = useMemo(() => {
    const map = new Map<CmsSection, CmsItem>();
    for (const item of items) {
      if (!map.has(item.section)) {
        map.set(item.section, item);
      }
    }
    return map;
  }, [items]);

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
                <BookOpen className="h-3.5 w-3.5" />
                Resource Hub
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Everything photographers need to move faster
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                Use our documentation, strategy guides, and update posts to launch and improve your Lensaya site with
                fewer bottlenecks.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {sectionCards.map((card) => {
              const Icon = card.icon;
              const latest = latestBySection.get(card.section);
              return (
                <Link
                  key={card.title}
                  to={card.href}
                  className="group rounded-[24px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-cyan-200"
                >
                  <div className="inline-flex rounded-xl bg-cyan-50 p-2 text-cyan-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-slate-950">{card.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{card.description}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {loading
                      ? "Loading latest content..."
                      : latest?.title
                        ? `Latest: ${latest.title}`
                        : "No published content yet."}
                  </p>
                  <p className="mt-4 text-sm font-semibold text-cyan-700 transition-colors group-hover:text-cyan-600">
                    Explore
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
