import {
  LayoutDashboard,
  Image,
  Briefcase,
  Package,
  Calendar,
  Eye,
  Users,
  BarChart3,
  Gift,
  ReceiptText,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { BrandWordmark } from "../BrandWordmark";

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { name: "Overview", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Analytics", icon: BarChart3, path: "/dashboard/analytics" },
  { name: "Calendar", icon: Calendar, path: "/dashboard/availability" },
  { name: "Services", icon: Briefcase, path: "/dashboard/services" },
  { name: "Packages", icon: Package, path: "/dashboard/packages" },
  { name: "Portfolio", icon: Image, path: "/dashboard/portfolio" },
  { name: "Team", icon: Users, path: "/dashboard/team", requiresTeamFeature: true },
  { name: "Public Site", icon: Eye, path: "/dashboard/preview" },
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
      {isOpen ? <div className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden" onClick={onClose} /> : null}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 transform border-r border-cyan-800/70 bg-gradient-to-b from-cyan-950 via-slate-900 to-cyan-950 shadow-xl transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-cyan-800/70 bg-cyan-900/60 px-6 backdrop-blur-sm">
            <Link to="/" className="flex items-center gap-2">
              <BrandWordmark className="text-cyan-50" />
            </Link>
            <button onClick={onClose} className="rounded-lg p-2 text-cyan-100 transition-colors hover:bg-cyan-800/70 lg:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors
                    ${
                      isActive
                        ? "bg-cyan-300 text-slate-900 shadow-sm"
                        : "text-cyan-100 hover:bg-cyan-800/70 hover:text-white"
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-cyan-800/80 bg-cyan-900/45 px-6 py-4">
            <div className="rounded-xl bg-gradient-to-br from-cyan-500 via-cyan-500 to-sky-500 p-4 text-white shadow-lg">
              <p className="mb-1 text-sm font-semibold">{currentPlan} Plan</p>
              <p className="mb-3 text-xs text-cyan-50">Upgrade for higher limits and premium tools.</p>
              <Link
                to="/dashboard/pricing"
                className="inline-flex w-full items-center justify-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-cyan-600 transition-colors hover:bg-gray-50"
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
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}







