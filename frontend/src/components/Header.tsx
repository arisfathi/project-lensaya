import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRoleHomePath } from '../lib/roles';
import { BrandWordmark } from './BrandWordmark';

export function Header() {
  const { isAuthenticated, user } = useAuth();
  const roleHomePath = getRoleHomePath(user?.role);
  const navItems = [
    { label: 'Features', to: '/#features' },
    { label: 'Examples', to: '/#examples' },
    { label: 'Pricing', to: '/#pricing' },
    { label: 'Directory', to: '/#directory' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-3 rounded-full px-2 py-1 transition-colors hover:bg-slate-50">
            <BrandWordmark showText={false} className="shrink-0" />
            <span className="brand-wordmark text-[1.05rem] text-slate-950">Lensaya</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="font-medium text-slate-600 transition-colors hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to={roleHomePath}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2 text-white shadow-sm transition-all hover:from-cyan-400 hover:to-sky-400 hover:shadow-md"
              >
                {user?.role === 'ADMIN' ? 'Admin Panel' : 'Dashboard'}
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden px-4 py-2 font-medium text-slate-600 transition-colors hover:text-slate-950 sm:block"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2 text-white shadow-sm transition-all hover:from-cyan-400 hover:to-sky-400 hover:shadow-md"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
