"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Shield,
  Lock,
  Ban,
  Users,
  KeyRound,
  AlertTriangle,
  LogOut,
  Search,
  Loader2,
  Monitor,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import { TableRowSkeleton } from "./AdminSkeletons";
import {
  adminApi,
  ApiError,
  type AdminDashboardPayload,
  type AdminFailedLoginRow,
  type AdminSessionRow,
  type AdminSuspiciousIp,
} from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";

type Tab = "overview" | "sessions" | "logins" | "ips";

const PAGE_SIZE = 50;

function formatRelative(iso: string, locale: string): string {
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return locale === "ar" ? "الآن" : "just now";
    if (min < 60) return locale === "ar" ? `قبل ${min} د` : `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return locale === "ar" ? `قبل ${hr} س` : `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return locale === "ar" ? `قبل ${d} ي` : `${d}d ago`;
  } catch {
    return iso;
  }
}

function deviceIcon(name: string | null) {
  const n = (name || "").toLowerCase();
  if (n.includes("ios") || n.includes("iphone") || n.includes("android") || n.includes("mobile"))
    return Smartphone;
  return Monitor;
}

function roleBadgeStyle(role: string): string {
  switch (role) {
    case "ADMIN":
    case "SUPER_ADMIN":
      return "bg-[var(--color-text-primary)] text-white";
    case "INSTRUCTOR":
    case "TEACHING_ASSISTANT":
      return "bg-[var(--color-border-subtle)] text-[#1D4ED8]";
    case "MANAGER":
      return "bg-[#EDE9FE] text-[#7C3AED]";
    default:
      return "bg-[#DCFCE7] text-[#16A34A]";
  }
}

const SecurityContent = () => {
  const t = useTranslations("adminDashboard.securityPage");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);

  // Sessions
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [search, setSearch] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<AdminSessionRow | null>(null);

  // Failed logins
  const [failed, setFailed] = useState<AdminFailedLoginRow[]>([]);
  const [failedTotal, setFailedTotal] = useState(0);
  const [failedLoading, setFailedLoading] = useState(false);

  // Suspicious IPs
  const [ips, setIps] = useState<AdminSuspiciousIp[]>([]);
  const [ipsLoading, setIpsLoading] = useState(false);

  // ── Initial dashboard fetch (drives KPI strip) ─────────────────────
  useEffect(() => {
    let cancelled = false;
    adminApi
      .getDashboard()
      .then((res) => {
        if (!cancelled) setDashboard(res);
      })
      .catch(() => {
        /* user might not have access; KPI cards just stay zero */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Tab-specific fetchers ──────────────────────────────────────────
  const loadSessions = useCallback(
    async (page: number, q: string) => {
      setSessionsLoading(true);
      try {
        const res = await adminApi.getSecuritySessions({
          search: q || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setSessions(res.rows);
        setSessionsTotal(res.total);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load sessions");
      } finally {
        setSessionsLoading(false);
      }
    },
    [],
  );

  const loadFailed = useCallback(async () => {
    setFailedLoading(true);
    try {
      const res = await adminApi.getFailedLogins({ limit: 100, hours: 24 });
      setFailed(res.rows);
      setFailedTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load failed logins");
    } finally {
      setFailedLoading(false);
    }
  }, []);

  const loadIps = useCallback(async () => {
    setIpsLoading(true);
    try {
      const rows = await adminApi.getSuspiciousIps(5);
      setIps(rows);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load IP list");
    } finally {
      setIpsLoading(false);
    }
  }, []);

  // Trigger fetches when switching tabs.
  useEffect(() => {
    if (tab === "sessions") loadSessions(sessionsPage, search);
    if (tab === "logins") loadFailed();
    if (tab === "ips") loadIps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Re-search sessions when the query changes (debounced via effect).
  useEffect(() => {
    if (tab !== "sessions") return;
    const t = setTimeout(() => {
      setSessionsPage(0);
      loadSessions(0, search);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Actions ────────────────────────────────────────────────────────
  const performRevoke = async (row: AdminSessionRow) => {
    setRevokingId(row.deviceId);
    try {
      await adminApi.revokeUserDevice(row.userId, row.deviceId);
      setSessions((prev) => prev.filter((s) => s.deviceId !== row.deviceId));
      setSessionsTotal((prev) => Math.max(0, prev - 1));
      toast.success(t("toasts.revokeSuccess", { user: row.userName }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("toasts.revokeFailed"));
    } finally {
      setRevokingId(null);
      setConfirmRevoke(null);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const sec = dashboard?.security;
    return {
      failedLogins: sec?.failedLogins ?? 0,
      ipsBlocked: sec?.ipsBlocked ?? 0,
      activeSessions: sec?.activeSessions ?? 0,
      twoFa: sec?.twoFaAdoption ?? 0,
    };
  }, [dashboard]);

  const securityScore = useMemo(() => {
    // Coarse health score: 2FA adoption weighted heavy, penalize for
    // active suspicious IPs and elevated failed logins.
    const fa = Math.min(stats.twoFa, 100);
    const ipPenalty = Math.min(stats.ipsBlocked * 5, 25);
    const loginPenalty = Math.min(Math.floor(stats.failedLogins / 5), 15);
    return Math.max(0, Math.min(100, Math.round(fa - ipPenalty - loginPenalty)));
  }, [stats]);

  const totalSessionPages = Math.max(1, Math.ceil(sessionsTotal / PAGE_SIZE));

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
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("subtitle")}
                </p>
              </div>

              {/* KPI strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                <StatCard
                  icon={Lock}
                  iconColor="text-[#D97706]"
                  iconBg="bg-[#FEF3C7]"
                  label={t("stats.failedLogins")}
                  value={String(stats.failedLogins)}
                />
                <StatCard
                  icon={Ban}
                  iconColor="text-[#DC2626]"
                  iconBg="bg-[#FEE2E2]"
                  label={t("stats.ipsBlocked")}
                  value={String(stats.ipsBlocked)}
                />
                <StatCard
                  icon={Users}
                  iconColor="text-[var(--color-primary)]"
                  iconBg="bg-[var(--color-border-subtle)]"
                  label={t("stats.activeSessions")}
                  value={String(stats.activeSessions)}
                />
                <StatCard
                  icon={KeyRound}
                  iconColor="text-[#16A34A]"
                  iconBg="bg-[#DCFCE7]"
                  label={t("stats.twoFa")}
                  value={`${stats.twoFa}%`}
                />
                <StatCard
                  icon={Shield}
                  iconColor="text-[#8B5CF6]"
                  iconBg="bg-[#EDE9FE]"
                  label={t("stats.score")}
                  value={`${securityScore}%`}
                />
              </div>

              {/* Tabs */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
                  {(["overview", "sessions", "logins", "ips"] as Tab[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                        tab === id
                          ? "border-[var(--color-primary)] text-[var(--color-text-primary)]"
                          : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {t(`tabs.${id}`)}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {tab === "overview" && (
                    <OverviewTab
                      stats={stats}
                      securityScore={securityScore}
                      ips={ips}
                      ipsLoading={ipsLoading}
                      onLoadIps={loadIps}
                    />
                  )}

                  {tab === "sessions" && (
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                        <div className="relative flex-1">
                          <Search
                            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                          />
                          <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t("searchPlaceholder")}
                            className={`w-full ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-page)] focus:outline-none focus:border-[var(--color-primary)]`}
                          />
                        </div>
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {t("sessionCount", { n: sessionsTotal })}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        {sessionsLoading && (
                          <div>
                            {Array.from({ length: 6 }).map((_, i) => (
                              <TableRowSkeleton key={i} cols={5} />
                            ))}
                          </div>
                        )}

                        {!sessionsLoading && sessions.length === 0 && (
                          <p className="text-sm text-[var(--color-text-secondary)] py-10 text-center">
                            {t("noSessions")}
                          </p>
                        )}

                        {!sessionsLoading && sessions.length > 0 && (
                          <table className="w-full text-sm">
                            <thead className="bg-[var(--color-surface-page)] text-xs uppercase text-[var(--color-text-secondary)]">
                              <tr>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.user")}
                                </th>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.device")}
                                </th>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.ip")}
                                </th>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.lastActive")}
                                </th>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.actions")}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                              {sessions.map((row) => {
                                const Icon = deviceIcon(row.deviceName);
                                return (
                                  <tr key={row.deviceId}>
                                    <td className="px-4 py-3">
                                      <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-1">
                                        {row.userName}
                                      </p>
                                      <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
                                        <span>{row.userEmail}</span>
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${roleBadgeStyle(row.userRole)}`}
                                        >
                                          {row.userRole}
                                        </span>
                                      </p>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                                        <Icon className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                                        <span className="line-clamp-1">
                                          {row.deviceName || t("unknownDevice")}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                                      {row.ipAddress || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                                      {formatRelative(row.lastUsedAt, locale)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <button
                                        type="button"
                                        onClick={() => setConfirmRevoke(row)}
                                        disabled={revokingId === row.deviceId}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#DC2626] hover:bg-[#FEE2E2] px-2 py-1 rounded transition-colors disabled:opacity-60"
                                      >
                                        {revokingId === row.deviceId ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <LogOut className="w-3.5 h-3.5" />
                                        )}
                                        {t("actions.revoke")}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {sessionsTotal > PAGE_SIZE && (
                        <div className="flex items-center justify-between mt-4 text-xs text-[var(--color-text-secondary)]">
                          <span>
                            {t("page", { n: sessionsPage + 1, total: totalSessionPages })}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={sessionsPage === 0}
                              onClick={() => {
                                const next = Math.max(0, sessionsPage - 1);
                                setSessionsPage(next);
                                loadSessions(next, search);
                              }}
                              className="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-50"
                            >
                              {t("actions.prev")}
                            </button>
                            <button
                              type="button"
                              disabled={sessionsPage + 1 >= totalSessionPages}
                              onClick={() => {
                                const next = sessionsPage + 1;
                                setSessionsPage(next);
                                loadSessions(next, search);
                              }}
                              className="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-50"
                            >
                              {t("actions.next")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "logins" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                            {t("failedLoginAttempts")}
                          </h3>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                            {t("failedSubtitle", { total: failedTotal })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={loadFailed}
                          disabled={failedLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-60"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${failedLoading ? "animate-spin" : ""}`} />
                          {t("actions.refresh")}
                        </button>
                      </div>

                      {failedLoading && (
                        <div>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <TableRowSkeleton key={i} cols={5} />
                          ))}
                        </div>
                      )}

                      {!failedLoading && failed.length === 0 && (
                        <p className="text-sm text-[var(--color-text-secondary)] py-10 text-center">
                          {t("noFailedLogins")}
                        </p>
                      )}

                      {!failedLoading && failed.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[var(--color-surface-page)] text-xs uppercase text-[var(--color-text-secondary)]">
                              <tr>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.attemptedEmail")}
                                </th>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.ip")}
                                </th>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.time")}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                              {failed.map((row) => (
                                <tr key={row.id}>
                                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                                    {row.attemptedEmail || "—"}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                                    {row.ipAddress || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                                    {formatRelative(row.createdAt, locale)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "ips" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                            {t("suspiciousIps")}
                          </h3>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                            {t("suspiciousSubtitle")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={loadIps}
                          disabled={ipsLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-60"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${ipsLoading ? "animate-spin" : ""}`} />
                          {t("actions.refresh")}
                        </button>
                      </div>

                      {ipsLoading && (
                        <div>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <TableRowSkeleton key={i} cols={5} />
                          ))}
                        </div>
                      )}

                      {!ipsLoading && ips.length === 0 && (
                        <p className="text-sm text-[var(--color-text-secondary)] py-10 text-center">
                          {t("noSuspicious")}
                        </p>
                      )}

                      {!ipsLoading && ips.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[var(--color-surface-page)] text-xs uppercase text-[var(--color-text-secondary)]">
                              <tr>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.ip")}
                                </th>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.attempts")}
                                </th>
                                <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("table.lastAttempt")}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                              {ips.map((row) => (
                                <tr key={row.ipAddress}>
                                  <td className="px-4 py-3 font-mono text-[var(--color-text-primary)]">
                                    {row.ipAddress}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                                        row.attempts >= 20
                                          ? "bg-[#FEE2E2] text-[#DC2626]"
                                          : "bg-[#FEF3C7] text-[#D97706]"
                                      }`}
                                    >
                                      {row.attempts}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                                    {formatRelative(row.lastAttemptAt, locale)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revoke confirmation modal */}
      {confirmRevoke && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[#FEE2E2] border-b border-[#FCA5A5] px-6 py-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#DC2626] flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#991B1B]">
                  {t("revokeConfirm.title")}
                </h3>
                <p className="text-xs text-[#B91C1C] mt-0.5">
                  {t("revokeConfirm.subtitle", { user: confirmRevoke.userName })}
                </p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-3 text-sm text-[var(--color-text-primary)]">
              <p>{t("revokeConfirm.body")}</p>
              <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-3 text-xs">
                <p>
                  <strong>{t("table.device")}:</strong>{" "}
                  {confirmRevoke.deviceName || t("unknownDevice")}
                </p>
                <p>
                  <strong>{t("table.ip")}:</strong>{" "}
                  <span className="font-mono">{confirmRevoke.ipAddress || "—"}</span>
                </p>
                <p>
                  <strong>{t("table.lastActive")}:</strong>{" "}
                  {formatRelative(confirmRevoke.lastUsedAt, locale)}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-[var(--color-surface-page)] border-t border-[var(--color-border)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRevoke(null)}
                disabled={revokingId === confirmRevoke.deviceId}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg disabled:opacity-50"
              >
                {t("revokeConfirm.cancel")}
              </button>
              <button
                type="button"
                onClick={() => performRevoke(confirmRevoke)}
                disabled={revokingId === confirmRevoke.deviceId}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {revokingId === confirmRevoke.deviceId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                {t("revokeConfirm.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── Subcomponents ────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
}: {
  icon: typeof Lock;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-1">{label}</p>
    </div>
  );
}

function OverviewTab({
  stats,
  securityScore,
  ips,
  ipsLoading,
  onLoadIps,
}: {
  stats: { failedLogins: number; ipsBlocked: number; activeSessions: number; twoFa: number };
  securityScore: number;
  ips: AdminSuspiciousIp[];
  ipsLoading: boolean;
  onLoadIps: () => void;
}) {
  const t = useTranslations("adminDashboard.securityPage");
  const locale = useLocale();
  const alerts: Array<{
    severity: "critical" | "warning" | "info";
    title: string;
    body: string;
  }> = [];

  if (stats.failedLogins >= 50) {
    alerts.push({
      severity: "critical",
      title: t("overview.elevatedFailedTitle"),
      body: t("overview.elevatedFailedBody", { n: stats.failedLogins }),
    });
  }
  if (stats.ipsBlocked > 0) {
    alerts.push({
      severity: "warning",
      title: t("overview.suspiciousIpsTitle"),
      body: t("overview.suspiciousIpsBody", { n: stats.ipsBlocked }),
    });
  }
  if (stats.twoFa < 70) {
    alerts.push({
      severity: "warning",
      title: t("overview.low2faTitle"),
      body: t("overview.low2faBody", { pct: stats.twoFa }),
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      severity: "info",
      title: t("overview.allClearTitle"),
      body: t("overview.allClearBody", { score: securityScore }),
    });
  }

  // Fetch IPs once on overview open so the right pane shows real data
  // even before the user clicks into the IPs tab.
  useEffect(() => {
    if (ips.length === 0 && !ipsLoading) onLoadIps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
          {t("alerts")}
        </h3>
        <div className="space-y-3">
          {alerts.map((a, i) => {
            const styles =
              a.severity === "critical"
                ? "bg-[#FEE2E2] border-[#FCA5A5] text-[#991B1B]"
                : a.severity === "warning"
                  ? "bg-[#FEF3C7] border-[#FCD34D] text-[#92400E]"
                  : "bg-[#DCFCE7] border-[#BBF7D0] text-[#166534]";
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-4 rounded-lg border ${styles}`}
              >
                {a.severity === "critical" ? (
                  <AlertTriangle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
                ) : a.severity === "warning" ? (
                  <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
                ) : (
                  <Shield className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs mt-0.5 opacity-90">{a.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
          {t("topSuspicious")}
        </h3>
        <div className="bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] max-h-[260px] overflow-y-auto">
          {ipsLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
            </div>
          )}
          {!ipsLoading && ips.length === 0 && (
            <p className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
              {t("noSuspicious")}
            </p>
          )}
          {!ipsLoading &&
            ips.slice(0, 8).map((row) => (
              <div key={row.ipAddress} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-[var(--color-text-primary)]">
                    {row.ipAddress}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {formatRelative(row.lastAttemptAt, locale)}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    row.attempts >= 20
                      ? "bg-[#FEE2E2] text-[#DC2626]"
                      : "bg-[#FEF3C7] text-[#D97706]"
                  }`}
                >
                  {row.attempts}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default SecurityContent;
