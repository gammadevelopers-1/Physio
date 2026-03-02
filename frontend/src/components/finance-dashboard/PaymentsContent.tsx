"use client";

import { useState, useEffect, useCallback } from "react";
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
  TrendingUp,
  Download,
  Loader2,
} from "lucide-react";
import { paymentApi, financeApi } from "@/lib/api";

const mockProfile = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

const PaymentsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = { ...mockProfile, name: t("names.noraAlFahad") };

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentsRes, summaryRes] = await Promise.all([
        paymentApi.getAll(page, 10),
        financeApi.getSummary(),
      ]);

      const mapped = (paymentsRes.data || []).map((p: any) => ({
        id: p.id,
        invoiceNumber: p.id.slice(0, 13).toUpperCase(),
        date: new Date(p.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" }),
        customer: p.userName || p.userEmail || "-",
        course: isRTL ? (p.courseTitleAr || p.courseTitle || "-") : (p.courseTitle || "-"),
        amount: `${t("kpi.sar")} ${Number(p.amount).toLocaleString()}`,
        gateway: (p.gateway || "").charAt(0).toUpperCase() + (p.gateway || "").slice(1) as any,
        status: p.status as any,
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
  }, [page, locale, isRTL, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

      <div className="bg-[#F9FAFB] min-h-screen">
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
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors">
                    <Download className="w-4 h-4" />
                    {t("paymentsPage.exportTransactions")}
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={index}
                      className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-start gap-3"
                    >
                      <div className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280] font-medium">
                          {stat.label}
                        </p>
                        <p className="text-xl font-bold text-[#111827]">
                          {loading ? "..." : stat.value}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* All Payments Table */}
              {loading ? (
                <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#B8860B] animate-spin" />
                </div>
              ) : (
                <PaymentsInvoicesTable
                  transactions={transactions}
                  showPagination={true}
                  showExport={true}
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
