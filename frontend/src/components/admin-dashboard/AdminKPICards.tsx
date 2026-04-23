"use client";

import { useTranslations } from "next-intl";
import {
  Users,
  UserCheck,
  DollarSign,
  FileCheck,
  Activity,
  Award,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface KPIData {
  activeUsers: number;
  activeUsersTrend: number;
  totalUsers: number;
  totalUsersNew: number;
  revenueMTD: number;
  revenueTrend: number;
  nelcCompliance: number;
  nelcClauses: string;
  systemUptime: number;
  uptimeStatus: "healthy" | "warning" | "critical";
  certificatesIssued: number;
  certificatesPeriod: string;
}

interface AdminKPICardsProps {
  data: KPIData;
}

const AdminKPICards = ({ data }: AdminKPICardsProps) => {
  const t = useTranslations("adminDashboard");

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toLocaleString();
  };

  const kpiCards = [
    {
      id: "activeUsers",
      label: t("kpi.activeUsers"),
      value: formatNumber(data.activeUsers),
      subLabel: `${data.activeUsersTrend > 0 ? "+" : ""}${data.activeUsersTrend}% ${t("kpi.mau")}`,
      trend: data.activeUsersTrend,
      icon: UserCheck,
      iconBg: "bg-[var(--blue-blue-50)]",
      iconColor: "text-[var(--blue-blue-500)]",
    },
    {
      id: "totalUsers",
      label: t("kpi.totalUsers"),
      value: formatNumber(data.totalUsers),
      subLabel: `+${data.totalUsersNew} ${t("kpi.thisWeek")}`,
      icon: Users,
      iconBg: "bg-[var(--gold-gold-100)]",
      iconColor: "text-[var(--gold-gold-500)]",
    },
    {
      id: "revenueMTD",
      label: t("kpi.revenueMTD"),
      value: formatNumber(data.revenueMTD),
      subLabel: `${data.revenueTrend > 0 ? "+" : ""}${data.revenueTrend}% ${t("kpi.sar")}`,
      trend: data.revenueTrend,
      icon: DollarSign,
      iconBg: "bg-[var(--functional-green-400)]/10",
      iconColor: "text-[var(--functional-green-600)]",
    },
    {
      id: "nelcCompliance",
      label: t("kpi.nelcCompliance"),
      value: `${data.nelcCompliance}%`,
      subLabel: data.nelcClauses,
      icon: FileCheck,
      iconBg: "bg-[var(--blue-blue-50)]",
      iconColor: "text-[var(--blue-blue-500)]",
    },
    {
      id: "systemUptime",
      label: t("kpi.systemUptime"),
      value: `${data.systemUptime}%`,
      subLabel: t(`kpi.${data.uptimeStatus}`),
      status: data.uptimeStatus,
      icon: Activity,
      iconBg: "bg-[var(--functional-green-400)]/10",
      iconColor: "text-[var(--functional-green-600)]",
    },
    {
      id: "certificates",
      label: t("kpi.certificates"),
      value: data.certificatesIssued.toString(),
      subLabel: data.certificatesPeriod,
      icon: Award,
      iconBg: "bg-[var(--gold-gold-100)]",
      iconColor: "text-[var(--gold-gold-500)]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-[var(--surface-intense)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between">
              <div
                className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}
              >
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
            <div>
              <p className="text-sm text-[var(--on-surface-variant)]">
                {card.label}
              </p>
              <p className="text-2xl font-bold text-[var(--on-surface-default)]">
                {card.value}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {card.trend !== undefined && (
                <>
                  {card.trend > 0 ? (
                    <TrendingUp className="w-3 h-3 text-[var(--functional-green-600)]" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-[var(--functional-red-600)]" />
                  )}
                </>
              )}
              {card.status && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    card.status === "healthy"
                      ? "bg-[var(--functional-green-600)]"
                      : card.status === "warning"
                        ? "bg-[var(--functional-amber-500)]"
                        : "bg-[var(--functional-red-600)]"
                  }`}
                />
              )}
              <span
                className={`text-xs ${
                  card.trend !== undefined
                    ? card.trend > 0
                      ? "text-[var(--functional-green-600)]"
                      : "text-[var(--functional-red-600)]"
                    : "text-[var(--on-surface-variant)]"
                }`}
              >
                {card.subLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdminKPICards;
