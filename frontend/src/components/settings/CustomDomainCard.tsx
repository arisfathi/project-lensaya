import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { ApiClientError, customDomainsApi, getApiErrorMessage } from "../../lib/api";
import { Button } from "../ui/Button";

type ApiDomainState = Awaited<ReturnType<typeof customDomainsApi.get>>;
type CustomDomainStatus = NonNullable<ApiDomainState["status"]>;
type DisplayStatus = "locked" | "empty" | CustomDomainStatus;

type CustomDomainCardProps = {
  currentPlan: string;
  fallbackHost: string;
};

const DEFAULT_DNS_TARGET = "domains.lensaya.app";
const VERIFY_DELAY_MS = 1200;
const FORCE_LOCAL_MOCK = String(import.meta.env.VITE_CUSTOM_DOMAIN_LOCAL_MOCK || "")
  .trim()
  .toLowerCase() === "true";

const normalizeDomain = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.+$/, "");

const isValidDomain = (value: string) =>
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value);

const toRecommendedDomain = (value: string) => {
  if (!value) return "";
  if (value.startsWith("www.")) return value;
  return value.split(".").length === 2 ? `www.${value}` : value;
};

const getDnsHost = (domain: string) => {
  const parts = String(domain || "").split(".");
  return parts.length > 2 ? parts[0] || "www" : "www";
};

const shouldFailMockVerification = (domain: string) => {
  const normalized = normalizeDomain(domain);
  return ["fail", "broken", "invalid"].some((keyword) => normalized.includes(keyword));
};

const buildBaseState = (
  currentPlan: string,
  fallbackUrl: string,
  seed?: Partial<ApiDomainState>
): ApiDomainState => {
  const normalizedPlan = String(seed?.currentPlan || currentPlan || "FREE").toUpperCase();
  const domain = seed?.domain || null;

  return {
    deleted: seed?.deleted ?? false,
    eligible: typeof seed?.eligible === "boolean" ? seed.eligible : false,
    currentPlan: normalizedPlan,
    domain,
    status: seed?.status ?? null,
    sslStatus: seed?.sslStatus ?? null,
    failureReason: seed?.failureReason ?? null,
    lastCheckedAt: seed?.lastCheckedAt ?? null,
    verifiedAt: seed?.verifiedAt ?? null,
    fallbackUrl: seed?.fallbackUrl || fallbackUrl,
    dnsInstructions:
      seed?.dnsInstructions ||
      (domain
        ? {
            type: "CNAME",
            host: getDnsHost(domain),
            value: DEFAULT_DNS_TARGET,
          }
        : null),
    verificationMode: seed?.verificationMode || "mock",
  };
};

const normalizeLoadedState = (state: ApiDomainState, currentPlan: string, fallbackUrl: string) =>
  buildBaseState(currentPlan, fallbackUrl, state);

const toDisplayStatus = (status: ApiDomainState["status"]): DisplayStatus => {
  if (!status) return "empty";
  return status === "pending" ? "awaiting_dns" : status;
};

const formatCheckedAt = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const shouldFallbackToLocalMock = (error: unknown) => {
  if (FORCE_LOCAL_MOCK) return true;
  if (!(error instanceof ApiClientError)) return true;
  return [404, 405, 501].includes(error.status);
};

const statusConfig: Record<DisplayStatus, { label: string; badgeClass: string; description: string }> = {
  locked: {
    label: "Upgrade required",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    description: "Custom domains are not enabled on your current plan.",
  },
  empty: {
    label: "Not connected",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    description: "Connect your own domain and keep your Lensaya URL as a fallback.",
  },
  awaiting_dns: {
    label: "Awaiting DNS",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    description: "Add the DNS record below, then come back and verify.",
  },
  pending: {
    label: "Pending",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    description: "Your domain setup has started. Add the DNS record below, then verify.",
  },
  verifying: {
    label: "Verifying",
    badgeClass: "bg-cyan-100 text-cyan-700 border-cyan-200",
    description: "Checking DNS propagation and SSL readiness.",
  },
  active: {
    label: "Active",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    description: "Your custom domain is connected and ready to use.",
  },
  failed: {
    label: "Failed",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    description: "We could not verify the DNS record for this domain.",
  },
  broken: {
    label: "Broken",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    description: "This domain was connected before but is no longer verifying correctly.",
  },
};

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function CustomDomainCard({ currentPlan, fallbackHost }: CustomDomainCardProps) {
  const fallbackUrlFromProps = `https://${fallbackHost}`;
  const [mode, setMode] = useState<"backend" | "local-mock">(FORCE_LOCAL_MOCK ? "local-mock" : "backend");
  const [loading, setLoading] = useState(!FORCE_LOCAL_MOCK);
  const [actionLoading, setActionLoading] = useState<"connect" | "verify" | "disconnect" | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(
    FORCE_LOCAL_MOCK ? "Using local mock mode until the backend/API is available." : null
  );
  const [backendState, setBackendState] = useState<ApiDomainState | null>(null);
  const [localState, setLocalState] = useState<ApiDomainState>(() =>
    buildBaseState(currentPlan, fallbackUrlFromProps, {
      verificationMode: "mock",
    })
  );
  const verifyTimerRef = useRef<number | null>(null);

  const activateLocalMock = (message: string, seed?: Partial<ApiDomainState>) => {
    setMode("local-mock");
    setLoading(false);
    setInlineError(null);
    setNoticeMessage(message);
    setLocalState(buildBaseState(currentPlan, fallbackUrlFromProps, { ...seed, verificationMode: "mock" }));
  };

  useEffect(() => {
    return () => {
      if (verifyTimerRef.current) {
        window.clearTimeout(verifyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== "local-mock") return;
    setLocalState((current) =>
      buildBaseState(currentPlan, fallbackUrlFromProps, {
        ...current,
        verificationMode: "mock",
      })
    );
  }, [currentPlan, fallbackUrlFromProps, mode]);

  useEffect(() => {
    if (mode !== "backend") return;

    let canceled = false;
    const loadState = async () => {
      setLoading(true);
      try {
        const result = normalizeLoadedState(await customDomainsApi.get(), currentPlan, fallbackUrlFromProps);
        if (canceled) return;
        setBackendState(result);
        setDomainInput(result.domain || "");
        setInlineError(null);
        setNoticeMessage(
          result.verificationMode === "mock"
            ? "Backend verification is currently running in mock mode."
            : null
        );
      } catch (error) {
        if (canceled) return;
        if (shouldFallbackToLocalMock(error)) {
          activateLocalMock(
            getApiErrorMessage(error, "Using local mock mode until the custom-domain API is available.")
          );
          return;
        }

        setInlineError(getApiErrorMessage(error, "Failed to load custom domain settings"));
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    void loadState();

    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing dependency shape; isolated in Phase 1.5
  }, [currentPlan, fallbackUrlFromProps, mode]);

  const resolvedState = useMemo(
    () =>
      mode === "backend"
        ? buildBaseState(currentPlan, fallbackUrlFromProps, backendState || undefined)
        : buildBaseState(currentPlan, fallbackUrlFromProps, localState),
    [backendState, currentPlan, fallbackUrlFromProps, localState, mode]
  );
  const connectedDomain = resolvedState.domain || "";
  const dnsInstructions =
    resolvedState.dnsInstructions ||
    (connectedDomain
      ? {
          type: "CNAME",
          host: getDnsHost(connectedDomain),
          value: DEFAULT_DNS_TARGET,
        }
      : null);
  const effectiveStatus = !resolvedState.eligible ? "locked" : toDisplayStatus(resolvedState.status);
  const status = statusConfig[effectiveStatus];
  const checkedAtLabel = formatCheckedAt(resolvedState.lastCheckedAt);
  const sslLabel =
    resolvedState.sslStatus === "issued"
      ? "Issued"
      : resolvedState.sslStatus === "error"
        ? "Attention required"
        : connectedDomain
          ? "Pending"
          : "Not requested";
  const showDnsInstructions = resolvedState.eligible && Boolean(connectedDomain) && Boolean(dnsInstructions);
  const showConnectionDetails = resolvedState.eligible && Boolean(connectedDomain);
  const errorMessage = inlineError || resolvedState.failureReason;
  const mockModeLabel =
    mode === "local-mock"
      ? "Local mock mode is active."
      : resolvedState.verificationMode === "mock"
        ? "Backend verification is running in mock mode."
        : null;

  const handleCopy = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.setTimeout(() => {
        setCopiedField((current) => (current === key ? null : current));
      }, 1600);
    } catch {
      setCopiedField(null);
    }
  };

  const connectInLocalMock = () => {
    const normalized = normalizeDomain(domainInput);
    if (!normalized) {
      setInlineError("Enter a domain to connect.");
      return;
    }

    const recommendedDomain = toRecommendedDomain(normalized);
    if (!isValidDomain(recommendedDomain)) {
      setInlineError("Enter a valid domain such as www.raystudio.com.");
      return;
    }

    setInlineError(null);
    setDomainInput(recommendedDomain);
    setLocalState((current) =>
      buildBaseState(currentPlan, fallbackUrlFromProps, {
        ...current,
        domain: recommendedDomain,
        status: "awaiting_dns",
        sslStatus: "pending",
        failureReason: null,
        lastCheckedAt: null,
        dnsInstructions: {
          type: "CNAME",
          host: getDnsHost(recommendedDomain),
          value: current.dnsInstructions?.value || DEFAULT_DNS_TARGET,
        },
        verificationMode: "mock",
      })
    );
    setNoticeMessage(
      recommendedDomain !== normalized
        ? "We prepared the recommended www version for this setup."
        : "DNS instructions are ready below."
    );
  };

  const verifyInLocalMock = () => {
    if (!connectedDomain) return;
    const wasActiveBeforeVerify = resolvedState.status === "active";
    if (verifyTimerRef.current) {
      window.clearTimeout(verifyTimerRef.current);
    }

    setActionLoading("verify");
    setInlineError(null);
    setNoticeMessage("Checking DNS propagation and SSL status in mock mode...");
    setLocalState((current) =>
      buildBaseState(currentPlan, fallbackUrlFromProps, {
        ...current,
        status: "verifying",
        sslStatus: "pending",
        failureReason: null,
        verificationMode: "mock",
      })
    );

    verifyTimerRef.current = window.setTimeout(() => {
      setLocalState((current) => {
        const shouldFail = shouldFailMockVerification(current.domain || connectedDomain);
        const nextStatus = shouldFail
          ? wasActiveBeforeVerify
            ? "broken"
            : "failed"
          : "active";
        return buildBaseState(currentPlan, fallbackUrlFromProps, {
          ...current,
          status: nextStatus,
          sslStatus: shouldFail ? "error" : "issued",
          failureReason: shouldFail
            ? "We could not find the required CNAME record yet. Double-check the host, target, and whether DNS has finished propagating."
            : null,
          lastCheckedAt: new Date().toISOString(),
          verificationMode: "mock",
        });
      });
      setNoticeMessage(
        shouldFailMockVerification(connectedDomain)
          ? null
          : "Domain verified successfully in mock mode."
      );
      setActionLoading(null);
    }, VERIFY_DELAY_MS);
  };

  const disconnectInLocalMock = () => {
    if (verifyTimerRef.current) {
      window.clearTimeout(verifyTimerRef.current);
    }
    setActionLoading(null);
    setInlineError(null);
    setNoticeMessage(null);
    setDomainInput("");
    setLocalState(
      buildBaseState(currentPlan, fallbackUrlFromProps, {
        verificationMode: "mock",
      })
    );
  };

  const handleConnect = async () => {
    if (mode === "local-mock") {
      connectInLocalMock();
      return;
    }

    const attemptedInput = domainInput;
    setActionLoading("connect");
    setInlineError(null);

    try {
      const result = normalizeLoadedState(await customDomainsApi.save(attemptedInput), currentPlan, fallbackUrlFromProps);
      setBackendState(result);
      setDomainInput(result.domain || "");
      setNoticeMessage(
        result.domain && normalizeDomain(attemptedInput) !== result.domain
          ? "We prepared the recommended www version for this setup."
          : "DNS instructions are ready below."
      );
    } catch (error) {
      if (shouldFallbackToLocalMock(error)) {
        activateLocalMock(
          getApiErrorMessage(error, "Using local mock mode until the custom-domain API is available."),
          backendState || undefined
        );
        connectInLocalMock();
        return;
      }

      setInlineError(getApiErrorMessage(error, "Failed to connect domain"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerify = async () => {
    if (!connectedDomain) return;
    if (mode === "local-mock") {
      verifyInLocalMock();
      return;
    }

    setActionLoading("verify");
    setInlineError(null);
    setNoticeMessage(
      resolvedState.verificationMode === "mock"
        ? "Checking DNS propagation and SSL status in mock mode..."
        : "Checking DNS propagation and SSL status..."
    );
    setBackendState((current) =>
      current
        ? {
            ...current,
            status: "verifying",
            sslStatus: "pending",
            failureReason: null,
          }
        : current
    );

    try {
      const result = normalizeLoadedState(await customDomainsApi.verify(), currentPlan, fallbackUrlFromProps);
      setBackendState(result);
      setNoticeMessage(
        result.status === "active"
          ? result.verificationMode === "mock"
            ? "Domain verified successfully in mock mode."
            : "Domain verified successfully."
          : null
      );
    } catch (error) {
      if (shouldFallbackToLocalMock(error)) {
        activateLocalMock(
          getApiErrorMessage(error, "Using local mock mode until the custom-domain API is available."),
          backendState || undefined
        );
        verifyInLocalMock();
        return;
      }

      setInlineError(getApiErrorMessage(error, "Failed to verify domain"));
      setNoticeMessage(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async () => {
    if (mode === "local-mock") {
      disconnectInLocalMock();
      return;
    }

    setActionLoading("disconnect");
    setInlineError(null);

    try {
      const result = normalizeLoadedState(await customDomainsApi.disconnect(), currentPlan, fallbackUrlFromProps);
      setBackendState(result);
      setDomainInput("");
      setNoticeMessage(null);
    } catch (error) {
      if (shouldFallbackToLocalMock(error)) {
        activateLocalMock(
          getApiErrorMessage(error, "Using local mock mode until the custom-domain API is available."),
          backendState || undefined
        );
        disconnectInLocalMock();
        return;
      }

      setInlineError(getApiErrorMessage(error, "Failed to disconnect domain"));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Custom Domain</h3>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}
            >
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 md:text-sm">
            Point your own domain to Lensaya while keeping your Lensaya URL as a fallback.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Plan</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{resolvedState.currentPlan}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 md:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fallback Lensaya URL</p>
            <p className="mt-1 break-all text-sm font-semibold text-cyan-700">{resolvedState.fallbackUrl}</p>
          </div>
          <CopyButton
            copied={copiedField === "fallback"}
            onClick={() => void handleCopy("fallback", resolvedState.fallbackUrl)}
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:p-5">
          Loading custom domain settings...
        </div>
      ) : !resolvedState.eligible ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600">
              <Lock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Unlock custom domains on Pro or Studio</p>
              <p className="mt-1 text-xs text-slate-600 md:text-sm">{status.description}</p>
              {resolvedState.domain ? (
                <>
                  <p className="mt-2 text-xs text-slate-500">
                    Your saved configuration for <span className="font-semibold text-slate-700">{resolvedState.domain}</span> will remain stored until you upgrade again.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void handleDisconnect()}
                      disabled={actionLoading === "disconnect"}
                      className="border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Unplug className="h-4 w-4" />
                      {actionLoading === "disconnect" ? "Disconnecting..." : "Disconnect Domain"}
                    </Button>
                  </div>
                </>
              ) : null}
              <div className="mt-4">
                <Link
                  to="/dashboard/pricing"
                  className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  View Plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label htmlFor="custom-domain-input" className="mb-1 block text-sm font-medium text-slate-700">
                Domain
              </label>
              <input
                id="custom-domain-input"
                type="text"
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder="www.raystudio.com"
                disabled={actionLoading === "verify" || actionLoading === "disconnect"}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Use the www version for the smoothest setup, for example www.yourstudio.com.
              </p>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={() => void handleConnect()}
                disabled={actionLoading === "verify" || actionLoading === "disconnect"}
                className="w-full sm:w-auto"
              >
                {actionLoading === "connect"
                  ? connectedDomain
                    ? "Updating..."
                    : "Connecting..."
                  : connectedDomain
                    ? "Update Domain"
                    : "Connect Domain"}
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 md:p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{status.description}</p>
                {noticeMessage ? <p className="mt-1 text-xs text-slate-600 md:text-sm">{noticeMessage}</p> : null}
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            </div>
          ) : null}

          {showConnectionDetails ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 md:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Domain</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="break-all text-sm font-semibold text-slate-900">{connectedDomain}</p>
                  {resolvedState.status === "active" ? (
                    <a
                      href={`https://${connectedDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-800"
                    >
                      Open
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 md:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SSL Status</p>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {resolvedState.sslStatus === "issued" ? (
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                  ) : resolvedState.sslStatus === "error" ? (
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                  ) : (
                    <RefreshCw
                      className={`h-4 w-4 text-cyan-600 ${
                        resolvedState.status === "verifying" ? "animate-spin" : ""
                      }`}
                    />
                  )}
                  <span>{sslLabel}</span>
                </div>
                {checkedAtLabel ? (
                  <p className="mt-2 text-xs text-slate-500">Last checked: {checkedAtLabel}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {showDnsInstructions && dnsInstructions ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 md:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">DNS Instructions</p>
                  <p className="mt-1 text-xs text-slate-600 md:text-sm">
                    Create this record at your DNS provider, then verify it here.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleVerify()}
                  disabled={actionLoading === "verify" || actionLoading === "disconnect"}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      actionLoading === "verify" || resolvedState.status === "verifying"
                        ? "animate-spin"
                        : ""
                    }`}
                  />
                  {actionLoading === "verify" ? "Verifying..." : "Verify Now"}
                </Button>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)] md:gap-3 md:px-4 md:py-3 md:text-xs">
                  <span>Type</span>
                  <span>Name / Host</span>
                  <span>Value / Target</span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-3 py-3 text-sm text-slate-700 md:grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)] md:gap-3 md:px-4 md:py-4">
                  <span className="font-semibold text-slate-900">{dnsInstructions.type}</span>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-900">{dnsInstructions.host}</span>
                      <CopyButton
                        copied={copiedField === "host"}
                        onClick={() => void handleCopy("host", dnsInstructions.host)}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-900">{dnsInstructions.value}</span>
                      <CopyButton
                        copied={copiedField === "target"}
                        onClick={() => void handleCopy("target", dnsInstructions.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                If you also want the root domain, forward it to the www version at your registrar.
              </p>
              {checkedAtLabel ? (
                <p className="mt-2 text-xs text-slate-500">Last checked: {checkedAtLabel}</p>
              ) : null}
            </div>
          ) : null}

          {connectedDomain ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleDisconnect()}
                disabled={actionLoading === "verify" || actionLoading === "disconnect"}
                className="border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Unplug className="h-4 w-4" />
                {actionLoading === "disconnect" ? "Disconnecting..." : "Disconnect"}
              </Button>
              {mockModeLabel ? (
                <p className="text-xs text-slate-500">
                  {mockModeLabel} Domains containing fail, broken, or invalid simulate a verification failure.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
















