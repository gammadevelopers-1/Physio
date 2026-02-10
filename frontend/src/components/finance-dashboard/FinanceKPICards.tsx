"use client";

import { useTranslations } from "next-intl";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ShoppingCart,
  FileText,
  RotateCcw,
} from "lucide-react";

interface FinanceKPIData {
  revenueMTD: number;
  revenueTrend: number;
  netRevenue: number;
  avgOrderValue: number;
  avgOrderTrend: number;
  pendingInvoices: number;
  pendingInvoicesAmount: number;
  refundRate: number;
  refundRateTrend: number;
}

interface FinanceKPICardsProps {
  data: FinanceKPIData;
}

const FinanceKPICards = ({ data }: FinanceKPICardsProps) => {
  const t = useTranslations("financeDashboard");

  const formatCurrency = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toLocaleString();
  };

  const kpiCards = [
    {
      id: "revenueMTD",
      label: t("kpi.revenueMTD"),
      value: formatCurrency(data.revenueMTD),
      subLabel: `${data.revenueTrend > 0 ? "+" : ""}${data.revenueTrend}% ${t("kpi.sar")}`,
      trend: data.revenueTrend,
      icon: DollarSign,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      id: "netRevenue",
      label: t("kpi.netRevenue"),
      value: formatCurrency(data.netRevenue),
      subLabel: t("kpi.afterRefunds"),
      icon: BarChart3,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      id: "avgOrderValue",
      label: t("kpi.avgOrderValue"),
      value: data.avgOrderValue.toLocaleString(),
      subLabel: `${data.avgOrderTrend > 0 ? "+" : ""}${data.avgOrderTrend}% ${t("kpi.sar")}`,
      trend: data.avgOrderTrend,
      icon: ShoppingCart,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D97706]",
    },
    {
      id: "pendingInvoices",
      label: t("kpi.pendingInvoices"),
      value: data.pendingInvoices.toString(),
      subLabel: t("kpi.totalPending", {
        amount: data.pendingInvoicesAmount.toLocaleString(),
      }),
      icon: FileText,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#EA580C]",
    },
    {
      id: "refundRate",
      label: t("kpi.refundRate"),
      value: `${data.refundRate}%`,
      subLabel: `${data.refundRateTrend > 0 ? "+" : ""}${data.refundRateTrend}%`,
      trend: data.refundRateTrend * -1,
      icon: RotateCcw,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#DC2626]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-[var(--surface-intense)] rounded-xl border border-[#E5E7EB] p-4 flex items-start gap-3.5 hover:shadow-md transition-all cursor-pointer"
          >
            <div
              className={`w-11 h-11 ${card.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
            >
              <Icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--on-surface-variant)] font-medium mb-1">
                {card.label}
              </p>
              <p className="text-xl font-bold text-[var(--on-surface-default)] leading-tight">
                {card.value}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {card.trend !== undefined && (
                  <>
                    {card.trend > 0 ? (
                      <TrendingUp className="w-3 h-3 text-[#16A34A]" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-[#DC2626]" />
                    )}
                  </>
                )}
                <span
                  className={`text-[11px] ${
                    card.trend !== undefined
                      ? card.trend > 0
                        ? "text-[#16A34A] font-semibold"
                        : "text-[#DC2626] font-semibold"
                      : "text-[var(--on-surface-variant)]"
                  }`}
                >
                  {card.subLabel}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FinanceKPICards;
