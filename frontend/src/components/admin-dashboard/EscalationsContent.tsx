"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ShieldAlert,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import Select from "./Select";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import {
  escalationsApi,
  ApiError,
  type ReconciliationEscalationListItem,
  type EscalationStatus,
  type EscalationUrgency,
  type EscalationStats,
} from "@/lib/api";
import { formatDateTime } from "@/components/finance-dashboard/shared/financeFormat";

const STATUS_TABS: (EscalationStatus | "all")[] = [
  "pending",
  "in_progress",
  "resolved",
  "declined",
  "sent_back",
  "all",
];

const STATUS_PILL: Record<EscalationStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-emerald-100 text-emerald-800",
  declined: "bg-slate-100 text-slate-700",
  sent_back: "bg-violet-100 text-violet-800",
};

const URGENCY_PILL: Record<EscalationUrgency, string> = {
  low: "bg-slate-100 text-slate-700",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-red-100 text-red-700",
};

// Label lookup helpers — resolve dynamic keys under
// `adminDashboard.escalations.labels.*` at render time.
type LabelT = ReturnType<typeof useTranslations>;

function getStatusLabel(status: EscalationStatus | "all", t: LabelT): string {
  return t(`labels.status.${status}`);
}

function getProposedActionLabel(action: string, t: LabelT): string {
  const has = t.has ? t.has(`labels.proposedAction.${action}`) : true;
  return has ? t(`labels.proposedAction.${action}`) : action;
}

function getGatewayLabel(gateway: string, t: LabelT): string {
  const has = t.has ? t.has(`labels.gateway.${gateway}`) : true;
  return has ? t(`labels.gateway.${gateway}`) : gateway;
}

function getDriftTypeLabel(driftType: string, t: LabelT): string {
  const has = t.has ? t.has(`labels.driftType.${driftType}`) : true;
  return has ? t(`labels.driftType.${driftType}`) : driftType;
}

function getUrgencyLabel(urgency: EscalationUrgency, t: LabelT): string {
  return t(`labels.urgency.${urgency}`);
}

export interface EscalationsContentProps {
  /** When true, render only the inner page (no AdminNavbar/Sidebar). Used by
   *  AdminFinanceShell so this content embeds inside the finance hub's tabs
   *  instead of breaking out as its own page. */
  embedded?: boolean;
}

export default function EscalationsContent({
  embedded = false,
}: EscalationsContentProps = {}) {
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const t = useTranslations("adminDashboard.escalations");

  const [statusTab, setStatusTab] = useState<EscalationStatus | "all">("pending");
  const [urgencyFilter, setUrgencyFilter] = useState<EscalationUrgency | "">("");
  const [gatewayFilter, setGatewayFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReconciliationEscalationListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<EscalationStats | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        escalationsApi.list({
          status: statusTab,
          urgency: urgencyFilter || undefined,
          gateway: gatewayFilter || undefined,
          page,
          limit: 25,
        }),
        escalationsApi.getStats(),
      ]);
      setItems(list.data);
      setTotalPages(list.pagination.totalPages);
      setTotal(list.pagination.total);
      setStats(s);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("list.toastLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [statusTab, urgencyFilter, gatewayFilter, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const inner = (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                      {t("list.title")}
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                      {t("list.subtitle")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-60"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t("list.refresh")}
                </button>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                <KpiCard
                  label={t("list.kpi.pending")}
                  value={stats?.pending ?? "—"}
                  emphasis={(stats?.pending ?? 0) > 0 ? "warning" : "normal"}
                />
                <KpiCard
                  label={t("list.kpi.inProgress")}
                  value={stats?.inProgress ?? "—"}
                />
                <KpiCard
                  label={t("list.kpi.highUrgencyOpen")}
                  value={stats?.highUrgencyOpen ?? "—"}
                  emphasis={(stats?.highUrgencyOpen ?? 0) > 0 ? "danger" : "normal"}
                />
                <KpiCard
                  label={t("list.kpi.avgResolutionTime")}
                  value={
                    stats?.avgResolutionMinutes
                      ? formatDuration(stats.avgResolutionMinutes)
                      : "—"
                  }
                />
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                    <Filter className="w-3.5 h-3.5" />
                    {t("list.filtersLabel")}
                  </div>
                  <Select
                    value={urgencyFilter}
                    onChange={(v) => {
                      setUrgencyFilter(v as EscalationUrgency | "");
                      setPage(1);
                    }}
                    size="sm"
                    className="w-[160px]"
                    options={[
                      { value: "", label: t("list.urgencyFilter.all") },
                      { value: "high", label: getUrgencyLabel("high", t) },
                      { value: "normal", label: getUrgencyLabel("normal", t) },
                      { value: "low", label: getUrgencyLabel("low", t) },
                    ]}
                  />
                  <Select
                    value={gatewayFilter}
                    onChange={(v) => {
                      setGatewayFilter(v);
                      setPage(1);
                    }}
                    size="sm"
                    className="w-[180px]"
                    options={[
                      { value: "", label: t("list.gatewayFilter.all") },
                      { value: "moyasar", label: getGatewayLabel("moyasar", t) },
                      { value: "tamara", label: getGatewayLabel("tamara", t) },
                      { value: "tabby", label: getGatewayLabel("tabby", t) },
                      { value: "bank_transfer", label: getGatewayLabel("bank_transfer", t) },
                    ]}
                  />
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
                      onClick={() => {
                        setStatusTab(key);
                        setPage(1);
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        active
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-page)]"
                      }`}
                    >
                      {getStatusLabel(key, t)}
                    </button>
                  );
                })}
              </div>

              {/* Table */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                    <ShieldAlert className="w-12 h-12 text-[var(--color-text-secondary)] opacity-40 mb-3" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {t("list.empty.title")}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {statusTab === "pending"
                        ? t("list.empty.pending")
                        : t("list.empty.otherStatus", {
                            status: getStatusLabel(statusTab, t).toLowerCase(),
                          })}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
                        <tr>
                          <th className="text-start p-3 font-medium">{t("list.table.urgency")}</th>
                          <th className="text-start p-3 font-medium">{t("list.table.status")}</th>
                          <th className="text-start p-3 font-medium">{t("list.table.drift")}</th>
                          <th className="text-start p-3 font-medium">{t("list.table.gateway")}</th>
                          <th className="text-start p-3 font-medium">{t("list.table.customer")}</th>
                          <th className="text-start p-3 font-medium">{t("list.table.proposedAction")}</th>
                          <th className="text-start p-3 font-medium">{t("list.table.escalatedBy")}</th>
                          <th className="text-start p-3 font-medium">{t("list.table.when")}</th>
                          <th className="text-end p-3 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((e) => (
                          <tr
                            key={e.id}
                            className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-page)]"
                          >
                            <td className="p-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${URGENCY_PILL[e.urgency]}`}
                              >
                                {getUrgencyLabel(e.urgency, t)}
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_PILL[e.status]}`}
                              >
                                {getStatusLabel(e.status, t)}
                              </span>
                            </td>
                            <td className="p-3 text-xs">
                              {getDriftTypeLabel(e.driftType, t)}
                            </td>
                            <td className="p-3 text-xs">
                              {getGatewayLabel(e.gateway, t)}
                            </td>
                            <td className="p-3">
                              <div className="text-xs">{e.customerName || e.customerEmail || "—"}</div>
                              {e.courseTitle && (
                                <div className="text-[11px] text-[var(--color-text-secondary)]">
                                  {e.courseTitle}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-xs">
                              {getProposedActionLabel(e.proposedAction, t)}
                            </td>
                            <td className="p-3 text-xs">{e.escalatedByName || t("list.systemFallback")}</td>
                            <td className="p-3 text-xs text-[var(--color-text-secondary)]">
                              {formatDateTime(e.escalatedAt, locale)}
                            </td>
                            <td className="p-3 text-end">
                              <Link
                                href={`/${locale}/dashboard/admin/finance/escalations/${e.id}`}
                                className="px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-colors inline-block"
                              >
                                {t("list.open")}
                              </Link>
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
                      {t("list.pagination", { total, page, totalPages })}
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
  );

  if (embedded) {
    return inner;
  }

  return (
    <>
      <AdminNavbar admin={admin} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:shrink-0">
              <AdminSidebar admin={admin} />
            </div>
            <AdminMobileSidebar admin={admin} />
            <div className="flex-1 min-w-0">{inner}</div>
          </div>
        </div>
      </div>
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
  emphasis?: "danger" | "warning" | "normal";
}) {
  const colorClass =
    emphasis === "danger"
      ? "text-red-600"
      : emphasis === "warning"
        ? "text-amber-600"
        : "text-[var(--color-text-primary)]";
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-4">
      <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}
