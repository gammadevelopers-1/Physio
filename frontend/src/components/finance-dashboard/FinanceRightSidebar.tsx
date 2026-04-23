"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  CreditCard,
  AlertTriangle,
  XCircle,
  FileText,
  BarChart3,
  Tag,
  RotateCcw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
} from "lucide-react";

interface TransactionFeedItem {
  id: string;
  customer: string;
  type: "income" | "refund" | "failed";
  amount: string;
  time: string;
}

interface AlertItem {
  id: string;
  type: "error" | "warning";
  title: string;
  description: string;
}

interface CouponItem {
  id: string;
  code: string;
  discount: string;
  used: number;
  limit: number;
  status: "active" | "expired";
}

interface FinanceRightSidebarProps {
  transactions: TransactionFeedItem[];
  alerts: AlertItem[];
  coupons: CouponItem[];
}

const FinanceRightSidebar = ({
  transactions,
  alerts,
  coupons,
}: FinanceRightSidebarProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const transactionIcons = {
    income: {
      bg: "bg-[#DCFCE7]",
      icon: DollarSign,
      iconColor: "text-[#16A34A]",
    },
    refund: {
      bg: "bg-[#FFEDD5]",
      icon: RotateCcw,
      iconColor: "text-[#EA580C]",
    },
    failed: {
      bg: "bg-[#FEE2E2]",
      icon: XCircle,
      iconColor: "text-[#DC2626]",
    },
  };

  return (
    <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("transactionFeed.title")}
          </h3>
        </div>

        <div className="space-y-0">
          {transactions.map((tx) => {
            const config = transactionIcons[tx.type];
            const Icon = config.icon;

            return (
              <div
                key={tx.id}
                className="flex items-center gap-2.5 py-2.5 border-b border-[#F3F4F6] last:border-b-0"
              >
                <div
                  className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--color-text-secondary)]">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {tx.customer}
                    </span>{" "}
                    {t(`transactionFeed.${tx.type}`)}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">{tx.time}</p>
                </div>
                <span
                  className={`text-[13px] font-semibold flex-shrink-0 ${
                    tx.type === "income"
                      ? "text-[#16A34A]"
                      : tx.type === "refund"
                        ? "text-[#DC2626]"
                        : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {tx.type === "income" ? "+" : tx.type === "refund" ? "-" : ""}
                  {tx.amount}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-[#F3F4F6] text-center">
          <Link
            href={`/${locale}/dashboard/finance/payments`}
            className="text-[13px] font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] hover:underline"
          >
            {t("transactionFeed.viewAll")}
          </Link>
        </div>
      </div>

      {/* Financial Alerts */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#EA580C]" />
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("financialAlerts.title")}
          </h3>
        </div>

        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg ${
                alert.type === "error"
                  ? "bg-[#FEE2E2] border-l-3"
                  : "bg-[#FFEDD5] border-l-3"
              }`}
              style={{
                borderLeftWidth: "3px",
                borderLeftColor:
                  alert.type === "error" ? "#DC2626" : "#EA580C",
              }}
            >
              {alert.type === "error" ? (
                <XCircle className="w-4 h-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#EA580C] flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                  {alert.title}
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {alert.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Coupons */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[var(--color-primary)]" />
            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
              {t("discounts.title")}
            </h3>
          </div>
          <button className="text-[12px] font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] hover:underline">
            {t("discounts.createCoupon")}
          </button>
        </div>

        <div className="space-y-2.5">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="flex items-center justify-between p-2.5 bg-[#F9FAFB] rounded-lg border border-[#F3F4F6]"
            >
              <div>
                <p className="text-[13px] font-medium text-[var(--color-text-secondary)]">
                  {coupon.code}
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {coupon.discount} -{" "}
                  {t("discounts.usage", {
                    used: coupon.used,
                    limit: coupon.limit,
                  })}
                </p>
              </div>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  coupon.status === "active"
                    ? "bg-[#DCFCE7] text-[#16A34A]"
                    : "bg-[#F3F4F6] text-[var(--color-text-secondary)]"
                }`}
              >
                {t(`discounts.${coupon.status}`)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("quickActions.title")}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-1.5 p-2.5 bg-[#F9FAFB] border border-[var(--color-border)] rounded-lg text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[#FDF6EC] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors">
            <FileText className="w-3.5 h-3.5" />
            {t("quickActions.createInvoice")}
          </button>
          <button className="flex items-center justify-center gap-1.5 p-2.5 bg-[#F9FAFB] border border-[var(--color-border)] rounded-lg text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[#FDF6EC] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors">
            <BarChart3 className="w-3.5 h-3.5" />
            {t("quickActions.exportReport")}
          </button>
          <button className="flex items-center justify-center gap-1.5 p-2.5 bg-[#F9FAFB] border border-[var(--color-border)] rounded-lg text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[#FDF6EC] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors">
            <Tag className="w-3.5 h-3.5" />
            {t("quickActions.addCoupon")}
          </button>
          <button className="flex items-center justify-center gap-1.5 p-2.5 bg-[#F9FAFB] border border-[var(--color-border)] rounded-lg text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[#FDF6EC] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            {t("quickActions.processRefund")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinanceRightSidebar;
