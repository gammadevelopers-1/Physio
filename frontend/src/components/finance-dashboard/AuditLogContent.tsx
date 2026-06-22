"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useTranslations, useLocale } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  Shield,
  Download,
  FileText,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
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

const AuditLogContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = useFinanceProfile();

  // Filters
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 20;

  // Data
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<{
    entityTypes: string[];
    actions: string[];
  }>({ entityTypes: [], actions: [] });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Fetch filter options on mount
  useEffect(() => {
    financeApi.getAuditLogFilters().then(setFilterOptions).catch(() => {});
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financeApi.getAuditLogs({
        entityType: entityType || undefined,
        action: action || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
        page,
        limit,
      });
      setLogs(result.data);
      setTotal(result.total);
    } catch {
      toast.error(t("auditLog.export.error"));
    } finally {
      setLoading(false);
    }
  }, [entityType, action, startDate, endDate, search, page, t]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  const updateFilter = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setEntityType("");
    setAction("");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setPage(1);
  };

  const hasFilters = entityType || action || startDate || endDate || search;

  const handleExportCsv = async () => {
    try {
      await financeApi.exportAuditLogsCsv({
        entityType: entityType || undefined,
        action: action || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
      });
      toast.success(t("auditLog.export.success"));
    } catch {
      toast.error(t("auditLog.export.error"));
    }
  };

  const handleExportPdf = async () => {
    try {
      await financeApi.exportAuditLogsPdf({
        entityType: entityType || undefined,
        action: action || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
      });
      toast.success(t("auditLog.export.success"));
    } catch {
      toast.error(t("auditLog.export.error"));
    }
  };

  const totalPages = Math.ceil(total / limit);
  const from = total > 0 ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);

  const getActionColor = (act: string) => {
    if (act.includes("completed") || act.includes("created") || act.includes("generated") || act.includes("approved"))
      return "bg-[#DCFCE7] text-[#16A34A]";
    if (act.includes("failed") || act.includes("rejected") || act.includes("deleted"))
      return "bg-[#FEE2E2] text-[#DC2626]";
    if (act.includes("requested") || act.includes("initiated") || act.includes("pending"))
      return "bg-[#FEF9C3] text-[#CA8A04]";
    return "bg-[#EFF6FF] text-[#3B82F6]";
  };

  const formatPerformer = (entry: AuditLogEntry) => {
    if (entry.performerFirstName) {
      return `${entry.performerFirstName} ${entry.performerLastName || ""}`.trim();
    }
    return t("auditLog.table.system");
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
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
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("auditLog.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("auditLog.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportCsv}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    {t("auditLog.export.csv")}
                  </button>
                  <button
                    onClick={handleExportPdf}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {t("auditLog.export.pdf")}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("auditLog.filters.entityType")}</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                  <select
                    value={entityType}
                    onChange={(e) => updateFilter(setEntityType, e.target.value)}
                    className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="">{t("auditLog.filters.allEntityTypes")}</option>
                    {filterOptions.entityTypes.map((et) => (
                      <option key={et} value={et}>{et}</option>
                    ))}
                  </select>

                  <select
                    value={action}
                    onChange={(e) => updateFilter(setAction, e.target.value)}
                    className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="">{t("auditLog.filters.allActions")}</option>
                    {filterOptions.actions.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>

                  <div>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => updateFilter(setStartDate, e.target.value)}
                      placeholder={t("auditLog.filters.startDate")}
                      className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => updateFilter(setEndDate, e.target.value)}
                      placeholder={t("auditLog.filters.endDate")}
                      className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>

                  <div className="relative flex-1 min-w-[200px]">
                    <Search className={`absolute top-2.5 ${isRTL ? "right-3" : "left-3"} w-4 h-4 text-[var(--color-text-secondary)]`} />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => updateFilter(setSearch, e.target.value)}
                      placeholder={t("auditLog.filters.search")}
                      className={`w-full ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]`}
                    />
                  </div>

                  {hasFilters && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      {t("auditLog.filters.clearFilters")}
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin mb-3" />
                    <p className="text-sm text-[var(--color-text-secondary)]">{t("auditLog.table.loading")}</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Shield className="w-12 h-12 text-[var(--color-text-secondary)] mb-4" />
                    <p className="text-sm text-[var(--color-text-secondary)]">{t("auditLog.table.noResults")}</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-page)]">
                            <th className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[var(--color-text-primary)]`}>
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
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((entry) => (
                            <Fragment key={entry.id}>
                              <tr
                                className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] transition-colors cursor-pointer"
                                onClick={() =>
                                  setExpandedRow(expandedRow === entry.id ? null : entry.id)
                                }
                              >
                                <td className={`px-4 py-3 text-${isRTL ? "right" : "left"} text-[var(--color-text-secondary)] whitespace-nowrap`}>
                                  {formatTimestamp(entry.createdAt)}
                                </td>
                                <td className={`px-4 py-3 text-${isRTL ? "right" : "left"}`}>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-page)] text-[var(--color-text-primary)] capitalize">
                                    {entry.entityType}
                                  </span>
                                </td>
                                <td className={`px-4 py-3 text-${isRTL ? "right" : "left"}`}>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(entry.action)}`}>
                                    {entry.action.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td className={`px-4 py-3 text-${isRTL ? "right" : "left"}`}>
                                  {entry.performedBy ? (
                                    <span className="text-[var(--color-text-primary)] font-medium">
                                      {formatPerformer(entry)}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
                                      {t("auditLog.table.system")}
                                    </span>
                                  )}
                                </td>
                                <td className={`px-4 py-3 text-${isRTL ? "right" : "left"} text-[var(--color-text-secondary)] font-mono text-xs`}>
                                  {entry.entityId.substring(0, 8)}...
                                </td>
                                <td className={`px-4 py-3 text-${isRTL ? "right" : "left"} text-[var(--color-text-secondary)] text-xs`}>
                                  {entry.ipAddress || "—"}
                                </td>
                              </tr>
                              {expandedRow === entry.id && entry.metadata && (
                                <tr key={`${entry.id}-meta`} className="bg-[var(--color-surface-page)]">
                                  <td colSpan={6} className="px-6 py-3">
                                    <div className="text-xs text-[var(--color-text-secondary)]">
                                      <span className="font-semibold text-[var(--color-text-primary)]">{t("auditLog.table.metadata")}:</span>
                                      <pre className="mt-1 p-2 bg-[var(--color-surface-card)] rounded border border-[var(--color-border)] overflow-x-auto whitespace-pre-wrap font-mono">
                                        {JSON.stringify(entry.metadata, null, 2)}
                                      </pre>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-subtle)]">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {t("auditLog.pagination.showing", { from, to, total })}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          {t("auditLog.pagination.previous")}
                        </button>
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          {page} / {totalPages || 1}
                        </span>
                        <button
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {t("auditLog.pagination.next")}
                          <ChevronRight className="w-4 h-4" />
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

export default AuditLogContent;
