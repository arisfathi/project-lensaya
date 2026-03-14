import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Save, Mail, FileText } from "lucide-react";
import { AdminLayout } from "../../layouts/AdminLayout";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
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

type LegalMeta = {
  slug: string;
  title: string;
  updatedAt: string;
};

type LegalEditorState = {
  open: boolean;
  slug: string;
  title: string;
  content: string;
} | null;

const defaultEmail: EmailNotifications = {
  newSignup: true,
  subscription: true,
  abuse: true,
  dailyReport: false,
  weeklyReport: true,
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingLegal, setSavingLegal] = useState(false);
  const [loadingLegalSlug, setLoadingLegalSlug] = useState<string | null>(null);

  const [emailNotifications, setEmailNotifications] = useState<EmailNotifications>(defaultEmail);
  const [legalPages, setLegalPages] = useState<LegalMeta[]>([]);
  const [legalEditor, setLegalEditor] = useState<LegalEditorState>(null);

  const { success, error } = useToast();

  const loadSettings = async () => {
    const [settingsResult, legalPagesResult] = await Promise.all([adminApi.settings(), adminApi.legalPages()]);

    setEmailNotifications((settingsResult.emailNotifications || defaultEmail) as EmailNotifications);
    const meta = (settingsResult.legalPagesMeta || legalPagesResult.items || []) as LegalMeta[];
    setLegalPages(meta);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        await loadSettings();
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

  const saveLegalPage = async () => {
    if (!legalEditor) return;
    if (!legalEditor.content.trim()) {
      error("Content is required");
      return;
    }

    try {
      setSavingLegal(true);
      await adminApi.patchLegalPage(legalEditor.slug, {
        title: legalEditor.title,
        content: legalEditor.content,
      });
      success("Legal page updated");
      setLegalEditor(null);
      await loadSettings();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to update legal page"));
    } finally {
      setSavingLegal(false);
    }
  };

  const openLegalEditor = async (page: LegalMeta) => {
    try {
      setLoadingLegalSlug(page.slug);
      const detail = await adminApi.legalPage(page.slug);
      setLegalEditor({
        open: true,
        slug: detail.slug,
        title: detail.title || page.title,
        content: detail.content || "",
      });
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to load legal page content"));
    } finally {
      setLoadingLegalSlug(null);
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
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-purple-50 text-purple-500 p-3 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Legal Pages</h2>
            <p className="text-sm text-slate-600">Manage legal documentation and policies</p>
          </div>
        </div>

        <div className="space-y-4">
          {legalPages.length === 0 ? (
            <p className="text-sm text-slate-500">No legal pages configured.</p>
          ) : (
            legalPages.map((page) => (
              <div key={page.slug} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-slate-900">{page.title}</h3>
                  <span className="text-xs text-slate-500">Last updated: {formatDate(page.updatedAt)}</span>
                </div>
                <p className="text-sm text-slate-600 mb-3">Manage {page.title.toLowerCase()} content.</p>
                <button
                  type="button"
                  onClick={() => void openLegalEditor(page)}
                  disabled={loadingLegalSlug === page.slug}
                  className="px-4 py-2 text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
                >
                  {loadingLegalSlug === page.slug ? "Loading..." : "Edit"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        open={Boolean(legalEditor?.open)}
        title={legalEditor?.title || "Edit Legal Page"}
        onClose={() => setLegalEditor(null)}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setLegalEditor(null)} disabled={savingLegal}>
              Cancel
            </Button>
            <Button onClick={() => void saveLegalPage()} disabled={savingLegal}>
              {savingLegal ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        {legalEditor ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
              <input
                type="text"
                value={legalEditor.title}
                onChange={(event) =>
                  setLegalEditor((current) =>
                    current
                      ? {
                          ...current,
                          title: event.target.value,
                        }
                      : current
                  )
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Content</label>
              <textarea
                value={legalEditor.content}
                onChange={(event) =>
                  setLegalEditor((current) =>
                    current
                      ? {
                          ...current,
                          content: event.target.value,
                        }
                      : current
                  )
                }
                rows={10}
                placeholder="Enter legal page content..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </AdminLayout>
  );
}
