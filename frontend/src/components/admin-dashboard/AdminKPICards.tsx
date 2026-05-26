"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Users,
  UserCheck,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Inbox,
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

  // Three signal-dense cards: platform engagement, commercial health,
  // and the only actionable item — Pending Applications. Everything
  // else (NELC %, certs MTD, 2FA, active sessions, new users 7d) lives
  // in its own dedicated widget below the strip, so the headline row
  // doesn't dilute attention.
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
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
