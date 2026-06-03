"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardList,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  BookOpen,
  Download,
  Users,
  Zap,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { supportApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

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

function getActivityStyle(status: string) {
  switch (status) {
    case "resolved":
    case "closed":
      return { icon: CheckCircle, iconBg: "bg-[#DCFCE7]", iconColor: "text-[#22C55E]" };
    case "in_progress":
      return { icon: MessageSquare, iconBg: "bg-[#EDE9FE]", iconColor: "text-[#8B5CF6]" };
    case "open":
    default:
      return { icon: ClipboardList, iconBg: "bg-[#EFF6FF]", iconColor: "text-[#3B82F6]" };
  }
}

const SupportRightSidebar = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const { user } = useAuth();
  const isSupervisor = user?.supportSubRole === "supervisor";
  const basePath = isSupervisor
    ? `/${locale}/dashboard/support/supervisor`
    : `/${locale}/dashboard/support/agent`;
  const [isExporting, setIsExporting] = useState(false);

  const [activityItems, setActivityItems] = useState<
    { id: string; icon: typeof ClipboardList; iconBg: string; iconColor: string; description: string; time: string }[]
  >([]);
  const [alerts, setAlerts] = useState<
    { id: string; type: "error" | "warning"; titleKey: string; descriptionKey: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // CSAT/NPS summary state sourced from the extended getKPIs() response.
  const [csatStats, setCsatStats] = useState<{
    avgScore: number;
    responses: number;
    npsScore: number;
    npsResponses: number;
  }>({ avgScore: 0, responses: 0, npsScore: 0, npsResponses: 0 });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [ticketsRes, kpisRes] = await Promise.all([
          supportApi.getTickets({ limit: 5 }),
          supportApi.getKPIs(),
        ]);

        if (cancelled) return;

        // Map tickets to activity items
        const tickets = ticketsRes?.tickets ?? [];
        const mapped = tickets.map((ticket: any) => {
          const style = getActivityStyle(ticket.status);
          return {
            id: ticket.id,
            icon: style.icon,
            iconBg: style.iconBg,
            iconColor: style.iconColor,
            description: ticket.subject,
            time: formatRelativeTime(ticket.createdAt),
          };
        });
        setActivityItems(mapped);

        // CSAT + NPS summary (already computed inside getKPIs)
        setCsatStats({
          avgScore: Number(kpisRes?.csatAvgScore) || 0,
          responses: Number(kpisRes?.csatResponses) || 0,
          npsScore: Number(kpisRes?.npsScore) || 0,
          npsResponses: Number(kpisRes?.npsResponses) || 0,
        });

        // Derive alerts from KPIs
        const derivedAlerts: typeof alerts = [];
        if (kpisRes?.slaBreaches > 0) {
          derivedAlerts.push({
            id: "sla",
            type: "error",
            titleKey: "alerts.slaBreaches",
            descriptionKey: "alerts.slaBreachesDesc",
          });
        }
        const unassigned = kpisRes?.statusBreakdown?.["open"] ?? 0;
        if (unassigned > 0) {
          derivedAlerts.push({
            id: "unassigned",
            type: "warning",
            titleKey: "alerts.unassignedTickets",
            descriptionKey: "alerts.unassignedTicketsDesc",
          });
        }
        if (kpisRes?.highPriorityOpen > 0) {
          derivedAlerts.push({
            id: "highPriority",
            type: "warning",
            titleKey: "alerts.highPriorityWaiting",
            descriptionKey: "alerts.highPriorityWaitingDesc",
          });
        }
        setAlerts(derivedAlerts);
      } catch (err) {
        console.error("Failed to fetch sidebar data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    // Auto-refresh every 60s while visible
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchData();
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleExportReport() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await supportApi.exportReport("volume");
      // Backend returns { csv, filename } — turn it into a download
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || `support-volume-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch {
      toast.error("Failed to export report");
    } finally {
      setIsExporting(false);
    }
  }

  const quickActions: {
    id: string;
    icon: typeof Plus;
    labelKey: string;
    onClick: () => void;
    disabled?: boolean;
  }[] = [
    {
      id: "newTicket",
      icon: Plus,
      labelKey: "quickActions.newTicket",
      // Supervisors/agents create tickets via the All Tickets board ("New" button)
      onClick: () => router.push(`${basePath}/tickets?new=1`),
    },
    {
      id: "knowledgeBase",
      icon: BookOpen,
      labelKey: "quickActions.knowledgeBase",
      onClick: () => router.push(`${basePath}/kb`),
    },
    {
      id: "exportReport",
      icon: Download,
      labelKey: "quickActions.exportReport",
      onClick: handleExportReport,
      disabled: isExporting,
    },
    {
      id: "teamChat",
      // Team Chat is not implemented yet; button routes to the Team page
      // (where supervisors can see the agent roster). Relabel by the
      // existing i18n key and swap the icon to Users for clarity.
      icon: Users,
      labelKey: "quickActions.teamChat",
      onClick: () => router.push(`${basePath}/team`),
    },
  ];

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
              {csatStats.avgScore > 0
                ? csatStats.avgScore.toFixed(1)
                : "—"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
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
              {csatStats.npsResponses > 0 ? csatStats.npsScore : "—"}
            </p>
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {t("csatSection.nps")}
            </p>
          </div>
          <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {csatStats.avgScore > 0
                ? `${csatStats.avgScore.toFixed(1)}/5`
                : "—"}
            </p>
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {t("csatSection.avgRating")}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("activity.title")}
          </h3>
        </div>

        <div className="space-y-0">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />
            </div>
          ) : activityItems.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-secondary)] text-center py-4">
              {t("activity.noRecent", { defaultMessage: "No recent activity" })}
            </p>
          ) : (
            activityItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 py-2.5 border-b border-[var(--color-border-subtle)] last:border-b-0"
                >
                  <div
                    className={`w-8 h-8 rounded-full ${item.iconBg} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[var(--color-text-secondary)]">
                      {item.description}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      {item.time}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] text-center">
          <Link
            href={`${basePath}/tickets`}
            className="text-[13px] font-medium text-[#3B82F6] hover:text-[#2563EB] hover:underline flex items-center justify-center gap-1"
          >
            {t("activity.viewAll")}
            <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#EA580C]" />
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("alerts.title")}
          </h3>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-[#EA580C] animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-secondary)] text-center py-4">
              {t("alerts.noAlerts", { defaultMessage: "No active alerts" })}
            </p>
          ) : null}
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg ${
                alert.type === "error"
                  ? "bg-[#FEE2E2]"
                  : "bg-[#FFEDD5]"
              }`}
              style={{
                borderLeftWidth: "3px",
                borderLeftColor:
                  alert.type === "error" ? "#DC2626" : "#EA580C",
              }}
            >
              {alert.type === "error" ? (
                <XCircle className="w-4 h-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#EA580C] flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                  {t(alert.titleKey)}
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {t(alert.descriptionKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("quickActions.title")}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[#EFF6FF] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action.id === "exportReport" && isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                {t(action.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SupportRightSidebar;
