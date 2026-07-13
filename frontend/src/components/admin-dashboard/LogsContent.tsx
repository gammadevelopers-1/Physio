"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import Select from "./Select";
import { TableRowSkeleton } from "./AdminSkeletons";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { tOrFallback } from "@/lib/notification-i18n";
import {
  adminApi,
  nelcAuditApi,
  type AdminAuditLogItem,
  type AdminNotificationItem,
  type AdminNotificationType,
} from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";

const ITEMS_PER_PAGE = 25;

// ─── Subset of nelc event types that count as violations ────
// These are the event names that mean "something went wrong" or
// "the system enforced a rule against a user/manager action."
// Adjust freely — frontend filter; backend doesn't care.
const VIOLATION_EVENT_TYPES = [
  "COMPLIANCE_CHECK_FAILED",
  "ENROLLMENT_LIMIT_ENFORCED",
  "ATTENDANCE_UNVERIFIED_CONFIRMED",
  "CERTIFICATE_REVOKED",
  "COURSE_CHANGES_REQUESTED",
] as const;

type Tab = "audit" | "violations" | "alerts";

// ISO date 7 days ago, used as the initial range start across tabs.
function defaultDateFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Hardened date formatter for table rows
function formatTs(value: string, locale: string): string {
  try {
    return new Date(value).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

// ─── Main Component ────────────────────────────────────────

const LogsContent = () => {
  const admin = useAdminProfile();
  const t = useTranslations("adminDashboard.logsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeTab, setActiveTab] = useState<Tab>("audit");

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>
            <AdminMobileSidebar admin={admin} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-start gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                    {t("subtitle")}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-[var(--color-border)] mb-6">
                <div className={`flex ${isRTL ? "flex-row-reverse" : ""} gap-1`}>
                  {(
                    [
                      { id: "audit", label: t("tabs.audit"), icon: ClipboardList },
                      { id: "violations", label: t("tabs.violations"), icon: ShieldAlert },
                      { id: "alerts", label: t("tabs.alerts"), icon: AlertCircle },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => {
                    const active = activeTab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveTab(id)}
                        className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                          active
                            ? "text-[var(--color-primary)] border-[var(--color-primary)]"
                            : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                        {id === "alerts" && <AlertsBadge />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab content */}
              {activeTab === "audit" && <AuditTab />}
              {activeTab === "violations" && <ViolationsTab />}
              {activeTab === "alerts" && <AlertsTab />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Alerts badge (unread count on tab) ────────────────────

function AlertsBadge() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    adminApi
      .getAdminNotificationCounts()
      .then((r) => {
        if (!cancelled) setUnread(r.unread);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (unread === 0) return null;
  return (
    <span className="ms-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-[#DC2626] rounded-full">
      {unread > 99 ? "99+" : unread}
    </span>
  );
}

// ─── Audit Trail Tab ───────────────────────────────────────

function AuditTab() {
  const t = useTranslations("adminDashboard.logsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState(defaultDateFrom());
  const [to, setTo] = useState(todayDate());
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminAuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filter source lists
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);

  // Expand state — keyed by row id
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, entityType, action, from, to]);

  // Load distinct values once
  useEffect(() => {
    adminApi
      .getAuditLogDistinct()
      .then((r) => {
        setEntityTypes(r.entityTypes);
        setActions(r.actions);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.getAuditLogs({
        entityType: entityType || undefined,
        action: action || undefined,
        search: searchQuery || undefined,
        from: from ? `${from}T00:00:00.000Z` : undefined,
        to: to ? `${to}T23:59:59.999Z` : undefined,
        page,
        limit: ITEMS_PER_PAGE,
      });
      setData(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [entityType, action, searchQuery, from, to, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await adminApi.exportAuditLogs({
        entityType: entityType || undefined,
        action: action || undefined,
        search: searchQuery || undefined,
        from: from ? `${from}T00:00:00.000Z` : undefined,
        to: to ? `${to}T23:59:59.999Z` : undefined,
      });
      toast.success(t("exportSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("exportError"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Filter bar */}
      <FilterBar
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        searchPlaceholder={t("audit.searchPlaceholder")}
        isRTL={isRTL}
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        exporting={exporting}
        onExport={handleExport}
        onRefresh={fetchData}
        exportLabel={t("export")}
        refreshLabel={t("refresh")}
        countText={t("rowsFound", { count: total })}
      >
        <Select
          size="sm"
          className="w-44"
          value={entityType}
          onChange={setEntityType}
          options={[
            { value: "", label: t("audit.allEntities") },
            ...entityTypes.map((et) => ({ value: et, label: et })),
          ]}
        />
        <Select
          size="sm"
          className="w-44"
          value={action}
          onChange={setAction}
          options={[
            { value: "", label: t("audit.allActions") },
            ...actions.map((a) => ({ value: a, label: a })),
          ]}
        />
      </FilterBar>

      {/* Body */}
      {loading ? (
        <LoadingPanel />
      ) : error ? (
        <ErrorPanel message={error} onRetry={fetchData} retryLabel={t("retry")} />
      ) : data.length === 0 ? (
        <EmptyPanel
          icon={ClipboardList}
          title={t("audit.emptyTitle")}
          body={t("audit.emptyBody")}
        />
      ) : (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
              <tr>
                <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("audit.col.timestamp")}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("audit.col.performer")}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("audit.col.entity")}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("audit.col.action")}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("audit.col.ip")}
                </th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const isExpanded = expandedId === row.id;
                const performer =
                  `${row.performerFirstName || ""} ${row.performerLastName || ""}`.trim() ||
                  row.performerEmail;
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)] cursor-pointer"
                    >
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                        {formatTs(row.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-[var(--color-text-primary)]">{performer}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{row.performerEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[var(--color-text-secondary)] font-mono">
                          {row.entityType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={row.action} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono">
                        {row.ipAddress || "—"}
                      </td>
                      <td className="px-2 py-3 text-[var(--color-text-secondary)]">
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[var(--color-surface-page)]">
                        <td colSpan={6} className="px-6 py-4">
                          <DetailGrid
                            rows={[
                              [t("detail.entityId"), row.entityId],
                              [t("detail.performerId"), row.performedBy],
                              [t("detail.ip"), row.ipAddress || "—"],
                            ]}
                          />
                          <div className="mt-3">
                            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                              {t("detail.metadata")}
                            </p>
                            <pre className="text-xs bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3 overflow-x-auto text-[var(--color-text-secondary)]">
                              {row.metadata
                                ? JSON.stringify(row.metadata, null, 2)
                                : "—"}
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
          <Pagination
            page={page}
            totalPages={totalPages}
            setPage={setPage}
            isRTL={isRTL}
          />
        </div>
      )}
    </div>
  );
}

// ─── Violations Tab (NELC compliance events) ───────────────

interface NelcLog {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

function ViolationsTab() {
  const t = useTranslations("adminDashboard.logsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [eventType, setEventType] = useState<string>(""); // "" = all violation types
  const [from, setFrom] = useState(defaultDateFrom());
  const [to, setTo] = useState(todayDate());
  const [page, setPage] = useState(1);

  const [data, setData] = useState<NelcLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [eventType, from, to]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (eventType) {
        // Single event type — backend supports filtering server-side.
        const result = await nelcAuditApi.getLogs({
          eventType,
          startDate: from ? `${from}T00:00:00.000Z` : undefined,
          endDate: to ? `${to}T23:59:59.999Z` : undefined,
          page,
          limit: ITEMS_PER_PAGE,
        });
        setData(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else {
        // "All violations" — fetch a wider window without an eventType
        // filter, then keep only the violation event types client-side.
        // Acceptable trade until the backend grows a multi-eventType
        // filter; NELC log volume is low enough that this is fine.
        const result = await nelcAuditApi.getLogs({
          startDate: from ? `${from}T00:00:00.000Z` : undefined,
          endDate: to ? `${to}T23:59:59.999Z` : undefined,
          page,
          limit: ITEMS_PER_PAGE * 4,
        });
        const filtered = result.data.filter((row) =>
          (VIOLATION_EVENT_TYPES as readonly string[]).includes(row.eventType),
        );
        setData(filtered.slice(0, ITEMS_PER_PAGE));
        setTotal(filtered.length);
        setTotalPages(Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [eventType, from, to, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await nelcAuditApi.exportCsv({
        eventType: eventType || undefined,
        startDate: from ? `${from}T00:00:00.000Z` : undefined,
        endDate: to ? `${to}T23:59:59.999Z` : undefined,
      });
      toast.success(t("exportSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("exportError"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <FilterBar
        searchInput=""
        setSearchInput={() => {}}
        searchPlaceholder=""
        isRTL={isRTL}
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        exporting={exporting}
        onExport={handleExport}
        onRefresh={fetchData}
        exportLabel={t("export")}
        refreshLabel={t("refresh")}
        countText={t("rowsFound", { count: total })}
        hideSearch
      >
        <Select
          size="sm"
          className="w-52"
          value={eventType}
          onChange={setEventType}
          options={[
            { value: "", label: t("violations.allTypes") },
            ...VIOLATION_EVENT_TYPES.map((vt) => ({ value: vt, label: vt })),
          ]}
        />
      </FilterBar>

      {loading ? (
        <LoadingPanel />
      ) : error ? (
        <ErrorPanel message={error} onRetry={fetchData} retryLabel={t("retry")} />
      ) : data.length === 0 ? (
        <EmptyPanel
          icon={Shield}
          title={t("violations.emptyTitle")}
          body={t("violations.emptyBody")}
          tone="positive"
        />
      ) : (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
              <tr>
                <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("audit.col.timestamp")}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("violations.col.eventType")}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("violations.col.entity")}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("audit.col.ip")}
                </th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const isExpanded = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)] cursor-pointer"
                    >
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                        {formatTs(row.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-[#FEE2E2] text-[#DC2626]">
                          <AlertTriangle className="w-3 h-3" />
                          {row.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-[var(--color-text-secondary)] font-mono truncate max-w-[200px]">
                          {row.entityType}
                        </div>
                        {row.entityId && (
                          <div className="text-xs text-[var(--color-text-secondary)] opacity-60 font-mono truncate max-w-[200px]">
                            {row.entityId}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono">
                        {row.ipAddress || "—"}
                      </td>
                      <td className="px-2 py-3 text-[var(--color-text-secondary)]">
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[var(--color-surface-page)]">
                        <td colSpan={5} className="px-6 py-4">
                          <DetailGrid
                            rows={[
                              [t("detail.entityId"), row.entityId || "—"],
                              [t("detail.userId"), row.userId || "—"],
                              [t("detail.ip"), row.ipAddress || "—"],
                            ]}
                          />
                          <div className="mt-3">
                            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                              {t("detail.metadata")}
                            </p>
                            <pre className="text-xs bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3 overflow-x-auto text-[var(--color-text-secondary)]">
                              {row.metadata ? JSON.stringify(row.metadata, null, 2) : "—"}
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
          <Pagination
            page={page}
            totalPages={totalPages}
            setPage={setPage}
            isRTL={isRTL}
          />
        </div>
      )}
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────

function AlertsTab() {
  const t = useTranslations("adminDashboard.logsPage");
  const tRoot = useTranslations();
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [type, setType] = useState<"" | AdminNotificationType>("");
  // Default: show unread first via backend ordering, but include reads.
  const [unreadFilter, setUnreadFilter] = useState<"all" | "unread" | "read">("all");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminNotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | "all" | null>(null);

  useEffect(() => {
    setPage(1);
  }, [type, unreadFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.getAdminNotifications({
        type: type || undefined,
        unread:
          unreadFilter === "unread"
            ? true
            : unreadFilter === "read"
              ? false
              : undefined,
        page,
        limit: ITEMS_PER_PAGE,
      });
      setData(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [type, unreadFilter, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkRead = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await adminApi.markAdminNotificationRead(id);
      // Local optimistic update so the row dims immediately
      setData((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      toast.success(t("alerts.markedRead"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("alerts.markReadError"));
    } finally {
      setBusy(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (busy) return;
    setBusy("all");
    try {
      const { updated } = await adminApi.markAllAdminNotificationsRead();
      toast.success(t("alerts.markedAllRead", { count: updated }));
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("alerts.markReadError"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {/* Filter bar — no date/search for alerts, just type + read state */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className={`flex items-center gap-2 ${isRTL ? "md:order-1" : ""}`}>
            <Filter className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <Select
              size="sm"
              className="w-40"
              value={type}
              onChange={(v) => setType(v as any)}
              options={[
                { value: "", label: t("alerts.allTypes") },
                { value: "critical", label: t("alerts.critical") },
                { value: "warning", label: t("alerts.warning") },
                { value: "info", label: t("alerts.info") },
              ]}
            />
            <Select
              size="sm"
              className="w-44"
              value={unreadFilter}
              onChange={(v) => setUnreadFilter(v as any)}
              options={[
                { value: "all", label: t("alerts.allStatuses") },
                { value: "unread", label: t("alerts.unreadOnly") },
                { value: "read", label: t("alerts.readOnly") },
              ]}
            />
          </div>

          <div className="flex-1" />

          <p className="text-xs text-[var(--color-text-secondary)]">
            {t("rowsFound", { count: total })}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-3 h-9 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
            >
              <RefreshCw className="w-4 h-4" />
              {t("refresh")}
            </button>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={busy === "all"}
              className="inline-flex items-center gap-1.5 px-3 h-9 text-sm text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
            >
              {busy === "all" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {t("alerts.markAllRead")}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <LoadingPanel />
      ) : error ? (
        <ErrorPanel message={error} onRetry={fetchData} retryLabel={t("retry")} />
      ) : data.length === 0 ? (
        <EmptyPanel
          icon={CheckCircle2}
          title={t("alerts.emptyTitle")}
          body={t("alerts.emptyBody")}
          tone="positive"
        />
      ) : (
        <div className="space-y-2">
          {data.map((row) => (
            <AlertCard
              key={row.id}
              row={row}
              busy={busy === row.id}
              onMarkRead={() => handleMarkRead(row.id)}
              t={t}
              tRoot={tRoot}
              locale={locale}
              isRTL={isRTL}
            />
          ))}
          <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
            <Pagination
              page={page}
              totalPages={totalPages}
              setPage={setPage}
              isRTL={isRTL}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AlertCard({
  row,
  busy,
  onMarkRead,
  t,
  tRoot,
  locale,
  isRTL,
}: {
  row: AdminNotificationItem;
  busy: boolean;
  onMarkRead: () => void;
  t: ReturnType<typeof useTranslations>;
  tRoot: ReturnType<typeof useTranslations>;
  locale: string;
  isRTL: boolean;
}) {
  const tone = typeTone(row.type);
  const title = tOrFallback(tRoot, row.titleKey, row.titleParams, row.title);
  const description = tOrFallback(
    tRoot,
    row.descriptionKey,
    row.descriptionParams,
    row.description,
  );
  return (
    <div
      className={`bg-[var(--color-surface-card)] rounded-xl border-l-4 border border-[var(--color-border)] p-4 flex items-start gap-3 ${row.isRead ? "opacity-60" : ""} ${tone.borderClass}`}
    >
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${tone.iconBg}`}>
        <tone.Icon className={`w-5 h-5 ${tone.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {title}
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1 break-words">
              {description}
            </p>
          </div>
          <span
            className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${tone.badgeBg} ${tone.badgeText}`}
          >
            {t(`alerts.${row.type}`)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-[var(--color-text-secondary)] font-mono">
            {formatTs(row.createdAt, locale)}
          </span>
          <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            {row.link && (
              <Link
                // Backend stores notification links without a locale
                // prefix (e.g. `/dashboard/admin/users`). Next.js
                // App Router routes live under `[locale]/...`, so we
                // prepend the current locale here to avoid the 404
                // that bare links would produce.
                href={
                  row.link.startsWith("/")
                    ? `/${locale}${row.link}`
                    : row.link
                }
                className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
              >
                {t("alerts.open")}
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            {!row.isRead && (
              <button
                type="button"
                onClick={onMarkRead}
                disabled={busy}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-md px-2 py-1 hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                {t("alerts.markRead")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function typeTone(type: AdminNotificationType) {
  switch (type) {
    case "critical":
      return {
        Icon: AlertTriangle,
        iconBg: "bg-[#FEE2E2]",
        iconColor: "text-[#DC2626]",
        badgeBg: "bg-[#DC2626]",
        badgeText: "text-white",
        borderClass: "border-l-[#DC2626]",
      };
    case "warning":
      return {
        Icon: AlertCircle,
        iconBg: "bg-[#FEF3C7]",
        iconColor: "text-[#D97706]",
        badgeBg: "bg-[#D97706]",
        badgeText: "text-white",
        borderClass: "border-l-[#D97706]",
      };
    case "info":
    default:
      return {
        Icon: Info,
        iconBg: "bg-[#DBEAFE]",
        iconColor: "text-[#2563EB]",
        badgeBg: "bg-[#2563EB]",
        badgeText: "text-white",
        borderClass: "border-l-[#2563EB]",
      };
  }
}

// ─── Shared sub-components ─────────────────────────────────

interface FilterBarProps {
  searchInput: string;
  setSearchInput: (v: string) => void;
  searchPlaceholder: string;
  isRTL: boolean;
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  exporting: boolean;
  onExport: () => void;
  onRefresh: () => void;
  exportLabel: string;
  refreshLabel: string;
  countText: string;
  hideSearch?: boolean;
  children?: React.ReactNode;
}

function FilterBar(props: FilterBarProps) {
  // Two-row layout keeps the filter widgets from wrapping into each
  // other on narrow screens (the old single-row + nested flex-wrap
  // would stack date inputs vertically and leave the "60 entries"
  // text floating between them).
  //   Row 1 (filters):  search + dropdowns
  //   Row 2 (actions):  date range · entries count · refresh · export
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 mb-4 space-y-3">
      {/* Row 1: search + select filters */}
      {(!props.hideSearch || props.children) && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {!props.hideSearch && (
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${props.isRTL ? "right-3" : "left-3"}`}
              />
              <input
                type="text"
                placeholder={props.searchPlaceholder}
                value={props.searchInput}
                onChange={(e) => props.setSearchInput(e.target.value)}
                className={`w-full h-9 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)] ${props.isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} focus:outline-none focus:border-[var(--color-primary)]`}
              />
            </div>
          )}
          {props.children && (
            <div className="flex items-center gap-2 flex-wrap">
              {props.children}
            </div>
          )}
        </div>
      )}

      {/* Row 2: date range + count + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)]">
            {/* Static "Range" label keeps the date pickers from looking
                like detached widgets. Hardcoded en/ar is fine — this is
                a single word that doesn't change per surface. */}
            {props.isRTL ? "النطاق" : "Range"}
          </span>
          <DateInput value={props.from} onChange={props.setFrom} />
          <span className="text-[var(--color-text-secondary)]">→</span>
          <DateInput value={props.to} onChange={props.setTo} />
        </div>

        <div className="flex-1" />

        <p className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap order-3 sm:order-none">
          {props.countText}
        </p>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={props.onRefresh}
            className="inline-flex items-center gap-1.5 px-3 h-9 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            title={props.refreshLabel}
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline">{props.refreshLabel}</span>
          </button>
          <button
            type="button"
            onClick={props.onExport}
            disabled={props.exporting}
            className="inline-flex items-center gap-1.5 px-3 h-9 text-sm font-medium text-white btn-gold rounded-lg disabled:opacity-50 transition-colors"
          >
            {props.exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {props.exportLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
    />
  );
}

function ActionBadge({ action }: { action: string }) {
  // Color by the *kind* of action (the part after the last dot, or the
  // whole string if none). Defaults to neutral.
  const last = action.includes(".") ? action.split(".").pop()! : action;
  const lower = last.toLowerCase();
  let cls = "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
  if (/^(create|activate|approve|added|grant|started)$/i.test(lower)) {
    cls = "bg-[#DCFCE7] text-[#16A34A]";
  } else if (/^(update|edit|patch)$/i.test(lower)) {
    cls = "bg-[#DBEAFE] text-[#1D4ED8]";
  } else if (/^(delete|revoke|remove|block|reject|archive|cancel)$/i.test(lower)) {
    cls = "bg-[#FEE2E2] text-[#DC2626]";
  } else if (/^(complete|finalize|end|ended)$/i.test(lower)) {
    cls = "bg-[#EDE9FE] text-[#7C3AED]";
  } else if (/^(login|logout|access)$/i.test(lower)) {
    cls = "bg-[var(--color-border-subtle)] text-[var(--color-primary)]";
  } else if (/^(export|download)$/i.test(lower)) {
    cls = "bg-[#FCE7F3] text-[#BE185D]";
  } else if (/^(failed|error)$/i.test(lower)) {
    cls = "bg-[#FEE2E2] text-[#DC2626]";
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${cls}`}>
      {action}
    </span>
  );
}

function DetailGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-0.5">
            {label}
          </p>
          <p className="text-xs text-[var(--color-text-primary)] font-mono break-all">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  setPage,
  isRTL,
}: {
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  isRTL: boolean;
}) {
  if (totalPages <= 1) return null;
  const numbers = buildPageNumbers(page, totalPages);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
      <span className="text-xs text-[var(--color-text-secondary)]">
        {page} / {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1.5 text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
        >
          {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPage(n)}
            className={`w-8 h-7 rounded-md text-xs font-medium ${
              n === page
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-1.5 text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
        >
          {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function buildPageNumbers(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
}

function LoadingPanel() {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      {Array.from({ length: 10 }).map((_, i) => (
        <TableRowSkeleton key={i} cols={5} />
      ))}
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-red-200 py-12 text-center">
      <XCircle className="w-10 h-10 text-[#DC2626] mx-auto mb-3" />
      <p className="text-red-600 mb-4">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)]"
      >
        <RefreshCw className="w-4 h-4" />
        {retryLabel}
      </button>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  body,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone?: "neutral" | "positive";
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] py-16 text-center">
      <Icon
        className={`w-12 h-12 mx-auto mb-3 ${tone === "positive" ? "text-[#16A34A]" : "text-[var(--color-text-secondary)]"}`}
      />
      <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{title}</p>
      <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto">{body}</p>
    </div>
  );
}

export default LogsContent;
