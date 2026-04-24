"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import { DollarSign, ArrowRight } from "lucide-react";

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

interface FinanceSummaryWidgetProps {
  data: FinanceData;
}

const FinanceSummaryWidget = ({ data }: FinanceSummaryWidgetProps) => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    return amount.toLocaleString();
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
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
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center">
          <p className="text-3xl font-bold text-[var(--color-text-secondary)]">
            {formatCurrency(data.grossRevenue)}
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("finance.gross")} ({t("finance.sar")})
          </p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-[var(--color-text-secondary)]">
            {formatCurrency(data.netRevenue)}
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("finance.net")} ({t("finance.sar")})
          </p>
        </div>
      </div>

      {/* Gateway Breakdown */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase mb-3">
          {t("finance.byGateway")}
        </h4>
        <div className="space-y-2">
          {data.gateways.map((gateway) => (
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
      <div className="pt-4 border-t border-[var(--color-border)]">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {t("finance.refundRate")}
            </span>
            <span
              className={`text-sm font-medium ${data.refundRate <= 3 ? "text-[#16A34A]" : "text-[#D97706]"}`}
            >
              {data.refundRate}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {t("finance.chargebackRate")}
            </span>
            <span
              className={`text-sm font-medium ${data.chargebackRate <= 1 ? "text-[#16A34A]" : "text-[#DC2626]"}`}
            >
              {data.chargebackRate}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceSummaryWidget;
