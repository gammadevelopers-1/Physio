"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Users,
  UserCheck,
  DollarSign,
  FileCheck,
  Award,
  TrendingUp,
  TrendingDown,
  Inbox,
  KeyRound,
  Activity,
} from "lucide-react";

interface KPIData {
  activeUsers: number;
  activeUsersTrend: number;
  revenueMTD: number;
  revenueTrend: number;
  pendingApplications: number;
  nelcCompliance: number;
  nelcClauses: string;
  newUsers7d: number;
  certificatesIssued: number;
  twoFaAdoption: number;
  activeSessions: number;
}

interface AdminKPICardsProps {
  data: KPIData;
}

type CardDef = {
  id: string;
  label: string;
  value: string;
  subLabel: string;
  trend?: number;
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
  /** When set, the card becomes a clickable link to this href. */
  href?: string;
};

const formatNumber = (num: number): string => {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const AdminKPICards = ({ data }: AdminKPICardsProps) => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();

  // Eight real cards in the order the user wants. Pending Applications
  // sits in slot 3 (top row, third column) so it catches the admin's
  // eye but doesn't displace the headline Active Users / Revenue cards.
  const kpiCards: CardDef[] = [
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
      id: "pendingApplications",
      label: t("kpi.pendingApplications"),
      value: data.pendingApplications.toString(),
      subLabel: t("kpi.awaitingReview"),
      icon: Inbox,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D97706]",
      href: `/${locale}/dashboard/admin/role-requests`,
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
      id: "newUsers",
      label: t("kpi.newUsers7d"),
      value: `+${data.newUsers7d}`,
      subLabel: t("kpi.thisWeek"),
      icon: Users,
      iconBg: "bg-[var(--gold-gold-100)]",
      iconColor: "text-[var(--color-star)]",
    },
    {
      id: "certificates",
      label: t("kpi.certificates"),
      value: data.certificatesIssued.toString(),
      subLabel: t("kpi.thisMonth"),
      icon: Award,
      iconBg: "bg-[var(--gold-gold-100)]",
      iconColor: "text-[var(--color-star)]",
    },
    {
      id: "twoFaAdoption",
      label: t("kpi.twoFaAdoption"),
      value: `${data.twoFaAdoption}%`,
      subLabel: data.twoFaAdoption >= 70 ? t("kpi.healthy") : t("kpi.warning"),
      icon: KeyRound,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      id: "activeSessions",
      label: t("kpi.activeSessions"),
      value: data.activeSessions.toString(),
      subLabel: t("kpi.last24h"),
      icon: Activity,
      iconBg: "bg-[#EDE9FE]",
      iconColor: "text-[#7C3AED]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        const body = (
          <div className="bg-[var(--surface-intense)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3 hover:border-[var(--color-primary)] transition-colors h-full">
            <div className="flex items-start justify-between">
              <div
                className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}
              >
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
            <div>
              <p className="text-sm text-[var(--on-surface-variant)]">{card.label}</p>
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

        return card.href ? (
          <Link key={card.id} href={card.href} className="block">
            {body}
          </Link>
        ) : (
          <div key={card.id}>{body}</div>
        );
      })}
    </div>
  );
};

export default AdminKPICards;
