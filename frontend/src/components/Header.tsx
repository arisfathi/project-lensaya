import { Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRoleHomePath } from '../lib/roles';

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
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-slate-900 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Camera className="h-6 w-6 text-cyan-500" />
            <span className="text-xl font-semibold text-slate-900">Lensaya</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to={roleHomePath}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-white transition-colors hover:bg-cyan-600"
              >
                {user?.role === 'ADMIN' ? 'Admin Panel' : 'Dashboard'}
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden px-4 py-2 text-slate-600 transition-colors hover:text-slate-900 sm:block"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-white transition-colors hover:bg-cyan-600"
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
