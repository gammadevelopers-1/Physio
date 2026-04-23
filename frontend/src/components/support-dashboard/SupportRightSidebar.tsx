"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  ClipboardList,
  MessageSquare,
  CheckCircle,
  Star,
  AlertTriangle,
  XCircle,
  Plus,
  BookOpen,
  Download,
  MessageCircle,
  Zap,
  ArrowRight,
} from "lucide-react";

const SupportRightSidebar = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const activityItems = [
    {
      id: "1",
      icon: ClipboardList,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
      textKey: "activity.ticketCreated",
      timeKey: "activity.time.2min",
    },
    {
      id: "2",
      icon: MessageSquare,
      iconBg: "bg-[#EDE9FE]",
      iconColor: "text-[#8B5CF6]",
      textKey: "activity.hanaReplied",
      timeKey: "activity.time.15min",
    },
    {
      id: "3",
      icon: CheckCircle,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#22C55E]",
      textKey: "activity.ticketResolved",
      timeKey: "activity.time.32min",
    },
    {
      id: "4",
      icon: Star,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D97706]",
      textKey: "activity.fiveStarRating",
      timeKey: "activity.time.1hour",
    },
  ];

  const alerts = [
    {
      id: "1",
      type: "error" as const,
      titleKey: "alerts.slaBreaches",
      descriptionKey: "alerts.slaBreachesDesc",
    },
    {
      id: "2",
      type: "warning" as const,
      titleKey: "alerts.unassignedTickets",
      descriptionKey: "alerts.unassignedTicketsDesc",
    },
    {
      id: "3",
      type: "warning" as const,
      titleKey: "alerts.highPriorityWaiting",
      descriptionKey: "alerts.highPriorityWaitingDesc",
    },
  ];

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
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
        <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-4">
          {t("csatSection.title")}
        </h3>

        <div className="flex items-center justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-[#DCFCE7] flex items-center justify-center">
            <span className="text-2xl font-bold text-[#16A34A]">94%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
            <p className="text-sm font-semibold text-[var(--color-text-secondary)]">156</p>
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {t("csatSection.responses")}
            </p>
          </div>
          <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
            <p className="text-sm font-semibold text-[#16A34A]">+42</p>
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {t("csatSection.nps")}
            </p>
          </div>
          <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
            <p className="text-sm font-semibold text-[var(--color-text-secondary)]">4.7</p>
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {t("csatSection.avgRating")}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-4 h-4 text-[#3B82F6]" />
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("activity.title")}
          </h3>
        </div>

        <div className="space-y-0">
          {activityItems.map((item) => {
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
                  <p className="text-[13px] text-[var(--color-text-secondary)]">
                    {t(item.textKey)}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    {t(item.timeKey)}
                  </p>
                </div>
              </div>
            );
          })}
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
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#EA580C]" />
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("alerts.title")}
          </h3>
        </div>

        <div className="space-y-2">
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
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[#3B82F6]" />
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
                className="flex items-center justify-center gap-1.5 p-2.5 bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[#EFF6FF] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
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
