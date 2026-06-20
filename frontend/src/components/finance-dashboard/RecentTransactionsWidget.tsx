"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Receipt, ArrowRight, ArrowLeft, CreditCard, User, Calendar } from "lucide-react";
import Money from "./shared/Money";
import { FINANCE_COLORS, gatewayColor } from "./shared/financeColors";
import { TableRowSkeleton } from "./shared/Skeleton";

export type TxStatus =
  | "paid"
  | "pending"
  | "awaiting_approval"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "chargeback";

export interface RecentTransaction {
  id: string;
  date: string;
  customer: string;
  customerEmail?: string | null;
  course: string;
  amount: number;
  gateway: string;
  status: TxStatus;
}

interface RecentTransactionsWidgetProps {
  transactions: RecentTransaction[];
  loading?: boolean;
}

const STATUS_STYLE: Record<TxStatus, { bg: string; text: string; labelKey: string }> = {
  paid: {
    bg: FINANCE_COLORS.success.bg,
    text: FINANCE_COLORS.success.textDark,
    labelKey: "status.paid",
  },
  pending: {
    bg: FINANCE_COLORS.warning.bg,
    text: FINANCE_COLORS.warning.textDark,
    labelKey: "status.pending",
  },
  awaiting_approval: {
    bg: FINANCE_COLORS.info.bg,
    text: FINANCE_COLORS.info.textDark,
    labelKey: "status.awaitingApproval",
  },
  failed: {
    bg: FINANCE_COLORS.error.bg,
    text: FINANCE_COLORS.error.textDark,
    labelKey: "status.failed",
  },
  refunded: {
    bg: FINANCE_COLORS.violet.bg,
    text: FINANCE_COLORS.violet.textDark,
    labelKey: "status.refunded",
  },
  partially_refunded: {
    bg: FINANCE_COLORS.violet.bgSoft,
    text: FINANCE_COLORS.violet.textDark,
    labelKey: "status.partiallyRefunded",
  },
  chargeback: {
    bg: FINANCE_COLORS.slate.bg,
    text: FINANCE_COLORS.slate.textDark,
    labelKey: "status.chargeback",
  },
};

const RecentTransactionsWidget = ({
  transactions,
  loading,
}: RecentTransactionsWidgetProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const viewAllHref = `/${locale}/dashboard/finance/payments`;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6">
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)] ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className="w-9 h-9 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center">
            <Receipt className="w-4.5 h-4.5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("recentTransactions.title")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t("recentTransactions.subtitle")}
            </p>
          </div>
        </div>
        <Link
          href={viewAllHref}
          className={`inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] hover:underline ${isRTL ? "flex-row-reverse" : ""}`}
        >
          {t("recentTransactions.viewAll")}
          <Arrow className="w-4 h-4" />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
            <tr>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider`}>
                {t("recentTransactions.col.date")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider`}>
                {t("recentTransactions.col.customer")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider hidden md:table-cell`}>
                {t("recentTransactions.col.course")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider hidden sm:table-cell`}>
                {t("recentTransactions.col.gateway")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider`}>
                {t("recentTransactions.col.status")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-left" : "text-right"} font-medium text-[10px] uppercase tracking-wider`}>
                {t("recentTransactions.col.amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cols={6} rows={5} />
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
                    <Receipt className="w-8 h-8 opacity-40" />
                    <p className="text-sm">{t("recentTransactions.empty")}</p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.slice(0, 8).map((tx) => {
                const style = STATUS_STYLE[tx.status] || STATUS_STYLE.pending;
                return (
                  <tr
                    key={tx.id}
                    className="border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] transition-colors"
                  >
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} text-xs text-[var(--color-text-secondary)] whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 opacity-60" />
                        {tx.date}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                            {tx.customer}
                          </p>
                          {tx.customerEmail && (
                            <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                              {tx.customerEmail}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} hidden md:table-cell`}>
                      <p className="text-[13px] text-[var(--color-text-primary)] truncate max-w-[200px]">
                        {tx.course}
                      </p>
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} hidden sm:table-cell`}>
                      <span
                        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-primary)] font-medium"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: gatewayColor(tx.gateway) }}
                        />
                        <span className="capitalize">{tx.gateway?.replace(/_/g, " ")}</span>
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}
                      >
                        {t(style.labelKey)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-left" : "text-right"} font-semibold text-[var(--color-text-primary)] whitespace-nowrap`}>
                      <Money amount={tx.amount} decimals={0} iconSize={12} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentTransactionsWidget;
