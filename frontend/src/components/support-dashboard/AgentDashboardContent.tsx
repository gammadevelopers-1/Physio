"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import SupportDashboardSkeleton from "./SupportDashboardSkeleton";
import SupportActiveIncidentsBar from "./SupportActiveIncidentsBar";
import {
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Smile,
  ArrowRight,
  Zap,
  RefreshCw,
  BookOpen,
  ClipboardList,
} from "lucide-react";

interface MyTicketRow {
  id: string;
  referenceNumber?: string | null;
  subject: string;
  studentName: string;
  category: string;
  priority: "high" | "medium" | "low";
  status: string;
  ttrRemainingMinutes: number | null;
  slaBreachedTtr: boolean;
  slaBreachedFrt: boolean;
  slaPaused: boolean;
  slaPausedReason: "on_hold" | "off_hours" | null;
  firstResponseAt: string | null;
  createdAt: string;
}

interface MyPerf {
  totalTickets: number;
  resolvedCount: number;
  avgFrtMinutes: number | null;
  csatAvgScore: number | null;
  csatResponses: number;
  frtBreaches: number;
  ttrBreaches: number;
}

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const abs = Math.abs(minutes);
  if (abs < 60) return `${Math.round(abs)}m`;
  const hours = abs / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

const AgentDashboardContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const isRTL = locale === "ar";

  const basePath = `/${locale}/dashboard/support/agent`;

  const [myTickets, setMyTickets] = useState<MyTicketRow[]>([]);
  const [perf, setPerf] = useState<MyPerf | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const profile = useSupportProfile();

  const fetchAll = useCallback(
    async (silent = false) => {
      if (!user?.id) return;
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const [ticketsRes, perfRes] = await Promise.all([
          supportApi.getTickets({ assigneeId: user.id, limit: 50 }),
          supportApi.getMyPerformance().catch(() => null),
        ]);
        const mapped: MyTicketRow[] = (ticketsRes.tickets || []).map((x: any) => ({
          id: x.id,
          subject: x.subject,
          studentName:
            [x.studentFirstName, x.studentLastName].filter(Boolean).join(" ") || "—",
          category: x.category,
          priority: x.priority,
          status: x.status,
          ttrRemainingMinutes:
            typeof x.ttrRemainingMinutes === "number" ? x.ttrRemainingMinutes : null,
          slaBreachedTtr: Boolean(x.slaBreachedTtr),
          slaBreachedFrt: Boolean(x.slaBreachedFrt),
          slaPaused: Boolean(x.slaPaused),
          slaPausedReason:
            x.slaPausedReason === "on_hold" || x.slaPausedReason === "off_hours"
              ? x.slaPausedReason
              : null,
          firstResponseAt: x.firstResponseAt ?? null,
          createdAt: x.createdAt,
        }));
        setMyTickets(mapped);
        setPerf(perfRes);
      } catch {
        setMyTickets([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchAll(true);
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Open = active work; excludes resolved/closed
  const openTickets = useMemo(
    () =>
      myTickets.filter(
        (x) => x.status === "new" || x.status === "in_progress" || x.status === "on_hold",
      ),
    [myTickets],
  );

  const dueTodayCount = useMemo(
    () =>
      openTickets.filter(
        (x) =>
          x.ttrRemainingMinutes != null &&
          x.ttrRemainingMinutes >= 0 &&
          x.ttrRemainingMinutes <= 8 * 60,
      ).length,
    [openTickets],
  );

  const overdueCount = useMemo(
    () => openTickets.filter((x) => x.slaBreachedTtr || x.slaBreachedFrt).length,
    [openTickets],
  );

  const awaitingFirstReply = useMemo(
    () =>
      openTickets.filter((x) => !x.firstResponseAt && x.status === "new").length,
    [openTickets],
  );

  // "Next up" — the most urgent ticket to work on right now.
  // Breached first (most overdue), then by smallest SLA remaining, then by
  // priority + age. This is what a focused agent should pick up first.
  const nextUpTicket = useMemo(() => {
    const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = [...openTickets].sort((a, b) => {
      if (a.slaBreachedTtr !== b.slaBreachedTtr) return a.slaBreachedTtr ? -1 : 1;
      const am = a.ttrRemainingMinutes ?? Number.POSITIVE_INFINITY;
      const bm = b.ttrRemainingMinutes ?? Number.POSITIVE_INFINITY;
      if (am !== bm) return am - bm;
      const pd = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (pd !== 0) return pd;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    return sorted[0] || null;
  }, [openTickets]);

  const stats = [
    {
      key: "assigned",
      label: t("myTicketsPage.stats.assigned"),
      value: openTickets.length,
      icon: Inbox,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      key: "dueToday",
      label: t("myTicketsPage.stats.dueToday"),
      value: dueTodayCount,
      icon: Clock,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#F97316]",
    },
    {
      key: "overdue",
      label: t("myTicketsPage.stats.overdue"),
      value: overdueCount,
      icon: AlertTriangle,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#EF4444]",
    },
    {
      key: "csat",
      label: t("agentDashboard.myCsat"),
      value:
        perf?.csatAvgScore != null
          ? `${perf.csatAvgScore.toFixed(1)}/5`
          : "—",
      sub:
        perf?.csatResponses
          ? t("agentDashboard.csatResponses", { count: perf.csatResponses })
          : t("agentDashboard.noCsatYet"),
      icon: Smile,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
  ];

  const priorityStyles: Record<string, string> = {
    high: "bg-[#FEE2E2] text-[#DC2626]",
    medium: "bg-[#FFEDD5] text-[#C2410C]",
    low: "bg-[#DCFCE7] text-[#15803D]",
  };

  const statusStyles: Record<string, string> = {
    new: "bg-[#DBEAFE] text-[#1D4ED8]",
    in_progress: "bg-[#FEF9C3] text-[#A16207]",
    on_hold: "bg-[#FFEDD5] text-[#C2410C]",
    resolved: "bg-[#DCFCE7] text-[#15803D]",
    closed: "bg-[#F3F4F6] text-[#4B5563]",
  };

  function slaBadge(ticket: MyTicketRow) {
    if (ticket.status === "resolved" || ticket.status === "closed") return null;
    const m = ticket.ttrRemainingMinutes;
    if (m == null) return null;
    // Paused (off-hours or on-hold) — surface the SAME truth as the
    // per-ticket detail view. Without this, the badge looked identical
    // at 3 AM and 11 AM, making the timer feel like it was ticking in
    // the background.
    if (ticket.slaPaused && m >= 0)
      return {
        text: t("agentDashboard.sla.paused", { value: formatMinutes(m) }),
        cls: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
      };
    if (m < 0)
      return {
        text: t("agentDashboard.sla.overBy", { value: formatMinutes(m) }),
        cls: "bg-[#FEE2E2] text-[#DC2626]",
      };
    if (m < 60)
      return {
        text: t("agentDashboard.sla.left", { value: formatMinutes(m) }),
        cls: "bg-[#FEE2E2] text-[#DC2626]",
      };
    if (m < 180)
      return {
        text: t("agentDashboard.sla.left", { value: formatMinutes(m) }),
        cls: "bg-[#FFEDD5] text-[#C2410C]",
      };
    return {
      text: t("agentDashboard.sla.left", { value: formatMinutes(m) }),
      cls: "bg-[#DCFCE7] text-[#15803D]",
    };
  }

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole="agent" />
            </div>
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("agentDashboard.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("agentDashboard.welcome", {
                      name:
                        profile.name.split(" ")[0] || t("agentDashboard.fallbackName"),
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchAll(true)}
                  disabled={isRefreshing || isLoading}
                  className="flex items-center gap-1.5 px-3 h-9 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                  aria-label={t("myTicketsPage.refresh")}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{t("myTicketsPage.refresh")}</span>
                </button>
              </div>

              {/* Active incidents strip — visible to all support
                  staff regardless of audience. Empty array → component
                  renders null, no chrome cost. */}
              <SupportActiveIncidentsBar />

              {/* Initial-load skeleton — only shown on the very first
                  fetch (silent refreshes use isRefreshing and keep the
                  existing data on screen). Replaces stat cards, Next Up,
                  Quick Actions, and the assigned tickets table so the
                  agent never sees zero counts during the first paint. */}
              {isLoading ? (
                <SupportDashboardSkeleton />
              ) : (
              <>

              {/* Stats — 4 themed cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.key}
                      className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 sm:p-5 flex items-start gap-3"
                    >
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.iconBg}`}
                      >
                        <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                          {stat.label}
                        </p>
                        <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                          {stat.value}
                        </p>
                        {"sub" in stat && stat.sub && (
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                            {stat.sub}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Two-column: Focus card + Quick actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Next Up — what to work on now */}
                <div className="lg:col-span-2 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-[var(--color-primary)]" />
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t("agentDashboard.nextUp.title")}
                    </h3>
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
                    </div>
                  ) : !nextUpTicket ? (
                    <div className="text-center py-6 text-[var(--color-text-secondary)]">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#22C55E]" />
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {t("agentDashboard.nextUp.cleared")}
                      </p>
                      <p className="text-xs mt-1">
                        {t("agentDashboard.nextUp.clearedHint")}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`${basePath}/tickets/${nextUpTicket.id}`)
                      }
                      className="w-full text-start group block"
                    >
                      <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-[11px] text-[var(--color-primary)]">
                              {nextUpTicket.referenceNumber || `#${nextUpTicket.id.substring(0, 8)}`}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityStyles[nextUpTicket.priority]}`}
                            >
                              {t(`agentDashboard.priorities.${nextUpTicket.priority}`)}
                            </span>
                            {(() => {
                              const sla = slaBadge(nextUpTicket);
                              return sla ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${sla.cls}`}
                                >
                                  <Clock className="w-3 h-3" />
                                  {sla.text}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <p className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2 mb-1">
                            {nextUpTicket.subject}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {nextUpTicket.studentName}
                          </p>
                        </div>
                        <ArrowRight
                          className={`w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 mt-1 group-hover:text-[var(--color-primary)] transition-colors ${isRTL ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>
                  )}
                  {awaitingFirstReply > 0 && (
                    <p className="mt-3 text-[11px] text-[var(--color-text-secondary)] inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-[#F97316]" />
                      {t("agentDashboard.awaitingFirstReply", { count: awaitingFirstReply })}
                    </p>
                  )}
                </div>

                {/* My Performance — bite-sized perf card */}
                <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                    {t("agentDashboard.myPerformance")}
                  </h3>
                  {perf ? (
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">
                          {t("agentDashboard.perf.resolved")}
                        </span>
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {perf.resolvedCount} / {perf.totalTickets}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">
                          {t("agentDashboard.perf.avgFrt")}
                        </span>
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {formatMinutes(perf.avgFrtMinutes)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">
                          {t("agentDashboard.perf.breaches")}
                        </span>
                        <span
                          className={`font-semibold ${
                            perf.frtBreaches + perf.ttrBreaches > 0
                              ? "text-[#DC2626]"
                              : "text-[#15803D]"
                          }`}
                        >
                          {perf.frtBreaches + perf.ttrBreaches}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--color-text-secondary)] py-4 text-center">
                      {t("agentDashboard.perf.noData")}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`${basePath}/kb`)}
                    className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-[var(--color-text-primary)] bg-[var(--color-border-subtle)] hover:bg-[var(--color-border)] rounded-lg font-medium transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    {t("agentDashboard.openKb")}
                  </button>
                </div>
              </div>

              {/* Tickets table */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-[var(--color-primary)]" />
                    <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                      {t("agentDashboard.assignedTickets")}
                    </h2>
                    <span className="bg-[var(--color-primary)] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                      {openTickets.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`${basePath}/my-tickets`)}
                    className="text-sm text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                  >
                    {t("agentDashboard.viewAll")}
                    <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                  </div>
                ) : openTickets.length === 0 ? (
                  <div className="text-center py-12 text-[var(--color-text-secondary)]">
                    <Inbox className="w-10 h-10 mx-auto mb-3 text-[var(--color-icon)]" />
                    <p className="text-sm">{t("agentDashboard.noTickets")}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                          <th className="px-4 py-2.5 text-start text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                            {t("agentDashboard.columns.id")}
                          </th>
                          <th className="px-4 py-2.5 text-start text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                            {t("agentDashboard.columns.subject")}
                          </th>
                          <th className="px-4 py-2.5 text-start text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden md:table-cell">
                            {t("agentDashboard.columns.student")}
                          </th>
                          <th className="px-4 py-2.5 text-start text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                            {t("agentDashboard.columns.priority")}
                          </th>
                          <th className="px-4 py-2.5 text-start text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                            {t("agentDashboard.columns.sla")}
                          </th>
                          <th className="px-4 py-2.5 text-start text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                            {t("agentDashboard.columns.status")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {openTickets.slice(0, 10).map((ticket) => {
                          const sla = slaBadge(ticket);
                          return (
                            <tr
                              key={ticket.id}
                              className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-border-subtle)] cursor-pointer transition-colors"
                              onClick={() =>
                                router.push(`${basePath}/tickets/${ticket.id}`)
                              }
                            >
                              <td className="px-4 py-3 text-[13px] font-mono text-[var(--color-primary)] font-medium">
                                {ticket.referenceNumber || `#${ticket.id?.substring(0, 8)}`}
                              </td>
                              <td className="px-4 py-3 text-[13px] text-[var(--color-text-primary)] max-w-[260px] truncate">
                                {ticket.subject}
                              </td>
                              <td className="px-4 py-3 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">
                                {ticket.studentName}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                    priorityStyles[ticket.priority] || ""
                                  }`}
                                >
                                  {t(`agentDashboard.priorities.${ticket.priority}`)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {sla ? (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${sla.cls}`}
                                  >
                                    <Clock className="w-3 h-3" />
                                    {sla.text}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                    statusStyles[ticket.status] || ""
                                  }`}
                                >
                                  {ticket.status
                                    ? t(`activeIncidents.ticketStatus.${ticket.status}`)
                                    : ""}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AgentDashboardContent;
