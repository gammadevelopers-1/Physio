"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Clock,
  FilePlus,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  UserCheck,
  UserPlus,
  XCircle,
  XOctagon,
} from "lucide-react";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import { useAuth } from "@/contexts/AuthContext";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";

// Supervisor / admin alerts page. Aggregates three things on one
// surface so a supervisor doesn't have to bounce between tabs to
// triage a queue:
//   1. Breached tickets (red, top — the most actionable)
//   2. High-priority + unassigned (current /alerts page shape)
//   3. Live audit trail — every meaningful support action across the
//      org, paginated, refreshable, with actor + role badges
//
// The earlier /alerts route showed only the breached/unassigned/high
// triplet. This widens that view to the full org activity, which is
// what the user asked for ("breeches, admin changes something in
// settings, agent do something in ticket").

type AuditTrailResponse = Awaited<
  ReturnType<typeof supportApi.getSupervisorAuditTrail>
>;

type AlertRow = {
  key: string;
  category: "breached" | "highPriority" | "unassigned";
  ticketId: string;
  referenceNumber: string | null;
  subject: string;
  priority: string;
};

function categoryStyle(c: AlertRow["category"]): {
  icon: typeof AlertTriangle;
  color: string;
  bg: string;
  border: string;
} {
  switch (c) {
    case "breached":
      return {
        icon: XCircle,
        color: "text-[#DC2626]",
        bg: "bg-[#FEE2E2]",
        border: "#DC2626",
      };
    case "highPriority":
      return {
        icon: AlertTriangle,
        color: "text-[#EA580C]",
        bg: "bg-[#FFEDD5]",
        border: "#EA580C",
      };
    case "unassigned":
    default:
      return {
        icon: UserPlus,
        color: "text-[#C2410C]",
        bg: "bg-[#FFEDD5]",
        border: "#C2410C",
      };
  }
}

const SupervisorAlertsPageContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();
  const profile = useSupportProfile();

  const basePath =
    user?.supportSubRole === "supervisor"
      ? `/${locale}/dashboard/support/supervisor`
      : `/${locale}/dashboard/support/agent`;

  // KPI alerts (breached / unassigned / high-priority) — pulled from
  // the same /kpis endpoint the dashboard widget reads. Tabular here
  // instead of the existing rich card list to keep the page dense.
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [activeCategory, setActiveCategory] = useState<
    "all" | AlertRow["category"]
  >("all");

  // Audit trail — paginated cross-team activity.
  const [trail, setTrail] = useState<AuditTrailResponse | null>(null);
  const [trailPage, setTrailPage] = useState(1);
  const [isLoadingTrail, setIsLoadingTrail] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const kpis = await supportApi.getKPIs();
      const a = (kpis?.alerts ?? {
        breached: [],
        unassigned: [],
        highPriority: [],
      }) as {
        breached: { id: string; referenceNumber?: string | null; subject: string; priority: string }[];
        unassigned: { id: string; referenceNumber?: string | null; subject: string; priority: string }[];
        highPriority: { id: string; referenceNumber?: string | null; subject: string; priority: string }[];
      };
      const rows: AlertRow[] = [
        ...a.breached.map((x) => ({
          key: `b-${x.id}`,
          category: "breached" as const,
          ticketId: x.id,
          referenceNumber: x.referenceNumber || null,
          subject: x.subject,
          priority: x.priority,
        })),
        ...a.highPriority.map((x) => ({
          key: `h-${x.id}`,
          category: "highPriority" as const,
          ticketId: x.id,
          referenceNumber: x.referenceNumber || null,
          subject: x.subject,
          priority: x.priority,
        })),
        ...a.unassigned.map((x) => ({
          key: `u-${x.id}`,
          category: "unassigned" as const,
          ticketId: x.id,
          referenceNumber: x.referenceNumber || null,
          subject: x.subject,
          priority: x.priority,
        })),
      ];
      setAlerts(rows);
    } catch {
      setAlerts([]);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  const fetchTrail = useCallback(
    async (page: number, refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoadingTrail(true);
      }
      try {
        const res = await supportApi.getSupervisorAuditTrail(page, 20);
        setTrail(res);
      } catch {
        // Keep last-known data; the section header surfaces the spinner.
      } finally {
        setIsLoadingTrail(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    void fetchTrail(trailPage);
  }, [trailPage, fetchTrail]);

  const filteredAlerts = useMemo(() => {
    if (activeCategory === "all") return alerts;
    return alerts.filter((a) => a.category === activeCategory);
  }, [alerts, activeCategory]);

  return (
    <>
      <SupportNavbar profile={profile} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar
                profile={profile}
                supportSubRole={user?.supportSubRole}
              />
            </div>

            <div className="flex-1 min-w-0" dir={isRTL ? "rtl" : "ltr"}>
              {/* Header */}
              <div className="mb-6">
                <Link
                  href={basePath}
                  className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-3"
                >
                  <ArrowLeft className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                  {t("alertsPage.backToDashboard")}
                </Link>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-[#EA580C]" />
                  {t("alertsPage.title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("alertsPage.subtitleSupervisor")}
                </p>
              </div>

              {/* KPI alerts block */}
              <section className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mb-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {t("alertsPage.kpiAlertsTitle")}
                  </h2>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(["all", "breached", "highPriority", "unassigned"] as const).map(
                      (c) => {
                        const active = activeCategory === c;
                        const count =
                          c === "all"
                            ? alerts.length
                            : alerts.filter((a) => a.category === c).length;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setActiveCategory(c)}
                            className={`px-3 py-1 text-xs rounded-lg border ${
                              active
                                ? "border-[var(--color-primary)] bg-[#EFF6FF] text-[var(--color-primary)]"
                                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                            }`}
                          >
                            {t(
                              c === "all"
                                ? "alertsPage.tabs.all"
                                : `alerts.category.${c}`,
                            )}{" "}
                            ({count})
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>

                {isLoadingAlerts ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                ) : filteredAlerts.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">
                    {t("alertsPage.allClear.title")}
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {filteredAlerts.map((alert) => {
                      const style = categoryStyle(alert.category);
                      const Icon = style.icon;
                      return (
                        <li key={alert.key}>
                          <Link
                            href={`${basePath}/tickets/${alert.ticketId}`}
                            className="flex items-center gap-3 py-3 hover:bg-[var(--color-border-subtle)] -mx-2 px-2 rounded"
                          >
                            <span
                              className={`flex-shrink-0 w-8 h-8 rounded-full ${style.bg} flex items-center justify-center`}
                            >
                              <Icon className={`w-4 h-4 ${style.color}`} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[var(--color-primary)] font-semibold">
                                {alert.referenceNumber || alert.ticketId.slice(0, 8)}
                              </p>
                              <p className="text-sm text-[var(--color-text-primary)] truncate">
                                {alert.subject}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] uppercase tracking-wide font-medium ${style.color}`}
                            >
                              {t(`alerts.category.${alert.category}`)}
                            </span>
                            <ArrowRight
                              className={`w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 ${
                                isRTL ? "rotate-180" : ""
                              }`}
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Audit trail block */}
              <section className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t("alertsPage.auditTrailTitle")}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchTrail(trailPage, true)}
                    disabled={isRefreshing || isLoadingTrail}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
                    />
                    {t("alertsPage.refresh")}
                  </button>
                </div>

                {isLoadingTrail && !trail ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                ) : !trail || trail.data.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">
                    {t("alertsPage.noAuditTrail")}
                  </p>
                ) : (
                  <>
                    <div className="divide-y divide-[var(--color-border-subtle)]">
                      {trail.data.map((row) => (
                        <AuditRow
                          key={row.id}
                          row={row}
                          basePath={basePath}
                          t={t}
                        />
                      ))}
                    </div>
                    {trail.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-border)]">
                        <span className="text-[11px] text-[var(--color-text-secondary)]">
                          {t("alertsPage.paginationShowing", {
                            from: (trail.page - 1) * trail.limit + 1,
                            to: Math.min(trail.page * trail.limit, trail.total),
                            total: trail.total,
                          })}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setTrailPage((p) => Math.max(1, p - 1))}
                            disabled={trail.page <= 1 || isRefreshing}
                            className="p-1.5 border border-[var(--color-border)] rounded-lg disabled:opacity-40 hover:bg-[var(--color-border-subtle)]"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[11px] text-[var(--color-text-secondary)] px-2 tabular-nums">
                            {trail.page} / {trail.totalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setTrailPage((p) =>
                                Math.min(trail.totalPages, p + 1),
                              )
                            }
                            disabled={trail.page >= trail.totalPages || isRefreshing}
                            className="p-1.5 border border-[var(--color-border)] rounded-lg disabled:opacity-40 hover:bg-[var(--color-border-subtle)]"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

function AuditRow({
  row,
  basePath,
  t,
}: {
  row: AuditTrailResponse["data"][number];
  basePath: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const { icon: Icon, tone } = auditIconFor(row.action);
  const performerLabel = row.performerName || t("alertsPage.auditUnknownActor");
  const refLabel = row.ticketReferenceNumber || row.ticketId.slice(0, 8);

  // Build a one-line description for the more meaningful actions.
  const md = (row.metadata || {}) as Record<string, unknown>;
  let detail: string | null = null;
  if (row.action === "assignee_changed") {
    detail = t("alertsPage.auditDetailAssignee");
  } else if (row.action === "priority_changed") {
    detail = t("alertsPage.auditDetailPriority", {
      from: String(md.previousPriority || "?"),
      to: String(md.newPriority || "?"),
    });
  } else if (row.action === "status_changed") {
    detail = t("alertsPage.auditDetailStatus", {
      from: String(md.previousStatus || "?"),
      to: String(md.newStatus || "?"),
    });
  }

  return (
    <Link
      href={`${basePath}/tickets/${row.ticketId}`}
      className="flex items-start gap-3 py-2.5 hover:bg-[var(--color-border-subtle)] -mx-2 px-2 rounded"
    >
      <span
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          tone === "success"
            ? "bg-[#DCFCE7] text-[#15803D]"
            : tone === "danger"
              ? "bg-[#FEE2E2] text-[#991B1B]"
              : tone === "warning"
                ? "bg-[#FEF3C7] text-[#92400E]"
                : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {t(`alertsPage.auditAction.${row.action}`)}
          </span>
          <span className="text-[10px] text-[var(--color-primary)] font-medium">
            {refLabel}
          </span>
          {row.ticketSubject && (
            <span className="text-[11px] text-[var(--color-text-secondary)] truncate">
              · {row.ticketSubject}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-secondary)] mt-0.5 flex-wrap">
          <span>{performerLabel}</span>
          {row.performerRole && (
            <span className="text-[9px] uppercase tracking-wide bg-[var(--color-border-subtle)] px-1 rounded">
              {t(`alertsPage.auditRole.${row.performerRole}`)}
            </span>
          )}
          {detail && (
            <>
              <span>·</span>
              <span>{detail}</span>
            </>
          )}
          <span>·</span>
          <span>{formatAgo(row.createdAt, t)}</span>
        </div>
      </div>
    </Link>
  );
}

function auditIconFor(action: string): {
  icon: typeof FilePlus;
  tone: "neutral" | "success" | "warning" | "danger";
} {
  switch (action) {
    case "ticket_created":
      return { icon: FilePlus, tone: "neutral" };
    case "ticket_replied":
      return { icon: MessageSquare, tone: "neutral" };
    case "internal_note_added":
      return { icon: Lock, tone: "warning" };
    case "assignee_changed":
      return { icon: UserCheck, tone: "neutral" };
    case "priority_changed":
      return { icon: ArrowUp, tone: "warning" };
    case "status_changed":
      return { icon: Activity, tone: "neutral" };
    case "ticket_resolved":
      return { icon: CircleCheckBig, tone: "success" };
    case "ticket_closed":
      return { icon: XOctagon, tone: "neutral" };
    case "ticket_reopened":
      return { icon: RotateCcw, tone: "warning" };
    case "sla_frt_breach":
    case "sla_ttr_breach":
    case "sla_frt_breach_reassigned":
    case "sla_ttr_breach_reassigned":
      return { icon: AlertTriangle, tone: "danger" };
    case "sla_frt_warning_75":
    case "sla_priority_escalated":
    case "sla_escalation_triggered":
      return { icon: AlertTriangle, tone: "warning" };
    case "sla_resolved_within_sla":
      return { icon: CircleCheckBig, tone: "success" };
    default:
      return { icon: Activity, tone: "neutral" };
  }
}

function formatAgo(
  iso: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return t("alertsPage.agoSeconds", { count: seconds });
  if (seconds < 3600)
    return t("alertsPage.agoMinutes", { count: Math.floor(seconds / 60) });
  return t("alertsPage.agoHours", { count: Math.floor(seconds / 3600) });
}

export default SupervisorAlertsPageContent;
