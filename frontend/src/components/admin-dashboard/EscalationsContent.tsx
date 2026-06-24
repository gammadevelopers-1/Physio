"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
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
import { useAdminProfile } from "@/hooks/useAdminProfile";
import {
  escalationsApi,
  ApiError,
  type ReconciliationEscalationListItem,
  type EscalationStatus,
  type EscalationUrgency,
  type EscalationStats,
} from "@/lib/api";

const STATUS_TABS: (EscalationStatus | "all")[] = [
  "pending",
  "in_progress",
  "resolved",
  "declined",
  "sent_back",
  "all",
];

const STATUS_LABEL: Record<EscalationStatus | "all", string> = {
  pending: "Pending",
  in_progress: "In progress",
  resolved: "Resolved",
  declined: "Declined",
  sent_back: "Sent back",
  all: "All",
};

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

const PROPOSED_ACTION_LABEL: Record<string, string> = {
  enroll: "Manual enrollment",
  refund: "Issue refund",
  investigate: "Investigate",
  other: "Other",
  system_inferred: "System-inferred",
};

const GATEWAY_LABEL: Record<string, string> = {
  moyasar: "Moyasar",
  tamara: "Tamara",
  tabby: "Tabby",
  bank_transfer: "Bank Transfer",
};

const DRIFT_TYPE_LABEL: Record<string, string> = {
  missing_local: "Missing locally",
  missing_gateway: "Missing on gateway",
  amount_mismatch: "Amount mismatch",
  status_mismatch: "Status mismatch",
  stuck_pending: "Stuck pending",
  stuck_approval: "Stuck approval",
  orphan_receipt: "Orphan receipt",
  paid_no_receipt: "Paid, no receipt",
};

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
      toast.error(err instanceof ApiError ? err.message : "Failed to load escalations");
    } finally {
      setLoading(false);
    }
  }, [statusTab, urgencyFilter, gatewayFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const inner = (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                      Reconciliation Escalations
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                      Finance-raised reconciliation drifts that need admin action
                    </p>
                  </div>
                </div>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-60"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                <KpiCard
                  label="Pending"
                  value={stats?.pending ?? "—"}
                  emphasis={(stats?.pending ?? 0) > 0 ? "warning" : "normal"}
                />
                <KpiCard
                  label="In progress"
                  value={stats?.inProgress ?? "—"}
                />
                <KpiCard
                  label="High urgency (open)"
                  value={stats?.highUrgencyOpen ?? "—"}
                  emphasis={(stats?.highUrgencyOpen ?? 0) > 0 ? "danger" : "normal"}
                />
                <KpiCard
                  label="Avg resolution time"
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
                    Filters:
                  </div>
                  <select
                    value={urgencyFilter}
                    onChange={(e) => {
                      setUrgencyFilter(e.target.value as EscalationUrgency | "");
                      setPage(1);
                    }}
                    className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-card)]"
                  >
                    <option value="">All urgency</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={gatewayFilter}
                    onChange={(e) => {
                      setGatewayFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-card)]"
                  >
                    <option value="">All gateways</option>
                    <option value="moyasar">Moyasar</option>
                    <option value="tamara">Tamara</option>
                    <option value="tabby">Tabby</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
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
                      {STATUS_LABEL[key]}
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
                      No escalations
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {statusTab === "pending"
                        ? "Nothing waiting — finance hasn't escalated anything new."
                        : `No ${STATUS_LABEL[statusTab].toLowerCase()} escalations.`}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
                        <tr>
                          <th className="text-left p-3 font-medium">Urgency</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">Drift</th>
                          <th className="text-left p-3 font-medium">Gateway</th>
                          <th className="text-left p-3 font-medium">Customer</th>
                          <th className="text-left p-3 font-medium">Proposed action</th>
                          <th className="text-left p-3 font-medium">Escalated by</th>
                          <th className="text-left p-3 font-medium">When</th>
                          <th className="text-right p-3 font-medium"></th>
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
                                className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${URGENCY_PILL[e.urgency]}`}
                              >
                                {e.urgency}
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_PILL[e.status]}`}
                              >
                                {STATUS_LABEL[e.status]}
                              </span>
                            </td>
                            <td className="p-3 text-xs">
                              {DRIFT_TYPE_LABEL[e.driftType] || e.driftType}
                            </td>
                            <td className="p-3 text-xs">
                              {GATEWAY_LABEL[e.gateway] || e.gateway}
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
                              {PROPOSED_ACTION_LABEL[e.proposedAction] || e.proposedAction}
                            </td>
                            <td className="p-3 text-xs">{e.escalatedByName || "System"}</td>
                            <td className="p-3 text-xs text-[var(--color-text-secondary)]">
                              {new Date(e.escalatedAt).toLocaleString(
                                locale === "ar" ? "ar-SA" : "en-US",
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <Link
                                href={`/${locale}/dashboard/admin/finance/escalations/${e.id}`}
                                className="px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-colors inline-block"
                              >
                                Open
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
                      {total} escalations · page {page} of {totalPages}
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
    </>
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
