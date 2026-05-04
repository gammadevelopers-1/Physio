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
  UserPlus,
  BookOpen,
  BarChart3,
  HardDrive,
  ClipboardList,
  Settings,
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

interface GatewayBreakdown {
  name: string;
  percentage: number;
}

interface FinanceData {
  grossRevenue: number;
  netRevenue: number;
  gateways: GatewayBreakdown[];
  refundRate: number;
  chargebackRate: number;
}

interface AlertsActivitySidebarProps {
  alerts: Alert[];
  activities: Activity[];
  finance?: FinanceData;
}

const AlertsActivitySidebar = ({
  alerts,
  activities,
  finance,
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

  const quickActions = [
    {
      id: "addUser",
      label: t("quickActions.addUser"),
      icon: UserPlus,
      href: `/${locale}/dashboard/admin/users`,
    },
    {
      id: "newCourse",
      label: t("quickActions.newCourse"),
      icon: BookOpen,
      href: `/${locale}/dashboard/admin/courses`,
    },
    {
      id: "runBackup",
      label: t("quickActions.runBackup"),
      icon: HardDrive,
      href: `/${locale}/dashboard/admin/settings`,
    },
    {
      id: "generateReport",
      label: t("quickActions.generateReport"),
      icon: BarChart3,
      href: `/${locale}/dashboard/admin/reports`,
    },
    {
      id: "viewLogs",
      label: t("quickActions.viewLogs"),
      icon: ClipboardList,
      href: `/${locale}/dashboard/admin/logs`,
    },
    {
      id: "settings",
      label: t("quickActions.settings"),
      icon: Settings,
      href: `/${locale}/dashboard/admin/settings`,
    },
  ];

  return (
    <div className="w-full lg:w-[320px] lg:flex-shrink-0 space-y-4">
      {/* Alerts Section */}
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

        <div className="space-y-3">
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

        <div className="space-y-4">
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

      {/* Quick Actions Section */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("quickActions.title")}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.id}
                href={action.href}
                className="flex items-center gap-2 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] transition-colors"
              >
                <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Finance Summary Section */}
      {finance && (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[var(--color-primary)]" />
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t("finance.title")}
              </h3>
            </div>
            <Link
              href={`/${locale}/dashboard/admin/finance`}
              className="text-sm text-[#0066FF] hover:underline flex items-center gap-1"
            >
              {t("finance.viewReports")}
              <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
            </Link>
          </div>

          {/* Revenue Cards */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                {finance.grossRevenue >= 1000
                  ? `${(finance.grossRevenue / 1000).toFixed(0)}K`
                  : finance.grossRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("finance.gross")} ({t("finance.sar")})
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                {finance.netRevenue >= 1000
                  ? `${(finance.netRevenue / 1000).toFixed(0)}K`
                  : finance.netRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("finance.net")} ({t("finance.sar")})
              </p>
            </div>
          </div>

          {/* Gateway Breakdown */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase mb-2">
              {t("finance.byGateway")}
            </h4>
            <div className="space-y-1.5">
              {finance.gateways.map((gateway) => (
                <div
                  key={gateway.name}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-[var(--color-text-secondary)]">{gateway.name}</span>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {gateway.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Health Metrics */}
          <div className="pt-3 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {t("finance.refundRate")}
                </span>
                <span
                  className={`text-sm font-medium ${finance.refundRate <= 3 ? "text-[#16A34A]" : "text-[#D97706]"}`}
                >
                  {finance.refundRate}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {t("finance.chargebackRate")}
                </span>
                <span
                  className={`text-sm font-medium ${finance.chargebackRate <= 1 ? "text-[#16A34A]" : "text-[#DC2626]"}`}
                >
                  {finance.chargebackRate}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsActivitySidebar;
