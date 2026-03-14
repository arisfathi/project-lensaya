import { useEffect, useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from './ui/Avatar';
import { publicApi } from '../lib/api';
import { buildPublicStudioUrl } from '../lib/platform';

type DirectoryPhotographer = {
  username: string;
  studioName: string | null;
  category: string | null;
  imageUrl: string | null;
  location: string | null;
};

export function DirectoryPreview() {
  const [directoryPhotographers, setDirectoryPhotographers] = useState<DirectoryPhotographer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadDirectory = async () => {
      setLoading(true);
      try {
        const result = await publicApi.directory({ page: 1, limit: 4 });
        if (!mounted) return;
        setDirectoryPhotographers((result.items || []) as DirectoryPhotographer[]);
        setErrorMessage(null);
      } catch {
        if (!mounted) return;
        setErrorMessage('Unable to load directory preview.');
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
  }, []);

  const cards = loading
    ? Array.from({ length: 4 }, (_, index) => ({
        username: `loading-${index + 1}`,
        studioName: 'Loading...',
        category: 'Photography',
        imageUrl: null,
        location: 'Loading location',
      }))
    : directoryPhotographers;

  return (
    <section id="directory" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">Join our global directory</h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Get discovered by clients searching for photographers in your area
          </p>
        </div>

        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((photographer) => (
            <a
              key={photographer.username}
              href={loading ? '/photographers' : buildPublicStudioUrl(photographer.username)}
              className={`group overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:border-cyan-500 hover:shadow-lg ${
                loading ? 'pointer-events-none' : ''
              }`}
            >
              <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-slate-50 via-white to-cyan-50/70 p-6">
                <div className="rounded-[2rem] border border-white/80 bg-white/80 p-4 shadow-sm transition-transform duration-500 group-hover:scale-105">
                  <Avatar
                    src={loading ? null : photographer.imageUrl}
                    name={photographer.studioName || photographer.username}
                    size={112}
                    className="ring-4 ring-white"
                    imageClassName="border-slate-200 shadow-md"
                  />
                </div>
              </div>
              <div className="p-4">
                <p className="mb-1 font-semibold text-slate-900">{photographer.studioName || photographer.username}</p>
                <p className="mb-2 text-xs text-slate-500">{photographer.category || 'Photography'}</p>
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <MapPin className="h-3 w-3" />
                  {photographer.location || 'Lensaya Directory'}
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="text-center">
          <Link
            to="/photographers"
            className="group inline-flex items-center gap-2 font-medium text-cyan-500 transition-colors hover:text-cyan-600"
          >
            Browse all photographers
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {!loading && errorMessage ? <p className="mt-4 text-center text-sm text-red-600">{errorMessage}</p> : null}
      </div>
    </section>
  );
}


