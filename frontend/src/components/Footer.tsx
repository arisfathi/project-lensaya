import { Link } from 'react-router-dom';
import { BrandWordmark } from './BrandWordmark';

const footerLinks = {
  Product: [
    { label: 'Features', to: '/#features' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Templates', to: '/#features' },
    { label: 'Showcase', to: '/#examples' },
  ],
  Resources: [
    { label: 'Help Center', to: '/help-center' },
    { label: 'Blog', to: '/blog' },
    { label: 'Guides', to: '/guides' },
  ],
  Company: [
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' },
  ],
  Legal: [
    { label: 'Privacy Policy', to: '/privacy-policy' },
    { label: 'Terms of Service', to: '/terms-of-service' },
    { label: 'Cookie Policy', to: '/cookie-policy' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-10 grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <BrandWordmark className="text-white" />
            </div>
            <p className="max-w-xs text-sm leading-6 text-slate-400">
              Professional portfolio websites for photographers with premium presentation and control.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">
                {category}
              </h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-slate-400 transition-colors hover:text-cyan-300">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-8">
          <p className="text-center text-sm text-slate-400">
            (c) 2026 Lensaya. All rights reserved. Made with love in Malaysia
          </p>
        </div>
      </div>
    </footer>
  );
}
