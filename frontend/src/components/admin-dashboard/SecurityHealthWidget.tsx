"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Shield,
  ArrowRight,
  Lock,
  Ban,
  Users,
  KeyRound,
  Zap,
  AlertTriangle,
  HardDrive,
  Database,
} from "lucide-react";

interface SecurityMetrics {
  failedLogins: number;
  ipsBlocked: number;
  activeSessions: number;
  twoFaAdoption: number;
}

interface SystemMetrics {
  apiLatency: number;
  apiLatencyStatus: "healthy" | "warning" | "critical";
  errorRate: number;
  errorRateStatus: "healthy" | "warning" | "critical";
  lastBackup: string;
  dbHealth: "good" | "warning" | "critical";
}

interface SecurityHealthWidgetProps {
  security: SecurityMetrics;
  system: SystemMetrics;
}

const SecurityHealthWidget = ({
  security,
  system,
}: SecurityHealthWidgetProps) => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "good":
        return "bg-[var(--functional-green-600)]";
      case "warning":
        return "bg-[var(--functional-amber-500)]";
      case "critical":
        return "bg-[var(--functional-red-600)]";
      default:
        return "bg-[#9CA3AF]";
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "good":
        return "text-[var(--functional-green-600)]";
      case "warning":
        return "text-[var(--functional-amber-500)]";
      case "critical":
        return "text-[var(--functional-red-600)]";
      default:
        return "text-[#9CA3AF]";
    }
  };

  const securityItems = [
    {
      id: "failedLogins",
      label: t("securityHealth.failedLogins"),
      value: security.failedLogins,
      icon: Lock,
      status: security.failedLogins > 20 ? "warning" : "healthy",
    },
    {
      id: "ipsBlocked",
      label: t("securityHealth.ipsBlocked"),
      value: security.ipsBlocked,
      icon: Ban,
      status: "healthy",
    },
    {
      id: "activeSessions",
      label: t("securityHealth.activeSessions"),
      value: security.activeSessions,
      icon: Users,
      status: "healthy",
    },
    {
      id: "twoFaAdoption",
      label: t("securityHealth.twoFaAdoption"),
      value: `${security.twoFaAdoption}%`,
      icon: KeyRound,
      status: security.twoFaAdoption >= 70 ? "healthy" : "warning",
    },
  ];

  const systemItems = [
    {
      id: "apiLatency",
      label: t("securityHealth.apiLatency"),
      value: `${system.apiLatency}ms`,
      icon: Zap,
      status: system.apiLatencyStatus,
    },
    {
      id: "errorRate",
      label: t("securityHealth.errorRate"),
      value: `${system.errorRate}%`,
      icon: AlertTriangle,
      status: system.errorRateStatus,
    },
    {
      id: "lastBackup",
      label: t("securityHealth.lastBackup"),
      value: system.lastBackup,
      icon: HardDrive,
      status: "healthy",
    },
    {
      id: "dbHealth",
      label: t("securityHealth.dbHealth"),
      value: t(`securityHealth.${system.dbHealth}`),
      icon: Database,
      status: system.dbHealth,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#002D87]" />
          <h3 className="text-lg font-semibold text-[#1F2937]">
            {t("securityHealth.title")}
          </h3>
        </div>
        <Link
          href={`/${locale}/admin-dashboard/logs`}
          className="text-sm text-[#0066FF] hover:underline flex items-center gap-1"
        >
          {t("securityHealth.viewLogs")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>

      {/* Two Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Security Column */}
        <div>
          <h4 className="text-sm font-semibold text-[#6B7280] uppercase mb-3">
            {t("securityHealth.security")}
          </h4>
          <div className="space-y-3">
            {securityItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-sm text-[#4B5563]">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`}
                    />
                    <span className="text-sm font-medium text-[#1F2937]">
                      {item.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Column */}
        <div>
          <h4 className="text-sm font-semibold text-[#6B7280] uppercase mb-3">
            {t("securityHealth.system")}
          </h4>
          <div className="space-y-3">
            {systemItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-sm text-[#4B5563]">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`}
                    />
                    <span
                      className={`text-sm font-medium ${getStatusTextColor(item.status)}`}
                    >
                      {item.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityHealthWidget;
