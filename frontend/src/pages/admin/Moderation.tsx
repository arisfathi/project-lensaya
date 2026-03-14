import { useEffect, useMemo, useState } from "react";
import { Shield, AlertTriangle, Flag, CheckCircle, Ban, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AdminLayout } from "../../layouts/AdminLayout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Modal } from "../../components/ui/Modal";
import { LoadingCard, LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type ModerationStats = {
  pendingReports: number;
  reviewedToday: number;
  suspendedAccounts: number;
  flaggedImages: number;
};

type AbuseType = {
  type: string;
  count: number;
};

type ReportItem = {
  reportId: string;
  photographer: string;
  reports: number;
  reason: string;
  severity: string;
  status: string;
};

type FlaggedImage = {
  imageReportId: string;
  photographer: string;
  reason: string;
  reports: number;
  date: string;
  imageUrl: string | null;
};

type ConfirmState =
  | {
      type: "report-suspend";
      report: ReportItem;
    }
  | {
      type: "image-remove";
      image: FlaggedImage;
    }
  | null;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const severityClass = (value: string) => {
  if (value === "HIGH") return "bg-red-100 text-red-700";
  if (value === "MEDIUM") return "bg-orange-100 text-orange-700";
  return "bg-yellow-100 text-yellow-700";
};

export default function Moderation() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState<ModerationStats>({
    pendingReports: 0,
    reviewedToday: 0,
    suspendedAccounts: 0,
    flaggedImages: 0,
  });
  const [abuseTypes, setAbuseTypes] = useState<AbuseType[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [flaggedImages, setFlaggedImages] = useState<FlaggedImage[]>([]);

  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [reportDetail, setReportDetail] = useState<ReportItem | null>(null);

  const { success, error } = useToast();

  const loadModeration = async () => {
    const [overviewResult, reportsResult, flaggedResult] = await Promise.all([
      adminApi.moderationOverview(),
      adminApi.moderationReports({ page: 1, limit: 20 }),
      adminApi.flaggedImages({ page: 1, limit: 12 }),
    ]);

    setStats(
      (overviewResult.stats || {
        pendingReports: 0,
        reviewedToday: 0,
        suspendedAccounts: 0,
        flaggedImages: 0,
      }) as ModerationStats
    );
    setAbuseTypes((overviewResult.abuseTypes || []) as AbuseType[]);
    setReports((reportsResult.items || []) as ReportItem[]);
    setFlaggedImages((flaggedResult.items || []) as FlaggedImage[]);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        await loadModeration();
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load moderation data"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error]);

  const statsCards = [
    {
      name: "Pending Reports",
      value: String(stats.pendingReports || 0),
      icon: Flag,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-500",
    },
    {
      name: "Reviewed Today",
      value: String(stats.reviewedToday || 0),
      icon: CheckCircle,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      name: "Suspended Accounts",
      value: String(stats.suspendedAccounts || 0),
      icon: Ban,
      bgColor: "bg-red-50",
      iconColor: "text-red-500",
    },
    {
      name: "Flagged Images",
      value: String(stats.flaggedImages || 0),
      icon: AlertTriangle,
      bgColor: "bg-yellow-50",
      iconColor: "text-yellow-500",
    },
  ];

  const abuseStatsData = useMemo(() => {
    if (!abuseTypes.length) return [];
    return abuseTypes.map((item, index) => ({
      id: `${item.type || "abuse"}-${index + 1}`,
      type: item.type || "Unknown",
      count: Number(item.count || 0),
    }));
  }, [abuseTypes]);

  const patchReport = async (report: ReportItem, action: "approve" | "suspend") => {
    try {
      setActionLoading(true);
      await adminApi.moderationPatchReport(report.reportId, action);
      success(`Report ${action}d`);
      await loadModeration();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to update report"));
    } finally {
      setActionLoading(false);
    }
  };

  const patchImage = async (image: FlaggedImage, action: "approve" | "remove") => {
    try {
      setActionLoading(true);
      await adminApi.patchFlaggedImage(image.imageReportId, action);
      success(`Image ${action}d`);
      await loadModeration();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to update image report"));
    } finally {
      setActionLoading(false);
    }
  };

  const onConfirm = async () => {
    if (!confirmState) return;
    if (confirmState.type === "report-suspend") {
      await patchReport(confirmState.report, "suspend");
    } else {
      await patchImage(confirmState.image, "remove");
    }
    setConfirmState(null);
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading moderation..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Abuse / Moderation</h1>
        <p className="text-slate-600">Monitor and manage platform content and user behavior</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className={`${stat.bgColor} ${stat.iconColor} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</h3>
              <p className="text-sm text-slate-600">{stat.name}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Abuse Reports by Type</h2>
        {abuseStatsData.length === 0 ? (
          <p className="text-sm text-slate-500">No abuse type data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={abuseStatsData}>
              <XAxis dataKey="type" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#f59e0b" name="Reports" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Reported Photographers</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Photographer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Reports</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Reason</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Severity</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-sm text-slate-500">
                    No reports found.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.reportId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{report.photographer || "Unknown photographer"}</div>
                        <div className="text-sm text-slate-500">{report.reportId}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {Number(report.reports || 0)} reports
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600">{report.reason || "-"}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityClass(report.severity || "")}`}>
                        {report.severity || "LOW"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {report.status || "PENDING"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
                          onClick={() => setReportDetail(report)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                          onClick={() => void patchReport(report, "approve")}
                          disabled={actionLoading}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60"
                          onClick={() => setConfirmState({ type: "report-suspend", report })}
                          disabled={actionLoading}
                        >
                          Suspend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Flagged Portfolio Images</h2>
        {flaggedImages.length === 0 ? (
          <p className="text-sm text-slate-500">No flagged images.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {flaggedImages.map((image) => (
              <div key={image.imageReportId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="aspect-square bg-gray-200 flex items-center justify-center">
                  {image.imageUrl ? (
                    <img src={image.imageUrl} alt="Flagged content" className="w-full h-full object-cover" />
                  ) : (
                    <Shield className="w-12 h-12 text-gray-400" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-slate-900 mb-1">{image.photographer || "Unknown photographer"}</p>
                  <p className="text-xs text-slate-600 mb-2">{image.reason || "-"}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{Number(image.reports || 0)} reports</span>
                    <span>{formatDate(image.date)}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-60"
                      onClick={() => void patchImage(image, "approve")}
                      disabled={actionLoading}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-60"
                      onClick={() => setConfirmState({ type: "image-remove", image })}
                      disabled={actionLoading}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.type === "report-suspend" ? "Suspend Photographer" : "Remove Image"}
        message={
          confirmState?.type === "report-suspend"
            ? `Suspend ${confirmState.report.photographer || "this photographer"} due to reported abuse?`
            : "Remove this flagged image from the platform?"
        }
        confirmLabel={confirmState?.type === "report-suspend" ? "Suspend" : "Remove"}
        loading={actionLoading}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => void onConfirm()}
      />

      <Modal open={Boolean(reportDetail)} title="Report Details" onClose={() => setReportDetail(null)}>
        {!reportDetail ? (
          <LoadingSpinner label="Loading..." />
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500">Report ID</p>
              <p className="text-sm text-slate-900 font-medium">{reportDetail.reportId}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Photographer</p>
              <p className="text-sm text-slate-900 font-medium">{reportDetail.photographer || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Reason</p>
              <p className="text-sm text-slate-900">{reportDetail.reason || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Severity</p>
              <p className="text-sm text-slate-900">{reportDetail.severity || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <p className="text-sm text-slate-900">{reportDetail.status || "-"}</p>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
