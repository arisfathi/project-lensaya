import { ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { buildPublicStudioHost } from '../lib/platform';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pb-16 pt-8 sm:pb-24 sm:pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-4xl text-center sm:mb-16">
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-7xl">
            The portfolio platform
            <br />
            built for photographers
          </h1>
          <p className="mx-auto mb-8 max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-xl lg:text-2xl">
            Create a stunning portfolio website that showcases your work, attracts clients, and grows your photography
            business.
          </p>

          <div className="mb-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-cyan-500/30 transition-all hover:bg-cyan-600 hover:shadow-xl hover:shadow-cyan-500/40"
            >
              Start Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/portfolio"
              className="group flex items-center gap-2 rounded-lg border-2 border-slate-200 px-8 py-4 text-lg font-semibold text-slate-700 transition-all hover:border-cyan-500 hover:text-cyan-600"
            >
              <ExternalLink className="h-5 w-5 transition-transform group-hover:scale-110" />
              View a Live Example
            </Link>
          </div>

          <p className="text-sm text-slate-500">No credit card required. Free plan available.</p>
        </div>

        <div className="relative">
          <div className="relative mb-6 overflow-hidden rounded-2xl shadow-2xl">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1606216794074-735e91aa2c92?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWRkaW5nJTIwcGhvdG9ncmFwaHklMjBlbGVnYW50fGVufDF8fHx8MTc0MjU1MTIwMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              alt="Photography portfolio hero"
              className="h-[400px] w-full object-cover sm:h-[500px] lg:h-[600px]"
            />

            <div className="absolute left-6 top-6 rounded-xl border border-gray-100 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Live Portfolio</p>
              <p className="font-bold text-slate-900">Sarah Johnson Photography</p>
            </div>

            <div className="absolute bottom-6 right-6 rounded-xl border border-gray-100 bg-white/95 px-5 py-3 shadow-xl backdrop-blur-sm">
              <p className="mb-1 text-xs text-slate-500">Your custom URL:</p>
              <p className="text-lg font-semibold text-cyan-500">{buildPublicStudioHost('yourname')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1649107835391-07d0b93a409d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHBob3RvZ3JhcGh5JTIwc3R1ZGlvfGVufDF8fHx8MTc3Mjg2MTI1OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Portrait photography"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1612192666336-561178b9cbfd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwcGhvdG9ncmFwaHklMjBhZXN0aGV0aWN8ZW58MXx8fHwxNzcyODc0NjI4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Food photography"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1764967116421-342cb89025bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMHBob3RvZ3JhcGh5JTIwcHJvZmVzc2lvbmFsfGVufDF8fHx8MTc3Mjk0NTQ4Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Event photography"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

