import { useEffect, useMemo, useState } from "react";
import { Cloud, HardDrive, Image, TrendingUp, Users } from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AdminLayout } from "../../layouts/AdminLayout";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type StorageOverview = {
  totalStorage: { _sum?: { sizeBytes?: number } };
  totalImages: number;
  avgPerUser: number;
  monthlyGrowth: number;
  neonDatabaseSizeBytes: number | null;
};

type StorageByPlan = {
  plan: string;
  usage: number;
};

type UploadPoint = {
  month: string;
  uploads: number;
};

type TopStorageUser = {
  userId: string;
  name: string;
  plan: string;
  storageUsed: number;
  imageCount: number;
  quotaPercent: number;
};

type R2Overview = {
  configured: boolean;
  connected: boolean;
  bucket: string | null;
  prefix: string;
  totalBytes: number;
  totalObjects: number;
  dbReadyBytes: number;
  dbReadyObjects: number;
  deltaBytes: number | null;
  truncated: boolean;
  lastSyncedAt: string | null;
  message: string | null;
};

const planColorMap: Record<string, string> = {
  FREE: "#94a3b8",
  PRO: "#06b6d4",
  STUDIO: "#a855f7",
};

const formatPlan = (plan: string) => {
  if (plan === "FREE") return "Free";
  if (plan === "PRO") return "Pro";
  if (plan === "STUDIO") return "Studio";
  return plan || "Unknown";
};

const formatBytes = (bytes: number) => {
  const size = Number(bytes || 0);
  if (size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;
  return `${value.toFixed(value >= 100 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const monthFallback = () => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      month: date.toLocaleString(undefined, { month: "short" }),
      uploads: 0,
    };
  });
};

export default function Storage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<StorageOverview>({
    totalStorage: { _sum: { sizeBytes: 0 } },
    totalImages: 0,
    avgPerUser: 0,
    monthlyGrowth: 0,
    neonDatabaseSizeBytes: null,
  });
  const [byPlan, setByPlan] = useState<StorageByPlan[]>([]);
  const [uploads, setUploads] = useState<UploadPoint[]>([]);
  const [topUsers, setTopUsers] = useState<TopStorageUser[]>([]);
  const [r2Overview, setR2Overview] = useState<R2Overview>({
    configured: false,
    connected: false,
    bucket: null,
    prefix: "uploads/",
    totalBytes: 0,
    totalObjects: 0,
    dbReadyBytes: 0,
    dbReadyObjects: 0,
    deltaBytes: null,
    truncated: false,
    lastSyncedAt: null,
    message: null,
  });

  const { error } = useToast();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [overviewResult, byPlanResult, uploadsResult, topUsersResult] = await Promise.all([
          adminApi.storageOverview(),
          adminApi.storageByPlan(),
          adminApi.storageUploads(),
          adminApi.storageTopUsers({ page: 1, limit: 10 }),
        ]);

        if (!mounted) return;
        setOverview(
          (overviewResult || {
            totalStorage: { _sum: { sizeBytes: 0 } },
            totalImages: 0,
            avgPerUser: 0,
            monthlyGrowth: 0,
            neonDatabaseSizeBytes: null,
          }) as StorageOverview
        );
        setByPlan((byPlanResult.items || []) as StorageByPlan[]);
        setUploads((uploadsResult.series || []) as UploadPoint[]);
        setTopUsers((topUsersResult.items || []) as TopStorageUser[]);

        try {
          const r2Result = await adminApi.storageR2Overview();
          if (!mounted) return;
          setR2Overview((r2Result || null) as R2Overview);
        } catch (r2Error) {
          if (!mounted) return;
          setR2Overview((current) => ({
            ...current,
            configured: true,
            connected: false,
            message: getApiErrorMessage(r2Error, "Failed to read R2 bucket usage"),
            lastSyncedAt: new Date().toISOString(),
          }));
        }
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load storage analytics"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error]);

  const assetStorageBytes = Number(overview.totalStorage?._sum?.sizeBytes || 0);
  const neonDatabaseStorageBytes =
    overview.neonDatabaseSizeBytes === null || overview.neonDatabaseSizeBytes === undefined
      ? null
      : Number(overview.neonDatabaseSizeBytes);
  const totalStorageBytes =
    neonDatabaseStorageBytes !== null && Number.isFinite(neonDatabaseStorageBytes)
      ? neonDatabaseStorageBytes
      : assetStorageBytes;
  const r2DeltaBytes = Number(r2Overview.deltaBytes || 0);
  const r2DeltaLabel =
    r2Overview.deltaBytes === null
      ? "delta n/a"
      : `${r2DeltaBytes > 0 ? "+" : r2DeltaBytes < 0 ? "-" : ""}${formatBytes(Math.abs(r2DeltaBytes))}`;
  const r2Status = !r2Overview.configured
    ? "R2 not configured"
    : !r2Overview.connected
      ? r2Overview.message || "R2 unavailable"
      : `${new Intl.NumberFormat().format(Number(r2Overview.totalObjects || 0))} objects - ${r2DeltaLabel} vs DB`;

  const stats = [
    {
      name: "Total Storage Used (Neon DB)",
      value: formatBytes(totalStorageBytes),
      icon: HardDrive,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-500",
      hint:
        neonDatabaseStorageBytes !== null
          ? "PostgreSQL database size from Neon"
          : "Neon size unavailable, showing tracked asset bytes",
    },
    {
      name: "R2 Bucket Usage",
      value: r2Overview.connected ? formatBytes(Number(r2Overview.totalBytes || 0)) : "--",
      icon: Cloud,
      bgColor: r2Overview.connected ? "bg-sky-50" : "bg-slate-100",
      iconColor: r2Overview.connected ? "text-sky-500" : "text-slate-500",
      hint: r2Status,
    },
    {
      name: "Total Images",
      value: new Intl.NumberFormat().format(Number(overview.totalImages || 0)),
      icon: Image,
      bgColor: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
    {
      name: "Avg Storage per User",
      value: formatBytes(Number(overview.avgPerUser || 0)),
      icon: Users,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      name: "Monthly Growth",
      value: formatBytes(Number(overview.monthlyGrowth || 0)),
      icon: TrendingUp,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },

  ];

  const storageByPlanData = useMemo(() => {
    if (!byPlan.length) {
      return [
        { id: "storage-free", name: "Free", value: 0, color: planColorMap.FREE },
        { id: "storage-pro", name: "Pro", value: 0, color: planColorMap.PRO },
        { id: "storage-studio", name: "Studio", value: 0, color: planColorMap.STUDIO },
      ];
    }

    return byPlan.map((item, index) => {
      const plan = item.plan || "FREE";
      return {
        id: `${plan}-${index + 1}`,
        name: formatPlan(plan),
        value: Number(item.usage || 0),
        color: planColorMap[plan] || planColorMap.FREE,
      };
    });
  }, [byPlan]);

  const imageUploadsData = useMemo(() => {
    if (!uploads.length) return monthFallback();
    return uploads.map((item) => ({
      month: item.month || "",
      uploads: Number(item.uploads || 0),
    }));
  }, [uploads]);

  if (loading) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading storage data..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Storage & Images</h1>
        <p className="text-slate-600">Storage analytics and image usage metrics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
        {stats.map((stat) => {
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
              {"hint" in stat ? <p className="text-xs text-slate-500 mt-1">{stat.hint}</p> : null}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Storage Usage by Plan</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={storageByPlanData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {storageByPlanData.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatBytes(Number(value || 0))} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Image Uploads per Month</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={imageUploadsData}>
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="uploads" stroke="#06b6d4" strokeWidth={2} name="Uploads" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Largest Photographers by Storage</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Photographer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Plan</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Storage Used</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Images</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Usage</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-sm text-slate-500">
                    No storage users found.
                  </td>
                </tr>
              ) : (
                topUsers.map((user) => (
                  <tr key={user.userId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{user.name || "Unknown photographer"}</div>
                        <div className="text-sm text-slate-500">{user.userId}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.plan === "STUDIO"
                            ? "bg-purple-100 text-purple-700"
                            : user.plan === "PRO"
                              ? "bg-cyan-100 text-cyan-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {formatPlan(user.plan)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-900">{formatBytes(Number(user.storageUsed || 0))}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{new Intl.NumberFormat().format(Number(user.imageCount || 0))}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[120px]">
                          <div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(Number(user.quotaPercent || 0), 100))}%` }} />
                        </div>
                        <span className="text-sm text-slate-600">{Number(user.quotaPercent || 0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
