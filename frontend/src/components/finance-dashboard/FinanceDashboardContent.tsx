"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import FinanceKPICards, { FinanceKPIData } from "./FinanceKPICards";
import RevenueSummaryWidget from "./RevenueSummaryWidget";
import RecentTransactionsWidget, { RecentTransaction, TxStatus } from "./RecentTransactionsWidget";
import RefundsQueueRail, { RefundQueueItem } from "./right-rail/RefundsQueueRail";
import BankTransferRail, { BankTransferRailItem } from "./right-rail/BankTransferRail";
import ReconciliationDriftsRail, { DriftRailItem } from "./right-rail/ReconciliationDriftsRail";
import ActiveCouponsRail, { CouponRailItem } from "./right-rail/ActiveCouponsRail";
import FinancialAlertsRail, { FinancialAlert } from "./right-rail/FinancialAlertsRail";
import DateRangeFilter from "./DateRangeFilter";
import {
  financeApi,
  paymentApi,
  refundApi,
  discountApi,
  financeBankTransferApi,
  reconciliationApi,
} from "@/lib/api";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

function getDefaultDateRange() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return { startDate: start.toISOString().slice(0, 10), endDate: todayStr, label: "30d" };
}

function ageHoursFrom(iso: string): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

const FinanceDashboardContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const profile = useFinanceProfile();
  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string; label: string }>(getDefaultDateRange);

  const [kpiData, setKpiData] = useState<FinanceKPIData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  const [revenueData, setRevenueData] = useState<{
    gateways: { name: string; gatewayKey: string; percentage: number; amount: number; totalCount?: number }[];
    topCourses: { name: string; revenue: number; enrollments: number }[];
  }>({ gateways: [], topCourses: [] });
  const [revenueLoading, setRevenueLoading] = useState(true);

  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  const [refundItems, setRefundItems] = useState<RefundQueueItem[]>([]);
  const [pendingRefundCount, setPendingRefundCount] = useState(0);
  const [refundLoading, setRefundLoading] = useState(true);

  const [bankTransferItems, setBankTransferItems] = useState<BankTransferRailItem[]>([]);
  const [pendingBankTransferCount, setPendingBankTransferCount] = useState(0);
  const [bankTransferLoading, setBankTransferLoading] = useState(true);

  const [driftItems, setDriftItems] = useState<DriftRailItem[]>([]);
  const [totalUnresolvedDrifts, setTotalUnresolvedDrifts] = useState(0);
  const [driftLoading, setDriftLoading] = useState(true);

  const [coupons, setCoupons] = useState<CouponRailItem[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(true);

  const [alerts, setAlerts] = useState<FinancialAlert[]>([]);

  // Reject refund modal state
  const [rejectingRefundId, setRejectingRefundId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const fetchAll = useCallback(async () => {
    setKpiLoading(true);
    setRevenueLoading(true);
    setTransactionsLoading(true);
    setRefundLoading(true);
    setBankTransferLoading(true);
    setDriftLoading(true);
    setCouponsLoading(true);

    const params = { startDate: dateRange.startDate, endDate: dateRange.endDate };

    const [
      summaryRes,
      refundRateRes,
      revenueRes,
      topCoursesRes,
      paymentsRes,
      refundsRes,
      bankTransferRes,
      reconciliationRes,
      discountsRes,
    ] = await Promise.allSettled([
      financeApi.getSummary(params),
      financeApi.getRefundRate(params),
      financeApi.getRevenueBySource(params),
      financeApi.getTopCourses({ limit: 5, ...params }),
      paymentApi.getAll(1, 8),
      refundApi.getAll(1, 10),
      financeBankTransferApi.listQueue({ status: "pending", page: 1, limit: 10 }),
      reconciliationApi.listFindings({ status: "unresolved", page: 1, limit: 8 }),
      discountApi.getAll(1, 10),
    ]);

    // KPIs
    if (summaryRes.status === "fulfilled") {
      const s = summaryRes.value;
      const refundRate =
        refundRateRes.status === "fulfilled"
          ? parseFloat(refundRateRes.value?.refundRate || "0")
          : 0;
      setKpiData({
        grossRevenue: Number(s.totalRevenue || 0),
        revenueTrend: Number(s.revenueTrend || 0),
        netRevenue: Number(s.netRevenue || 0),
        pendingCount: Number(s.pendingPayments || 0) + Number(s.awaitingApprovalCount || 0),
        pendingAmount: Number(s.pendingAmount || 0) + Number(s.awaitingApprovalAmount || 0),
        refundRate,
        refundRateTrend: Number(s.refundRateTrend || 0),
        successRate: Number(s.successRate || 0),
        failedRate: Number(s.failedRate || 0),
        failedCount: Number(s.failedPayments || 0),
      });

      // Build alerts from real signals
      const builtAlerts: FinancialAlert[] = [];
      const now = new Date().toISOString();
      if (Number(s.failedPayments) > 0) {
        builtAlerts.push({
          id: `failed-${dateRange.startDate}-${s.failedPayments}`,
          severity: Number(s.failedPayments) >= 5 ? "critical" : "warning",
          title: t("alerts.failedPayments.title", { count: s.failedPayments }),
          description: t("alerts.failedPayments.desc"),
          createdAt: now,
        });
      }
      if (Number(s.awaitingApprovalCount) >= 3) {
        builtAlerts.push({
          id: `awaiting-${s.awaitingApprovalCount}`,
          severity: "warning",
          title: t("alerts.awaitingApproval.title", { count: s.awaitingApprovalCount }),
          description: t("alerts.awaitingApproval.desc"),
          createdAt: now,
        });
      }
      if (refundRate > 5) {
        builtAlerts.push({
          id: `refund-rate-${refundRate.toFixed(1)}`,
          severity: refundRate > 10 ? "critical" : "warning",
          title: t("alerts.highRefundRate.title", { rate: refundRate.toFixed(1) }),
          description: t("alerts.highRefundRate.desc"),
          createdAt: now,
        });
      }
      setAlerts(builtAlerts);
    }
    setKpiLoading(false);

    // Revenue by source
    if (revenueRes.status === "fulfilled") {
      type SourceRow = { gateway: string; totalRevenue: number; count?: number; totalCount?: number };
      const sources = (revenueRes.value || []) as SourceRow[];
      const total = sources.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
      const gatewayList = sources.map((s) => ({
        name: s.gateway?.charAt(0).toUpperCase() + s.gateway?.slice(1).replace(/_/g, " "),
        gatewayKey: s.gateway,
        percentage: total > 0 ? Math.round((s.totalRevenue / total) * 100) : 0,
        amount: Number(s.totalRevenue),
        totalCount: Number(s.totalCount || 0),
      }));
      const topCoursesList =
        topCoursesRes.status === "fulfilled"
          ? (topCoursesRes.value || []).map(
              (c: { title: string; titleAr?: string | null; revenue: number; count?: number }) => ({
                name: locale === "ar" && c.titleAr ? c.titleAr : c.title,
                revenue: Number(c.revenue) || 0,
                enrollments: Number(c.count) || 0,
              }),
            )
          : [];
      setRevenueData({ gateways: gatewayList, topCourses: topCoursesList });
    }
    setRevenueLoading(false);

    // Recent transactions
    if (paymentsRes.status === "fulfilled") {
      const data = paymentsRes.value?.data || [];
      type PaymentRow = {
        id: string;
        createdAt: string;
        userName?: string | null;
        userEmail?: string | null;
        courseTitle?: string | null;
        amount: number | string;
        gateway: string;
        status: string;
      };
      const mapped: RecentTransaction[] = data.map((p: PaymentRow) => ({
        id: p.id,
        date: new Date(p.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
          month: "short",
          day: "numeric",
        }),
        customer: p.userName || p.userEmail || "-",
        customerEmail: p.userEmail,
        course: p.courseTitle || "-",
        amount: Number(p.amount),
        gateway: p.gateway || "-",
        status: (p.status || "pending") as TxStatus,
      }));
      setTransactions(mapped);
    }
    setTransactionsLoading(false);

    // Refunds
    if (refundsRes.status === "fulfilled") {
      type RefundRow = {
        id: string;
        status: string;
        requesterName?: string | null;
        requesterEmail?: string | null;
        courseTitle?: string | null;
        refundAmount: number | string;
        reason?: string | null;
      };
      const list = (refundsRes.value?.data || []) as RefundRow[];
      const pending = list.filter((r) => r.status === "pending");
      setPendingRefundCount(pending.length);
      setRefundItems(
        pending.map((r) => ({
          id: r.id,
          customer: r.requesterName || r.requesterEmail || "-",
          course: r.courseTitle || "-",
          refundAmount: Number(r.refundAmount),
          reason: r.reason || "-",
        })),
      );
    }
    setRefundLoading(false);

    // Bank transfer queue
    if (bankTransferRes.status === "fulfilled") {
      const value = bankTransferRes.value;
      setPendingBankTransferCount(value?.pagination?.total ?? 0);
      setBankTransferItems(
        (value?.data || []).map((b) => ({
          id: b.receiptId,
          customer: b.student?.name || b.student?.email || "-",
          course: b.course?.title || "-",
          amount: Number(b.payment?.amount || 0),
          uploadedAt: b.uploadedAt,
          ageHours: ageHoursFrom(b.uploadedAt),
        })),
      );
    }
    setBankTransferLoading(false);

    // Reconciliation drifts
    if (reconciliationRes.status === "fulfilled") {
      const value = reconciliationRes.value;
      setTotalUnresolvedDrifts(value?.pagination?.total ?? 0);
      setDriftItems(
        (value?.data || []).map((f) => ({
          id: f.id,
          driftType: f.driftType,
          gateway: f.gateway,
          detectedAt: new Date(f.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
            month: "short",
            day: "numeric",
          }),
          escalated: !!f.escalationId && f.escalationStatus !== "resolved" && f.escalationStatus !== "declined",
        })),
      );
    }
    setDriftLoading(false);

    // Coupons
    if (discountsRes.status === "fulfilled") {
      type CouponRow = {
        id: string;
        code: string;
        type: string;
        value: number;
        currentUses: number;
        maxUses: number;
        isActive: boolean;
        expiresAt?: string | null;
      };
      const active = ((discountsRes.value?.data || []) as CouponRow[]).filter((d) => d.isActive);
      setCoupons(
        active.slice(0, 4).map((d) => ({
          id: d.id,
          code: d.code,
          discountLabel:
            d.type === "percentage"
              ? t("rail.coupons.percentOff", { value: Number(d.value) })
              : t("rail.coupons.fixedOff", { value: Number(d.value) }),
          used: d.currentUses || 0,
          limit: d.maxUses || 0,
          expiresIn: daysUntil(d.expiresAt),
        })),
      );
    }
    setCouponsLoading(false);
  }, [dateRange, locale, t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleApproveRefund = async (refundId: string) => {
    try {
      await refundApi.approve(refundId);
      toast.success(t("rail.refunds.approveSuccess"));
      setRefundItems((prev) => prev.filter((r) => r.id !== refundId));
      setPendingRefundCount((c) => Math.max(0, c - 1));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("rail.refunds.approveFailed"));
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
      toast.success(t("rail.refunds.rejectSuccess"));
      setRefundItems((prev) => prev.filter((r) => r.id !== rejectingRefundId));
      setPendingRefundCount((c) => Math.max(0, c - 1));
      setRejectingRefundId(null);
      setRejectionNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("rail.refunds.rejectFailed"));
    } finally {
      setRejecting(false);
    }
  };

  return (
    <>
      <FinanceNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
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
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("subtitle", { name: profile.name.split(" ")[0] })}
                  </p>
                </div>
                <DateRangeFilter onChange={setDateRange} defaultPreset="30d" />
              </div>

              {/* KPI Cards */}
              <FinanceKPICards data={kpiData} loading={kpiLoading} />

              {/* Revenue + Analytics (full width, merged) */}
              <div className="mb-6">
                <RevenueSummaryWidget
                  gateways={revenueData.gateways}
                  topCourses={revenueData.topCourses}
                  summary={{
                    grossRevenue: kpiData?.grossRevenue || 0,
                    averageOrderValue:
                      kpiData && kpiData.grossRevenue > 0 && transactions.length > 0
                        ? kpiData.grossRevenue / Math.max(1, transactions.filter((t) => t.status === "paid").length)
                        : 0,
                  }}
                  dateRange={dateRange}
                  loading={revenueLoading}
                />
              </div>

              {/* Recent Transactions (full width) */}
              <RecentTransactionsWidget transactions={transactions} loading={transactionsLoading} />
            </div>

            {/* Right Rail */}
            <aside className="w-full lg:w-[320px] lg:flex-shrink-0 space-y-4">
              <FinancialAlertsRail alerts={alerts} loading={kpiLoading} />
              <RefundsQueueRail
                items={refundItems}
                totalPending={pendingRefundCount}
                onApprove={handleApproveRefund}
                onReject={handleRejectRefund}
                loading={refundLoading}
              />
              <BankTransferRail
                items={bankTransferItems}
                totalPending={pendingBankTransferCount}
                loading={bankTransferLoading}
              />
              <ReconciliationDriftsRail
                items={driftItems}
                totalUnresolved={totalUnresolvedDrifts}
                loading={driftLoading}
              />
              <ActiveCouponsRail items={coupons} loading={couponsLoading} />
            </aside>
          </div>
        </div>
      </div>

      {/* Reject Refund Modal */}
      {rejectingRefundId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
              {t("rail.refunds.rejectTitle")}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {t("rail.refunds.rejectSubtitle")}
            </p>
            <textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder={t("rail.refunds.rejectPlaceholder")}
              rows={3}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setRejectingRefundId(null);
                  setRejectionNote("");
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors"
              >
                {t("rail.refunds.cancel")}
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejecting || rejectionNote.length < 10}
                className="px-4 py-2 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
              >
                {t("rail.refunds.reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FinanceDashboardContent;
