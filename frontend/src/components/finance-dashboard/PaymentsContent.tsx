"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CreditCard, Clock, XCircle, Search, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import PaymentsTable, { PaymentRow, PaymentRowStatus } from "./PaymentsTable";
import PaymentDetailDrawer from "./PaymentDetailDrawer";
import DateRangeFilter from "./DateRangeFilter";
import Money from "./shared/Money";
import { KPICardSkeleton } from "./shared/Skeleton";
import { FINANCE_COLORS } from "./shared/financeColors";
import Select from "@/components/admin-dashboard/Select";
import { paymentApi, financeApi } from "@/lib/api";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

function getDefaultDateRange() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return { startDate: start.toISOString().slice(0, 10), endDate: todayStr, label: "30d" };
}

const PaymentsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = useFinanceProfile();

  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string; label: string }>(getDefaultDateRange);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [includeAbandoned, setIncludeAbandoned] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [summary, setSummary] = useState<{
    totalPayments: number;
    pendingPayments: number;
    pendingAmount: number;
    awaitingApprovalCount: number;
    awaitingApprovalAmount: number;
    failedPayments: number;
    totalRevenue: number;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [sweepResult, setSweepResult] = useState<{ count: number; cutoff: string } | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentApi.getAll(page, 12, {
        status: statusFilter,
        search: searchQuery,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        gateway: gatewayFilter,
        paymentMethod: methodFilter,
        includeAbandoned,
      });
      type PaymentApiRow = {
        id: string;
        createdAt: string;
        userName?: string | null;
        userEmail?: string | null;
        courseTitle?: string | null;
        courseTitleAr?: string | null;
        amount: number | string;
        gateway: string;
        paymentMethod: string | null;
        status: string;
      };
      const mapped: PaymentRow[] = (res.data || []).map((p: PaymentApiRow) => ({
        id: p.id,
        date: new Date(p.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        customer: p.userName || p.userEmail || "-",
        customerEmail: p.userEmail,
        course: (locale === "ar" ? p.courseTitleAr : p.courseTitle) || p.courseTitle || "-",
        amount: Number(p.amount),
        gateway: p.gateway,
        method: p.paymentMethod,
        status: p.status as PaymentRowStatus,
      }));
      setRows(mapped);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery, dateRange, gatewayFilter, methodFilter, includeAbandoned, locale]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await financeApi.getSummary({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      setSummary({
        totalPayments: Number(res.totalPayments || 0),
        pendingPayments: Number(res.pendingPayments || 0),
        pendingAmount: Number(res.pendingAmount || 0),
        awaitingApprovalCount: Number(res.awaitingApprovalCount || 0),
        awaitingApprovalAmount: Number(res.awaitingApprovalAmount || 0),
        failedPayments: Number(res.failedPayments || 0),
        totalRevenue: Number(res.totalRevenue || 0),
      });
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 350);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchInput]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, gatewayFilter, methodFilter, includeAbandoned, dateRange]);

  const statusOptions = [
    { value: "all", label: t("paymentsTable.filter.allStatuses") },
    { value: "paid", label: t("status.paid") },
    { value: "pending", label: t("status.pending") },
    { value: "awaiting_approval", label: t("status.awaitingApproval") },
    { value: "failed", label: t("status.failed") },
    { value: "refunded", label: t("status.refunded") },
    { value: "partially_refunded", label: t("status.partiallyRefunded") },
    { value: "chargeback", label: t("status.chargeback") },
  ];

  const gatewayOptions = [
    { value: "all", label: t("paymentsTable.filter.allGateways") },
    { value: "moyasar", label: "Moyasar" },
    { value: "tamara", label: "Tamara" },
    { value: "tabby", label: "Tabby" },
    { value: "bank_transfer", label: t("paymentsTable.filter.bankTransfer") },
  ];

  // Moyasar accepts: card, mada, applepay, samsungpay, stcpay (it returns
  // these exact lowercase strings on the payment row). Tamara/Tabby return
  // 'bnpl'. Bank transfer rows carry 'bank_transfer'.
  const methodOptions = [
    { value: "all", label: t("paymentsTable.filter.allMethods") },
    { value: "card", label: t("paymentsTable.filter.card") },
    { value: "mada", label: "Mada" },
    { value: "applepay", label: "Apple Pay" },
    { value: "samsungpay", label: "Samsung Pay" },
    { value: "stcpay", label: "STC Pay" },
    { value: "bnpl", label: "BNPL" },
    { value: "bank_transfer", label: t("paymentsTable.filter.bankTransfer") },
  ];

  const totalPendingCount = (summary?.pendingPayments || 0) + (summary?.awaitingApprovalCount || 0);
  const totalPendingAmount = (summary?.pendingAmount || 0) + (summary?.awaitingApprovalAmount || 0);

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
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("paymentsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("paymentsPage.subtitle")}
                  </p>
                </div>
                <DateRangeFilter onChange={setDateRange} defaultPreset="30d" />
              </div>

              {/* 3 focused stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {summaryLoading ? (
                  <>
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                  </>
                ) : (
                  <>
                    <StatCard
                      label={t("paymentsPage.stats.inPeriod")}
                      icon={CreditCard}
                      iconBg={FINANCE_COLORS.info.bg}
                      iconColor={FINANCE_COLORS.info.text}
                      value={(summary?.totalPayments || 0).toLocaleString("en-US")}
                      sublabel={t("paymentsPage.stats.totalPaid")}
                    />
                    <StatCard
                      label={t("paymentsPage.stats.pending")}
                      icon={Clock}
                      iconBg={FINANCE_COLORS.warning.bg}
                      iconColor={FINANCE_COLORS.warning.text}
                      value={totalPendingCount.toLocaleString("en-US")}
                      sublabel={
                        <Money
                          amount={totalPendingAmount}
                          decimals={0}
                          iconSize={11}
                          className="text-xs text-[var(--color-text-secondary)]"
                        />
                      }
                    />
                    <StatCard
                      label={t("paymentsPage.stats.failed")}
                      icon={XCircle}
                      iconBg={FINANCE_COLORS.error.bg}
                      iconColor={FINANCE_COLORS.error.text}
                      value={(summary?.failedPayments || 0).toLocaleString("en-US")}
                      sublabel={t("paymentsPage.stats.needsAttention")}
                    />
                  </>
                )}
              </div>

              {/* Filter bar */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 mb-4">
                <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                  {/* Search */}
                  <div className={`flex-1 min-w-[200px] relative ${isRTL ? "" : ""}`}>
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder={t("paymentsTable.searchPlaceholder")}
                      className={`w-full h-9 ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] bg-[var(--color-surface-page)] text-[var(--color-text-primary)]`}
                    />
                  </div>

                  <div className="w-[160px]">
                    <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} size="sm" />
                  </div>
                  <div className="w-[160px]">
                    <Select value={gatewayFilter} onChange={setGatewayFilter} options={gatewayOptions} size="sm" />
                  </div>
                  <div className="w-[160px]">
                    <Select value={methodFilter} onChange={setMethodFilter} options={methodOptions} size="sm" />
                  </div>

                  {/* Show abandoned toggle */}
                  <button
                    onClick={() => setIncludeAbandoned((v) => !v)}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border transition-colors ${
                      includeAbandoned
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]"
                    }`}
                    title={t("paymentsTable.showAbandonedTooltip")}
                  >
                    {includeAbandoned ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {t("paymentsTable.showAbandoned")}
                  </button>

                  {/* Manual abandoned-sweep trigger — runs the same job the cron
                      runs nightly. Lets finance flip stale pending rows
                      immediately when they need to clean the ledger. */}
                  <button
                    onClick={async () => {
                      if (sweepRunning) return;
                      setSweepRunning(true);
                      setSweepResult(null);
                      try {
                        const res = await paymentApi.runAbandonedSweep();
                        setSweepResult({ count: res.sweptCount, cutoff: res.cutoff });
                        await fetchRows();
                        await fetchSummary();
                      } catch {
                        setSweepResult({ count: -1, cutoff: "" });
                      } finally {
                        setSweepRunning(false);
                      }
                    }}
                    disabled={sweepRunning}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] disabled:opacity-50"
                    title={t("paymentsTable.runSweepTooltip")}
                  >
                    {sweepRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {sweepRunning ? t("paymentsTable.runSweepRunning") : t("paymentsTable.runSweep")}
                  </button>
                </div>
                {sweepResult && (
                  <p className={`mt-2 text-[11px] ${
                    sweepResult.count === -1
                      ? "text-[#DC2626]"
                      : "text-[var(--color-text-secondary)]"
                  } ${isRTL ? "text-right" : ""}`}>
                    {sweepResult.count === -1
                      ? t("paymentsTable.runSweepError")
                      : t("paymentsTable.runSweepResult", { count: sweepResult.count })}
                  </p>
                )}
              </div>

              {/* Table */}
              <PaymentsTable
                rows={rows}
                loading={loading}
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={setPage}
                onRowClick={setSelectedPaymentId}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      <PaymentDetailDrawer
        paymentId={selectedPaymentId}
        onClose={() => setSelectedPaymentId(null)}
      />
    </>
  );
};

function StatCard({
  label,
  icon: Icon,
  iconBg,
  iconColor,
  value,
  sublabel,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  value: string;
  sublabel: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-secondary)] font-medium">{label}</p>
        <p className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">{value}</p>
        <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{sublabel}</div>
      </div>
    </div>
  );
}

export default PaymentsContent;
