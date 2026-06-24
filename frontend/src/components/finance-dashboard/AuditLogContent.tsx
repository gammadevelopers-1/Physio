"use client";

import { useState, useEffect, useCallback, Fragment, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import Select from "@/components/admin-dashboard/Select";
import DatePicker from "@/components/ui/DatePicker";
import ExportDropdown from "./shared/ExportDropdown";
import {
  Shield,
  ShieldCheck,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Activity,
  Users,
  TrendingUp,
  Layers,
} from "lucide-react";
import { financeApi } from "@/lib/api";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";
import { toast } from "sonner";

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  performerFirstName: string | null;
  performerLastName: string | null;
  performerEmail: string | null;
}

interface Actor {
  id: string;
  name: string;
  email: string;
}

interface AuditSummary {
  totalEvents: number;
  uniqueActors: number;
  topActions: Array<{ action: string; count: number }>;
  topEntityTypes: Array<{ entityType: string; count: number }>;
}

// Semantic colors per entity type — makes a long log scannable. Each entity
// gets a distinct hue rather than a single token because there are too many
// (8+) to share semantic accents meaningfully.
const ENTITY_PILL: Record<string, { bg: string; fg: string }> = {
  payment:                  { bg: "#DBEAFE", fg: "#1D4ED8" }, // blue
  refund:                   { bg: "#FEE2E2", fg: "#B91C1C" }, // red
  invoice:                  { bg: "#F3E8FF", fg: "#6B21A8" }, // purple
  discount_code:            { bg: "#FEF3C7", fg: "#92400E" }, // amber
  discount:                 { bg: "#FEF3C7", fg: "#92400E" }, // amber
  coupon_campaign:          { bg: "#EDE9FE", fg: "#5B21B6" }, // violet
  webhook:                  { bg: "#E2E8F0", fg: "#475569" }, // slate
  reconciliation_finding:   { bg: "#FFEDD5", fg: "#C2410C" }, // orange
  reconciliation_escalation:{ bg: "#FCE7F3", fg: "#9D174D" }, // pink
  reconciliation_scan:      { bg: "#CFFAFE", fg: "#155E75" }, // cyan
  report_export:            { bg: "#DCFCE7", fg: "#15803D" }, // green
  audit_log_export:         { bg: "#DCFCE7", fg: "#15803D" }, // green
};

// Entity type → finance dashboard URL where the entityId can be viewed.
// Returns null if there's no useful destination (e.g. webhook events, exports).
function entityDeepLink(entityType: string, entityId: string, locale: string): string | null {
  const base = `/${locale}/dashboard/finance`;
  switch (entityType) {
    case "payment":                 return `${base}/payments?paymentId=${entityId}`;
    case "refund":                  return `${base}/refunds?refundId=${entityId}`;
    case "invoice":                 return `${base}/invoices?invoiceId=${entityId}`;
    case "discount_code":
    case "discount":
    case "coupon_campaign":         return `${base}/discounts`;
    case "reconciliation_finding":  return `${base}/reconciliation?findingId=${entityId}`;
    case "reconciliation_escalation":
    case "reconciliation_scan":     return `${base}/reconciliation`;
    default:                        return null;
  }
}

// Action category → pill accent. Falls back to neutral when the action
// can't be classified — keeps the UI honest about unknown actions.
function actionCategory(action: string): "success" | "warn" | "danger" | "info" | "neutral" {
  const a = action.toLowerCase();
  if (/completed|approved|created|generated|paid|enrolled|resolved|captured|exported/.test(a)) return "success";
  if (/failed|rejected|deleted|chargeback|declined|cancelled|canceled|expired|abandoned|gave_up/.test(a)) return "danger";
  if (/requested|initiated|pending|stuck|sent_back|warning|alert/.test(a)) return "warn";
  if (/received|processed|updated|claimed|retried/.test(a)) return "info";
  return "neutral";
}

const CATEGORY_STYLES: Record<ReturnType<typeof actionCategory>, { bg: string; fg: string }> = {
  success: { bg: "#DCFCE7", fg: "#15803D" },
  warn:    { bg: "#FEF3C7", fg: "#92400E" },
  danger:  { bg: "#FEE2E2", fg: "#B91C1C" },
  info:    { bg: "#DBEAFE", fg: "#1D4ED8" },
  neutral: { bg: "#E2E8F0", fg: "#475569" },
};

// Latin digits — never let the AR locale rewrite numbers (project rule).
function formatInt(n: number | undefined | null) {
  return (n ?? 0).toLocaleString("en-US");
}

const AuditLogContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = useFinanceProfile();

  // ─── Filter state ──────────────────────────────────────────────
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [actorId, setActorId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  // ─── Data state ────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const limit = 20;
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [actors, setActors] = useState<Actor[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    entityTypes: string[];
    actions: string[];
  }>({ entityTypes: [], actions: [] });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | "pdf" | null>(null);

  // Friendly action labels via i18n dictionary (lookup, with snake-case
  // fallback so an action we haven't translated yet still renders something
  // human-readable rather than a raw key).
  const formatAction = useCallback(
    (raw: string) => {
      const key = `auditLog.actions.${raw}` as const;
      const translated = t(key);
      // next-intl returns the key path when missing — detect & fall back
      if (translated === key || translated.includes("auditLog.actions.")) {
        return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }
      return translated;
    },
    [t],
  );
  const formatEntityType = useCallback(
    (raw: string) => {
      const key = `auditLog.entityTypeLabels.${raw}` as const;
      const translated = t(key);
      if (translated === key || translated.includes("auditLog.entityTypeLabels.")) {
        return raw.replace(/_/g, " ");
      }
      return translated;
    },
    [t],
  );

  // ─── Initial fetches: filter options + actors ──────────────────
  useEffect(() => {
    financeApi.getAuditLogFilters().then(setFilterOptions).catch(() => {});
    financeApi.getAuditLogActors().then(setActors).catch(() => {});
  }, []);

  // ─── Main fetch: logs + summary ────────────────────────────────
  const currentFilters = useMemo(
    () => ({
      entityType: entityType === "all" ? undefined : entityType,
      action: action === "all" ? undefined : action,
      actorId: actorId === "all" ? undefined : actorId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: search || undefined,
    }),
    [entityType, action, actorId, startDate, endDate, search],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsResult, summaryResult] = await Promise.all([
        financeApi.getAuditLogs({ ...currentFilters, page, limit }),
        financeApi.getAuditLogSummary(currentFilters),
      ]);
      setLogs(logsResult.data);
      setTotal(logsResult.total);
      setSummary(summaryResult);
    } catch {
      toast.error(t("auditLog.toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [currentFilters, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [entityType, action, actorId, startDate, endDate, search]);

  // ─── Handlers ───────────────────────────────────────────────────
  const clearFilters = () => {
    setEntityType("all");
    setAction("all");
    setActorId("all");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setPage(1);
  };

  const hasFilters =
    entityType !== "all" ||
    action !== "all" ||
    actorId !== "all" ||
    startDate ||
    endDate ||
    search;

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    setExporting(format);
    try {
      await financeApi.downloadAuditLog(format, currentFilters);
      toast.success(t("auditLog.toasts.exported"));
      // Backend self-audits this download — refresh so the operator sees
      // their own export show up at the top of the table.
      fetchData();
    } catch {
      toast.error(t("auditLog.toasts.exportFailed"));
    } finally {
      setExporting(null);
    }
  };

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore — clipboard API can be blocked in some embeddings.
    }
  };

  // ─── Derived ────────────────────────────────────────────────────
  const totalPages = Math.ceil(total / limit) || 1;
  const from = total > 0 ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);

  const entityOptions = useMemo(() => {
    const opts = [{ value: "all", label: t("auditLog.filters.allEntityTypes") }];
    for (const et of filterOptions.entityTypes) {
      opts.push({ value: et, label: formatEntityType(et) });
    }
    return opts;
  }, [filterOptions.entityTypes, t, formatEntityType]);

  const actionOptions = useMemo(() => {
    const opts = [{ value: "all", label: t("auditLog.filters.allActions") }];
    for (const a of filterOptions.actions) {
      opts.push({ value: a, label: formatAction(a) });
    }
    return opts;
  }, [filterOptions.actions, t, formatAction]);

  const actorOptions = useMemo(() => {
    const opts = [{ value: "all", label: t("auditLog.filters.allActors") }];
    for (const a of actors) {
      opts.push({ value: a.id, label: a.name });
    }
    return opts;
  }, [actors, t]);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  // ─── Render ────────────────────────────────────────────────────
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
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)] flex items-center gap-2">
                    <Shield className="w-6 h-6 text-[var(--color-primary)]" />
                    {t("auditLog.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("auditLog.subtitle")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ExportDropdown onExport={handleExport} busy={exporting} />
                </div>
              </div>

              {/* PII redaction notice — appears as a slim banner above the
                  KPI strip so anyone exporting knows what's masked. */}
              <div className="flex items-start gap-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 mb-6 text-[12px] text-[#1E40AF]">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-[1px]" />
                <span>{t("auditLog.piiNotice")}</span>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <KpiCard
                  icon={Activity}
                  label={t("auditLog.kpi.totalEvents")}
                  value={formatInt(summary?.totalEvents)}
                  accent="#2563EB"
                />
                <KpiCard
                  icon={Users}
                  label={t("auditLog.kpi.uniqueActors")}
                  value={formatInt(summary?.uniqueActors)}
                  accent="#7C3AED"
                />
                <KpiCard
                  icon={TrendingUp}
                  label={t("auditLog.kpi.topAction")}
                  value={
                    summary?.topActions?.[0]
                      ? formatAction(summary.topActions[0].action)
                      : "—"
                  }
                  subline={
                    summary?.topActions?.[0]
                      ? t("auditLog.kpi.eventsCount", {
                          n: formatInt(summary.topActions[0].count),
                        })
                      : undefined
                  }
                  accent="#16A34A"
                />
                <KpiCard
                  icon={Layers}
                  label={t("auditLog.kpi.topEntity")}
                  value={
                    summary?.topEntityTypes?.[0]
                      ? formatEntityType(summary.topEntityTypes[0].entityType)
                      : "—"
                  }
                  subline={
                    summary?.topEntityTypes?.[0]
                      ? t("auditLog.kpi.eventsCount", {
                          n: formatInt(summary.topEntityTypes[0].count),
                        })
                      : undefined
                  }
                  accent="#EA580C"
                />
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mb-6">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t("auditLog.filters.title")}
                    </h3>
                  </div>
                  {hasFilters && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-[#DC2626] hover:bg-[#FEE2E2] rounded-md transition-colors"
                    >
                      <X className="w-3 h-3" />
                      {t("auditLog.filters.clearFilters")}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                      {t("auditLog.filters.entityType")}
                    </label>
                    <Select options={entityOptions} value={entityType} onChange={setEntityType} size="default" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                      {t("auditLog.filters.action")}
                    </label>
                    <Select options={actionOptions} value={action} onChange={setAction} size="default" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                      {t("auditLog.filters.actor")}
                    </label>
                    <Select options={actorOptions} value={actorId} onChange={setActorId} size="default" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                      {t("auditLog.filters.startDate")}
                    </label>
                    <DatePicker value={startDate} onChange={setStartDate} placeholder={t("auditLog.filters.anyDate")} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                      {t("auditLog.filters.endDate")}
                    </label>
                    <DatePicker value={endDate} onChange={setEndDate} placeholder={t("auditLog.filters.anyDate")} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1 uppercase tracking-wide">
                      {t("auditLog.filters.search")}
                    </label>
                    <div className="relative">
                      <Search className={`absolute top-2.5 ${isRTL ? "right-3" : "left-3"} w-4 h-4 text-[var(--color-text-secondary)]`} />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("auditLog.filters.searchPlaceholder")}
                        className={`w-full h-10 ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                {loading ? (
                  <TableSkeleton />
                ) : logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Shield className="w-12 h-12 text-[var(--color-text-secondary)] opacity-40 mb-4" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {t("auditLog.table.noResults")}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {t("auditLog.table.noResultsHint")}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-page)]">
                            <th className="w-8 px-3 py-3"></th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[var(--color-text-primary)] whitespace-nowrap`}>
                              {t("auditLog.table.timestamp")}
                            </th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[var(--color-text-primary)]`}>
                              {t("auditLog.table.entityType")}
                            </th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[var(--color-text-primary)]`}>
                              {t("auditLog.table.action")}
                            </th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[var(--color-text-primary)]`}>
                              {t("auditLog.table.performedBy")}
                            </th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[var(--color-text-primary)]`}>
                              {t("auditLog.table.entityId")}
                            </th>
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[var(--color-text-primary)]`}>
                              {t("auditLog.table.ipAddress")}
                            </th>
                            <th className={`px-3 py-3 text-${isRTL ? "left" : "right"} font-semibold text-[var(--color-text-primary)]`}>
                              {t("auditLog.table.actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((entry) => {
                            const isExpanded = expandedRow === entry.id;
                            const entityStyle =
                              ENTITY_PILL[entry.entityType] || { bg: "#E2E8F0", fg: "#475569" };
                            const actionStyle = CATEGORY_STYLES[actionCategory(entry.action)];
                            const deepLink = entityDeepLink(entry.entityType, entry.entityId, locale);
                            const performerName = entry.performerFirstName
                              ? `${entry.performerFirstName} ${entry.performerLastName || ""}`.trim()
                              : null;
                            return (
                              <Fragment key={entry.id}>
                                <tr
                                  className={`border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] transition-colors ${
                                    isExpanded ? "bg-[var(--color-surface-page)]" : ""
                                  }`}
                                >
                                  <td className="px-3 py-3 align-top">
                                    {entry.metadata && (
                                      <button
                                        onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                                        className="p-0.5 rounded hover:bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]"
                                        aria-label={t("auditLog.table.toggleMetadata")}
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="w-4 h-4" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4" />
                                        )}
                                      </button>
                                    )}
                                  </td>
                                  <td className={`px-4 py-3 align-top text-${isRTL ? "right" : "left"} text-[var(--color-text-secondary)] whitespace-nowrap font-mono text-xs`}>
                                    {formatTimestamp(entry.createdAt)}
                                  </td>
                                  <td className={`px-4 py-3 align-top text-${isRTL ? "right" : "left"}`}>
                                    <span
                                      className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap"
                                      style={{ backgroundColor: entityStyle.bg, color: entityStyle.fg }}
                                    >
                                      {formatEntityType(entry.entityType)}
                                    </span>
                                  </td>
                                  <td className={`px-4 py-3 align-top text-${isRTL ? "right" : "left"}`}>
                                    <span
                                      className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                                      style={{ backgroundColor: actionStyle.bg, color: actionStyle.fg }}
                                    >
                                      {formatAction(entry.action)}
                                    </span>
                                  </td>
                                  <td className={`px-4 py-3 align-top text-${isRTL ? "right" : "left"}`}>
                                    {performerName ? (
                                      <div>
                                        <div className="text-[var(--color-text-primary)] font-medium">{performerName}</div>
                                        {entry.performerEmail && (
                                          <div className="text-[11px] text-[var(--color-text-secondary)]">
                                            {entry.performerEmail}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                                        <AlertCircle className="w-3 h-3" />
                                        {t("auditLog.table.system")}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`px-4 py-3 align-top text-${isRTL ? "right" : "left"}`}>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[var(--color-text-secondary)] font-mono text-xs">
                                        {entry.entityId.substring(0, 8)}…
                                      </span>
                                      <button
                                        onClick={() => handleCopyId(entry.entityId)}
                                        className="p-0.5 rounded hover:bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                                        aria-label={t("auditLog.table.copyId")}
                                      >
                                        {copiedId === entry.entityId ? (
                                          <Check className="w-3 h-3 text-[#16A34A]" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                  <td className={`px-4 py-3 align-top text-${isRTL ? "right" : "left"} text-[var(--color-text-secondary)] font-mono text-xs`}>
                                    {entry.ipAddress || "—"}
                                  </td>
                                  <td className={`px-3 py-3 align-top text-${isRTL ? "left" : "right"}`}>
                                    {deepLink && (
                                      <Link
                                        href={deepLink}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-page)] transition-colors"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        {t("auditLog.table.view")}
                                      </Link>
                                    )}
                                  </td>
                                </tr>
                                {isExpanded && entry.metadata && (
                                  <tr key={`${entry.id}-meta`} className="bg-[var(--color-surface-page)]">
                                    <td></td>
                                    <td colSpan={7} className="px-6 py-3">
                                      <div className="text-xs">
                                        <div className="font-semibold text-[var(--color-text-primary)] mb-1">
                                          {t("auditLog.table.metadata")}
                                        </div>
                                        <pre className="p-3 bg-[var(--color-surface-card)] rounded border border-[var(--color-border)] overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                                          {JSON.stringify(entry.metadata, null, 2)}
                                        </pre>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-subtle)]">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {t("auditLog.pagination.showing", {
                          from: formatInt(from),
                          to: formatInt(to),
                          total: formatInt(total),
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          {t("auditLog.pagination.previous")}
                        </button>
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          {formatInt(page)} / {formatInt(totalPages)}
                        </span>
                        <button
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {t("auditLog.pagination.next")}
                          {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Sub-components ────────────────────────────────────────────────

const KpiCard = ({
  icon: Icon, label, value, subline, accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  subline?: string;
  accent: string;
}) => (
  <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4" style={{ color: accent }} />
      <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-xl font-bold text-[var(--on-surface-default)] truncate" title={value}>
      {value}
    </div>
    {subline && (
      <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">{subline}</div>
    )}
  </div>
);

const TableSkeleton = () => (
  <div className="p-4 space-y-2">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="h-12 bg-[var(--color-surface-page)] rounded-md animate-pulse" />
    ))}
  </div>
);

export default AuditLogContent;
