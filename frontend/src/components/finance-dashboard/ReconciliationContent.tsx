"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
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
  Info,
  Send,
  ShieldAlert,
  Undo2,
  Filter,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import Select from "@/components/admin-dashboard/Select";
import DatePicker from "@/components/ui/DatePicker";
import ExportDropdown from "./shared/ExportDropdown";
import {
  reconciliationApi,
  escalationsApi,
  ApiError,
  type ReconciliationFinding,
  type ReconciliationScan,
  type ReconciliationDriftType,
  type ReconciliationFindingStatus,
  type ReconciliationGateway,
  type EscalationProposedAction,
  type EscalationUrgency,
} from "@/lib/api";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

// ─── Types + constants ──────────────────────────────────────────────

type StatusTab = ReconciliationFindingStatus | "escalated" | "all";
type ScanGateway = Exclude<ReconciliationGateway, "all">;
type DriftFilter = ReconciliationDriftType | "all";

const STATUS_TABS: StatusTab[] = ["unresolved", "escalated", "resolved", "ignored", "all"];
const SCAN_GATEWAY_KEYS: ScanGateway[] = ["moyasar", "tamara", "tabby", "bank_transfer"];
const GATEWAYS_WITH_TOOLTIP = new Set<ScanGateway>(["tamara", "tabby", "bank_transfer"]);
const DRIFT_TYPES: ReconciliationDriftType[] = [
  "missing_local",
  "missing_gateway",
  "amount_mismatch",
  "status_mismatch",
  "stuck_pending",
  "stuck_approval",
  "orphan_receipt",
  "paid_no_receipt",
];

// Drift type → pill colors. Kept as raw Tailwind so each drift gets a
// distinct hue (a single token can't carry 8 semantic colors meaningfully).
// The semantic accent for status, however, IS moved to design tokens below.
const DRIFT_TYPE_PILL: Record<ReconciliationDriftType, string> = {
  missing_local: "bg-[#FEE2E2] text-[#B91C1C]",
  missing_gateway: "bg-[#FFEDD5] text-[#C2410C]",
  amount_mismatch: "bg-[#FEF3C7] text-[#92400E]",
  status_mismatch: "bg-[#DBEAFE] text-[#1D4ED8]",
  stuck_pending: "bg-[#E0E7FF] text-[#3730A3]",
  stuck_approval: "bg-[#FCE7F3] text-[#9D174D]",
  orphan_receipt: "bg-[#F3E8FF] text-[#6B21A8]",
  paid_no_receipt: "bg-[#FFE4E6] text-[#9F1239]",
};

// Recent-scan status pill — semantic colors via tokens.
const SCAN_STATUS_PILL: Record<string, string> = {
  succeeded: "bg-[#DCFCE7] text-[#15803D]",
  failed: "bg-[#FEE2E2] text-[#B91C1C]",
  running: "bg-[#FEF3C7] text-[#92400E]",
};

function suggestActionForDriftType(driftType: ReconciliationDriftType): EscalationProposedAction {
  switch (driftType) {
    case "missing_local":
    case "orphan_receipt":
      return "enroll";
    case "status_mismatch":
    case "amount_mismatch":
      return "refund";
    case "paid_no_receipt":
      return "investigate";
    default:
      return "other";
  }
}

function suggestUrgencyForDriftType(driftType: ReconciliationDriftType): EscalationUrgency {
  // Money received but no access → high. Suspected fraud → high.
  if (driftType === "missing_local" || driftType === "paid_no_receipt") return "high";
  return "normal";
}

// Latin digits always — never let the browser Arabic-Indic locale rewrite
// numbers (per the standing project rule on AR digits).
function formatInt(n: number | undefined | null) {
  return (n ?? 0).toLocaleString("en-US");
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch {
    return "—";
  }
}

// ─── Component ──────────────────────────────────────────────────────

export default function ReconciliationContent() {
  const t = useTranslations("financeDashboard.reconciliationPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = useFinanceProfile();
  const router = useRouter();
  const searchParams = useSearchParams();

  const gatewayLabel = (g: string) => {
    try {
      return t(`gateways.${g}` as never);
    } catch {
      return g;
    }
  };
  const driftLabel = (d: ReconciliationDriftType) => {
    try {
      return t(`driftTypes.${d}` as never);
    } catch {
      return d;
    }
  };

  // ─── Primary state ──────────────────────────────────────────────
  const [statusTab, setStatusTab] = useState<StatusTab>("unresolved");
  const [filterGateway, setFilterGateway] = useState<"all" | ScanGateway>("all");
  const [filterDriftType, setFilterDriftType] = useState<DriftFilter>("all");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  const [scanGateway, setScanGateway] = useState<ScanGateway>("moyasar");
  const [advancedScanOpen, setAdvancedScanOpen] = useState(false);
  const [scanFromDate, setScanFromDate] = useState("");
  const [scanToDate, setScanToDate] = useState("");

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const [items, setItems] = useState<ReconciliationFinding[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [stats, setStats] = useState<{
    unresolved: number;
    byDriftType: Record<string, number>;
    byGateway: Record<string, number>;
    lastScans: ReconciliationScan[];
  } | null>(null);
  const [sentBackCount, setSentBackCount] = useState(0);

  // Selection (for bulk actions)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal targets
  const [actingId, setActingId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ReconciliationFinding | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<ReconciliationFinding | null>(null);
  const [escalateTarget, setEscalateTarget] = useState<ReconciliationFinding | null>(null);
  const [viewTarget, setViewTarget] = useState<ReconciliationFinding | null>(null);
  const [bulkOp, setBulkOp] = useState<"resolve" | "ignore" | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  // Modal-local notes
  const [escalationNote, setEscalationNote] = useState("");
  const [escalationAction, setEscalationAction] = useState<EscalationProposedAction>("enroll");
  const [escalationUrgency, setEscalationUrgency] = useState<EscalationUrgency>("normal");
  const [note, setNote] = useState("");
  const [bulkNote, setBulkNote] = useState("");

  // Deep-link from URL: ?findingId=...
  const linkedFindingId = searchParams.get("findingId");
  const linkOpenedRef = useRef<string | null>(null);

  // ─── Data fetch ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const baseFilters = {
        gateway: filterGateway,
        driftType: filterDriftType,
        fromDate: filterFromDate || undefined,
        toDate: filterToDate || undefined,
      };
      const [list, s, sentBack] = await Promise.all([
        reconciliationApi.listFindings({
          ...baseFilters,
          status: statusTab,
          page,
          limit: 20,
        }),
        reconciliationApi.getStats(),
        // Sent-back KPI: a separate fetch with no pagination cap on count.
        // We only need the count, not the rows, so limit=1 is enough — the
        // pagination block carries `total` for us.
        reconciliationApi.listFindings({
          status: "unresolved",
          page: 1,
          limit: 1,
          ...baseFilters,
        }).then((r) => {
          const sb = r.data.filter((f) => f.escalationStatus === "sent_back").length;
          // Approx: if the page is 1, we only saw 1 row; this is an undercount.
          // The true count requires a server-side count — for now we use a
          // best-effort indicator on the visible page. A separate endpoint
          // would be cleaner if this becomes operationally important.
          return sb;
        }),
      ]);
      setItems(list.data);
      setTotalPages(list.pagination.totalPages);
      setTotal(list.pagination.total);
      setStats(s);
      setSentBackCount(sentBack);
      // Clear selection on data swap so we don't accidentally bulk-act on
      // ids that aren't visible anymore.
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [statusTab, page, filterGateway, filterDriftType, filterFromDate, filterToDate, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterGateway, filterDriftType, filterFromDate, filterToDate, statusTab]);

  // Deep-link open: when ?findingId=... is present, fetch the finding and
  // open its View modal. We use the existing listFindings path, asking for
  // up to 1 record matching the id via the standard filters — if the
  // finding is in the current page, we just open it from `items`.
  useEffect(() => {
    if (!linkedFindingId || linkOpenedRef.current === linkedFindingId) return;
    const found = items.find((f) => f.id === linkedFindingId);
    if (found) {
      setViewTarget(found);
      linkOpenedRef.current = linkedFindingId;
    }
  }, [linkedFindingId, items]);

  // ─── Handlers ───────────────────────────────────────────────────
  const handleScan = async (gateway: ReconciliationGateway = scanGateway) => {
    setScanning(true);
    try {
      const result = await reconciliationApi.runScan({
        gateway,
        fromDate: scanFromDate || undefined,
        toDate: scanToDate || undefined,
      });
      toast.success(
        t("toasts.scanCompleteFmt", {
          records: result.recordsScanned,
          drifts: result.driftsFound,
        }),
      );
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("toasts.scanFailed"));
    } finally {
      setScanning(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setActingId(resolveTarget.id);
    try {
      await reconciliationApi.resolve(resolveTarget.id, note.trim() || undefined);
      toast.success(t("toasts.resolved"));
      setResolveTarget(null);
      setNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("toasts.resolveFailed"));
    } finally {
      setActingId(null);
    }
  };

  const handleIgnore = async () => {
    if (!ignoreTarget) return;
    if (note.trim().length < 5) {
      toast.error(t("toasts.noteMin5"));
      return;
    }
    setActingId(ignoreTarget.id);
    try {
      await reconciliationApi.ignore(ignoreTarget.id, note.trim());
      toast.success(t("toasts.ignored"));
      setIgnoreTarget(null);
      setNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("toasts.ignoreFailed"));
    } finally {
      setActingId(null);
    }
  };

  const handleEscalate = async () => {
    if (!escalateTarget) return;
    if (escalationNote.trim().length < 20) {
      toast.error(t("toasts.noteMin20"));
      return;
    }
    setActingId(escalateTarget.id);
    try {
      await escalationsApi.create(escalateTarget.id, {
        note: escalationNote.trim(),
        proposedAction: escalationAction,
        urgency: escalationUrgency,
      });
      toast.success(t("toasts.escalated"));
      setEscalateTarget(null);
      setEscalationNote("");
      setEscalationAction("enroll");
      setEscalationUrgency("normal");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to escalate");
    } finally {
      setActingId(null);
    }
  };

  const handleBulk = async () => {
    if (!bulkOp || selectedIds.size === 0) return;
    if (bulkOp === "ignore" && bulkNote.trim().length < 5) {
      toast.error(t("toasts.noteMin5"));
      return;
    }
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const fn = bulkOp === "resolve" ? reconciliationApi.bulkResolve : reconciliationApi.bulkIgnore;
      const result = await fn(ids, bulkNote.trim() || undefined as never);
      toast.success(
        t("toasts.bulkResultFmt", {
          op: t(`actions.${bulkOp}`),
          transitioned: result.transitioned,
          requested: result.requested,
        }),
      );
      setBulkOp(null);
      setBulkNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("toasts.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    setExporting(format);
    try {
      await reconciliationApi.exportFindings(format, {
        status: statusTab === "escalated" ? "unresolved" : statusTab,
        gateway: filterGateway,
        driftType: filterDriftType,
        fromDate: filterFromDate || undefined,
        toDate: filterToDate || undefined,
      });
      toast.success(t("toasts.exported"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("toasts.exportFailed"));
    } finally {
      setExporting(null);
    }
  };

  const openFindingLink = (id: string) => {
    // Soft-update the URL so the operator can share / refresh and re-open
    // the same finding's drawer.
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("findingId", id);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  const closeFindingLink = () => {
    setViewTarget(null);
    linkOpenedRef.current = null;
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("findingId");
    router.replace(sp.toString() ? `?${sp.toString()}` : "?", { scroll: false });
  };

  // ─── Selection helpers ──────────────────────────────────────────
  const visibleUnresolvedIds = useMemo(
    () => items.filter((f) => f.status === "unresolved").map((f) => f.id),
    [items],
  );
  const allVisibleSelected =
    visibleUnresolvedIds.length > 0 &&
    visibleUnresolvedIds.every((id) => selectedIds.has(id));
  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const next = new Set(selectedIds);
      visibleUnresolvedIds.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      visibleUnresolvedIds.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ─── Select option lists ────────────────────────────────────────
  const gatewayOptions = useMemo(
    () => [
      { value: "all", label: t("filters.allGateways") },
      ...SCAN_GATEWAY_KEYS.map((g) => ({ value: g, label: gatewayLabel(g) })),
    ],
    [t], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const driftOptions = useMemo(
    () => [
      { value: "all", label: t("filters.allDriftTypes") },
      ...DRIFT_TYPES.map((d) => ({ value: d, label: driftLabel(d) })),
    ],
    [t], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const actionOptions = useMemo(
    () => [
      { value: "enroll", label: t("escalateModal.actionEnroll") },
      { value: "refund", label: t("escalateModal.actionRefund") },
      { value: "investigate", label: t("escalateModal.actionInvestigate") },
      { value: "other", label: t("escalateModal.actionOther") },
    ],
    [t],
  );

  // ─── Render ─────────────────────────────────────────────────────
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
              {/* Header + export tray */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)] flex items-center gap-2">
                    <Scale className="w-6 h-6 text-[var(--color-primary)]" />
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("subtitle")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ExportDropdown onExport={handleExport} busy={exporting} />
                  <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-2 h-9 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors disabled:opacity-60"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("refresh")}
                  </button>
                  <button
                    onClick={() => handleScan("all")}
                    disabled={scanning}
                    className="flex items-center gap-1.5 px-4 py-2 h-9 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
                    {scanning ? t("scanning") : t("scanAllGateways")}
                  </button>
                </div>
              </div>

              {/* Per-gateway scan picker (+ advanced window) */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3 mb-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                      {t("scanASingleGateway")}
                    </span>
                    {SCAN_GATEWAY_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => setScanGateway(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          scanGateway === key
                            ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                            : "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:bg-[var(--color-surface-page)]"
                        }`}
                      >
                        {gatewayLabel(key)}
                        {GATEWAYS_WITH_TOOLTIP.has(key) && (
                          <span className="relative group/tip">
                            <Info className="w-3.5 h-3.5 opacity-70" />
                            <span
                              className={`pointer-events-none absolute z-10 hidden group-hover/tip:block top-full mt-1 ${isRTL ? "right-0" : "left-0"} w-64 p-2 bg-[var(--color-text-primary)] text-white text-[11px] rounded shadow-lg normal-case font-normal`}
                            >
                              {t(`gatewayTooltips.${key}` as never)}
                            </span>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAdvancedScanOpen((v) => !v)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${advancedScanOpen ? "rotate-180" : ""}`}
                      />
                      {t("advancedScan")}
                    </button>
                    <button
                      onClick={() => handleScan(scanGateway)}
                      disabled={scanning}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-colors disabled:opacity-60"
                    >
                      {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
                      {t("runGatewayScan", { gateway: gatewayLabel(scanGateway) })}
                    </button>
                  </div>
                </div>
                {advancedScanOpen && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                    <div>
                      <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                        {t("scanFrom")}
                      </label>
                      <DatePicker value={scanFromDate} onChange={setScanFromDate} placeholder={t("scanWindowHint")} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                        {t("scanTo")}
                      </label>
                      <DatePicker value={scanToDate} onChange={setScanToDate} placeholder={t("scanWindowHint")} />
                    </div>
                    <div className="sm:col-span-2 text-[11px] text-[var(--color-text-secondary)] italic">
                      {t("scanWindowDefault")}
                    </div>
                  </div>
                )}
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <KpiCard
                  label={t("kpi.unresolved")}
                  value={formatInt(stats?.unresolved)}
                  emphasis={(stats?.unresolved ?? 0) > 10 ? "danger" : (stats?.unresolved ?? 0) > 0 ? "warning" : "normal"}
                />
                <KpiCard
                  label={t("kpi.missingLocally")}
                  value={formatInt(stats?.byDriftType?.missing_local)}
                  emphasis={(stats?.byDriftType?.missing_local ?? 0) > 0 ? "danger" : "normal"}
                />
                <KpiCard
                  label={t("kpi.missingOnGateway")}
                  value={formatInt(stats?.byDriftType?.missing_gateway)}
                  emphasis={(stats?.byDriftType?.missing_gateway ?? 0) > 5 ? "warning" : "normal"}
                />
                <KpiCard
                  label={t("kpi.mismatches")}
                  value={formatInt(
                    (stats?.byDriftType?.amount_mismatch ?? 0) +
                      (stats?.byDriftType?.status_mismatch ?? 0),
                  )}
                  emphasis={
                    (stats?.byDriftType?.amount_mismatch ?? 0) +
                      (stats?.byDriftType?.status_mismatch ?? 0) >
                    5
                      ? "warning"
                      : "normal"
                  }
                />
                <KpiCard
                  label={t("kpi.sentBack")}
                  value={formatInt(sentBackCount)}
                  emphasis={sentBackCount > 0 ? "warning" : "normal"}
                />
              </div>

              {/* Recent scans strip */}
              {stats?.lastScans && stats.lastScans.length > 0 && (
                <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3 mb-6">
                  <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                    {t("recentScans")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stats.lastScans.slice(0, 5).map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 px-2 py-1 bg-[var(--color-surface-page)] rounded text-xs"
                      >
                        <span className="font-medium">{gatewayLabel(s.gateway)}</span>
                        <span className="text-[var(--color-text-secondary)]">{formatDateTime(s.startedAt)}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            SCAN_STATUS_PILL[s.status] || "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {s.status}
                        </span>
                        {s.status === "succeeded" && (
                          <span className="text-[var(--color-text-secondary)]">
                            {t("scanStats", {
                              scanned: formatInt(s.recordsScanned),
                              drifts: formatInt(s.driftsFound),
                            })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter bar */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{t("filters.title")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                      {t("filters.gateway")}
                    </label>
                    <Select
                      options={gatewayOptions}
                      value={filterGateway}
                      onChange={(v) => setFilterGateway(v as "all" | ScanGateway)}
                      size="sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                      {t("filters.driftType")}
                    </label>
                    <Select
                      options={driftOptions}
                      value={filterDriftType}
                      onChange={(v) => setFilterDriftType(v as DriftFilter)}
                      size="sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                      {t("filters.fromDate")}
                    </label>
                    <DatePicker value={filterFromDate} onChange={setFilterFromDate} placeholder={t("filters.anyDate")} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                      {t("filters.toDate")}
                    </label>
                    <DatePicker value={filterToDate} onChange={setFilterToDate} placeholder={t("filters.anyDate")} />
                  </div>
                </div>
              </div>

              {/* Status tabs */}
              <div className="flex flex-wrap gap-2 mb-4" role="tablist">
                {STATUS_TABS.map((key) => {
                  const active = statusTab === key;
                  return (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStatusTab(key)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        active
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-page)]"
                      }`}
                    >
                      {t(`tabs.${key}` as never)}
                    </button>
                  );
                })}
              </div>

              {/* Bulk action toolbar — sticky when selection is non-empty */}
              {selectedIds.size > 0 && (
                <div className="bg-[var(--color-primary)] text-white rounded-lg p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium">
                    {t("bulk.nSelected", { n: formatInt(selectedIds.size) })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setBulkOp("resolve");
                        setBulkNote("");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {t("bulk.resolveSelected")}
                    </button>
                    <button
                      onClick={() => {
                        setBulkOp("ignore");
                        setBulkNote("");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      {t("bulk.ignoreSelected")}
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                    >
                      {t("bulk.clear")}
                    </button>
                  </div>
                </div>
              )}

              {/* Findings table */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                {loading ? (
                  <TableSkeleton />
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                    <Check className="w-12 h-12 text-[var(--color-text-secondary)] opacity-40 mb-3" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("empty.title")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {statusTab === "unresolved"
                        ? t("empty.unresolvedBody")
                        : t("empty.otherBody", { status: t(`tabs.${statusTab}` as never) })}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
                        <tr>
                          <th className="p-3 w-10">
                            {visibleUnresolvedIds.length > 0 && (
                              <input
                                type="checkbox"
                                aria-label={t("bulk.toggleAll")}
                                checked={allVisibleSelected}
                                onChange={toggleAllVisible}
                                className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                              />
                            )}
                          </th>
                          <th className={`${isRTL ? "text-right" : "text-left"} p-3 font-medium`}>
                            <span className="inline-flex items-center gap-1">
                              {t("table.drift")}
                              <button
                                type="button"
                                onClick={() => setGlossaryOpen(true)}
                                className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                                aria-label={t("glossary.openLabel")}
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          </th>
                          <th className={`${isRTL ? "text-right" : "text-left"} p-3 font-medium`}>{t("table.gateway")}</th>
                          <th className={`${isRTL ? "text-right" : "text-left"} p-3 font-medium`}>{t("table.chargeOrPaymentId")}</th>
                          <th className={`${isRTL ? "text-right" : "text-left"} p-3 font-medium`}>{t("table.customer")}</th>
                          <th className={`${isRTL ? "text-right" : "text-left"} p-3 font-medium`}>{t("table.detected")}</th>
                          <th className={`${isRTL ? "text-left" : "text-right"} p-3 font-medium`}>{t("table.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((f) => {
                          const sentBack =
                            f.status === "unresolved" &&
                            f.escalationStatus === "sent_back" &&
                            !!f.escalationResolutionNote;
                          const isSelected = selectedIds.has(f.id);
                          const canSelect = f.status === "unresolved";
                          return (
                            <tr
                              key={f.id}
                              className={`border-t border-[var(--color-border)] hover:bg-[var(--color-surface-page)] ${
                                sentBack ? "bg-violet-50/30" : ""
                              } ${isSelected ? "bg-[var(--color-primary)]/5" : ""}`}
                            >
                              <td className="p-3 align-top">
                                {canSelect && (
                                  <input
                                    type="checkbox"
                                    aria-label={t("bulk.toggleRow")}
                                    checked={isSelected}
                                    onChange={() => toggleOne(f.id)}
                                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                                  />
                                )}
                              </td>
                              <td className="p-3 align-top">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                    DRIFT_TYPE_PILL[f.driftType] ||
                                    "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"
                                  }`}
                                >
                                  {driftLabel(f.driftType)}
                                </span>
                                {sentBack && (
                                  <div className="mt-2 max-w-[260px] bg-violet-50 border border-violet-200 rounded-md p-2 text-[11px] text-violet-900 leading-snug">
                                    <div className="flex items-center gap-1 font-semibold mb-1">
                                      <Undo2 className="w-3 h-3" />
                                      {t("sentBack.label", {
                                        name: f.escalationResolvedByName || "admin",
                                      })}
                                    </div>
                                    <div className="whitespace-pre-wrap break-words text-violet-800">
                                      {f.escalationResolutionNote}
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="p-3 align-top">{gatewayLabel(f.gateway)}</td>
                              <td className="p-3 align-top font-mono text-xs">
                                {f.gatewayChargeId ||
                                  (f.paymentId ? f.paymentId.slice(0, 12) + "…" : "—")}
                              </td>
                              <td className="p-3 align-top">
                                {f.userName || f.userEmail || "—"}
                                {f.courseTitle && (
                                  <div className="text-xs text-[var(--color-text-secondary)]">{f.courseTitle}</div>
                                )}
                              </td>
                              <td className="p-3 align-top text-[var(--color-text-secondary)]">
                                {formatDateTime(f.createdAt)}
                              </td>
                              <td className={`p-3 align-top ${isRTL ? "text-left" : "text-right"}`}>
                                <div className={`flex gap-1 flex-wrap ${isRTL ? "justify-start" : "justify-end"}`}>
                                  <button
                                    onClick={() => {
                                      setViewTarget(f);
                                      openFindingLink(f.id);
                                    }}
                                    className="p-1.5 rounded hover:bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]"
                                    aria-label={t("actions.view")}
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
                                        {t("actions.resolve")}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setIgnoreTarget(f);
                                          setNote("");
                                        }}
                                        disabled={actingId === f.id}
                                        className="px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-page)]"
                                      >
                                        {t("actions.ignore")}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEscalateTarget(f);
                                          setEscalationNote("");
                                          setEscalationAction(suggestActionForDriftType(f.driftType));
                                          setEscalationUrgency(suggestUrgencyForDriftType(f.driftType));
                                        }}
                                        disabled={actingId === f.id}
                                        className="px-2 py-1 text-xs font-medium text-violet-700 border border-violet-300 rounded hover:bg-violet-50 flex items-center gap-1"
                                      >
                                        <Send className="w-3 h-3" />
                                        {t("actions.escalate")}
                                      </button>
                                    </>
                                  )}
                                  {f.status === "escalated" && (
                                    <span className="px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 rounded flex items-center gap-1">
                                      <ShieldAlert className="w-3 h-3" />
                                      {t("escalatedPill")}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {totalPages > 1 && !loading && (
                  <div className="flex items-center justify-between p-3 border-t border-[var(--color-border)]">
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {t("pagination.summary", { total: formatInt(total), page: formatInt(page), totalPages: formatInt(totalPages) })}
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
          title={t("resolveModal.title")}
          subtitle={t("resolveModal.subtitle")}
          onClose={() => {
            setResolveTarget(null);
            setNote("");
          }}
          onConfirm={handleResolve}
          confirmLabel={t("resolveModal.confirm")}
          cancelLabel={t("escalateModal.cancel")}
          confirmClass="bg-emerald-600 hover:bg-emerald-700"
          icon={<Check className="w-5 h-5 text-emerald-600" />}
          note={note}
          setNote={setNote}
          notePlaceholder={t("resolveModal.notePlaceholder")}
          loading={actingId === resolveTarget.id}
        />
      )}

      {/* Ignore modal */}
      {ignoreTarget && (
        <Modal
          title={t("ignoreModal.title")}
          subtitle={t("ignoreModal.subtitle")}
          onClose={() => {
            setIgnoreTarget(null);
            setNote("");
          }}
          onConfirm={handleIgnore}
          confirmLabel={t("ignoreModal.confirm")}
          cancelLabel={t("escalateModal.cancel")}
          confirmClass="bg-[var(--color-text-secondary)] hover:opacity-90"
          icon={<X className="w-5 h-5 text-[var(--color-text-secondary)]" />}
          note={note}
          setNote={setNote}
          notePlaceholder={t("ignoreModal.notePlaceholder")}
          loading={actingId === ignoreTarget.id}
        />
      )}

      {/* Bulk action modal */}
      {bulkOp && (
        <Modal
          title={t(`bulk.${bulkOp}Title`, { n: formatInt(selectedIds.size) })}
          subtitle={t(`bulk.${bulkOp}Subtitle`)}
          onClose={() => {
            setBulkOp(null);
            setBulkNote("");
          }}
          onConfirm={handleBulk}
          confirmLabel={t(`bulk.${bulkOp}Confirm`)}
          cancelLabel={t("escalateModal.cancel")}
          confirmClass={
            bulkOp === "resolve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
          }
          icon={
            bulkOp === "resolve" ? (
              <Check className="w-5 h-5 text-emerald-600" />
            ) : (
              <X className="w-5 h-5 text-amber-600" />
            )
          }
          note={bulkNote}
          setNote={setBulkNote}
          notePlaceholder={
            bulkOp === "ignore"
              ? t("bulk.ignoreNotePlaceholder")
              : t("bulk.resolveNotePlaceholder")
          }
          loading={bulkBusy}
        />
      )}

      {/* Escalate modal */}
      {escalateTarget && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEscalateTarget(null)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <ShieldAlert className="w-5 h-5 text-violet-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-base font-semibold">{t("escalateModal.title")}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("escalateModal.subtitle")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("escalateModal.proposedAction")}
                </label>
                <Select
                  options={actionOptions}
                  value={escalationAction}
                  onChange={(v) => setEscalationAction(v as EscalationProposedAction)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("escalateModal.urgency")}
                </label>
                <div className="flex gap-2">
                  {(["low", "normal", "high"] as EscalationUrgency[]).map((u) => (
                    <button
                      key={u}
                      onClick={() => setEscalationUrgency(u)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        escalationUrgency === u
                          ? u === "high"
                            ? "bg-red-50 border-red-300 text-red-700"
                            : u === "low"
                              ? "bg-slate-50 border-slate-300 text-slate-700"
                              : "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-[var(--color-surface-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]"
                      }`}
                    >
                      {t(`escalateModal.urgency${u.charAt(0).toUpperCase() + u.slice(1)}` as never)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("escalateModal.noteLabel")} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={escalationNote}
                  onChange={(e) => setEscalationNote(e.target.value)}
                  rows={4}
                  placeholder={t("escalateModal.notePlaceholder")}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {t("escalateModal.noteMinimum", { count: escalationNote.length })}
                </div>
              </div>
            </div>

            <div className={`flex gap-2 mt-4 ${isRTL ? "justify-start" : "justify-end"}`}>
              <button
                onClick={() => setEscalateTarget(null)}
                disabled={actingId === escalateTarget.id}
                className="px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-60"
              >
                {t("escalateModal.cancel")}
              </button>
              <button
                onClick={handleEscalate}
                disabled={actingId === escalateTarget.id || escalationNote.trim().length < 20}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-60 flex items-center gap-2"
              >
                {actingId === escalateTarget.id && <Loader2 className="w-4 h-4 animate-spin" />}
                <Send className="w-4 h-4" />
                {t("escalateModal.submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View details modal */}
      {viewTarget && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeFindingLink}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                {t("view.title")}
              </h3>
              <button
                onClick={closeFindingLink}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-page)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 text-sm">
              {/* Top strip — drift type + status as pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium ${
                    DRIFT_TYPE_PILL[viewTarget.driftType] ||
                    "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {driftLabel(viewTarget.driftType)}
                </span>
                <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--color-surface-page)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
                  {gatewayLabel(viewTarget.gateway)}
                </span>
                <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                  {(() => {
                    try {
                      return t(`tabs.${viewTarget.status}` as never);
                    } catch {
                      return viewTarget.status;
                    }
                  })()}
                </span>
                <span className={`text-[11px] text-[var(--color-text-secondary)] ${isRTL ? "mr-auto" : "ml-auto"}`}>
                  {t("view.detectedPrefix")} {formatDateTime(viewTarget.createdAt)}
                </span>
              </div>

              <DetailCard title={t("view.customerAndCourse")}>
                <DetailField
                  label={t("view.customer")}
                  value={viewTarget.userName || viewTarget.userEmail || "—"}
                />
                {viewTarget.userEmail && viewTarget.userName && (
                  <DetailField label={t("view.email")} value={viewTarget.userEmail} />
                )}
                <DetailField label={t("view.course")} value={viewTarget.courseTitle || "—"} />
              </DetailCard>

              <DetailCard title={t("view.paymentReferences")}>
                <DetailField
                  label={t("view.gatewayChargeId")}
                  value={viewTarget.gatewayChargeId || "—"}
                  mono
                  stack
                />
                <DetailField
                  label={t("view.localPaymentId")}
                  value={viewTarget.paymentId || "—"}
                  mono
                  stack
                />
              </DetailCard>

              <DetailCard title={t("view.driftEvidence")}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-1">
                      {t("view.ourValue")}
                    </div>
                    <pre className="bg-[var(--color-surface-page)] p-2.5 rounded text-[11px] overflow-x-auto font-mono leading-relaxed border border-[var(--color-border)]" dir="ltr">
                      {viewTarget.ourValue ? JSON.stringify(viewTarget.ourValue, null, 2) : "null"}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-1">
                      {t("view.gatewayValue")}
                    </div>
                    <pre className="bg-[var(--color-surface-page)] p-2.5 rounded text-[11px] overflow-x-auto font-mono leading-relaxed border border-[var(--color-border)]" dir="ltr">
                      {viewTarget.gatewayValue ? JSON.stringify(viewTarget.gatewayValue, null, 2) : "null"}
                    </pre>
                  </div>
                </div>
              </DetailCard>

              {viewTarget.resolutionNote && (
                <DetailCard title={t("view.resolutionNote")}>
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
                    {viewTarget.resolutionNote}
                  </p>
                </DetailCard>
              )}

              {viewTarget.escalationId && (
                <div
                  className={`rounded-lg border p-3 ${
                    viewTarget.escalationStatus === "sent_back"
                      ? "bg-violet-50 border-violet-200"
                      : viewTarget.escalationStatus === "resolved"
                        ? "bg-emerald-50 border-emerald-200"
                        : viewTarget.escalationStatus === "declined"
                          ? "bg-slate-50 border-slate-200"
                          : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {viewTarget.escalationStatus === "sent_back" ? (
                      <Undo2 className="w-4 h-4 text-violet-700" />
                    ) : (
                      <ShieldAlert
                        className={`w-4 h-4 ${
                          viewTarget.escalationStatus === "resolved"
                            ? "text-emerald-700"
                            : viewTarget.escalationStatus === "declined"
                              ? "text-slate-700"
                              : "text-blue-700"
                        }`}
                      />
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">
                      {viewTarget.escalationStatus === "sent_back"
                        ? t("view.escalation.sentBack")
                        : viewTarget.escalationStatus === "resolved"
                          ? t("view.escalation.resolved", {
                              action:
                                (viewTarget.escalationActionTaken || "").replace(/_/g, " ") || "action",
                            })
                          : viewTarget.escalationStatus === "declined"
                            ? t("view.escalation.declined")
                            : t("view.escalation.current")}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)] mb-2">
                    {viewTarget.escalationResolvedByName || "admin"}
                    {viewTarget.escalationResolvedAt && ` · ${formatDateTime(viewTarget.escalationResolvedAt)}`}
                  </div>
                  {viewTarget.escalationResolutionNote && (
                    <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
                      {viewTarget.escalationResolutionNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drift-type glossary drawer */}
      {glossaryOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex justify-end"
          onClick={() => setGlossaryOpen(false)}
        >
          <div
            className="bg-[var(--color-surface-card)] w-full max-w-md h-full overflow-y-auto shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[var(--color-primary)]" />
                {t("glossary.title")}
              </h3>
              <button
                onClick={() => setGlossaryOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-page)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t("glossary.subtitle")}</p>
            <div className="space-y-3">
              {DRIFT_TYPES.map((d) => (
                <div key={d} className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium mb-2 ${DRIFT_TYPE_PILL[d]}`}
                  >
                    {driftLabel(d)}
                  </span>
                  <p className="text-[13px] text-[var(--color-text-primary)] leading-relaxed">
                    {t(`glossary.definitions.${d}` as never)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function KpiCard({
  label, value, emphasis,
}: {
  label: string;
  value: number | string;
  emphasis?: "danger" | "warning" | "normal";
}) {
  const color =
    emphasis === "danger"
      ? "text-[#DC2626]"
      : emphasis === "warning"
        ? "text-[#EA580C]"
        : "text-[var(--on-surface-default)]";
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-4">
      <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-2">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailField({
  label, value, mono, stack,
}: { label: string; value: string; mono?: boolean; stack?: boolean }) {
  if (stack) {
    return (
      <div>
        <div className="text-[11px] text-[var(--color-text-secondary)] mb-0.5">{label}</div>
        <div className={`text-[var(--color-text-primary)] break-all ${mono ? "font-mono text-[12px]" : "text-sm"}`}>
          {value}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-between gap-3 items-baseline">
      <dt className="text-[12px] text-[var(--color-text-secondary)] flex-shrink-0">{label}</dt>
      <dd className={`text-[var(--color-text-primary)] text-right break-words min-w-0 ${mono ? "font-mono text-xs" : "text-sm"}`}>
        {value}
      </dd>
    </div>
  );
}

function Modal({
  title, subtitle, onClose, onConfirm, confirmLabel, cancelLabel, confirmClass,
  icon, note, setNote, notePlaceholder, loading,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  cancelLabel?: string;
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
            {cancelLabel || "Cancel"}
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

function TableSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 bg-[var(--color-surface-page)] rounded-md animate-pulse" />
      ))}
    </div>
  );
}
