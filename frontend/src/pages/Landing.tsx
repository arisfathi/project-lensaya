import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { PhotographerPreviews } from '../components/PhotographerPreviews';
import { Features } from '../components/Features';
import { Testimonials } from '../components/Testimonials';
import Pricing from '../components/Pricing';
import { DirectoryPreview } from '../components/DirectoryPreview';
import { CTA } from '../components/CTA';
import { Footer } from '../components/Footer';
import { buildAppUrl } from '../lib/platform';
import { PUBLIC_DIRECTORY_ENABLED } from '../lib/marketingFlags';
import { useSeoMeta } from '../lib/seo';

export default function Landing() {
  const location = useLocation();

  useSeoMeta({
    title: 'Lensaya | Portfolio Websites for Photographers',
    description:
      'Create a photography portfolio website with galleries, booking tools, public discovery, and pricing plans built for photographers.',
    canonicalUrl: buildAppUrl('/'),
  });

  useEffect(() => {
    const hash = location.hash.replace('#', '').trim();
    if (!hash) return;

    const frameId = window.requestAnimationFrame(() => {
      const target = document.getElementById(hash);
      if (!target) return;

      const top = target.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top, behavior: 'smooth' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Hero />
        <PhotographerPreviews />
        <Features />
        <Testimonials />
        <Pricing />
        {PUBLIC_DIRECTORY_ENABLED ? <DirectoryPreview /> : null}
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
