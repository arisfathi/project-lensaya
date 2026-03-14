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
  Settings,
  Search,
  Menu,
  X,
  ChevronDown,
  Camera,
  LogOut,
} from "lucide-react";
import { NotificationBell } from "../notifications/NotificationBell";
import { useAuth } from "../../contexts/AuthContext";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { name: "Photographers", icon: Users, path: "/admin/photographers" },
  { name: "Subscriptions", icon: CreditCard, path: "/admin/subscriptions" },
  { name: "Revenue", icon: DollarSign, path: "/admin/revenue" },
  { name: "Storage & Images", icon: HardDrive, path: "/admin/storage" },
  { name: "Abuse / Moderation", icon: Shield, path: "/admin/moderation" },
  { name: "Referrals", icon: Gift, path: "/admin/referrals" },
  { name: "Analytics", icon: BarChart3, path: "/admin/analytics" },
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
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/45 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-cyan-950 via-slate-900 to-cyan-950 border-r border-cyan-800/70 shadow-xl z-50 transition-transform lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-cyan-800/70 bg-cyan-900/60 backdrop-blur-sm">
          <Link to="/admin" className="flex items-center gap-2">
            <Camera className="w-6 h-6 text-cyan-300" />
            <span className="font-bold text-lg text-cyan-50">Lensaya Admin</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-cyan-100 hover:text-white hover:bg-cyan-800/70 rounded-lg p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-cyan-300 text-slate-900 font-medium shadow-sm"
                    : "text-cyan-100 hover:bg-cyan-800/70 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 h-16 border-b border-cyan-800/70 bg-gradient-to-r from-cyan-900 via-slate-900 to-cyan-950 backdrop-blur-sm z-30 shadow-sm">
          <div className="h-full flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-cyan-100 hover:text-white hover:bg-cyan-800/80 rounded-lg p-1 transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Search */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-300" />
                <input
                  type="text"
                  placeholder="Search photographers..."
                  className="pl-10 pr-4 py-2 w-64 border border-cyan-800 bg-cyan-900/55 rounded-lg text-sm text-cyan-50 placeholder:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <NotificationBell
                buttonClassName="relative p-2 text-cyan-100 hover:text-white hover:bg-cyan-800/80 rounded-lg transition-colors"
                iconClassName="w-5 h-5 text-cyan-100"
              />

              {/* Admin Profile */}
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setProfileMenuOpen((current) => !current);
                  }}
                  className="flex items-center gap-3 px-2 py-1.5 hover:bg-cyan-800/80 rounded-lg transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-sky-500 text-white flex items-center justify-center font-semibold text-sm">
                    {adminInitial}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-semibold text-cyan-50">{adminName}</p>
                    <p className="text-xs text-cyan-200">Admin</p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-cyan-200 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-cyan-100 rounded-lg shadow-lg z-40 py-1">
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-cyan-50/80"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate("/admin/settings");
                      }}
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-cyan-50/80 inline-flex items-center gap-2"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void handleLogout();
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
                </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}



