import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Save, Mail, FileText } from "lucide-react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type EmailNotifications = {
  newSignup: boolean;
  subscription: boolean;
  abuse: boolean;
  dailyReport: boolean;
  weeklyReport: boolean;
};

const defaultEmail: EmailNotifications = {
  newSignup: true,
  subscription: true,
  abuse: true,
  dailyReport: false,
  weeklyReport: true,
};

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState<EmailNotifications>(defaultEmail);

  const { success, error } = useToast();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const settingsResult = await adminApi.settings();
        if (!mounted) return;
        setEmailNotifications((settingsResult.emailNotifications || defaultEmail) as EmailNotifications);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load admin settings"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error]);

  const saveEmailSettings = async () => {
    try {
      setSavingEmail(true);
      await adminApi.updateEmailNotifications(emailNotifications);
      success("Notification settings saved");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to save notification settings"));
    } finally {
      setSavingEmail(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading settings..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Settings</h1>
        <p className="text-slate-600">Configure platform settings</p>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Plan Limits</h2>
        <p className="text-sm text-slate-600 mb-4">Plan and pricing limits are managed from the Subscriptions page.</p>
        <Link
          to="/admin/subscriptions"
          className="inline-flex items-center px-4 py-2 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors"
        >
          Open Subscriptions
        </Link>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-50 text-blue-500 p-3 rounded-lg">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Email Notification Settings</h2>
            <p className="text-sm text-slate-600">Configure admin email notifications</p>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(emailNotifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="font-medium text-slate-900">
                  {key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase())}
                </p>
                <p className="text-sm text-slate-600">Receive notifications for {key.toLowerCase()}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) =>
                    setEmailNotifications((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500" />
              </label>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void saveEmailSettings()}
          disabled={savingEmail}
          className="mt-6 px-6 py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {savingEmail ? "Saving..." : "Save Notification Settings"}
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-50 text-purple-500 p-3 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Legal Content</h2>
            <p className="text-sm text-slate-600">Privacy Policy, Terms of Service, and Cookie Policy are managed in Content CMS.</p>
          </div>
        </div>
        <Link
          to="/admin/content"
          className="inline-flex items-center px-4 py-2 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors"
        >
          Open Content CMS
        </Link>
      </div>
    </AdminLayout>
  );
}

