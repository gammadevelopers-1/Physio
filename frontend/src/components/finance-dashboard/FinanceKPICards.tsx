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
  CreditCard,
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
  totalTransactions: number;
  totalTransactionsPeriod: string;
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
    {
      id: "totalTransactions",
      label: t("kpi.totalTransactions"),
      value: data.totalTransactions.toLocaleString(),
      subLabel: data.totalTransactionsPeriod,
      icon: CreditCard,
      iconBg: "bg-[#EDE9FE]",
      iconColor: "text-[#8B5CF6]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-[var(--surface-intense)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3 hover:shadow-md transition-all cursor-pointer"
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
                    <TrendingUp className="w-3 h-3 text-[#16A34A]" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-[#DC2626]" />
                  )}
                </>
              )}
              <span
                className={`text-xs ${
                  card.trend !== undefined
                    ? card.trend > 0
                      ? "text-[#16A34A]"
                      : "text-[#DC2626]"
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

export default FinanceKPICards;
