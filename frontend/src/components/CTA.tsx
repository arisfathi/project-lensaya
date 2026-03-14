import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20 sm:py-28">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="mb-6 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-6xl">
          Ready to showcase
          <br />
          your photography?
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-slate-300 sm:text-2xl">
          Join photographers who have created polished portfolio websites with Lensaya and turned their work into a
          stronger client magnet.
        </p>

        <div className="mb-10 flex flex-wrap justify-center gap-4 sm:gap-6">
          {['Free to start', '3 minute setup', 'No credit card'].map((benefit) => (
            <div key={benefit} className="flex items-center gap-2 text-cyan-300">
              <Check className="h-5 w-5" />
              <span className="font-medium">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-10 py-5 text-lg font-bold text-white shadow-2xl shadow-cyan-500/50 transition-all hover:scale-105 hover:bg-cyan-400"
          >
            Create Your Portfolio
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            to="/portfolio"
            className="rounded-xl border-2 border-white/20 bg-white/10 px-10 py-5 text-lg font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
          >
            View Example Site
          </Link>
        </div>
      </div>
    </section>
  );
}
