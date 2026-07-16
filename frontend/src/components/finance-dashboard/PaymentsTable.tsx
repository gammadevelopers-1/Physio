"use client";

import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, User, Calendar } from "lucide-react";
import Money from "./shared/Money";
import { FINANCE_COLORS, gatewayColor } from "./shared/financeColors";
import { TableRowSkeleton } from "./shared/Skeleton";

export type PaymentRowStatus =
  | "paid"
  | "pending"
  | "processing"
  | "awaiting_approval"
  | "failed"
  | "rejected"
  | "refunded"
  | "partially_refunded"
  | "chargeback"
  | "abandoned";

export interface PaymentRow {
  id: string;
  date: string;
  customer: string;
  customerEmail?: string | null;
  course: string;
  amount: number;
  gateway: string;
  method: string | null;
  status: PaymentRowStatus;
}

interface PaymentsTableProps {
  rows: PaymentRow[];
  loading?: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRowClick: (id: string) => void;
}

const STATUS_STYLE: Record<PaymentRowStatus, { bg: string; text: string; labelKey: string }> = {
  paid: { bg: FINANCE_COLORS.success.bg, text: FINANCE_COLORS.success.textDark, labelKey: "status.paid" },
  pending: { bg: FINANCE_COLORS.warning.bg, text: FINANCE_COLORS.warning.textDark, labelKey: "status.pending" },
  processing: { bg: FINANCE_COLORS.info.bg, text: FINANCE_COLORS.info.textDark, labelKey: "status.processing" },
  awaiting_approval: { bg: FINANCE_COLORS.info.bg, text: FINANCE_COLORS.info.textDark, labelKey: "status.awaitingApproval" },
  failed: { bg: FINANCE_COLORS.error.bg, text: FINANCE_COLORS.error.textDark, labelKey: "status.failed" },
  rejected: { bg: FINANCE_COLORS.slate.bg, text: FINANCE_COLORS.slate.textDark, labelKey: "status.rejected" },
  refunded: { bg: FINANCE_COLORS.violet.bg, text: FINANCE_COLORS.violet.textDark, labelKey: "status.refunded" },
  partially_refunded: { bg: FINANCE_COLORS.violet.bgSoft, text: FINANCE_COLORS.violet.textDark, labelKey: "status.partiallyRefunded" },
  chargeback: { bg: FINANCE_COLORS.slate.bg, text: FINANCE_COLORS.slate.textDark, labelKey: "status.chargeback" },
  abandoned: { bg: FINANCE_COLORS.slate.bg, text: FINANCE_COLORS.slate.textDark, labelKey: "status.abandoned" },
};

const PaymentsTable = ({
  rows,
  loading,
  page,
  totalPages,
  totalCount,
  onPageChange,
  onRowClick,
}: PaymentsTableProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
            <tr>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider`}>
                {t("paymentsTable.col.date")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider`}>
                {t("paymentsTable.col.customer")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider hidden md:table-cell`}>
                {t("paymentsTable.col.course")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider hidden lg:table-cell`}>
                {t("paymentsTable.col.gateway")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider hidden lg:table-cell`}>
                {t("paymentsTable.col.method")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-right" : "text-left"} font-medium text-[10px] uppercase tracking-wider`}>
                {t("paymentsTable.col.status")}
              </th>
              <th className={`px-4 py-2.5 ${isRTL ? "text-left" : "text-right"} font-medium text-[10px] uppercase tracking-wider`}>
                {t("paymentsTable.col.amount")}
              </th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cols={8} rows={6} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("paymentsTable.empty")}
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const style = STATUS_STYLE[row.status] || STATUS_STYLE.pending;
                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick(row.id)}
                    className="border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] transition-colors cursor-pointer"
                  >
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} text-xs text-[var(--color-text-secondary)] whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 opacity-60" />
                        {row.date}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                            {row.customer}
                          </p>
                          {row.customerEmail && (
                            <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                              {row.customerEmail}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} hidden md:table-cell`}>
                      <p className="text-[13px] text-[var(--color-text-primary)] truncate max-w-[220px]">
                        {row.course}
                      </p>
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} hidden lg:table-cell`}>
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-primary)] font-medium">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: gatewayColor(row.gateway) }}
                        />
                        <span className="capitalize">{row.gateway?.replace(/_/g, " ")}</span>
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} hidden lg:table-cell text-[12px] text-[var(--color-text-secondary)] capitalize`}>
                      {row.method?.replace(/_/g, " ") || "—"}
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}>
                        {t(style.labelKey)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${isRTL ? "text-left" : "text-right"} font-semibold text-[var(--color-text-primary)] whitespace-nowrap`}>
                      <Money amount={row.amount} decimals={0} iconSize={12} />
                    </td>
                    <td className="px-2 py-3">
                      <Arrow className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalCount > 0 && (
        <div className={`flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-subtle)] ${isRTL ? "flex-row-reverse" : ""}`}>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t("paymentsTable.pagination.pageOf", { page, totalPages, total: totalCount })}
          </p>
          <div className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface-page)]"
              aria-label={t("a11y.previousPage")}
            >
              {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <span className="text-xs px-2 text-[var(--color-text-secondary)]">{page} / {totalPages}</span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface-page)]"
              aria-label={t("a11y.nextPage")}
            >
              {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsTable;
