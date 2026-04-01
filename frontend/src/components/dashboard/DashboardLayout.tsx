import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from "react";
import { Gift } from "lucide-react";
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useOnboarding } from "../../features/onboarding/OnboardingContext";
import { useToast } from "../../contexts/ToastContext";
import { isApiAccessError, notificationsApi } from "../../lib/api";

const OnboardingModal = lazy(async () => {
  const module = await import("../../features/onboarding/OnboardingModal");
  return { default: module.OnboardingModal };
});

interface DashboardLayoutProps {
  children: ReactNode;
}

type LayoutNotificationItem = {
  id: string;
  title?: string;
  body?: string;
  createdAt?: string;
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isVisible: isOnboardingVisible } = useOnboarding();
  const { user } = useAuth();
  const { success } = useToast();
  const [rewardPopupOpen, setRewardPopupOpen] = useState(false);
  const [rewardPopupMarkingRead, setRewardPopupMarkingRead] = useState(false);
  const [rewardPopupNotification, setRewardPopupNotification] = useState<LayoutNotificationItem | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadLatestUnreadRewardNotification = async () => {
      if (!user?.id) return;

      try {
        const result = await notificationsApi.list({ unreadOnly: true, page: 1, limit: 30 });
        if (!mounted) return;

        const items = (result.items || []) as LayoutNotificationItem[];
        const rewardNotifications = items.filter((item) =>
          String(item.title || "").toLowerCase() === "referral reward unlocked"
        );

        if (rewardNotifications.length === 0) return;

        const latest = rewardNotifications
          .slice()
          .sort((a, b) => {
            const aMs = Date.parse(String(a.createdAt || 0));
            const bMs = Date.parse(String(b.createdAt || 0));
            return bMs - aMs;
          })[0];

        setRewardPopupNotification(latest);
        setRewardPopupOpen(true);
        success("You earned a new referral reward!", "Congrats");
      } catch (err) {
        if (!mounted || isApiAccessError(err)) return;
      }
    };

    void loadLatestUnreadRewardNotification();

    return () => {
      mounted = false;
    };
  }, [success, user?.id]);

  const handleCloseRewardPopup = useCallback(async () => {
    const notificationId = rewardPopupNotification?.id;
    setRewardPopupOpen(false);

    if (!notificationId) return;

    setRewardPopupMarkingRead(true);
    try {
      await notificationsApi.markRead(notificationId);
      setRewardPopupNotification(null);
    } catch {
      // Best effort only.
    } finally {
      setRewardPopupMarkingRead(false);
    }
  }, [rewardPopupNotification?.id]);

  return (
    <div className="min-h-screen bg-linear-to-br from-cyan-200/70 via-cyan-100/60 to-sky-200/70">
      <Modal
        open={rewardPopupOpen}
        title="Congrats! Referral reward earned"
        onClose={() => {
          void handleCloseRewardPopup();
        }}
        panelClassName="max-w-lg"
        footer={(
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                void handleCloseRewardPopup();
              }}
              disabled={rewardPopupMarkingRead}
            >
              {rewardPopupMarkingRead ? "Saving..." : "Awesome, thanks"}
            </Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
            <Gift className="h-4 w-4" />
            Referral Reward
          </div>
          <p className="text-sm text-slate-800">
            {rewardPopupNotification?.body || "You earned a referral reward."}
          </p>
          <p className="text-sm text-slate-600">
            You got this because someone signed up using your referral link.
          </p>
        </div>
      </Modal>

      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {isOnboardingVisible ? (
        <Suspense fallback={null}>
          <OnboardingModal />
        </Suspense>
      ) : null}
    </div>
  );
}
