"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  BookOpen,
  Zap,
  Users,
  Shield,
  Award,
  DollarSign,
} from "lucide-react";

interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  time: string;
  link?: string;
}

interface Activity {
  id: string;
  type: "user" | "admin" | "payment" | "course" | "certificate";
  user: string;
  action: string;
  time: string;
}

interface AlertsActivitySidebarProps {
  alerts: Alert[];
  activities: Activity[];
  /** Extras rendered below the Alerts + Activity stack (e.g. a
   * compact Security snapshot). Lets the dashboard compose what
   * lives in the right rail without this component owning every
   * possible sub-widget. */
  extras?: React.ReactNode;
}

const AlertsActivitySidebar = ({
  alerts,
  activities,
  extras,
}: AlertsActivitySidebarProps) => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <AlertCircle className="w-5 h-5 text-[#DC2626]" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-[#D97706]" />;
      case "info":
        return <Info className="w-5 h-5 text-[var(--color-primary)]" />;
      default:
        return <Bell className="w-5 h-5 text-[var(--color-text-secondary)]" />;
    }
  };

  const getAlertBgColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-[#FEE2E2] border-[#FCA5A5]";
      case "warning":
        return "bg-[#FEF3C7] border-[#FCD34D]";
      case "info":
        return "bg-[var(--color-border-subtle)] border-[#93C5FD]";
      default:
        return "bg-[var(--color-border-subtle)] border-[var(--color-border)]";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "user":
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center">
            <Users className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
        );
      case "admin":
        return (
          <div className="w-8 h-8 rounded-full bg-[#FEF3C7] flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#D97706]" />
          </div>
        );
      case "payment":
        return (
          <div className="w-8 h-8 rounded-full bg-[#DCFCE7] flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-[#16A34A]" />
          </div>
        );
      case "course":
        return (
          <div className="w-8 h-8 rounded-full bg-[#EDE9FE] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#7C3AED]" />
          </div>
        );
      case "certificate":
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--gold-gold-100)] flex items-center justify-center">
            <Award className="w-4 h-4 text-[var(--color-star)]" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </div>
        );
    }
  };

  return (
    <div className="w-full lg:w-[320px] lg:flex-shrink-0 space-y-4">
      {/* Alerts Section — caps at ~440px and scrolls internally so the
          rest of the sidebar stays visible even when there's a flood. */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--color-primary)]" />
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("alerts.title")}
            </h3>
            {alerts.length > 0 && (
              <span className="bg-[#EF4444] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                {alerts.length}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1 -mr-1">
          {alerts.length === 0 && (
            <p className="text-xs text-[var(--color-text-secondary)] py-4 text-center">
              {t("alerts.empty")}
            </p>
          )}
          {alerts.map((alert) => {
            const content = (
              <div className="flex items-start gap-3">
                {getAlertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    {alert.title}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {alert.description}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">{alert.time}</p>
                </div>
              </div>
            );
            return alert.link ? (
              <Link
                key={alert.id}
                href={`/${locale}${alert.link}`}
                className={`block p-3 rounded-lg border ${getAlertBgColor(alert.type)} hover:opacity-80 transition-opacity`}
              >
                {content}
              </Link>
            ) : (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${getAlertBgColor(alert.type)}`}
              >
                {content}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[var(--color-primary)]" />
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("activity.title")}
            </h3>
          </div>
        </div>

        <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1 -mr-1">
          {activities.length === 0 && (
            <p className="text-xs text-[var(--color-text-secondary)] py-4 text-center">
              {t("activity.empty")}
            </p>
          )}
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              {getActivityIcon(activity.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  <span className="font-medium">{activity.user}</span>{" "}
                  {activity.action}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href={`/${locale}/dashboard/admin/logs`}
          className="mt-4 text-sm text-[#0066FF] hover:underline flex items-center gap-1"
        >
          {t("activity.viewAll")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>

      {extras}
    </div>
  );
};

export default AlertsActivitySidebar;
