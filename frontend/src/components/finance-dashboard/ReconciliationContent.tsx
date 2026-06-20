"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  Scale,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  reconciliationApi,
  ApiError,
  type ReconciliationFinding,
  type ReconciliationScan,
  type ReconciliationDriftType,
  type ReconciliationFindingStatus,
} from "@/lib/api";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

type StatusTab = ReconciliationFindingStatus | "all";

const STATUS_TABS: StatusTab[] = ["unresolved", "resolved", "ignored", "all"];

const DRIFT_TYPE_LABEL: Record<ReconciliationDriftType, string> = {
  missing_local: "Missing locally",
  missing_gateway: "Missing on gateway",
  amount_mismatch: "Amount mismatch",
  status_mismatch: "Status mismatch",
};

const DRIFT_TYPE_PILL: Record<ReconciliationDriftType, string> = {
  missing_local: "bg-[#FEE2E2] text-[#B91C1C]",
  missing_gateway: "bg-[#FFEDD5] text-[#C2410C]",
  amount_mismatch: "bg-[#FEF3C7] text-[#92400E]",
  status_mismatch: "bg-[#DBEAFE] text-[#1D4ED8]",
};

export default function ReconciliationContent() {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = useFinanceProfile();

  const [statusTab, setStatusTab] = useState<StatusTab>("unresolved");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<ReconciliationFinding[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{
    unresolved: number;
    byDriftType: Record<string, number>;
    byGateway: Record<string, number>;
    lastScans: ReconciliationScan[];
  } | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ReconciliationFinding | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<ReconciliationFinding | null>(null);
  const [viewTarget, setViewTarget] = useState<ReconciliationFinding | null>(null);
  const [note, setNote] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        reconciliationApi.listFindings({ status: statusTab, page, limit: 20 }),
        reconciliationApi.getStats(),
      ]);
      setItems(list.data);
      setTotalPages(list.pagination.totalPages);
      setTotal(list.pagination.total);
      setStats(s);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load reconciliation data");
    } finally {
      setLoading(false);
    }
  }, [statusTab, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await reconciliationApi.runScan({ gateway: "moyasar" });
      toast.success(
        `Scan complete — scanned ${result.recordsScanned} records, found ${result.driftsFound} drifts`,
      );
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setActingId(resolveTarget.id);
    try {
      await reconciliationApi.resolve(resolveTarget.id, note.trim() || undefined);
      toast.success("Finding marked as resolved");
      setResolveTarget(null);
      setNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to resolve");
    } finally {
      setActingId(null);
    }
  };

  const handleIgnore = async () => {
    if (!ignoreTarget) return;
    if (note.trim().length < 5) {
      toast.error("Note must be at least 5 characters");
      return;
    }
    setActingId(ignoreTarget.id);
    try {
      await reconciliationApi.ignore(ignoreTarget.id, note.trim());
      toast.success("Finding marked as ignored");
      setIgnoreTarget(null);
      setNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to ignore");
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <FinanceNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>
            <FinanceMobileSidebar profile={profile} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)] flex items-center gap-2">
                    <Scale className="w-6 h-6 text-[var(--color-primary)]" />
                    Reconciliation
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    Drift between our payment records and the gateway&apos;s own data
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors disabled:opacity-60"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {scanning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Scale className="w-4 h-4" />
                    )}
                    {scanning ? "Scanning…" : "Run scan now"}
                  </button>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                <KpiCard
                  label="Unresolved"
                  value={stats?.unresolved ?? "—"}
                  emphasis={(stats?.unresolved ?? 0) > 0 ? "danger" : "normal"}
                />
                <KpiCard
                  label="Missing locally"
                  value={stats?.byDriftType?.missing_local ?? 0}
                />
                <KpiCard
                  label="Missing on gateway"
                  value={stats?.byDriftType?.missing_gateway ?? 0}
                />
                <KpiCard
                  label="Mismatches"
                  value={
                    (stats?.byDriftType?.amount_mismatch ?? 0) +
                    (stats?.byDriftType?.status_mismatch ?? 0)
                  }
                />
              </div>

              {/* Last scans */}
              {stats?.lastScans && stats.lastScans.length > 0 && (
                <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3 mb-6">
                  <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                    Recent scans
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stats.lastScans.slice(0, 5).map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 px-2 py-1 bg-[var(--color-surface-page)] rounded text-xs"
                      >
                        <span className="font-medium">{s.gateway}</span>
                        <span className="text-[var(--color-text-secondary)]">
                          {new Date(s.startedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            s.status === "succeeded"
                              ? "bg-green-100 text-green-700"
                              : s.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {s.status}
                        </span>
                        {s.status === "succeeded" && (
                          <span className="text-[var(--color-text-secondary)]">
                            {s.recordsScanned} scanned · {s.driftsFound} drifts
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status tabs */}
              <div className="flex flex-wrap gap-2 mb-4" role="tablist">
                {STATUS_TABS.map((key) => {
                  const active = statusTab === key;
                  return (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setStatusTab(key);
                        setPage(1);
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                        active
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-page)]"
                      }`}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>

              {/* Findings table */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                    <Check className="w-12 h-12 text-[var(--color-text-secondary)] opacity-40 mb-3" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      No findings
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {statusTab === "unresolved"
                        ? "Everything looks reconciled. Run a scan to check again."
                        : `No ${statusTab} findings.`}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
                        <tr>
                          <th className="text-left p-3 font-medium">Drift</th>
                          <th className="text-left p-3 font-medium">Gateway</th>
                          <th className="text-left p-3 font-medium">Charge / Payment ID</th>
                          <th className="text-left p-3 font-medium">Customer</th>
                          <th className="text-left p-3 font-medium">Detected</th>
                          <th className="text-right p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((f) => (
                          <tr
                            key={f.id}
                            className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-page)]"
                          >
                            <td className="p-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  DRIFT_TYPE_PILL[f.driftType] ||
                                  "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"
                                }`}
                              >
                                {DRIFT_TYPE_LABEL[f.driftType] || f.driftType}
                              </span>
                            </td>
                            <td className="p-3 capitalize">{f.gateway}</td>
                            <td className="p-3 font-mono text-xs">
                              {f.gatewayChargeId ||
                                (f.paymentId ? f.paymentId.slice(0, 12) + "…" : "—")}
                            </td>
                            <td className="p-3">
                              {f.userName || f.userEmail || "—"}
                              {f.courseTitle && (
                                <div className="text-xs text-[var(--color-text-secondary)]">
                                  {f.courseTitle}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-[var(--color-text-secondary)]">
                              {new Date(f.createdAt).toLocaleString(
                                locale === "ar" ? "ar-SA" : "en-US",
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => setViewTarget(f)}
                                  className="p-1.5 rounded hover:bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]"
                                  aria-label="View details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {f.status === "unresolved" && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setResolveTarget(f);
                                        setNote("");
                                      }}
                                      disabled={actingId === f.id}
                                      className="px-2 py-1 text-xs font-medium text-emerald-700 border border-emerald-300 rounded hover:bg-emerald-50"
                                    >
                                      Resolve
                                    </button>
                                    <button
                                      onClick={() => {
                                        setIgnoreTarget(f);
                                        setNote("");
                                      }}
                                      disabled={actingId === f.id}
                                      className="px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-page)]"
                                    >
                                      Ignore
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t border-[var(--color-border)]">
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {total} findings · page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="p-1.5 rounded border border-[var(--color-border)] disabled:opacity-40"
                      >
                        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded border border-[var(--color-border)] disabled:opacity-40"
                      >
                        {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resolve modal */}
      {resolveTarget && (
        <Modal
          title="Mark as resolved"
          subtitle="The drift has been addressed. The note (optional) is for audit history."
          onClose={() => {
            setResolveTarget(null);
            setNote("");
          }}
          onConfirm={handleResolve}
          confirmLabel="Mark resolved"
          confirmClass="bg-emerald-600 hover:bg-emerald-700"
          icon={<Check className="w-5 h-5 text-emerald-600" />}
          note={note}
          setNote={setNote}
          notePlaceholder="Optional — e.g. 'Resynced from Moyasar manually'"
          loading={actingId === resolveTarget.id}
        />
      )}

      {/* Ignore modal */}
      {ignoreTarget && (
        <Modal
          title="Ignore this finding"
          subtitle="Use for test data, known abandoned attempts, or other non-actionable drift. Note is required."
          onClose={() => {
            setIgnoreTarget(null);
            setNote("");
          }}
          onConfirm={handleIgnore}
          confirmLabel="Ignore"
          confirmClass="bg-[var(--color-text-secondary)] hover:opacity-90"
          icon={<X className="w-5 h-5 text-[var(--color-text-secondary)]" />}
          note={note}
          setNote={setNote}
          notePlaceholder="Required — explain why this finding doesn't need action (≥5 chars)"
          loading={actingId === ignoreTarget.id}
        />
      )}

      {/* View details modal */}
      {viewTarget && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setViewTarget(null)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Finding details
              </h3>
              <button
                onClick={() => setViewTarget(null)}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-page)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <DetailRow label="Drift type" value={DRIFT_TYPE_LABEL[viewTarget.driftType]} />
              <DetailRow label="Gateway" value={viewTarget.gateway} />
              <DetailRow label="Status" value={viewTarget.status} />
              <DetailRow
                label="Gateway charge ID"
                value={viewTarget.gatewayChargeId || "—"}
                mono
              />
              <DetailRow
                label="Local payment ID"
                value={viewTarget.paymentId || "—"}
                mono
              />
              <DetailRow label="Customer" value={viewTarget.userName || viewTarget.userEmail || "—"} />
              <DetailRow label="Course" value={viewTarget.courseTitle || "—"} />
              <DetailRow
                label="Detected"
                value={new Date(viewTarget.createdAt).toLocaleString(
                  locale === "ar" ? "ar-SA" : "en-US",
                )}
              />
              <div>
                <div className="text-xs text-[var(--color-text-secondary)] font-medium mb-1">
                  Our value
                </div>
                <pre className="bg-[var(--color-surface-page)] p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(viewTarget.ourValue, null, 2) || "null"}
                </pre>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-secondary)] font-medium mb-1">
                  Gateway value
                </div>
                <pre className="bg-[var(--color-surface-page)] p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(viewTarget.gatewayValue, null, 2) || "null"}
                </pre>
              </div>
              {viewTarget.resolutionNote && (
                <DetailRow label="Resolution note" value={viewTarget.resolutionNote} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function KpiCard({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number | string;
  emphasis?: "danger" | "normal";
}) {
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-4">
      <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`text-2xl font-bold mt-1 ${
          emphasis === "danger" ? "text-red-600" : "text-[var(--on-surface-default)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-text-secondary)] font-medium flex-shrink-0">{label}</dt>
      <dd
        className={`text-[var(--color-text-primary)] text-right break-all ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  onConfirm,
  confirmLabel,
  confirmClass,
  icon,
  note,
  setNote,
  notePlaceholder,
  loading,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmClass: string;
  icon: React.ReactNode;
  note: string;
  setNote: (n: string) => void;
  notePlaceholder: string;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          {icon}
          <div className="flex-1">
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{subtitle}</p>
          </div>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={notePlaceholder}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 flex items-center gap-2 ${confirmClass}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
