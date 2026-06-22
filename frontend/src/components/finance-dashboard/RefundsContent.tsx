"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  RotateCcw,
  Check,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  DollarSign,
  BarChart3,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  FileDown,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { refundApi, financeApi } from "@/lib/api";
import { toast } from "sonner";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

interface RefundRequest {
  id: string;
  paymentId: string;
  customer: string;
  customerEmail: string;
  course: string;
  courseAr: string;
  gateway: string | null;
  originalAmount: number;
  refundAmount: number;
  deductionAmount: number;
  deductionReason: string | null;
  reason: string;
  reasonNote: string | null;
  date: string;
  status: string;
  approvedAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
  processedBy: string | null;
}

const REASON_LABELS: Record<string, { en: string; ar: string }> = {
  policy: { en: "Policy Request", ar: "طلب سياسة" },
  cancelled: { en: "Course Cancelled", ar: "دورة ملغاة" },
  duplicate: { en: "Duplicate Payment", ar: "دفع مكرر" },
  technical: { en: "Technical Error", ar: "خطأ تقني" },
  other: { en: "Other", ar: "أخرى" },
};

const RefundsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = useFinanceProfile();

  // Filter state
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Data state
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [refundRateData, setRefundRateData] = useState<any>(null);
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    processed: 0,
  });

  // Rejection modal state
  const [rejectingRefundId, setRejectingRefundId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectionError, setRejectionError] = useState(false);

  // Detail modal state
  const [detailRefund, setDetailRefund] = useState<RefundRequest | null>(null);

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);

  const mapStatus = (status: string): string => {
    if (status === "processing" || status === "completed") return "processed";
    return status;
  };

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        // Map tab value to backend status filter
        let backendStatus: string | undefined;
        if (activeTab === "processed") {
          backendStatus = undefined; // We'll filter client-side for processed+completed
        } else {
          backendStatus = activeTab;
        }

        const [refundsRes, rateRes] = await Promise.all([
          refundApi.getAll(page, 10, {
            status: activeTab === "processed" ? undefined : activeTab,
            search: searchQuery || undefined,
          }),
          financeApi.getRefundRate(),
        ]);

        const mapped: RefundRequest[] = (refundsRes.data || []).map(
          (r: any) => ({
            id: r.id,
            paymentId: r.paymentId,
            customer: r.requesterName || "-",
            customerEmail: r.requesterEmail || "-",
            course: r.courseTitle || "-",
            courseAr: r.courseTitleAr || r.courseTitle || "-",
            gateway: r.gateway || null,
            originalAmount: Number(r.originalAmount),
            refundAmount: Number(r.refundAmount),
            deductionAmount: Number(r.deductionAmount || 0),
            deductionReason: r.deductionReason || null,
            reason: r.reason || "-",
            reasonNote: r.reasonNote || null,
            date: r.createdAt,
            status: r.status,
            approvedAt: r.approvedAt || null,
            completedAt: r.completedAt || null,
            rejectedAt: r.rejectedAt || null,
            rejectionNote: r.rejectionNote || null,
            processedBy: r.processedBy || null,
          }),
        );

        // For "processed" tab, filter client-side for processing+completed
        const filtered =
          activeTab === "processed"
            ? mapped.filter(
                (r) => r.status === "processing" || r.status === "completed",
              )
            : mapped;

        setRefunds(filtered);
        setTotalPages(refundsRes.pagination?.totalPages || 1);
        setTotal(refundsRes.pagination?.total || 0);
        setRefundRateData(rateRes);

        // Fetch counts for all tabs (separate lightweight calls)
        if (!silent) {
          const [pendingRes, approvedRes, rejectedRes, allRes] =
            await Promise.all([
              refundApi.getAll(1, 1, { status: "pending" }),
              refundApi.getAll(1, 1, { status: "approved" }),
              refundApi.getAll(1, 1, { status: "rejected" }),
              refundApi.getAll(1, 1),
            ]);
          const totalAll = allRes.pagination?.total || 0;
          const pCount = pendingRes.pagination?.total || 0;
          const aCount = approvedRes.pagination?.total || 0;
          const rCount = rejectedRes.pagination?.total || 0;
          setStatusCounts({
            pending: pCount,
            approved: aCount,
            rejected: rCount,
            processed: totalAll - pCount - aCount - rCount,
          });
        }
      } catch {
        // Fallback to empty
      } finally {
        setLoading(false);
      }
    },
    [activeTab, page, searchQuery],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when tab or search changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const handleSearchChange = (value: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
      setPage(1);
    }, 300);
  };

  const getReasonLabel = (reason: string) => {
    const labels = REASON_LABELS[reason];
    if (!labels) return reason;
    return locale === "ar" ? labels.ar : labels.en;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatAmount = (amount: number) =>
    `${t("kpi.sar")} ${amount.toLocaleString()}`;

  const stats = [
    {
      label: t("refundsPage.stats.totalRefunds"),
      value: `${t("kpi.sar")} ${refundRateData?.refundedAmount?.toLocaleString() || "0"}`,
      icon: DollarSign,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#EA580C]",
    },
    {
      label: t("refundsPage.stats.pendingRefunds"),
      value: statusCounts.pending.toString(),
      icon: Clock,
      iconBg: "bg-[#FEF9C3]",
      iconColor: "text-[#CA8A04]",
    },
    {
      label: t("refundsPage.stats.approvedRefunds"),
      value: statusCounts.approved.toString(),
      icon: CheckCircle,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: t("refundsPage.stats.refundRate"),
      value: `${refundRateData?.refundRate || "0"}%`,
      icon: BarChart3,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
  ];

  const tabs = [
    {
      key: "pending",
      label: t("refundsPage.tabs.pending"),
      count: statusCounts.pending,
    },
    {
      key: "approved",
      label: t("refundsPage.tabs.approved"),
      count: statusCounts.approved,
    },
    {
      key: "rejected",
      label: t("refundsPage.tabs.rejected"),
      count: statusCounts.rejected,
    },
    {
      key: "processed",
      label: t("refundsPage.tabs.processed"),
      count: statusCounts.processed,
    },
  ];

  const statusStyles: Record<string, string> = {
    pending: "bg-[#FEF9C3] text-[#CA8A04]",
    approved: "bg-[#DCFCE7] text-[#16A34A]",
    rejected: "bg-[#FEE2E2] text-[#DC2626]",
    processing: "bg-[#DBEAFE] text-[#2563EB]",
    completed: "bg-[#D1FAE5] text-[#065F46]",
  };

  const statusLabels: Record<string, string> = {
    pending: t("refundsPage.tabs.pending"),
    approved: t("refundsPage.tabs.approved"),
    rejected: t("refundsPage.tabs.rejected"),
    processing: t("refundsPage.statusLabels.processing"),
    completed: t("refundsPage.statusLabels.completed"),
  };

  const handleApprove = async (refundId: string) => {
    setProcessing(refundId);
    try {
      await refundApi.approve(refundId);
      toast.success(
        t("refundsPage.approveSuccess") || "Refund approved successfully",
      );
      await fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve refund",
      );
    }
    setProcessing(null);
  };

  const handleReject = (refundId: string) => {
    setRejectingRefundId(refundId);
    setRejectionNote("");
    setRejectionError(false);
  };

  const handleConfirmReject = async () => {
    if (!rejectingRefundId) return;
    if (!rejectionNote.trim()) {
      setRejectionError(true);
      return;
    }
    setRejecting(true);
    try {
      await refundApi.reject(rejectingRefundId, rejectionNote);
      toast.success(t("refundsPage.rejectSuccess") || "Refund rejected");
      setRejectingRefundId(null);
      setRejectionNote("");
      await fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reject refund",
      );
    }
    setRejecting(false);
  };

  const handleExportCsv = async () => {
    setShowExportMenu(false);
    try {
      await financeApi.exportCsv({ status: "refunded" });
      toast.success(t("refundsPage.exportSuccess") || "Export started");
    } catch {
      toast.error(t("refundsPage.exportError") || "Export failed");
    }
  };

  const handleExportPdf = async () => {
    setShowExportMenu(false);
    try {
      await financeApi.exportPdf({ status: "refunded" });
      toast.success(t("refundsPage.exportSuccess") || "Export started");
    } catch {
      toast.error(t("refundsPage.exportError") || "Export failed");
    }
  };

  return (
    <>
      <FinanceNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>

            <FinanceMobileSidebar profile={profile} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("refundsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("refundsPage.subtitle")}
                  </p>
                </div>
                {/* Export Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors"
                  >
                    <FileDown className="w-4 h-4" />
                    {t("refundsPage.export") || "Export"}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-1 w-44 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg z-10">
                      <button
                        onClick={handleExportCsv}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        {t("paymentsTable.exportCsv") || "Export CSV"}
                      </button>
                      <button
                        onClick={handleExportPdf}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
                      >
                        <FileDown className="w-4 h-4" />
                        {t("paymentsTable.exportPdf") || "Export PDF"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={index}
                      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3"
                    >
                      <div
                        className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                          {stat.label}
                        </p>
                        <p className="text-xl font-bold text-[var(--color-text-primary)]">
                          {loading ? "..." : stat.value}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Deduction Rules */}
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-[#D97706]" />
                  <h4 className="text-sm font-semibold text-[#92400E]">
                    {t("refundsPage.deductionRules")}
                  </h4>
                </div>
                <ul className="space-y-1 text-[13px] text-[#92400E]">
                  <li>
                    {t("refundsPage.tamaraRule") ||
                      "Tamara BNPL: 10% processing fee deducted automatically"}
                  </li>
                  <li>
                    {t("refundsPage.tabbyRule") ||
                      "Tabby BNPL: Processing fee deducted per merchant agreement"}
                  </li>
                </ul>
              </div>

              {/* Main Card */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                {/* Tabs + Search */}
                <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex gap-1 bg-[var(--color-surface-page)] rounded-lg p-0.5 w-fit">
                      {tabs.map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2 ${
                            activeTab === tab.key
                              ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          {tab.label}
                          <span
                            className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                              activeTab === tab.key
                                ? "bg-[var(--color-primary)] text-white"
                                : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                            }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                      <input
                        type="text"
                        placeholder={
                          t("refundsPage.searchPlaceholder") ||
                          "Search by name, email, or course..."
                        }
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-lg w-full sm:w-64 focus:outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Refund Items */}
                <div className="p-5 space-y-4">
                  {loading && refunds.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-[#B8860B] animate-spin" />
                    </div>
                  ) : refunds.length === 0 ? (
                    <p className="text-center text-[var(--color-text-secondary)] py-8">
                      {t("refundsPage.noRefunds") || "No refunds found"}
                    </p>
                  ) : (
                    refunds.map((refund) => (
                      <div
                        key={refund.id}
                        className="p-4 bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)]"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#FFEDD5] flex items-center justify-center flex-shrink-0">
                              <RotateCcw className="w-4 h-4 text-[#EA580C]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                {refund.customer}
                              </p>
                              <p className="text-[12px] text-[var(--color-text-secondary)]">
                                {locale === "ar" ? refund.courseAr : refund.course}{" "}
                                &middot; {getReasonLabel(refund.reason)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div
                              className={`${isRTL ? "text-left" : "text-right"}`}
                            >
                              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {formatAmount(refund.refundAmount)}
                              </p>
                              {refund.deductionAmount > 0 && (
                                <p className="text-[11px] text-[var(--color-text-secondary)] line-through">
                                  {formatAmount(refund.originalAmount)}
                                </p>
                              )}
                            </div>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[refund.status] || "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"}`}
                            >
                              {statusLabels[refund.status] || refund.status}
                            </span>
                          </div>
                        </div>

                        {/* Deduction + Date + Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px] text-[var(--color-text-secondary)]">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span>{formatDate(refund.date)}</span>
                            {refund.gateway && (
                              <span className="px-1.5 py-0.5 bg-[var(--color-surface-page)] rounded text-[11px] font-medium uppercase">
                                {refund.gateway}
                              </span>
                            )}
                            {refund.deductionAmount > 0 && (
                              <span className="flex items-center gap-1 text-[#D97706]">
                                <AlertCircle className="w-3 h-3" />
                                {refund.deductionReason ||
                                  formatAmount(refund.deductionAmount)}
                              </span>
                            )}
                            {refund.rejectionNote && (
                              <span className="flex items-center gap-1 text-[#DC2626]">
                                <MessageSquare className="w-3 h-3" />
                                {refund.rejectionNote}
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {/* View detail */}
                            <button
                              onClick={() => setDetailRefund(refund)}
                              className="flex items-center gap-1 px-3 py-1.5 text-[var(--color-text-primary)] text-[12px] font-medium rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-page)] transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                              {t("refundsPage.viewDetail") || "View"}
                            </button>

                            {/* Actions for pending */}
                            {refund.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleApprove(refund.id)}
                                  disabled={processing === refund.id}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-[#16A34A] text-white text-[12px] font-medium rounded-md hover:bg-[#15803D] transition-colors disabled:opacity-50"
                                >
                                  {processing === refund.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  {t("refundsQueue.approve")}
                                </button>
                                <button
                                  onClick={() => handleReject(refund.id)}
                                  disabled={processing === refund.id}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-surface-card)] text-[#DC2626] text-[12px] font-medium rounded-md border border-[#FEE2E2] hover:bg-[#FEE2E2] transition-colors disabled:opacity-50"
                                >
                                  <X className="w-3 h-3" />
                                  {t("refundsQueue.reject")}
                                </button>
                              </>
                            )}

                            {/* Retry for approved (gateway failed) */}
                            {refund.status === "approved" && (
                              <button
                                onClick={() => handleApprove(refund.id)}
                                disabled={processing === refund.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#2563EB] text-white text-[12px] font-medium rounded-md hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
                              >
                                {processing === refund.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                {t("refundsPage.retryGateway") || "Retry Gateway"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border-subtle)]">
                    <p className="text-[12px] text-[var(--color-text-secondary)]">
                      {t("refundsPage.showing") || "Showing"} {refunds.length}{" "}
                      {t("refundsPage.of") || "of"} {total}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="p-1.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-page)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isRTL ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronLeft className="w-4 h-4" />
                        )}
                      </button>
                      <span className="text-sm text-[var(--color-text-primary)] px-2">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page >= totalPages}
                        className="p-1.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-page)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isRTL ? (
                          <ChevronLeft className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectingRefundId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setRejectingRefundId(null);
            setRejectionNote("");
            setRejectionError(false);
          }}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
              {t("refundsPage.rejectTitle") || "Reject Refund"}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {t("refundsPage.rejectionNoteLabel") ||
                "Provide a reason for rejecting this refund request."}
            </p>
            <textarea
              value={rejectionNote}
              onChange={(e) => {
                setRejectionNote(e.target.value);
                if (e.target.value.trim()) setRejectionError(false);
              }}
              placeholder={
                t("refundsPage.notePlaceholder") ||
                "Enter rejection reason or notes..."
              }
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none resize-none ${
                rejectionError
                  ? "border-[#DC2626] focus:border-[#DC2626]"
                  : "border-[var(--color-border)] focus:border-[var(--color-primary)]"
              }`}
            />
            {rejectionError && (
              <p className="text-[12px] text-[#DC2626] mt-1">
                {t("refundsPage.noteRequired") ||
                  "Rejection reason is required"}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setRejectingRefundId(null);
                  setRejectionNote("");
                  setRejectionError(false);
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors"
              >
                {t("refundsPage.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejecting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
              >
                {rejecting && <Loader2 className="w-3 h-3 animate-spin" />}
                {t("refundsQueue.reject")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailRefund && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDetailRefund(null)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {t("refundsPage.detailTitle") || "Refund Details"}
              </h3>
              <button
                onClick={() => setDetailRefund(null)}
                className="p-1 rounded-md hover:bg-[var(--color-surface-page)]"
              >
                <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </button>
            </div>

            <dl className="space-y-3">
              <div className="flex justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <dt className="text-sm text-[var(--color-text-secondary)]">
                  {t("refundsPage.detail.refundId") || "Refund ID"}
                </dt>
                <dd className="text-sm font-mono text-[var(--color-text-primary)]">
                  {detailRefund.id.slice(0, 8)}...
                </dd>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <dt className="text-sm text-[var(--color-text-secondary)]">
                  {t("refundsPage.detail.requester") || "Requester"}
                </dt>
                <dd className="text-sm text-[var(--color-text-primary)]">
                  {detailRefund.customer}
                  <span className="block text-[11px] text-[var(--color-text-secondary)]">
                    {detailRefund.customerEmail}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <dt className="text-sm text-[var(--color-text-secondary)]">
                  {t("refundsPage.detail.course") || "Course"}
                </dt>
                <dd className="text-sm text-[var(--color-text-primary)]">
                  {locale === "ar" ? detailRefund.courseAr : detailRefund.course}
                </dd>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <dt className="text-sm text-[var(--color-text-secondary)]">
                  {t("refundsPage.detail.reason") || "Reason"}
                </dt>
                <dd className="text-sm text-[var(--color-text-primary)]">
                  {getReasonLabel(detailRefund.reason)}
                  {detailRefund.reasonNote && (
                    <span className="block text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                      {detailRefund.reasonNote}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <dt className="text-sm text-[var(--color-text-secondary)]">
                  {t("refundsPage.detail.originalAmount") || "Original Amount"}
                </dt>
                <dd className="text-sm text-[var(--color-text-primary)]">
                  {formatAmount(detailRefund.originalAmount)}
                </dd>
              </div>
              {detailRefund.deductionAmount > 0 && (
                <div className="flex justify-between py-2 border-b border-[var(--color-border-subtle)]">
                  <dt className="text-sm text-[#D97706]">
                    {t("refundsPage.detail.deduction") || "Deduction"}
                  </dt>
                  <dd className="text-sm text-[#D97706]">
                    -{formatAmount(detailRefund.deductionAmount)}
                    {detailRefund.deductionReason && (
                      <span className="block text-[11px]">
                        {detailRefund.deductionReason}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <dt className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {t("refundsPage.detail.refundAmount") || "Refund Amount"}
                </dt>
                <dd className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {formatAmount(detailRefund.refundAmount)}
                </dd>
              </div>
              {detailRefund.gateway && (
                <div className="flex justify-between py-2 border-b border-[var(--color-border-subtle)]">
                  <dt className="text-sm text-[var(--color-text-secondary)]">
                    {t("refundsPage.detail.gateway") || "Gateway"}
                  </dt>
                  <dd className="text-sm text-[var(--color-text-primary)] uppercase">
                    {detailRefund.gateway}
                  </dd>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <dt className="text-sm text-[var(--color-text-secondary)]">
                  {t("refundsPage.detail.status") || "Status"}
                </dt>
                <dd>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[detailRefund.status] || "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"}`}
                  >
                    {statusLabels[detailRefund.status] || detailRefund.status}
                  </span>
                </dd>
              </div>

              {/* Audit Timeline */}
              <div className="pt-3">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  {t("refundsPage.detail.timeline") || "Timeline"}
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[12px]">
                    <div className="w-2 h-2 rounded-full bg-[#CA8A04]" />
                    <span className="text-[var(--color-text-secondary)]">
                      {t("refundsPage.detail.requested") || "Requested"}:
                    </span>
                    <span className="text-[var(--color-text-primary)]">
                      {formatDate(detailRefund.date)}
                    </span>
                  </div>
                  {detailRefund.approvedAt && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
                      <span className="text-[var(--color-text-secondary)]">
                        {t("refundsPage.detail.approvedAt") || "Approved"}:
                      </span>
                      <span className="text-[var(--color-text-primary)]">
                        {formatDate(detailRefund.approvedAt)}
                      </span>
                    </div>
                  )}
                  {detailRefund.completedAt && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <div className="w-2 h-2 rounded-full bg-[#065F46]" />
                      <span className="text-[var(--color-text-secondary)]">
                        {t("refundsPage.detail.completedAt") || "Completed"}:
                      </span>
                      <span className="text-[var(--color-text-primary)]">
                        {formatDate(detailRefund.completedAt)}
                      </span>
                    </div>
                  )}
                  {detailRefund.rejectedAt && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <div className="w-2 h-2 rounded-full bg-[#DC2626]" />
                      <span className="text-[var(--color-text-secondary)]">
                        {t("refundsPage.detail.rejectedAt") || "Rejected"}:
                      </span>
                      <span className="text-[var(--color-text-primary)]">
                        {formatDate(detailRefund.rejectedAt)}
                      </span>
                    </div>
                  )}
                  {detailRefund.rejectionNote && (
                    <div className="mt-2 p-2 bg-[#FEF2F2] rounded-lg text-[12px] text-[#991B1B]">
                      <span className="font-medium">
                        {t("refundsPage.detail.rejectionReason") ||
                          "Rejection Reason"}
                        :
                      </span>{" "}
                      {detailRefund.rejectionNote}
                    </div>
                  )}
                </div>
              </div>
            </dl>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setDetailRefund(null)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors"
              >
                {t("refundsPage.close") || "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RefundsContent;
