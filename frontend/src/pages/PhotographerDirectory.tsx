import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Camera, Search } from "lucide-react";
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
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="py-12 sm:py-16">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Photographer Directory</h1>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Browse photographers on Lensaya and open their pages.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-8">
            <form className="space-y-3" onSubmit={onSearchSubmit}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by studio name or username..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={cityInput}
                  onChange={(event) => setCityInput(event.target.value)}
                  placeholder="City (e.g. KL)"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={specialtyInput}
                  onChange={(event) => setSpecialtyInput(event.target.value)}
                  placeholder="Specialty (e.g. Wedding)"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <input
                  type="number"
                  min={0}
                  value={minPriceInput}
                  onChange={(event) => setMinPriceInput(event.target.value)}
                  placeholder="Min Price"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <input
                  type="number"
                  min={0}
                  value={maxPriceInput}
                  onChange={(event) => setMaxPriceInput(event.target.value)}
                  placeholder="Max Price"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors"
                >
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
                  className="px-4 py-2 border border-gray-200 text-slate-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            </form>

            <p className="mt-3 text-sm text-slate-600">
              Showing {showingFrom}-{showingTo} of {pagination.total} photographers
            </p>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={`loading-${index + 1}`} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="aspect-square bg-gray-200 animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">{errorMessage}</div>
          ) : photographers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 py-14 text-center text-slate-600 bg-white">
              No photographers found. Try a different search term.
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {photographers.map((photographer) => {
                  const studioLabel = photographer.studioName || photographer.username;
                  const portfolioUrl = buildPublicStudioUrl(photographer.username);

                  return (
                    <article
                      key={photographer.username}
                      className="group bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-cyan-400 hover:shadow-lg transition-all"
                    >
                      <a href={portfolioUrl} className="block">
                        <div className="aspect-square overflow-hidden bg-gray-100">
                          {photographer.imageUrl ? (
                            <ImageWithFallback
                              src={photographer.imageUrl}
                              alt={studioLabel}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Camera className="w-10 h-10" />
                            </div>
                          )}
                        </div>
                      </a>

                      <div className="p-4">
                        <p className="font-semibold text-slate-900">{studioLabel}</p>
                        <p className="mt-2 text-sm text-slate-600 min-h-[2.75rem]">{toShortBio(photographer)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {photographer.city ? (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                              {photographer.city}
                            </span>
                          ) : null}
                          {photographer.specialty ? (
                            <span className="inline-flex items-center rounded-full bg-cyan-50 px-2.5 py-1 text-xs text-cyan-700">
                              {photographer.specialty}
                            </span>
                          ) : null}
                        </div>
                        <a
                          href={portfolioUrl}
                          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700 transition-colors"
                        >
                          View pages
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-10 flex items-center justify-center gap-2">
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
                  className="px-3 py-2 border border-gray-200 rounded text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="px-3 py-2 bg-cyan-500 text-white rounded text-sm">
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
                  className="px-3 py-2 border border-gray-200 rounded text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
