"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  ClipboardList,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Loader2,
  RotateCcw,
  UserPlus,
  Clock,
  Send,
  Reply,
} from "lucide-react";
import { supportApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const DISMISSED_ALERTS_KEY = "support.dismissedAlerts.v1";

type AlertCategory = "breached" | "unassigned" | "highPriority";

interface AlertRow {
  /** Stable per-ticket-per-category id for dismissal tracking */
  key: string;
  category: AlertCategory;
  ticketId: string;
  /** Human-readable ref like "T-000123" — falls back to truncated UUID. */
  referenceNumber: string | null;
  subject: string;
}

interface KpiAlerts {
  breached: { id: string; referenceNumber?: string | null; subject: string; priority: string }[];
  unassigned: { id: string; referenceNumber?: string | null; subject: string; priority: string }[];
  highPriority: { id: string; referenceNumber?: string | null; subject: string; priority: string }[];
}

interface ActivityEvent {
  id: string;
  ticketId: string;
  ticketReferenceNumber?: string | null;
  type: "created" | "resolved" | "closed" | "staff_reply" | "student_reply";
  subject: string;
  at: string;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function getActivityStyle(type: ActivityEvent["type"]) {
  switch (type) {
    case "resolved":
    case "closed":
      return { icon: CheckCircle, iconBg: "bg-[#DCFCE7]", iconColor: "text-[#22C55E]" };
    case "staff_reply":
      return { icon: Send, iconBg: "bg-[#EDE9FE]", iconColor: "text-[#8B5CF6]" };
    case "student_reply":
      return { icon: Reply, iconBg: "bg-[#FEF9C3]", iconColor: "text-[#CA8A04]" };
    case "created":
    default:
      return { icon: ClipboardList, iconBg: "bg-[#EFF6FF]", iconColor: "text-[#3B82F6]" };
  }
}

function activityLabel(
  type: ActivityEvent["type"],
  t: ReturnType<typeof useTranslations>,
): string {
  return t(`activity.events.${type}`);
}

function alertCategoryStyle(category: AlertCategory): {
  icon: typeof AlertTriangle;
  iconColor: string;
  bg: string;
  borderColor: string;
} {
  switch (category) {
    case "breached":
      return {
        icon: XCircle,
        iconColor: "text-[#DC2626]",
        bg: "bg-[#FEE2E2]",
        borderColor: "#DC2626",
      };
    case "highPriority":
      return {
        icon: AlertTriangle,
        iconColor: "text-[#EA580C]",
        bg: "bg-[#FFEDD5]",
        borderColor: "#EA580C",
      };
    case "unassigned":
    default:
      return {
        icon: UserPlus,
        iconColor: "text-[#C2410C]",
        bg: "bg-[#FFEDD5]",
        borderColor: "#C2410C",
      };
  }
}

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_ALERTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DISMISSED_ALERTS_KEY,
      JSON.stringify(Array.from(set)),
    );
  } catch {
    // localStorage full / disabled — silently degrade
  }
}

const SupportRightSidebar = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();
  const isSupervisor = user?.supportSubRole === "supervisor";
  const basePath = isSupervisor
    ? `/${locale}/dashboard/support/supervisor`
    : `/${locale}/dashboard/support/agent`;

  const [activityItems, setActivityItems] = useState<ActivityEvent[]>([]);
  const [kpiAlerts, setKpiAlerts] = useState<KpiAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());

  const [csatStats, setCsatStats] = useState<{ avgScore: number; responses: number }>(
    { avgScore: 0, responses: 0 },
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [activityRes, kpisRes] = await Promise.all([
          supportApi.getActivity(15).catch(() => [] as ActivityEvent[]),
          supportApi.getKPIs(),
        ]);
        if (cancelled) return;

        setActivityItems(activityRes || []);
        setCsatStats({
          avgScore: Number(kpisRes?.csatAvgScore) || 0,
          responses: Number(kpisRes?.csatResponses) || 0,
        });
        setKpiAlerts(
          (kpisRes?.alerts as KpiAlerts | undefined) ?? {
            breached: [],
            unassigned: [],
            highPriority: [],
          },
        );
      } catch (err) {
        console.error("Failed to fetch sidebar data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchData();
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Flatten + dedupe + filter the dismissed set. A breached ticket that
  // is also high-priority should appear once in the more-severe bucket.
  const allAlerts: AlertRow[] = useMemo(() => {
    if (!kpiAlerts) return [];
    const seen = new Set<string>();
    const rows: AlertRow[] = [];
    const push = (category: AlertCategory, list: KpiAlerts[AlertCategory]) => {
      for (const t of list) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        rows.push({
          key: `${category}:${t.id}`,
          category,
          ticketId: t.id,
          referenceNumber: t.referenceNumber ?? null,
          subject: t.subject,
        });
      }
    };
    push("breached", kpiAlerts.breached);
    push("highPriority", kpiAlerts.highPriority);
    push("unassigned", kpiAlerts.unassigned);
    return rows;
  }, [kpiAlerts]);

  const visibleAlerts = useMemo(
    () => allAlerts.filter((a) => !dismissed.has(a.key)),
    [allAlerts, dismissed],
  );

  function dismissOne(key: string) {
    const next = new Set(dismissed);
    next.add(key);
    setDismissed(next);
    saveDismissed(next);
  }

  function dismissAll() {
    const next = new Set(dismissed);
    for (const a of visibleAlerts) next.add(a.key);
    setDismissed(next);
    saveDismissed(next);
  }

  function resetDismissed() {
    const next = new Set<string>();
    setDismissed(next);
    saveDismissed(next);
  }

  return (
    <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
      {/* CSAT Score */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
        <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-4">
          {t("csatSection.title")}
        </h3>

        <div className="flex items-center justify-center mb-4">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center ${
              csatStats.avgScore >= 4
                ? "bg-[#DCFCE7]"
                : csatStats.avgScore >= 3
                  ? "bg-[#FEF9C3]"
                  : csatStats.avgScore > 0
                    ? "bg-[#FEE2E2]"
                    : "bg-[var(--color-border-subtle)]"
            }`}
          >
            <span
              className={`text-2xl font-bold ${
                csatStats.avgScore >= 4
                  ? "text-[#16A34A]"
                  : csatStats.avgScore >= 3
                    ? "text-[#CA8A04]"
                    : csatStats.avgScore > 0
                      ? "text-[#DC2626]"
                      : "text-[var(--color-text-secondary)]"
              }`}
            >
              {csatStats.avgScore > 0 ? csatStats.avgScore.toFixed(1) : "—"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {csatStats.responses}
            </p>
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {t("csatSection.responses")}
            </p>
          </div>
          <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {csatStats.avgScore > 0 ? `${csatStats.avgScore.toFixed(1)}/5` : "—"}
            </p>
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {t("csatSection.avgRating")}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Feed — real events from /tickets/activity */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("activity.title")}
          </h3>
        </div>

        <div className="max-h-[280px] overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />
            </div>
          ) : activityItems.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-secondary)] text-center py-4">
              {t("activity.noRecent")}
            </p>
          ) : (
            activityItems.map((item) => {
              const style = getActivityStyle(item.type);
              const Icon = style.icon;
              return (
                <Link
                  key={item.id}
                  href={`${basePath}/tickets/${item.ticketId}`}
                  className="flex items-start gap-2.5 py-2.5 border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-border-subtle)] transition-colors rounded -mx-1 px-1"
                >
                  <div
                    className={`w-8 h-8 rounded-full ${style.iconBg} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${style.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">
                      {activityLabel(item.type, t)}
                    </p>
                    <p className="text-[12px] text-[var(--color-text-secondary)] truncate">
                      {item.subject}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      {formatRelativeTime(item.at)}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] text-center">
          <Link
            href={`${basePath}/tickets`}
            className="text-[13px] font-medium text-[var(--color-primary)] hover:underline flex items-center justify-center gap-1"
          >
            {t("activity.viewAll")}
            <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
        </div>
      </div>

      {/* Alerts — real ticket-backed, scrollable, dismissable */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#EA580C]" />
            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
              {t("alerts.title")}
            </h3>
            {visibleAlerts.length > 0 && (
              <span className="text-[11px] font-semibold bg-[#FEE2E2] text-[#DC2626] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {visibleAlerts.length}
              </span>
            )}
          </div>
          {visibleAlerts.length > 0 && (
            <button
              type="button"
              onClick={dismissAll}
              className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] font-medium transition-colors"
              title={t("alerts.markAllRead")}
            >
              {t("alerts.markAllRead")}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-[#EA580C] animate-spin" />
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle className="w-7 h-7 mx-auto text-[#22C55E] mb-2" />
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {t("alerts.noAlerts")}
            </p>
            {dismissed.size > 0 && (
              <button
                type="button"
                onClick={resetDismissed}
                className="mt-2 text-[11px] text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                {t("alerts.restoreDismissed", { count: dismissed.size })}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-[280px] overflow-y-auto -mx-1 px-1">
              {visibleAlerts.slice(0, 20).map((alert) => {
                const style = alertCategoryStyle(alert.category);
                const AlertIcon = style.icon;
                return (
                  <div
                    key={alert.key}
                    className={`flex items-start gap-2 p-2.5 rounded-lg ${style.bg}`}
                    style={{
                      borderLeftWidth: "3px",
                      borderLeftColor: style.borderColor,
                    }}
                  >
                    <AlertIcon className={`w-4 h-4 ${style.iconColor} flex-shrink-0 mt-0.5`} />
                    <Link
                      href={`${basePath}/tickets/${alert.ticketId}`}
                      className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                    >
                      <p className="text-[11px] font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
                        {t(`alerts.category.${alert.category}`)}
                      </p>
                      <p className="text-[12px] text-[var(--color-text-primary)] line-clamp-1 font-medium">
                        {alert.subject}
                      </p>
                      <p className="text-[10px] font-mono text-[var(--color-text-secondary)] mt-0.5">
                        {alert.referenceNumber || `#${alert.ticketId.substring(0, 8)}`}
                      </p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => dismissOne(alert.key)}
                      className="p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex-shrink-0"
                      aria-label={t("alerts.dismiss")}
                      title={t("alerts.dismiss")}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {visibleAlerts.length > 20 && (
                <p className="text-[11px] text-center text-[var(--color-text-secondary)] py-1">
                  {t("alerts.moreCount", { count: visibleAlerts.length - 20 })}
                </p>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] text-center">
              <Link
                href={`${basePath}/alerts`}
                className="text-[13px] font-medium text-[var(--color-primary)] hover:underline inline-flex items-center justify-center gap-1"
              >
                {t("alerts.viewAll")}
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupportRightSidebar;
