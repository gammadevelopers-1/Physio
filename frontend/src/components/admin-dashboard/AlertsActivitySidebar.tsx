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
        return <Info className="w-5 h-5 text-[#3B82F6]" />;
      default:
        return <Bell className="w-5 h-5 text-[#6B7280]" />;
    }
  };

  const getAlertBgColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-[#FEE2E2] border-[#FCA5A5]";
      case "warning":
        return "bg-[#FEF3C7] border-[#FCD34D]";
      case "info":
        return "bg-[#DBEAFE] border-[#93C5FD]";
      default:
        return "bg-[#F3F4F6] border-[#E5E7EB]";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "user":
        return (
          <div className="w-8 h-8 rounded-full bg-[#DBEAFE] flex items-center justify-center">
            <Users className="w-4 h-4 text-[#3B82F6]" />
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
            <Award className="w-4 h-4 text-[var(--gold-gold-500)]" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#6B7280]" />
          </div>
        );
    }
  };

  const quickActions = [
    {
      id: "addUser",
      label: t("quickActions.addUser"),
      icon: UserPlus,
      href: `/${locale}/admin-dashboard/users`,
    },
    {
      id: "newCourse",
      label: t("quickActions.newCourse"),
      icon: BookOpen,
      href: `/${locale}/admin-dashboard/courses`,
    },
    {
      id: "runBackup",
      label: t("quickActions.runBackup"),
      icon: HardDrive,
      href: `/${locale}/admin-dashboard/settings`,
    },
    {
      id: "generateReport",
      label: t("quickActions.generateReport"),
      icon: BarChart3,
      href: `/${locale}/admin-dashboard/reports`,
    },
    {
      id: "viewLogs",
      label: t("quickActions.viewLogs"),
      icon: ClipboardList,
      href: `/${locale}/admin-dashboard/logs`,
    },
    {
      id: "settings",
      label: t("quickActions.settings"),
      icon: Settings,
      href: `/${locale}/admin-dashboard/settings`,
    },
  ];

  return (
    <div className="w-full lg:w-[320px] lg:flex-shrink-0 space-y-4">
      {/* Alerts Section */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#002D87]" />
            <h3 className="text-base font-semibold text-[#1F2937]">
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
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border ${getAlertBgColor(alert.type)}`}
            >
              <div className="flex items-start gap-3">
                {getAlertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1F2937]">
                    {alert.title}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {alert.description}
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-1">{alert.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#002D87]" />
            <h3 className="text-base font-semibold text-[#1F2937]">
              {t("activity.title")}
            </h3>
          </div>
        </div>

        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              {getActivityIcon(activity.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1F2937]">
                  <span className="font-medium">{activity.user}</span>{" "}
                  {activity.action}
                </p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href={`/${locale}/admin-dashboard/logs`}
          className="mt-4 text-sm text-[#0066FF] hover:underline flex items-center gap-1"
        >
          {t("activity.viewAll")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>

      {/* Quick Actions Section */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-[#002D87]" />
          <h3 className="text-base font-semibold text-[#1F2937]">
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
                className="flex items-center gap-2 p-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
              >
                <Icon className="w-4 h-4 text-[#6B7280]" />
                <span className="text-sm text-[#4B5563]">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Finance Summary Section */}
      {finance && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#002D87]" />
              <h3 className="text-base font-semibold text-[#1F2937]">
                {t("finance.title")}
              </h3>
            </div>
            <Link
              href={`/${locale}/admin-dashboard/finance`}
              className="text-sm text-[#0066FF] hover:underline flex items-center gap-1"
            >
              {t("finance.viewReports")}
              <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
            </Link>
          </div>

          {/* Revenue Cards */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#1F2937]">
                {finance.grossRevenue >= 1000
                  ? `${(finance.grossRevenue / 1000).toFixed(0)}K`
                  : finance.grossRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-[#6B7280]">
                {t("finance.gross")} ({t("finance.sar")})
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#1F2937]">
                {finance.netRevenue >= 1000
                  ? `${(finance.netRevenue / 1000).toFixed(0)}K`
                  : finance.netRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-[#6B7280]">
                {t("finance.net")} ({t("finance.sar")})
              </p>
            </div>
          </div>

          {/* Gateway Breakdown */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-[#6B7280] uppercase mb-2">
              {t("finance.byGateway")}
            </h4>
            <div className="space-y-1.5">
              {finance.gateways.map((gateway) => (
                <div
                  key={gateway.name}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-[#4B5563]">{gateway.name}</span>
                  <span className="text-sm font-medium text-[#1F2937]">
                    {gateway.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Health Metrics */}
          <div className="pt-3 border-t border-[#E5E7EB]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#4B5563]">
                  {t("finance.refundRate")}
                </span>
                <span
                  className={`text-sm font-medium ${finance.refundRate <= 3 ? "text-[#16A34A]" : "text-[#D97706]"}`}
                >
                  {finance.refundRate}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#4B5563]">
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
