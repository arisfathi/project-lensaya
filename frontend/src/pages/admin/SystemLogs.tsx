import { useEffect, useMemo, useState } from "react";
import { FileText, Shield, LogIn, AlertTriangle, Search, Filter } from "lucide-react";
import { AdminLayout } from "../../layouts/AdminLayout";
import { LoadingCard, LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type LogItem = {
  id: string;
  timestamp: string;
  event: unknown;
  user: unknown;
  ip: unknown;
  status: unknown;
  details: unknown;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const defaultPagination: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const toDisplayText = (value: unknown, fallback = "-") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value || fallback;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

const shortId = (value: unknown) => {
  const text = toDisplayText(value, "system");
  if (text.length <= 16) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
};

const formatLogDetails = (value: unknown) => {
  return toDisplayText(value, "[unserializable details]");
};

export default function SystemLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(defaultPagination);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [eventInput, setEventInput] = useState("");
  const [rangeInput, setRangeInput] = useState("24h");

  const [searchQuery, setSearchQuery] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [rangeQuery, setRangeQuery] = useState("24h");

  const { error } = useToast();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const result = await adminApi.systemLogs({
          q: searchQuery || undefined,
          eventType: eventQuery || undefined,
          range: rangeQuery || undefined,
          page,
          limit: 20,
        });
        if (!mounted) return;
        setLogs((result.items || []) as LogItem[]);
        setPagination((result.pagination || defaultPagination) as PaginationMeta);
      } catch (err) {
        if (!mounted) return;
        error(getApiErrorMessage(err, "Failed to load system logs"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [error, eventQuery, page, rangeQuery, searchQuery]);

  const applyFilters = () => {
    setPage(1);
    setSearchQuery(searchInput.trim());
    setEventQuery(eventInput);
    setRangeQuery(rangeInput);
  };

  const totalEvents = pagination.total || 0;
  const securityEvents = logs.filter((log) => toDisplayText(log.event, "").toLowerCase().includes("security")).length;
  const loginAttempts = logs.filter((log) => toDisplayText(log.event, "").toLowerCase().includes("login")).length;
  const apiErrors = logs.filter((log) => {
    const status = toDisplayText(log.status, "").toLowerCase();
    return status.includes("error") || status.includes("failed");
  }).length;

  const stats = [
    {
      name: "Total Events",
      value: new Intl.NumberFormat().format(totalEvents),
      icon: FileText,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      name: "Security Events",
      value: String(securityEvents),
      icon: Shield,
      bgColor: "bg-red-50",
      iconColor: "text-red-500",
    },
    {
      name: "Login Attempts",
      value: String(loginAttempts),
      icon: LogIn,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      name: "API Errors",
      value: String(apiErrors),
      icon: AlertTriangle,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-500",
    },
  ];

  const statusClass = useMemo(
    () => (status: unknown) => {
      const lower = toDisplayText(status, "").toLowerCase();
      if (lower.includes("success") || lower.includes("info")) return "bg-green-100 text-green-700";
      if (lower.includes("failed") || lower.includes("error")) return "bg-red-100 text-red-700";
      return "bg-yellow-100 text-yellow-700";
    },
    []
  );

  if (loading && page === 1) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading system logs..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">System Logs</h1>
        <p className="text-slate-600">Activity monitoring and technical event tracking</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
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
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search logs by user, event, or IP address..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={eventInput}
              onChange={(event) => setEventInput(event.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">All Events</option>
              <option value="GET">GET Requests</option>
              <option value="POST">POST Requests</option>
              <option value="PATCH">PATCH Requests</option>
              <option value="DELETE">DELETE Requests</option>
            </select>
            <select
              value={rangeInput}
              onChange={(event) => setRangeInput(event.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <button
              type="button"
              onClick={applyFilters}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Activity Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Timestamp</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Event</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">IP Address</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-900">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4">
                    <LoadingSpinner label="Refreshing logs..." />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-sm text-slate-500">
                    No logs found for this filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 text-sm text-slate-600 font-mono">{formatDateTime(log.timestamp)}</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {toDisplayText(log.event, "EVENT")}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-900">{shortId(log.user)}</td>
                    <td className="py-4 px-4 text-sm text-slate-600 font-mono">{toDisplayText(log.ip, "-")}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass(log.status)}`}>
                        {toDisplayText(log.status, "INFO")}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600">
                      <span className="block max-w-[360px] truncate" title={formatLogDetails(log.details)}>
                        {formatLogDetails(log.details)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-slate-600">
            Showing {logs.length} of {pagination.total} events
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1 || loading}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(current + 1, pagination.totalPages || 1))}
              disabled={page >= (pagination.totalPages || 1) || loading}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
