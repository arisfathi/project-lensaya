import { Camera } from 'lucide-react';
import { Link } from 'react-router-dom';

const footerLinks = {
  Product: [
    { label: 'Features', to: '/#features' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Templates', to: '/#features' },
    { label: 'Showcase', to: '/#examples' },
  ],
  Resources: [
    { label: 'Help Center', to: '/' },
    { label: 'Blog', to: '/' },
    { label: 'Guides', to: '/' },
  ],
  Company: [
    { label: 'About', to: '/' },
    { label: 'Contact', to: '/' },
  ],
  Legal: [
    { label: 'Privacy Policy', to: '/' },
    { label: 'Terms of Service', to: '/' },
    { label: 'Cookie Policy', to: '/' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <Camera className="h-6 w-6 text-cyan-400" />
              <span className="text-xl font-semibold">Lensaya</span>
            </div>
            <p className="text-sm text-slate-400">Professional portfolio websites for photographers</p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-3 font-semibold">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-slate-400 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-8">
          <p className="text-center text-sm text-slate-400">(c) 2026 Lensaya. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
