"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  CreditCard,
  Search,
  Download,
  Eye,
  Send,
  RotateCcw,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Transaction {
  id: string;
  invoiceNumber: string;
  date: string;
  customer: string;
  course: string;
  amount: string;
  gateway: "Tap" | "Moyasar" | "Tamara" | "Tabby";
  status: "paid" | "pending" | "failed" | "refunded";
}

interface PaymentsInvoicesTableProps {
  transactions: Transaction[];
  showPagination?: boolean;
  showExport?: boolean;
}

const PaymentsInvoicesTable = ({
  transactions,
  showPagination = true,
  showExport = true,
}: PaymentsInvoicesTableProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      searchQuery === "" ||
      tx.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.course.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || tx.status === statusFilter;
    const matchesGateway =
      gatewayFilter === "all" || tx.gateway === gatewayFilter;
    return matchesSearch && matchesStatus && matchesGateway;
  });

  const gatewayStyles: Record<string, string> = {
    Tap: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
    Moyasar: "bg-[#CFFAFE] text-[#0891B2]",
    Tamara: "bg-[#EDE9FE] text-[#8B5CF6]",
    Tabby: "bg-[#FEF3C7] text-[#D97706]",
  };

  const statusStyles: Record<string, string> = {
    paid: "bg-[#DCFCE7] text-[#16A34A]",
    pending: "bg-[#FEF9C3] text-[#CA8A04]",
    failed: "bg-[#FEE2E2] text-[#DC2626]",
    refunded: "bg-[#FFEDD5] text-[#EA580C]",
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 border-b border-[#F3F4F6] gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("paymentsTable.title")}
          </h3>
        </div>
        {showExport && (
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium btn-gold text-[var(--color-button-text)] rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            {t("paymentsTable.export")}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="px-5 py-3 border-b border-[#F3F4F6]">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/20"
          >
            <option value="all">{t("paymentsTable.filters.allStatus")}</option>
            <option value="paid">{t("paymentsTable.filters.paid")}</option>
            <option value="pending">
              {t("paymentsTable.filters.pending")}
            </option>
            <option value="failed">{t("paymentsTable.filters.failed")}</option>
          </select>
          <select
            value={gatewayFilter}
            onChange={(e) => setGatewayFilter(e.target.value)}
            className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/20"
          >
            <option value="all">
              {t("paymentsTable.filters.allGateways")}
            </option>
            <option value="Tap">{t("gateways.tap")}</option>
            <option value="Moyasar">{t("gateways.moyasar")}</option>
            <option value="Tamara">{t("gateways.tamara")}</option>
            <option value="Tabby">{t("gateways.tabby")}</option>
          </select>
          <div className="flex-1 relative">
            <Search
              className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("paymentsTable.searchPlaceholder")}
              className={`w-full py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/20 ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th
                className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("paymentsTable.columns.invoice")}
              </th>
              <th
                className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("paymentsTable.columns.date")}
              </th>
              <th
                className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("paymentsTable.columns.customer")}
              </th>
              <th
                className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("paymentsTable.columns.course")}
              </th>
              <th
                className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("paymentsTable.columns.amount")}
              </th>
              <th
                className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden lg:table-cell ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("paymentsTable.columns.gateway")}
              </th>
              <th
                className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("paymentsTable.columns.status")}
              </th>
              <th className="py-3 px-4 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-[#F3F4F6] hover:bg-[var(--color-surface-page)] transition-colors"
              >
                <td className="py-3 px-4">
                  <span className="text-[13px] font-medium text-[var(--color-primary)]">
                    {tx.invoiceNumber}
                  </span>
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)]">
                  {tx.date}
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] font-medium">
                  {tx.customer}
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">
                  {tx.course}
                </td>
                <td className="py-3 px-4 text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {tx.amount}
                </td>
                <td className="py-3 px-4 hidden lg:table-cell">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${gatewayStyles[tx.gateway]}`}
                  >
                    {tx.gateway}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[tx.status]}`}
                  >
                    {t(`paymentsTable.statuses.${tx.status}`)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="relative">
                    <button
                      onClick={() =>
                        setOpenActionId(
                          openActionId === tx.id ? null : tx.id
                        )
                      }
                      className="w-7 h-7 flex items-center justify-center border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {openActionId === tx.id && (
                      <div
                        className={`absolute top-full mt-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[140px] z-20 ${isRTL ? "left-0" : "right-0"}`}
                      >
                        <button className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                          {t("paymentsTable.actions.view")}
                        </button>
                        <button className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors">
                          <Download className="w-3.5 h-3.5" />
                          {t("paymentsTable.actions.download")}
                        </button>
                        <button className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors">
                          <Send className="w-3.5 h-3.5" />
                          {t("paymentsTable.actions.resend")}
                        </button>
                        {tx.status === "paid" && (
                          <button className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEE2E2] transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" />
                            {t("paymentsTable.actions.refund")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-[#F3F4F6] gap-3">
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            {t("paymentsTable.pagination.showing", {
              from: 1,
              to: filteredTransactions.length,
              total: filteredTransactions.length,
            })}
          </p>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors">
              <ChevronLeft className="w-4 h-4" />
              {t("paymentsTable.pagination.previous")}
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors">
              {t("paymentsTable.pagination.next")}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsInvoicesTable;
