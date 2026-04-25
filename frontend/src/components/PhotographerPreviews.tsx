import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { publicApi } from '../lib/api';
import { PUBLIC_DIRECTORY_ENABLED } from '../lib/marketingFlags';
import { buildPublicStudioHost, buildPublicStudioUrl } from '../lib/platform';

type FeaturedPhotographer = {
  username: string;
  studioName: string | null;
  category: string | null;
  imageUrl: string | null;
  location: string | null;
};

export function PhotographerPreviews() {
  const [photographers, setPhotographers] = useState<FeaturedPhotographer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadFeatured = async () => {
      setLoading(true);
      try {
        const result = await publicApi.featured({ limit: 6 });
        if (!mounted) return;
        setPhotographers((result.items || []) as FeaturedPhotographer[]);
        setErrorMessage(null);
      } catch {
        if (!mounted) return;
        setErrorMessage('Unable to load photographer previews right now.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadFeatured();

    return () => {
      mounted = false;
    };
  }, []);

  const cards = loading
    ? Array.from({ length: 6 }, (_, index) => ({
        username: `loading-${index + 1}`,
        studioName: 'Loading...',
        category: 'Photography',
        imageUrl: null,
        location: 'Loading location',
      }))
    : photographers;

  return (
    <section id="examples" className="scroll-mt-24 bg-gray-50 py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-16">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-500">Photographer Showcase</p>
          <h2 className="mb-6 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
            Portfolios built with Lensaya
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-slate-600 sm:text-xl">
            Join photographers using Lensaya to create elegant portfolio websites that showcase their best work and
            attract new clients.
          </p>
        </div>

        <div className="mb-12 grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
          {cards.map((photographer) => (
            <a
              key={photographer.username}
              href={loading ? '/portfolio' : buildPublicStudioUrl(photographer.username)}
              className={`group relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-300 hover:shadow-2xl ${
                loading ? 'pointer-events-none' : ''
              }`}
            >
              <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                {photographer.imageUrl ? (
                  <ImageWithFallback
                    src={photographer.imageUrl}
                    alt={`${photographer.studioName || photographer.username}'s portfolio`}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-gray-200" />
                )}
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <p className="mb-1 text-sm font-medium text-cyan-300">{photographer.category || 'Photography'}</p>
                  <p className="mb-1 text-xs text-white/70">
                    {photographer.location || buildPublicStudioHost(photographer.username)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">View Portfolio</span>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="absolute left-6 top-6 rounded-lg bg-white/95 px-4 py-2 shadow-lg backdrop-blur-sm">
                <p className="font-bold text-slate-900">{photographer.studioName || photographer.username}</p>
                {!loading ? (
                  <p className="mt-1 text-xs font-medium text-cyan-500">{buildPublicStudioHost(photographer.username)}</p>
                ) : null}
              </div>
            </a>
          ))}
        </div>

        {PUBLIC_DIRECTORY_ENABLED ? (
          <div className="text-center">
            <Link
              to="/photographers"
              className="group inline-flex items-center gap-2 text-lg font-semibold text-cyan-500 transition-colors hover:text-cyan-600"
            >
              Explore more portfolios
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        ) : null}

        {!loading && errorMessage ? <p className="mt-6 text-center text-sm text-red-600">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
