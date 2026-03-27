"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  ClipboardList,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  BookOpen,
  Download,
  MessageCircle,
  Zap,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { supportApi } from "@/lib/api";

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

  const [activityItems, setActivityItems] = useState<
    { id: string; icon: typeof ClipboardList; iconBg: string; iconColor: string; description: string; time: string }[]
  >([]);
  const [alerts, setAlerts] = useState<
    { id: string; type: "error" | "warning"; titleKey: string; descriptionKey: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

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
    return () => { cancelled = true; };
  }, []);

  const quickActions = [
    {
      id: "newTicket",
      icon: Plus,
      labelKey: "quickActions.newTicket",
    },
    {
      id: "knowledgeBase",
      icon: BookOpen,
      labelKey: "quickActions.knowledgeBase",
    },
    {
      id: "exportReport",
      icon: Download,
      labelKey: "quickActions.exportReport",
    },
    {
      id: "teamChat",
      icon: MessageCircle,
      labelKey: "quickActions.teamChat",
    },
  ];

  return (
    <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
      {/* CSAT Score */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
        <h3 className="text-[15px] font-semibold text-[#111827] mb-4">
          {t("csatSection.title")}
        </h3>

        <div className="flex items-center justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-[#DCFCE7] flex items-center justify-center">
            <span className="text-2xl font-bold text-[#16A34A]">94%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
            <p className="text-sm font-semibold text-[#111827]">156</p>
            <p className="text-[10px] text-[#6B7280]">
              {t("csatSection.responses")}
            </p>
          </div>
          <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
            <p className="text-sm font-semibold text-[#16A34A]">+42</p>
            <p className="text-[10px] text-[#6B7280]">
              {t("csatSection.nps")}
            </p>
          </div>
          <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
            <p className="text-sm font-semibold text-[#111827]">4.7</p>
            <p className="text-[10px] text-[#6B7280]">
              {t("csatSection.avgRating")}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-4 h-4 text-[#3B82F6]" />
          <h3 className="text-[15px] font-semibold text-[#111827]">
            {t("activity.title")}
          </h3>
        </div>

        <div className="space-y-0">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />
            </div>
          ) : activityItems.length === 0 ? (
            <p className="text-[13px] text-[#9CA3AF] text-center py-4">
              {t("activity.noRecent", { defaultMessage: "No recent activity" })}
            </p>
          ) : (
            activityItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 py-2.5 border-b border-[#F3F4F6] last:border-b-0"
                >
                  <div
                    className={`w-8 h-8 rounded-full ${item.iconBg} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#374151]">
                      {item.description}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      {item.time}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-[#F3F4F6] text-center">
          <Link
            href={`/${locale}/dashboard/support/activity`}
            className="text-[13px] font-medium text-[#3B82F6] hover:text-[#2563EB] hover:underline flex items-center justify-center gap-1"
          >
            {t("activity.viewAll")}
            <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#EA580C]" />
          <h3 className="text-[15px] font-semibold text-[#111827]">
            {t("alerts.title")}
          </h3>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-[#EA580C] animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-[13px] text-[#9CA3AF] text-center py-4">
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
                <p className="text-[12px] font-medium text-[#111827]">
                  {t(alert.titleKey)}
                </p>
                <p className="text-[11px] text-[#4B5563]">
                  {t(alert.descriptionKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[#3B82F6]" />
          <h3 className="text-[15px] font-semibold text-[#111827]">
            {t("quickActions.title")}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-[12px] font-medium text-[#374151] hover:bg-[#EFF6FF] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
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
