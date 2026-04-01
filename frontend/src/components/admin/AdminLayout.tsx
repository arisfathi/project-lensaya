import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  HardDrive,
  Shield,
  Gift,
  BarChart3,
  FileText,
  PencilLine,
  Settings,
  Search,
  Menu,
  X,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { NotificationBell } from "../notifications/NotificationBell";
import { useAuth } from "../../contexts/AuthContext";
import { BrandWordmark } from "../BrandWordmark";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { name: "Photographers", icon: Users, path: "/admin/photographers" },
  { name: "Subscriptions", icon: CreditCard, path: "/admin/subscriptions" },
  { name: "Revenue", icon: DollarSign, path: "/admin/revenue" },
  { name: "Storage & Images", icon: HardDrive, path: "/admin/storage" },
  { name: "Abuse / Moderation", icon: Shield, path: "/admin/moderation" },
  { name: "Referrals", icon: Gift, path: "/admin/referrals" },
  { name: "Analytics", icon: BarChart3, path: "/admin/analytics" },
  { name: "Content CMS", icon: PencilLine, path: "/admin/content" },
  { name: "System Logs", icon: FileText, path: "/admin/logs" },
  { name: "Settings", icon: Settings, path: "/admin/settings" },
];

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const adminName = user?.fullName?.trim() || "Admin";
  const adminInitial = adminName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !profileMenuRef.current) {
        return;
      }

      if (!profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-200/70 via-cyan-100/60 to-sky-200/70">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 z-50 h-full w-64 border-r border-cyan-800/70 bg-gradient-to-b from-cyan-950 via-slate-900 to-cyan-950 shadow-xl transition-transform lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex h-16 items-center justify-between border-b border-cyan-800/70 bg-cyan-900/60 px-6 backdrop-blur-sm">
          <Link to="/admin" className="flex items-center gap-2">
            <BrandWordmark className="text-cyan-50" suffix="Admin" suffixClassName="text-cyan-100" />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-cyan-100 transition-colors hover:bg-cyan-800/70 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 p-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                  isActive
                    ? "bg-cyan-300 text-slate-900 font-medium shadow-sm"
                    : "text-cyan-100 hover:bg-cyan-800/70 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 h-16 border-b border-cyan-800/70 bg-gradient-to-r from-cyan-900 via-slate-900 to-cyan-950 shadow-sm backdrop-blur-sm">
          <div className="flex h-full items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-1 text-cyan-100 transition-colors hover:bg-cyan-800/80 hover:text-white lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>

              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300" />
                <input
                  type="text"
                  placeholder="Search photographers..."
                  className="w-64 rounded-lg border border-cyan-800 bg-cyan-900/55 py-2 pl-10 pr-4 text-sm text-cyan-50 placeholder:text-cyan-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell
                buttonClassName="relative rounded-lg p-2 text-cyan-100 transition-colors hover:bg-cyan-800/80 hover:text-white"
                iconClassName="h-5 w-5 text-cyan-100"
              />

              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setProfileMenuOpen((current) => !current);
                  }}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-cyan-800/80"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-sky-500 text-sm font-semibold text-white">
                    {adminInitial}
                  </div>
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-semibold text-cyan-50">{adminName}</p>
                    <p className="text-xs text-cyan-200">Admin</p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-cyan-200 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 z-40 mt-2 w-44 rounded-lg border border-cyan-100 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-cyan-50/80"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate("/admin/settings");
                      }}
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      className="inline-flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-cyan-50/80"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void handleLogout();
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
