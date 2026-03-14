import {
  LayoutDashboard,
  Image,
  Briefcase,
  Package,
  Calendar,
  Eye,
  BarChart3,
  Gift,
  ReceiptText,
  Settings,
  Camera,
  LogOut,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Portfolio", icon: Image, path: "/dashboard/portfolio" },
  { name: "Services", icon: Briefcase, path: "/dashboard/services" },
  { name: "Packages", icon: Package, path: "/dashboard/packages" },
  { name: "Availability", icon: Calendar, path: "/dashboard/availability" },
  { name: "Website Preview", icon: Eye, path: "/dashboard/preview" },
  { name: "Analytics", icon: BarChart3, path: "/dashboard/analytics" },
  { name: "Referrals", icon: Gift, path: "/dashboard/referrals" },
  { name: "Payments", icon: ReceiptText, path: "/dashboard/transactions" },
  { name: "Settings", icon: Settings, path: "/dashboard/settings" },
];

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const currentPlan = user?.plan || "FREE";

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      onClose();
      navigate("/login", { replace: true });
    }
  };

  return (
    <>
      {isOpen ? <div className="fixed inset-0 bg-slate-900/45 z-40 lg:hidden" onClick={onClose} /> : null}

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-cyan-950 via-slate-900 to-cyan-950 border-r border-cyan-800/70 shadow-xl z-50
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-6 border-b border-cyan-800/70 bg-cyan-900/60 backdrop-blur-sm">
            <Link to="/" className="flex items-center gap-2">
              <Camera className="w-6 h-6 text-cyan-300" />
              <span className="text-xl font-semibold text-cyan-50">Lensaya</span>
            </Link>
            <button onClick={onClose} className="lg:hidden p-2 text-cyan-100 hover:bg-cyan-800/70 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                    ${
                      isActive
                        ? "bg-cyan-300 text-slate-900 shadow-sm"
                        : "text-cyan-100 hover:bg-cyan-800/70 hover:text-white"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="px-6 py-4 border-t border-cyan-800/80 bg-cyan-900/45">
            <div className="bg-gradient-to-br from-cyan-500 via-cyan-500 to-sky-500 rounded-lg p-4 text-white shadow-lg">
              <p className="text-sm font-semibold mb-1">{currentPlan} Plan</p>
              <p className="text-xs text-cyan-50 mb-3">Upgrade for higher limits and premium tools.</p>
              <Link
                to="/dashboard/pricing"
                className="inline-flex w-full items-center justify-center px-3 py-1.5 bg-white text-cyan-600 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Upgrade Now
              </Link>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-700 px-3 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-800/80 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
