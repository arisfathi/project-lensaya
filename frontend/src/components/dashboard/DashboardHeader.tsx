import { useEffect, useState } from "react";
import { LogOut, Menu, Search } from "lucide-react";
import { isApiAccessError, profileApi, getApiErrorMessage } from "../../lib/api";
import { buildPublicStudioHost } from "../../lib/platform";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { useOnboarding } from "../../features/onboarding/OnboardingContext";
import { NotificationBell } from "../notifications/NotificationBell";
import { Avatar } from "../ui/Avatar";

type DashboardHeaderProps = {
  onMenuClick: () => void;
};

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const { user, logout } = useAuth();
  const { isVisible: isOnboardingVisible } = useOnboarding();
  const { error } = useToast();

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const profile = await profileApi.get();
        if (!mounted) return;
        setAvatarUrl(profile.avatarUrl || null);
      } catch (err) {
        if (!mounted || isApiAccessError(err)) return;
        error(getApiErrorMessage(err, "Failed to load profile"));
      }
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [error]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // noop
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-cyan-800/70 bg-gradient-to-r from-cyan-900 via-slate-900 to-cyan-950 backdrop-blur-sm shadow-sm">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        <div className="flex items-center gap-4 flex-1">
          <button onClick={onMenuClick} className="lg:hidden p-2 hover:bg-cyan-800/80 rounded-lg transition-colors">
            <Menu className="w-6 h-6 text-cyan-100" />
          </button>

          <div className="hidden sm:flex items-center gap-2 border border-cyan-800 bg-cyan-900/55 px-4 py-2 rounded-lg max-w-md w-full">
            <Search className="w-5 h-5 text-cyan-300" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent outline-none text-sm w-full text-cyan-50 placeholder:text-cyan-300"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell
            buttonClassName="relative p-2 text-cyan-100 hover:text-white hover:bg-cyan-800/80 rounded-lg transition-colors"
            iconClassName="w-5 h-5 text-cyan-100"
          />

          <div className="flex items-center gap-3 pl-3 border-l border-cyan-800">
            <div className="hidden sm:block text-right">
              <div className="flex items-center justify-end gap-2">
                <p className="text-sm font-medium text-cyan-50">{user?.fullName || "Lensaya User"}</p>
              </div>
              <p className="text-xs text-cyan-200">
                {isOnboardingVisible ? "Studio setup in progress" : user?.username ? buildPublicStudioHost(user.username) : user?.email}
              </p>
            </div>

            <Avatar
              src={avatarUrl}
              name={user?.fullName || "Lensaya User"}
              size={40}
              href="/dashboard/settings"
            />

            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
              aria-label="Logout"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-cyan-100 border border-cyan-700 rounded-lg hover:bg-cyan-800/80 hover:text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
