"use client";

import { useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
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
  ChevronDown,
  X,
  AlertCircle,
  FileText,
  FileDown,
} from "lucide-react";
import { invoiceApi, refundApi, financeApi } from "@/lib/api";

interface Transaction {
  id: string;
  invoiceNumber: string;
  invoiceId?: string | null;
  date: string;
  customer: string;
  course: string;
  amount: string;
  gateway: "Moyasar" | "Tamara" | "Tabby" | "BankTransfer";
  status: "paid" | "pending" | "failed" | "refunded";
  errorCode?: string | null;
  failureReason?: string | null;
  gatewayChargeId?: string | null;
  paymentMethod?: string | null;
}

interface PaymentsInvoicesTableProps {
  transactions: Transaction[];
  showPagination?: boolean;
  showExport?: boolean;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onExport?: () => void;
  onExportPdf?: () => void;
  // Controlled filter props for server-side mode
  statusFilter?: string;
  onStatusFilterChange?: (val: string) => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

const PaymentsInvoicesTable = ({
  transactions,
  showPagination = true,
  showExport = true,
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
  onExport,
  onExportPdf,
  statusFilter: controlledStatus,
  onStatusFilterChange,
  searchQuery: controlledSearch,
  onSearchChange,
}: PaymentsInvoicesTableProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Internal filter state (fallback when not controlled)
  const [internalStatus, setInternalStatus] = useState("all");
  const [internalSearch, setInternalSearch] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // Modal state
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refundTx, setRefundTx] = useState<Transaction | null>(null);
  const [refundReason, setRefundReason] = useState("policy");
  const [refundNote, setRefundNote] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  // Track which Tamara payment is currently mid-retry so we can disable the
  // button + show a spinner. One in flight at a time per row.
  const [retryingTamaraId, setRetryingTamaraId] = useState<string | null>(null);

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Effective filter values (controlled takes priority)
  const effectiveStatus = controlledStatus !== undefined ? controlledStatus : internalStatus;
  const effectiveSearch = controlledSearch !== undefined ? controlledSearch : internalSearch;

  const handleStatusChange = (val: string) => {
    if (onStatusFilterChange) onStatusFilterChange(val);
    else setInternalStatus(val);
  };

  const handleSearchChange = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    else setInternalSearch(val);
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      effectiveSearch === "" ||
      tx.customer.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
      tx.invoiceNumber.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
      tx.course.toLowerCase().includes(effectiveSearch.toLowerCase());
    const matchesStatus = effectiveStatus === "all" || tx.status === effectiveStatus;
    const matchesGateway = gatewayFilter === "all" || tx.gateway === gatewayFilter;
    return matchesSearch && matchesStatus && matchesGateway;
  });

  const gatewayStyles: Record<string, string> = {
    Moyasar: "bg-[#CFFAFE] text-[#0891B2]",
    Tamara: "bg-[#EDE9FE] text-[#8B5CF6]",
    Tabby: "bg-[#FEF3C7] text-[#D97706]",
    BankTransfer: "bg-[#E0E7FF] text-[#4338CA]",
  };

  const statusStyles: Record<string, string> = {
    paid: "bg-[#DCFCE7] text-[#16A34A]",
    pending: "bg-[#FEF9C3] text-[#CA8A04]",
    failed: "bg-[#FEE2E2] text-[#DC2626]",
    refunded: "bg-[#FFEDD5] text-[#EA580C]",
  };

  const handleDownload = async (tx: Transaction) => {
    if (!tx.invoiceId) return;
    try {
      const result = await invoiceApi.getPdfUrl(tx.invoiceId);
      if (result?.url) window.open(result.url, "_blank");
    } catch {
      toast.error(t("paymentsTable.actions.downloadError"));
    }
  };

  const handleResend = async (tx: Transaction) => {
    if (!tx.invoiceId) return;
    try {
      await invoiceApi.resend(tx.invoiceId);
      toast.success(t("paymentsTable.actions.resendSuccess"));
    } catch {
      toast.error(t("paymentsTable.actions.resendError"));
    }
  };

  /**
   * Manually trigger the Tamara Authorise + Capture flow for a stuck payment.
   * The cron retry job is already attempting this every 10 minutes — this
   * button just lets finance fire it on demand. Toast reflects the outcome
   * (paid / failed / no-op / still-retrying) so they know what happened
   * without having to refresh the list.
   */
  const handleRetryTamara = async (tx: Transaction) => {
    if (retryingTamaraId) return;
    setRetryingTamaraId(tx.id);
    try {
      const result = await financeApi.retryTamaraCapture(tx.id);
      if (result.action === 'paid') {
        toast.success(t('paymentsTable.actions.tamaraRetryPaid'));
      } else if (result.action === 'failed' || result.action === 'refunded') {
        toast.warning(
          t('paymentsTable.actions.tamaraRetryTerminal', { detail: result.detail }),
        );
      } else if (result.action === 'no_op') {
        toast.info(result.detail);
      } else {
        // 'retried' — capture still failing, will keep auto-retrying
        toast.error(
          t('paymentsTable.actions.tamaraRetryStillFailing', {
            detail: result.detail.slice(0, 80),
          }),
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('paymentsTable.actions.tamaraRetryError'),
      );
    } finally {
      setRetryingTamaraId(null);
    }
  };

  const handleRefundSubmit = async () => {
    if (!refundTx) return;
    setRefundLoading(true);
    try {
      await refundApi.request({ paymentId: refundTx.id, reason: refundReason, reasonNote: refundNote });
      toast.success(t("paymentsTable.refundModal.success"));
      setRefundTx(null);
      setRefundNote("");
      setRefundReason("policy");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("paymentsTable.refundModal.error"));
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <>
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)] gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[var(--color-primary)]" />
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("paymentsTable.title")}
            </h3>
          </div>
          {showExport && (
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                aria-label="Export options"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium btn-gold text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                {t("paymentsTable.export")}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showExportMenu && (
                <div
                  className={`absolute top-full mt-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[140px] z-20 ${isRTL ? "left-0" : "right-0"}`}
                >
                  <button
                    onClick={() => { onExport?.(); setShowExportMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {t("paymentsTable.exportCsv")}
                  </button>
                  {onExportPdf && (
                    <button
                      onClick={() => { onExportPdf(); setShowExportMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      {t("paymentsTable.exportPdf")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={effectiveStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/20"
            >
              <option value="all">{t("paymentsTable.filters.allStatus")}</option>
              <option value="paid">{t("paymentsTable.filters.paid")}</option>
              <option value="pending">{t("paymentsTable.filters.pending")}</option>
              <option value="failed">{t("paymentsTable.filters.failed")}</option>
              <option value="refunded">{t("paymentsTable.filters.refunded")}</option>
            </select>
            <select
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value)}
              className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/20"
            >
              <option value="all">{t("paymentsTable.filters.allGateways")}</option>
              <option value="Moyasar">{t("gateways.moyasar")}</option>
              <option value="Tamara">{t("gateways.tamara")}</option>
              <option value="Tabby">{t("gateways.tabby")}</option>
              <option value="BankTransfer">{t("gateways.bankTransfer")}</option>
            </select>
            <div className="flex-1 relative">
              <Search
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
              />
              <input
                type="text"
                value={effectiveSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t("paymentsTable.searchPlaceholder")}
                className={`w-full py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/20 ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" aria-label="Payments and invoices">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("paymentsTable.columns.invoice")}
                </th>
                <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("paymentsTable.columns.date")}
                </th>
                <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("paymentsTable.columns.customer")}
                </th>
                <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>
                  {t("paymentsTable.columns.course")}
                </th>
                <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("paymentsTable.columns.amount")}
                </th>
                <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden lg:table-cell ${isRTL ? "text-right" : "text-left"}`}>
                  {t("paymentsTable.columns.gateway")}
                </th>
                <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                  {t("paymentsTable.columns.status")}
                </th>
                <th scope="col" className="py-3 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] transition-colors"
                >
                  <td className="py-3 px-4">
                    <span className="text-[13px] font-medium text-[var(--color-primary)]">
                      {tx.invoiceNumber}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)]">
                    {tx.date}
                  </td>
                  <td className="py-3 px-4 text-[13px] text-[var(--color-text-primary)] font-medium">
                    {tx.customer}
                  </td>
                  <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">
                    {tx.course}
                  </td>
                  <td className="py-3 px-4 text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {tx.amount}
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${gatewayStyles[tx.gateway] || "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"}`}>
                      {tx.gateway}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[tx.status] || "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"}`}>
                        {t(`paymentsTable.statuses.${tx.status}`)}
                      </span>
                      {tx.status === "failed" && tx.errorCode && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#DC2626] bg-[#FEF2F2] px-1.5 py-0.5 rounded w-fit">
                          <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" />
                          {t.has(`paymentsTable.errorCodes.${tx.errorCode}`) ? t(`paymentsTable.errorCodes.${tx.errorCode}`) : tx.errorCode}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenActionId(openActionId === tx.id ? null : tx.id)
                        }
                        aria-label="Actions"
                        className="w-7 h-7 flex items-center justify-center border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {openActionId === tx.id && (
                        <div
                          className={`absolute top-full mt-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[150px] z-20 ${isRTL ? "left-0" : "right-0"}`}
                        >
                          <button
                            onClick={() => { setSelectedTx(tx); setOpenActionId(null); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t("paymentsTable.actions.view")}
                          </button>
                          {tx.invoiceId && (
                            <button
                              onClick={() => { handleDownload(tx); setOpenActionId(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {t("paymentsTable.actions.download")}
                            </button>
                          )}
                          {tx.invoiceId && (
                            <button
                              onClick={() => { handleResend(tx); setOpenActionId(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              {t("paymentsTable.actions.resend")}
                            </button>
                          )}
                          {tx.status === "paid" && (
                            <button
                              onClick={() => { setRefundTx(tx); setOpenActionId(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              {t("paymentsTable.actions.refund")}
                            </button>
                          )}
                          {/* Manual retry of Authorise + Capture for Tamara
                              orders stuck in pending. Backend cron is
                              also retrying every 10 min — this is the
                              human-triggered override. */}
                          {tx.gateway === "Tamara" && tx.status === "pending" && (
                            <button
                              onClick={() => { handleRetryTamara(tx); setOpenActionId(null); }}
                              disabled={retryingTamaraId === tx.id}
                              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[#7C3AED] hover:bg-[#EDE9FE] transition-colors disabled:opacity-60"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${retryingTamaraId === tx.id ? "animate-spin" : ""}`} />
                              {retryingTamaraId === tx.id
                                ? t("paymentsTable.actions.tamaraRetrying")
                                : t("paymentsTable.actions.tamaraRetry")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[13px] text-[var(--color-text-secondary)]">
                    {t("paymentsTable.noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {showPagination && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-[var(--color-border-subtle)] gap-3">
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {totalCount !== undefined && currentPage !== undefined
                ? t("paymentsTable.pagination.showing", {
                    from: totalCount === 0 ? 0 : (currentPage - 1) * transactions.length + 1,
                    to: Math.min(currentPage * transactions.length, totalCount),
                    total: totalCount,
                  })
                : t("paymentsTable.pagination.showing", {
                    from: filteredTransactions.length === 0 ? 0 : 1,
                    to: filteredTransactions.length,
                    total: filteredTransactions.length,
                  })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange?.(Math.max(1, (currentPage ?? 1) - 1))}
                disabled={!onPageChange || !currentPage || currentPage <= 1}
                aria-label="Previous page"
                className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors disabled:opacity-40 disabled:cursor-default"
              >
                <ChevronLeft className="w-4 h-4" />
                {t("paymentsTable.pagination.previous")}
              </button>
              <button
                onClick={() => onPageChange?.((currentPage ?? 1) + 1)}
                disabled={!onPageChange || !currentPage || currentPage >= (totalPages ?? 1)}
                aria-label="Next page"
                className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors disabled:opacity-40 disabled:cursor-default"
              >
                {t("paymentsTable.pagination.next")}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t("paymentsTable.transactionDetail.title")}
              </h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="space-y-3 text-[13px]">
              {[
                { label: t("paymentsTable.columns.invoice"), value: selectedTx.invoiceNumber },
                { label: t("paymentsTable.transactionDetail.paymentId"), value: selectedTx.id, mono: true },
                { label: t("paymentsTable.columns.date"), value: selectedTx.date },
                { label: t("paymentsTable.columns.customer"), value: selectedTx.customer },
                { label: t("paymentsTable.columns.course"), value: selectedTx.course },
                { label: t("paymentsTable.columns.amount"), value: selectedTx.amount },
                { label: t("paymentsTable.columns.gateway"), value: selectedTx.gateway },
                { label: t("paymentsTable.transactionDetail.paymentMethod"), value: selectedTx.paymentMethod || "—" },
                { label: t("paymentsTable.columns.status"), value: t(`paymentsTable.statuses.${selectedTx.status}`) },
                ...(selectedTx.errorCode ? [{ label: t("paymentsTable.transactionDetail.errorCode"), value: selectedTx.errorCode, mono: true, error: true }] : []),
                ...(selectedTx.failureReason ? [{ label: t("paymentsTable.transactionDetail.failureReason"), value: selectedTx.failureReason }] : []),
                ...(selectedTx.gatewayChargeId ? [{ label: t("paymentsTable.transactionDetail.gatewayTxId"), value: selectedTx.gatewayChargeId, mono: true }] : []),
              ].map(({ label, value, mono, error }) => (
                <div
                  key={label}
                  className={`flex justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  <dt className="text-[var(--color-text-secondary)] font-medium flex-shrink-0">{label}</dt>
                  <dd
                    className={`text-[var(--color-text-primary)] ${isRTL ? "text-left" : "text-right"} break-all ${mono ? "font-mono text-[11px]" : ""} ${error ? "text-[#DC2626] bg-[#FEF2F2] px-1.5 py-0.5 rounded" : ""}`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* Refund Request Modal */}
      {refundTx && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setRefundTx(null)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t("paymentsTable.refundModal.title")}
              </h3>
              <button
                onClick={() => setRefundTx(null)}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[13px] text-[var(--color-text-secondary)] mb-4">
              {refundTx.customer} — {refundTx.amount}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[var(--color-text-primary)] mb-1">
                  {t("paymentsTable.refundModal.reason")}
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)] bg-[var(--color-surface-card)]"
                >
                  <option value="policy">{t("paymentsTable.refundModal.reasons.policy")}</option>
                  <option value="cancelled">{t("paymentsTable.refundModal.reasons.cancelled")}</option>
                  <option value="duplicate">{t("paymentsTable.refundModal.reasons.duplicate")}</option>
                  <option value="technical">{t("paymentsTable.refundModal.reasons.technical")}</option>
                  <option value="other">{t("paymentsTable.refundModal.reasons.other")}</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--color-text-primary)] mb-1">
                  {t("paymentsTable.refundModal.note")}
                </label>
                <textarea
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)] resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setRefundTx(null)}
                className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
              >
                {t("paymentsTable.refundModal.cancel")}
              </button>
              <button
                onClick={handleRefundSubmit}
                disabled={refundLoading}
                className="flex-1 px-4 py-2 bg-[#DC2626] text-white rounded-lg text-[13px] font-medium hover:bg-[#B91C1C] disabled:opacity-50 transition-colors"
              >
                {refundLoading ? "..." : t("paymentsTable.refundModal.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentsInvoicesTable;
