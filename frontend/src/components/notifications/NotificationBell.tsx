import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { notificationsApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type NotificationItem = {
  id: string;
  title?: string;
  body?: string;
  read: boolean;
  createdAt: string;
};

type NotificationBellProps = {
  buttonClassName?: string;
  iconClassName?: string;
};

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
};

export function NotificationBell({
  buttonClassName = "relative p-2 hover:bg-gray-100 rounded-lg",
  iconClassName = "w-5 h-5 text-slate-600",
}: NotificationBellProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { error, success } = useToast();

  useEffect(() => {
    let mounted = true;

    const loadNotifications = async () => {
      setLoading(true);
      try {
        const result = await notificationsApi.list({ page: 1, limit: 8 });
        if (!mounted) return;
        setUnreadCount(result.unreadCount || 0);
        setNotifications((result.items || []) as NotificationItem[]);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load notifications"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadNotifications();

    return () => {
      mounted = false;
    };
  }, [error]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to update notification"));
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount <= 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const result = await notificationsApi.markAllRead();
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
      if ((result.markedCount || 0) > 0) {
        success(`${result.markedCount} notification${result.markedCount === 1 ? "" : "s"} marked as read.`);
      }
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to mark all notifications as read"));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative">
      <button
        className={buttonClassName}
        onClick={() => {
          setPanelOpen((open) => !open);
        }}
      >
        <Bell className={iconClassName} />
        {unreadCount > 0 ? (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-cyan-500 text-white rounded-full text-[10px] flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {panelOpen ? (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button
              type="button"
              className="text-xs font-medium text-cyan-600 hover:text-cyan-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
              onClick={() => {
                void handleMarkAllRead();
              }}
              disabled={loading || markingAll || unreadCount <= 0}
            >
              {markingAll ? "Marking..." : "Mark all as read"}
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="px-4 py-5 text-sm text-slate-500">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-5 text-sm text-slate-500">No notifications yet.</div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                  disabled={markingAll}
                  onClick={() => {
                    if (!item.read) {
                      void handleMarkRead(item.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-2 w-2 h-2 rounded-full ${item.read ? "bg-gray-300" : "bg-cyan-500"}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.title || "Notification"}</p>
                      <p className="text-sm text-slate-600">{item.body || "New activity in your account."}</p>
                      <p className="text-xs text-slate-500 mt-1">{formatDateTime(item.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
