"use client";

import { useState, useEffect } from "react";
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
import { financeApi, paymentApi, refundApi, discountApi } from "@/lib/api";

// Mock Finance Profile
const mockProfile = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

const FinanceDashboardContent = () => {
  const t = useTranslations("financeDashboard");

  const profile = { ...mockProfile, name: t("names.noraAlFahad") };

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

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [summaryRes, revenueRes, paymentsRes, refundsRes, refundRateRes, discountsRes] = await Promise.allSettled([
          financeApi.getSummary(),
          financeApi.getRevenueBySource(),
          paymentApi.getAll(1, 5),
          refundApi.getAll(1, 3),
          financeApi.getRefundRate(),
          discountApi.getAll(1, 4),
        ]);

        // KPI Data
        if (summaryRes.status === "fulfilled") {
          const s = summaryRes.value;
          setKpiData({
            revenueMTD: s.totalRevenue || 0,
            revenueTrend: 0,
            netRevenue: s.netRevenue || 0,
            avgOrderValue: s.averageOrderValue || 0,
            avgOrderTrend: 0,
            pendingInvoices: s.pendingPayments || 0,
            pendingInvoicesAmount: s.pendingAmount || 0,
            refundRate: 0,
            refundRateTrend: 0,
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
            tap: "bg-[#3B82F6]",
            moyasar: "bg-[#8B5CF6]",
            tamara: "bg-[#22C55E]",
            tabby: "bg-[#F59E0B]",
            mock: "bg-[#6B7280]",
          };
          setRevenueData({
            gateways: sources.map((s: any) => ({
              name: s.gateway?.charAt(0).toUpperCase() + s.gateway?.slice(1) || "-",
              percentage: total > 0 ? Math.round((s.totalRevenue / total) * 100) : 0,
              color: gatewayColors[s.gateway] || "bg-[#6B7280]",
            })),
            topCourses: [],
          });
        }

        // Recent transactions
        if (paymentsRes.status === "fulfilled") {
          const mapped = (paymentsRes.value?.data || []).map((p: any) => ({
            id: p.id,
            invoiceNumber: p.id.slice(0, 13).toUpperCase(),
            date: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            customer: p.userName || p.userEmail || "-",
            course: p.courseTitle || "-",
            amount: `${t("kpi.sar")} ${Number(p.amount).toLocaleString()}`,
            gateway: (p.gateway || "").charAt(0).toUpperCase() + (p.gateway || "").slice(1) as any,
            status: p.status as any,
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
          setRefunds(
            (refundsRes.value?.data || []).filter((r: any) => r.status === "pending").slice(0, 3).map((r: any) => ({
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
    };

    fetchAll();
  }, [t]);

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
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>

            {/* Mobile Sidebar */}
            <FinanceMobileSidebar profile={profile} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("subtitle", {
                    name: profile.name.split(" ")[0],
                  })}
                </p>
              </div>

              {/* KPI Cards */}
              <FinanceKPICards data={{ ...kpiData, totalTransactionsPeriod: t("kpi.thisMonth") }} />

              {/* Revenue Summary + Refunds Queue */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <div className="lg:col-span-3">
                  <RevenueSummaryWidget data={revenueData} />
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
