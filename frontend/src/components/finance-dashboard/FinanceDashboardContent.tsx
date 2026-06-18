"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import FinanceKPICards from "./FinanceKPICards";
import RevenueSummaryWidget from "./RevenueSummaryWidget";
import PaymentsInvoicesTable from "./PaymentsInvoicesTable";
import RefundsQueueWidget from "./RefundsQueueWidget";
import FinanceRightSidebar from "./FinanceRightSidebar";
import DateRangeFilter from "./DateRangeFilter";
import {
  financeApi,
  paymentApi,
  refundApi,
  discountApi,
  financeBankTransferApi,
} from "@/lib/api";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

function getDefaultDateRange() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return { startDate: start.toISOString().slice(0, 10), endDate: todayStr, label: "30d" };
}

const FinanceDashboardContent = () => {
  const t = useTranslations("financeDashboard");
  const profile = useFinanceProfile();
  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string; label: string }>(getDefaultDateRange);

  const [kpiData, setKpiData] = useState({
    revenueMTD: 0,
    revenueTrend: 0,
    netRevenue: 0,
    avgOrderValue: 0,
    avgOrderTrend: 0,
    pendingInvoices: 0,
    pendingInvoicesAmount: 0,
    refundRate: 0,
    refundRateTrend: 0,
    totalTransactions: 0,
    totalTransactionsPeriod: "",
  });

  const [revenueData, setRevenueData] = useState({
    gateways: [] as { name: string; percentage: number; color: string }[],
    topCourses: [] as { name: string; revenue: string }[],
  });

  const [transactions, setTransactions] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [transactionFeed, setTransactionFeed] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [pendingRefundCount, setPendingRefundCount] = useState(0);
  const [pendingBankTransferCount, setPendingBankTransferCount] = useState(0);

  const fetchAll = useCallback(async () => {
    try {
      const [
        summaryRes,
        revenueRes,
        paymentsRes,
        refundsRes,
        refundRateRes,
        discountsRes,
        topCoursesRes,
        bankTransferQueueRes,
      ] = await Promise.allSettled([
        financeApi.getSummary({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        financeApi.getRevenueBySource({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        paymentApi.getAll(1, 5),
        refundApi.getAll(1, 3),
        financeApi.getRefundRate({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        discountApi.getAll(1, 4),
        financeApi.getTopCourses({ limit: 5, startDate: dateRange.startDate, endDate: dateRange.endDate }),
        // Cheap 1-row query just to read pagination.total for the sidebar badge.
        financeBankTransferApi.listQueue({ status: "pending", page: 1, limit: 1 }),
      ]);

      if (bankTransferQueueRes.status === "fulfilled") {
        setPendingBankTransferCount(
          bankTransferQueueRes.value?.pagination?.total ?? 0,
        );
      }

        // KPI Data
        if (summaryRes.status === "fulfilled") {
          const s = summaryRes.value;
          setKpiData({
            revenueMTD: s.totalRevenue || 0,
            revenueTrend: s.revenueTrend || 0,
            netRevenue: s.netRevenue || 0,
            avgOrderValue: s.averageOrderValue || 0,
            avgOrderTrend: s.avgOrderTrend || 0,
            pendingInvoices: s.pendingPayments || 0,
            pendingInvoicesAmount: s.pendingAmount || 0,
            refundRate: 0,
            refundRateTrend: s.refundRateTrend || 0,
            totalTransactions: s.totalPayments || 0,
            totalTransactionsPeriod: t("kpi.thisMonth"),
          });
        }

        // Refund rate
        if (refundRateRes.status === "fulfilled") {
          setKpiData((prev) => ({
            ...prev,
            refundRate: parseFloat(refundRateRes.value?.refundRate || "0"),
          }));
        }

        // Revenue by source
        if (revenueRes.status === "fulfilled") {
          const sources = revenueRes.value || [];
          const total = sources.reduce((sum: number, s: any) => sum + (s.totalRevenue || 0), 0);
          const gatewayColors: Record<string, string> = {
            moyasar: "bg-[#8B5CF6]",
            tamara: "bg-[#22C55E]",
            tabby: "bg-[#F59E0B]",
            bank_transfer: "bg-[#4338CA]",
            mock: "bg-[#6B7280]",
          };
          setRevenueData((prev) => ({
            ...prev,
            gateways: sources.map((s: any) => ({
              name: s.gateway?.charAt(0).toUpperCase() + s.gateway?.slice(1) || "-",
              percentage: total > 0 ? Math.round((s.totalRevenue / total) * 100) : 0,
              color: gatewayColors[s.gateway] || "bg-[#6B7280]",
            })),
          }));
        }

        // Recent transactions
        if (paymentsRes.status === "fulfilled") {
          const mapped = (paymentsRes.value?.data || []).map((p: any) => ({
            id: p.id,
            invoiceNumber: p.invoiceNumber || p.id.slice(0, 13).toUpperCase(),
            invoiceId: p.invoiceId || null,
            date: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            customer: p.userName || p.userEmail || "-",
            course: p.courseTitle || "-",
            amount: `${t("kpi.sar")} ${Number(p.amount).toLocaleString()}`,
            gateway: (p.gateway || "").charAt(0).toUpperCase() + (p.gateway || "").slice(1) as any,
            status: p.status as any,
            errorCode: p.errorCode || null,
            failureReason: p.failureReason || null,
            gatewayChargeId: p.gatewayChargeId || null,
            paymentMethod: p.paymentMethod || null,
          }));
          setTransactions(mapped);

          // Transaction feed from recent payments
          setTransactionFeed(
            (paymentsRes.value?.data || []).slice(0, 4).map((p: any) => ({
              id: p.id,
              customer: p.userName || p.userEmail || "-",
              type: p.status === "paid" ? "income" : p.status === "refunded" ? "refund" : "failed",
              amount: `${t("kpi.sar")} ${Number(p.amount).toLocaleString()}`,
              time: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            }))
          );
        }

        // Refunds queue
        if (refundsRes.status === "fulfilled") {
          const pendingRefunds = (refundsRes.value?.data || []).filter((r: any) => r.status === "pending");
          setPendingRefundCount(pendingRefunds.length);
          setRefunds(
            pendingRefunds.slice(0, 3).map((r: any) => ({
              id: r.id,
              customer: r.requesterName || r.requesterEmail || "-",
              course: r.courseTitle || "-",
              originalAmount: `${t("kpi.sar")} ${Number(r.originalAmount).toLocaleString()}`,
              refundAmount: `${t("kpi.sar")} ${Number(r.refundAmount).toLocaleString()}`,
              reason: r.reason || "-",
              deduction: Number(r.deductionAmount) > 0 ? t("refundsQueue.deduction", { amount: `${t("kpi.sar")} ${Number(r.deductionAmount).toLocaleString()}` }) : undefined,
            }))
          );
        }

        // Alerts
        const alertsList = [];
        if (summaryRes.status === "fulfilled") {
          const s = summaryRes.value;
          if (s.failedPayments > 0) {
            alertsList.push({
              id: "1",
              type: "error" as const,
              title: t("financialAlerts.failedPayments", { count: s.failedPayments }),
              description: t("financialAlerts.failedPaymentsDesc"),
            });
          }
          if (s.pendingPayments > 0) {
            alertsList.push({
              id: "2",
              type: "warning" as const,
              title: t("financialAlerts.pendingInvoices", { count: s.pendingPayments }),
              description: t("financialAlerts.pendingInvoicesDesc", { amount: s.pendingAmount?.toLocaleString() || "0" }),
            });
          }
        }
        setAlerts(alertsList);

        // Top courses
        if (topCoursesRes.status === "fulfilled") {
          setRevenueData((prev) => ({
            ...prev,
            topCourses: (topCoursesRes.value || []).map((c: any) => ({
              name: c.title || "-",
              revenue: `${t("kpi.sar")} ${Number(c.revenue).toLocaleString()}`,
            })),
          }));
        }

        // Coupons
        if (discountsRes.status === "fulfilled") {
          setCoupons(
            (discountsRes.value?.data || []).slice(0, 4).map((d: any) => ({
              id: d.id,
              code: d.code,
              discount: d.type === "percentage" ? t("discounts.off", { amount: Number(d.value) }) : t("discounts.fixedOff", { amount: Number(d.value) }),
              used: d.currentUses || 0,
              limit: d.maxUses || 0,
              status: d.isActive ? "active" : "expired",
            }))
          );
        }
    } catch {
      // Keep empty state on error
    }
  }, [t, dateRange]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refund action handlers
  const [rejectingRefundId, setRejectingRefundId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const handleApproveRefund = async (refundId: string) => {
    try {
      await refundApi.approve(refundId);
      toast.success(t("refundsQueue.approveSuccess") || "Refund approved successfully");
      // Remove from local list immediately
      setRefunds((prev) => prev.filter((r) => r.id !== refundId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve refund");
    }
  };

  const handleRejectRefund = (refundId: string) => {
    setRejectingRefundId(refundId);
    setRejectionNote("");
  };

  const handleConfirmReject = async () => {
    if (!rejectingRefundId) return;
    setRejecting(true);
    try {
      await refundApi.reject(rejectingRefundId, rejectionNote);
      toast.success(t("refundsQueue.rejectSuccess") || "Refund rejected");
      setRefunds((prev) => prev.filter((r) => r.id !== rejectingRefundId));
      setRejectingRefundId(null);
      setRejectionNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject refund");
    }
    setRejecting(false);
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <FinanceNavbar profile={profile} />

      {/* Main Container */}
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar
                profile={profile}
                pendingRefundCount={pendingRefundCount}
                pendingBankTransferCount={pendingBankTransferCount}
              />
            </div>

            {/* Mobile Sidebar */}
            <FinanceMobileSidebar
              profile={profile}
              pendingRefundCount={pendingRefundCount}
              pendingBankTransferCount={pendingBankTransferCount}
            />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("subtitle", {
                      name: profile.name.split(" ")[0],
                    })}
                  </p>
                </div>
                <DateRangeFilter onChange={setDateRange} defaultPreset="30d" />
              </div>

              {/* KPI Cards */}
              <FinanceKPICards data={{ ...kpiData, totalTransactionsPeriod: t("kpi.thisMonth") }} />

              {/* Revenue Summary + Refunds Queue */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <div className="lg:col-span-3">
                  <RevenueSummaryWidget
                    data={revenueData}
                    summaryData={{ totalRevenue: kpiData.revenueMTD, averageOrderValue: kpiData.avgOrderValue }}
                    dateRange={dateRange}
                  />
                </div>
                <div className="lg:col-span-2">
                  <RefundsQueueWidget refunds={refunds} onApprove={handleApproveRefund} onReject={handleRejectRefund} />
                </div>
              </div>

              {/* Payments & Invoices Table */}
              <PaymentsInvoicesTable transactions={transactions} />
            </div>

            {/* Right Sidebar */}
            <FinanceRightSidebar
              transactions={transactionFeed}
              alerts={alerts}
              coupons={coupons}
            />
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectingRefundId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
              {t("refundsPage.rejectTitle") || "Reject Refund"}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {t("refundsPage.rejectionNoteLabel") || "Provide a reason for rejecting this refund request."}
            </p>
            <textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder={t("refundsPage.notePlaceholder") || "Enter rejection reason or notes..."}
              rows={3}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setRejectingRefundId(null); setRejectionNote(""); }}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors"
              >
                {t("refundsPage.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejecting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
              >
                {t("refundsQueue.reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FinanceDashboardContent;
