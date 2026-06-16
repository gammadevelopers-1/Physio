"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import PaymentsInvoicesTable from "./PaymentsInvoicesTable";
import {
  CreditCard,
  CheckCircle,
  XCircle,
  DollarSign,
  Loader2,
} from "lucide-react";
import { paymentApi, financeApi } from "@/lib/api";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

const PaymentsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = useFinanceProfile();

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // Server-side filter state
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentsRes, summaryRes] = await Promise.all([
        paymentApi.getAll(page, 10, { status: statusFilter, search: searchQuery }),
        financeApi.getSummary(),
      ]);

      const mapped = (paymentsRes.data || []).map((p: any) => ({
        id: p.id,
        invoiceNumber: p.invoiceNumber || p.id.slice(0, 13).toUpperCase(),
        invoiceId: p.invoiceId || null,
        date: new Date(p.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" }),
        customer: p.userName || p.userEmail || "-",
        course: isRTL ? (p.courseTitleAr || p.courseTitle || "-") : (p.courseTitle || "-"),
        amount: `${t("kpi.sar")} ${Number(p.amount).toLocaleString()}`,
        gateway: (p.gateway || "").charAt(0).toUpperCase() + (p.gateway || "").slice(1) as any,
        status: p.status as any,
        errorCode: p.errorCode || null,
        failureReason: p.failureReason || null,
        gatewayChargeId: p.gatewayChargeId || null,
        paymentMethod: p.paymentMethod || null,
      }));

      setTransactions(mapped);
      setTotalPages(paymentsRes.pagination?.totalPages || 1);
      setTotal(paymentsRes.pagination?.total || 0);
      setSummary(summaryRes);
    } catch {
      // Fallback to empty
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery, locale, isRTL, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh when pending payments exist
  useEffect(() => {
    const hasPending = transactions.some((tx) => tx.status === "pending");
    if (!hasPending) return;
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [transactions, fetchData]);

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setPage(1), 300);
  };

  const totalPayments = summary?.totalPayments ?? 0;
  const failedPayments = summary?.failedPayments ?? 0;
  const successRate = totalPayments > 0 ? (((totalPayments - failedPayments) / totalPayments) * 100).toFixed(1) : "0";
  const totalVolume = summary?.totalRevenue ?? 0;

  const stats = [
    {
      label: t("paymentsPage.stats.totalPayments"),
      value: totalPayments.toLocaleString(),
      icon: CreditCard,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      label: t("paymentsPage.stats.successRate"),
      value: `${successRate}%`,
      icon: CheckCircle,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: t("paymentsPage.stats.failedPayments"),
      value: failedPayments.toLocaleString(),
      icon: XCircle,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#DC2626]",
    },
    {
      label: t("paymentsPage.stats.totalVolume"),
      value: `${t("kpi.sar")} ${Number(totalVolume).toLocaleString()}`,
      icon: DollarSign,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
  ];

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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("paymentsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("paymentsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3"></div>
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
                      <div className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
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

              {/* All Payments Table */}
              {loading && transactions.length === 0 ? (
                <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-12 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#B8860B] animate-spin" />
                </div>
              ) : (
                <PaymentsInvoicesTable
                  transactions={transactions}
                  showPagination={true}
                  showExport={true}
                  currentPage={page}
                  totalPages={totalPages}
                  totalCount={total}
                  onPageChange={setPage}
                  onExport={() => financeApi.exportCsv({ locale }).catch(() => {})}
                  onExportPdf={() => financeApi.exportPdf({ locale }).catch(() => {})}
                  statusFilter={statusFilter}
                  onStatusFilterChange={handleStatusFilterChange}
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentsContent;
