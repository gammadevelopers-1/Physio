"use client";

import { useState, useEffect, useCallback } from "react";
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
  XCircle,
  AlertCircle,
  MessageSquare,
  DollarSign,
  BarChart3,
  Loader2,
} from "lucide-react";
import { refundApi, financeApi } from "@/lib/api";
import { toast } from "sonner";

const mockProfile = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

interface RefundRequest {
  id: string;
  customer: string;
  course: string;
  originalAmount: string;
  refundAmount: string;
  reason: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  deduction?: string;
  note?: string;
}

const RefundsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = { ...mockProfile, name: t("names.noraAlFahad") };
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [refundRateData, setRefundRateData] = useState<any>(null);

  // Rejection modal state
  const [rejectingRefundId, setRejectingRefundId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [refundsRes, rateRes] = await Promise.all([
        refundApi.getAll(1, 50),
        financeApi.getRefundRate(),
      ]);

      const mapped: RefundRequest[] = (refundsRes.data || []).map((r: any) => ({
        id: r.id,
        customer: r.requesterName || r.requesterEmail || "-",
        course: r.courseTitle || "-",
        originalAmount: `${t("kpi.sar")} ${Number(r.originalAmount).toLocaleString()}`,
        refundAmount: `${t("kpi.sar")} ${Number(r.refundAmount).toLocaleString()}`,
        reason: r.reason || "-",
        date: new Date(r.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: r.status as RefundRequest["status"],
        deduction: Number(r.deductionAmount) > 0 ? `${t("kpi.sar")} ${Number(r.deductionAmount).toLocaleString()}` : undefined,
        note: r.rejectionNote || r.reasonNote || undefined,
      }));

      setRefunds(mapped);
      setRefundRateData(rateRes);
    } catch {
      // Fallback to empty
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pendingCount = refunds.filter((r) => r.status === "pending").length;
  const approvedCount = refunds.filter((r) => r.status === "approved").length;
  const rejectedCount = refunds.filter((r) => r.status === "rejected").length;

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
      value: pendingCount.toString(),
      icon: Clock,
      iconBg: "bg-[#FEF9C3]",
      iconColor: "text-[#CA8A04]",
    },
    {
      label: t("refundsPage.stats.approvedRefunds"),
      value: approvedCount.toString(),
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
    { key: "pending", label: t("refundsPage.tabs.pending"), count: pendingCount },
    { key: "approved", label: t("refundsPage.tabs.approved"), count: approvedCount },
    { key: "rejected", label: t("refundsPage.tabs.rejected"), count: rejectedCount },
  ];

  const filteredRefunds = refunds.filter((r) => r.status === activeTab);

  const statusStyles: Record<string, string> = {
    pending: "bg-[#FEF9C3] text-[#CA8A04]",
    approved: "bg-[#DCFCE7] text-[#16A34A]",
    rejected: "bg-[#FEE2E2] text-[#DC2626]",
  };

  const handleApprove = async (refundId: string) => {
    setProcessing(refundId);
    try {
      await refundApi.approve(refundId);
      toast.success(t("refundsPage.approveSuccess") || "Refund approved successfully");
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve refund");
    }
    setProcessing(null);
  };

  const handleReject = (refundId: string) => {
    setRejectingRefundId(refundId);
    setRejectionNote("");
  };

  const handleConfirmReject = async () => {
    if (!rejectingRefundId) return;
    setRejecting(true);
    try {
      await refundApi.reject(rejectingRefundId, rejectionNote);
      toast.success(t("refundsPage.rejectSuccess") || "Refund rejected");
      setRejectingRefundId(null);
      setRejectionNote("");
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject refund");
    }
    setRejecting(false);
  };

  return (
    <>
      <FinanceNavbar profile={profile} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>

            <FinanceMobileSidebar profile={profile} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("refundsPage.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("refundsPage.subtitle")}
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div key={index} className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-start gap-3">
                      <div className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280] font-medium">{stat.label}</p>
                        <p className="text-xl font-bold text-[#111827]">{loading ? "..." : stat.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Deduction Rules */}
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-[#D97706]" />
                  <h4 className="text-sm font-semibold text-[#92400E]">{t("refundsPage.deductionRules")}</h4>
                </div>
                <ul className="space-y-1 text-[13px] text-[#92400E]">
                  <li>{t("refundsPage.bnplFees", { percent: "10" })}</li>
                </ul>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <div className="flex gap-1 bg-[#F3F4F6] rounded-lg p-0.5 w-fit">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2 ${
                          activeTab === tab.key
                            ? "bg-white text-[#111827] shadow-sm"
                            : "text-[#6B7280] hover:text-[#374151]"
                        }`}
                      >
                        {tab.label}
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                          activeTab === tab.key
                            ? "bg-[#a37f49] text-white"
                            : "bg-[#E5E7EB] text-[#6B7280]"
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Refund Items */}
                <div className="p-5 space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-[#B8860B] animate-spin" />
                    </div>
                  ) : filteredRefunds.length === 0 ? (
                    <p className="text-center text-[#6B7280] py-8">{t("refundsPage.noRefunds") || "No refunds found"}</p>
                  ) : (
                    filteredRefunds.map((refund) => (
                      <div key={refund.id} className="p-4 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#FFEDD5] flex items-center justify-center flex-shrink-0">
                              <RotateCcw className="w-4 h-4 text-[#EA580C]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#111827]">{refund.customer}</p>
                              <p className="text-[12px] text-[#6B7280]">{refund.course} - {refund.reason}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`${isRTL ? "text-left" : "text-right"}`}>
                              <p className="text-sm font-semibold text-[#111827]">{refund.refundAmount}</p>
                              {refund.originalAmount !== refund.refundAmount && (
                                <p className="text-[11px] text-[#9CA3AF] line-through">{refund.originalAmount}</p>
                              )}
                            </div>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[refund.status]}`}>
                              {t(`refundsPage.tabs.${refund.status}`)}
                            </span>
                          </div>
                        </div>

                        {/* Deduction + Date */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px] text-[#6B7280]">
                          <div className="flex items-center gap-3">
                            <span>{refund.date}</span>
                            {refund.deduction && (
                              <span className="flex items-center gap-1 text-[#D97706]">
                                <AlertCircle className="w-3 h-3" />
                                {refund.deduction}
                              </span>
                            )}
                            {refund.note && (
                              <span className="flex items-center gap-1 text-[#DC2626]">
                                <MessageSquare className="w-3 h-3" />
                                {refund.note}
                              </span>
                            )}
                          </div>

                          {/* Actions for pending */}
                          {refund.status === "pending" && (
                            <div className="flex gap-2">
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
                                className="flex items-center gap-1 px-3 py-1.5 bg-white text-[#DC2626] text-[12px] font-medium rounded-md border border-[#FEE2E2] hover:bg-[#FEE2E2] transition-colors disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                {t("refundsQueue.reject")}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectingRefundId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-[#111827] mb-1">
              {t("refundsPage.rejectTitle") || "Reject Refund"}
            </h3>
            <p className="text-sm text-[#6B7280] mb-4">
              {t("refundsPage.rejectionNoteLabel") || "Provide a reason for rejecting this refund request."}
            </p>
            <textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder={t("refundsPage.notePlaceholder") || "Enter rejection reason or notes..."}
              rows={3}
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:border-[#a37f49] resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setRejectingRefundId(null); setRejectionNote(""); }}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
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
    </>
  );
};

export default RefundsContent;
