import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Camera, Search, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Header } from "../components/Header";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Footer } from "../components/Footer";
import { getApiErrorMessage, publicApi } from "../lib/api";
import { buildPublicStudioUrl } from "../lib/platform";

type DirectoryPhotographer = {
  username: string;
  studioName: string | null;
  imageUrl: string | null;
  bio?: string | null;
  category: string | null;
  location: string | null;
  city?: string | null;
  country?: string | null;
  specialty?: string | null;
  style?: string | null;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;

const defaultPagination: PaginationMeta = {
  page: DEFAULT_PAGE,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
};

const toPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : fallback;
};

const toShortBio = (photographer: DirectoryPhotographer) => {
  const fallback = [photographer.category, photographer.location]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" - ");

  const text = (photographer.bio || fallback || "Professional photographer on Lensaya.").trim();
  if (text.length <= 120) return text;
  return `${text.slice(0, 117).trimEnd()}...`;
};

export default function PhotographerDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => toPositiveInt(searchParams.get("page"), DEFAULT_PAGE), [searchParams]);
  const search = useMemo(() => String(searchParams.get("search") || "").trim(), [searchParams]);
  const city = useMemo(() => String(searchParams.get("city") || "").trim(), [searchParams]);
  const specialty = useMemo(() => String(searchParams.get("specialty") || "").trim(), [searchParams]);
  const minPrice = useMemo(() => String(searchParams.get("minPrice") || "").trim(), [searchParams]);
  const maxPrice = useMemo(() => String(searchParams.get("maxPrice") || "").trim(), [searchParams]);

  const [searchInput, setSearchInput] = useState(search);
  const [cityInput, setCityInput] = useState(city);
  const [specialtyInput, setSpecialtyInput] = useState(specialty);
  const [minPriceInput, setMinPriceInput] = useState(minPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPrice);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photographers, setPhotographers] = useState<DirectoryPhotographer[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(defaultPagination);

  const updateQuery = useCallback(
    (next: {
      page: number;
      search: string;
      city: string;
      specialty: string;
      minPrice: string;
      maxPrice: string;
    }) => {
      const params = new URLSearchParams(searchParams);
      params.set("page", String(Math.max(next.page, 1)));

      const normalizedSearch = next.search.trim();
      if (normalizedSearch) {
        params.set("search", normalizedSearch);
      } else {
        params.delete("search");
      }

      const normalizedCity = next.city.trim();
      if (normalizedCity) {
        params.set("city", normalizedCity);
      } else {
        params.delete("city");
      }

      const normalizedSpecialty = next.specialty.trim();
      if (normalizedSpecialty) {
        params.set("specialty", normalizedSpecialty);
      } else {
        params.delete("specialty");
      }

      const normalizedMinPrice = next.minPrice.trim();
      if (normalizedMinPrice) {
        params.set("minPrice", normalizedMinPrice);
      } else {
        params.delete("minPrice");
      }

      const normalizedMaxPrice = next.maxPrice.trim();
      if (normalizedMaxPrice) {
        params.set("maxPrice", normalizedMaxPrice);
      } else {
        params.delete("maxPrice");
      }

      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    setSearchInput(search);
    setCityInput(city);
    setSpecialtyInput(specialty);
    setMinPriceInput(minPrice);
    setMaxPriceInput(maxPrice);
  }, [city, maxPrice, minPrice, search, specialty]);

  useEffect(() => {
    let mounted = true;

    const loadDirectory = async () => {
      setLoading(true);
      try {
        const result = await publicApi.directory({
          page,
          limit: DEFAULT_LIMIT,
          search: search || undefined,
          city: city || undefined,
          specialty: specialty || undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
        });
        if (!mounted) return;

        const rows = (result.items || []) as DirectoryPhotographer[];
        const rawPagination = (result.pagination || {}) as Record<string, unknown>;
        const total = toPositiveInt(rawPagination.total, rows.length);
        const totalPages = toPositiveInt(rawPagination.totalPages, Math.max(1, Math.ceil(total / DEFAULT_LIMIT)));
        const currentPage = toPositiveInt(rawPagination.page, page);
        const limit = toPositiveInt(rawPagination.limit, DEFAULT_LIMIT);

        setPhotographers(rows);
        setPagination({
          page: currentPage,
          limit,
          total,
          totalPages,
        });
        setErrorMessage(null);
      } catch (err) {
        if (!mounted) return;
        setErrorMessage(getApiErrorMessage(err, "Unable to load photographers right now."));
        setPhotographers([]);
        setPagination({
          page,
          limit: DEFAULT_LIMIT,
          total: 0,
          totalPages: 1,
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadDirectory();

    return () => {
      mounted = false;
    };
  }, [city, maxPrice, minPrice, page, search, specialty]);

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery({
      page: 1,
      search: searchInput,
      city: cityInput,
      specialty: specialtyInput,
      minPrice: minPriceInput,
      maxPrice: maxPriceInput,
    });
  };

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const showingFrom = photographers.length === 0 ? 0 : (page - 1) * pagination.limit + 1;
  const showingTo = photographers.length === 0 ? 0 : showingFrom + photographers.length - 1;

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="brand-shell">
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16 lg:px-8">
          <div className="brand-panel relative overflow-hidden rounded-[32px] border border-white/70 px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:px-10 sm:py-10 lg:px-12 lg:py-12">
            <div className="absolute right-[-10%] top-[-20%] h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute left-[-10%] top-[40%] h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 shadow-sm">
                  <Camera className="h-3.5 w-3.5" />
                  Photographer directory
                </div>
                <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Discover photographers with a polished Lensaya presence.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                  Search by city, specialty, or budget and open a portfolio that feels premium from the first glance.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 shadow-sm">Search by studio</span>
                  <span className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 shadow-sm">Filter by city</span>
                  <span className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 shadow-sm">Open full portfolios</span>
                </div>
              </div>

              <div className="relative">
                <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">Live results</p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Showing</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{photographers.length}</p>
                    </div>
                    <div className="rounded-2xl bg-cyan-50 px-4 py-3 ring-1 ring-cyan-100">
                      <p className="text-xs uppercase tracking-[0.16em] text-cyan-700">Page</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{page}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{pagination.total}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Narrow the list with the search tools below, then jump straight into a photographer's portfolio.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur sm:p-6">
            <form className="space-y-4" onSubmit={onSearchSubmit}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by studio name or username..."
                  className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.04)] outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  type="text"
                  value={cityInput}
                  onChange={(event) => setCityInput(event.target.value)}
                  placeholder="City (e.g. KL)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.04)] outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                />
                <input
                  type="text"
                  value={specialtyInput}
                  onChange={(event) => setSpecialtyInput(event.target.value)}
                  placeholder="Specialty (e.g. Wedding)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.04)] outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                />
                <input
                  type="number"
                  min={0}
                  value={minPriceInput}
                  onChange={(event) => setMinPriceInput(event.target.value)}
                  placeholder="Min Price"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.04)] outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                />
                <input
                  type="number"
                  min={0}
                  value={maxPriceInput}
                  onChange={(event) => setMaxPriceInput(event.target.value)}
                  placeholder="Max Price"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.04)] outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(6,182,212,0.28)] transition hover:from-cyan-400 hover:to-sky-400"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Search
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setCityInput("");
                    setSpecialtyInput("");
                    setMinPriceInput("");
                    setMaxPriceInput("");
                    updateQuery({
                      page: 1,
                      search: "",
                      city: "",
                      specialty: "",
                      minPrice: "",
                      maxPrice: "",
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Clear
                </button>

                <p className="ml-auto text-sm text-slate-600">
                  Showing {showingFrom}-{showingTo} of {pagination.total} photographers
                </p>
              </div>
            </form>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={`loading-${index + 1}`} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                  <div className="aspect-[4/5] animate-pulse bg-slate-200/80" />
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-3/5 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
                    <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : errorMessage ? (
            <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-red-700 shadow-sm">{errorMessage}</div>
          ) : photographers.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-600 shadow-sm">
              <p className="text-lg font-semibold text-slate-900">No photographers found</p>
              <p className="mt-2 text-sm">Try a different search term or clear the filters.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {photographers.map((photographer) => {
                  const studioLabel = photographer.studioName || photographer.username;
                  const portfolioUrl = buildPublicStudioUrl(photographer.username);

                  return (
                    <article
                      key={photographer.username}
                      className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
                    >
                      <a href={portfolioUrl} className="block">
                        <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
                          {photographer.imageUrl ? (
                            <ImageWithFallback
                              src={photographer.imageUrl}
                              alt={studioLabel}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-400">
                              <Camera className="h-10 w-10" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/50 to-transparent" />
                        </div>
                      </a>

                      <div className="space-y-3 p-5">
                        <div>
                          <p className="text-lg font-bold text-slate-950">{studioLabel}</p>
                          <p className="mt-2 min-h-[2.75rem] text-sm leading-6 text-slate-600">{toShortBio(photographer)}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {photographer.city ? (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {photographer.city}
                            </span>
                          ) : null}
                          {photographer.specialty ? (
                            <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700">
                              {photographer.specialty}
                            </span>
                          ) : null}
                        </div>

                        <a
                          href={portfolioUrl}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-600 transition-colors hover:text-cyan-700"
                        >
                          View portfolio
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-10 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    updateQuery({
                      page: page - 1,
                      search,
                      city,
                      specialty,
                      minPrice,
                      maxPrice,
                    })
                  }
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 shadow-sm">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    updateQuery({
                      page: page + 1,
                      search,
                      city,
                      specialty,
                      minPrice,
                      maxPrice,
                    })
                  }
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
