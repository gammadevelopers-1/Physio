"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Money from "./shared/Money";
import SaudiRiyalIcon from "./shared/SaudiRiyalIcon";
import { FINANCE_COLORS } from "./shared/financeColors";
import { KPIStripSkeleton } from "./shared/Skeleton";
import { formatInt } from "./shared/financeFormat";

export interface FinanceKPIData {
  grossRevenue: number;
  revenueTrend: number;
  netRevenue: number;
  pendingCount: number;
  pendingAmount: number;
  refundRate: number;
  refundRateTrend: number;
  successRate: number;
  failedRate: number;
  failedCount: number;
}

interface FinanceKPICardsProps {
  data: FinanceKPIData | null;
  loading?: boolean;
}

interface CardSpec {
  id: string;
  label: string;
  valueNode: React.ReactNode;
  subLabel: string;
  trend?: number;
  trendInverted?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

const FinanceKPICards = ({ data, loading }: FinanceKPICardsProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  if (loading || !data) {
    return <KPIStripSkeleton count={6} />;
  }

  const cards: CardSpec[] = [
    {
      id: "grossRevenue",
      label: t("kpi.grossRevenue"),
      valueNode: <Money amount={data.grossRevenue} decimals={0} iconSize={20} />,
      subLabel:
        data.revenueTrend !== 0
          ? t("kpi.vsPrevious", {
              value: `${data.revenueTrend > 0 ? "+" : ""}${data.revenueTrend}%`,
            })
          : t("kpi.noPriorPeriod"),
      trend: data.revenueTrend,
      icon: SaudiRiyalIcon,
      iconBg: FINANCE_COLORS.success.bg,
      iconColor: FINANCE_COLORS.success.text,
    },
    {
      id: "netRevenue",
      label: t("kpi.netRevenue"),
      valueNode: <Money amount={data.netRevenue} decimals={0} iconSize={20} />,
      subLabel: t("kpi.afterRefunds"),
      icon: Wallet,
      iconBg: "bg-[var(--color-border-subtle)]",
      iconColor: "text-[var(--color-primary)]",
    },
    {
      id: "pending",
      label: t("kpi.pendingApproval"),
      valueNode: (
        <span className="inline-flex items-baseline gap-2" dir="ltr">
          <span>{formatInt(data.pendingCount, isRTL ? "ar" : "en")}</span>
          <Money
            amount={data.pendingAmount}
            decimals={0}
            iconSize={11}
            className="text-sm font-normal text-[var(--color-text-secondary)]"
          />
        </span>
      ),
      subLabel: t("kpi.awaitingFinance"),
      icon: Clock,
      iconBg: FINANCE_COLORS.warning.bg,
      iconColor: FINANCE_COLORS.warning.text,
    },
    {
      id: "successRate",
      label: t("kpi.successRate"),
      valueNode: <span>{data.successRate.toFixed(1)}%</span>,
      subLabel: t("kpi.ofDecidedAttempts"),
      icon: CheckCircle2,
      iconBg: FINANCE_COLORS.success.bg,
      iconColor: FINANCE_COLORS.success.text,
    },
    {
      id: "failedRate",
      label: t("kpi.failedRate"),
      valueNode: <span>{data.failedRate.toFixed(1)}%</span>,
      subLabel: t("kpi.failedCount", { count: data.failedCount }),
      trend: data.failedRate,
      trendInverted: true,
      icon: XCircle,
      iconBg: FINANCE_COLORS.error.bg,
      iconColor: FINANCE_COLORS.error.text,
    },
    {
      id: "refundRate",
      label: t("kpi.refundRate"),
      valueNode: <span>{data.refundRate.toFixed(1)}%</span>,
      subLabel:
        data.refundRateTrend !== 0
          ? t("kpi.vsPrevious", {
              value: `${data.refundRateTrend > 0 ? "+" : ""}${data.refundRateTrend.toFixed(1)}pp`,
            })
          : t("kpi.noPriorPeriod"),
      trend: data.refundRateTrend,
      trendInverted: true,
      icon: RotateCcw,
      iconBg: FINANCE_COLORS.violet.bg,
      iconColor: FINANCE_COLORS.violet.text,
    },
  ];

  return (
    <div
      role="region"
      aria-label={t("kpi.regionLabel")}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        const trendValue = card.trend ?? null;
        const trendUp = trendValue !== null && trendValue > 0;
        const trendIsGood = card.trendInverted ? !trendUp : trendUp;
        const trendColor =
          trendValue === null || trendValue === 0
            ? "text-[var(--color-text-secondary)]"
            : trendIsGood
              ? "text-[#16A34A]"
              : "text-[#DC2626]";

        return (
          <div
            key={card.id}
            className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between">
              <div
                className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}
              >
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {card.label}
              </p>
              <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5">
                {card.valueNode}
              </div>
            </div>
            <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
              {trendValue !== null && trendValue !== 0 && (
                trendUp ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )
              )}
              <span>{card.subLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FinanceKPICards;
