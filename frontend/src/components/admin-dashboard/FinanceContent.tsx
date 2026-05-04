"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  RefreshCcw,
  FileText,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useAdminProfile } from "@/hooks/useAdminProfile";

const FinanceContent = () => {
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Mock Finance Data with translations
  const mockTransactions = [
    {
      id: "1",
      date: "Feb 9, 2026",
      description: `${t("financePage.transactionTypes.enrollment")} - ${t("coursesPage.sampleCourses.acls")}`,
      user: t("financePage.sampleUsers.ahmedK"),
      amount: 1200,
      type: "payment",
      status: "completed",
      gateway: "Tap",
    },
    {
      id: "2",
      date: "Feb 9, 2026",
      description: `${t("financePage.transactionTypes.refund")} - ${t("coursesPage.sampleCourses.firstAid")}`,
      user: t("financePage.sampleUsers.saraM"),
      amount: -800,
      type: "refund",
      status: "completed",
      gateway: "Tap",
    },
    {
      id: "3",
      date: "Feb 8, 2026",
      description: `${t("financePage.transactionTypes.enrollment")} - ${t("coursesPage.sampleCourses.cpr")}`,
      user: t("financePage.sampleUsers.mohammedH"),
      amount: 950,
      type: "payment",
      status: "completed",
      gateway: "Tamara",
    },
    {
      id: "4",
      date: "Feb 8, 2026",
      description: `${t("financePage.transactionTypes.enrollment")} - ${t("coursesPage.sampleCourses.emergency")}`,
      user: t("financePage.sampleUsers.fatimaN"),
      amount: 1500,
      type: "payment",
      status: "pending",
      gateway: "Moyasar",
    },
    {
      id: "5",
      date: "Feb 7, 2026",
      description: `${t("financePage.transactionTypes.enrollment")} - ${t("coursesPage.sampleCourses.infection")}`,
      user: t("financePage.sampleUsers.khalidA"),
      amount: 1100,
      type: "payment",
      status: "completed",
      gateway: "Tap",
    },
  ];

  const [dateRange, setDateRange] = useState("mtd");
  const [transactionFilter, setTransactionFilter] = useState("all");

  const stats = {
    grossRevenue: 245000,
    grossTrend: 12,
    netRevenue: 228000,
    netTrend: 10,
    refunds: 17000,
    refundTrend: -5,
    avgOrderValue: 1150,
    aovTrend: 8,
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "pending":
        return "bg-[#FEF3C7] text-[#D97706]";
      case "failed":
        return "bg-[#FEE2E2] text-[#DC2626]";
      default:
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  const filteredTransactions = mockTransactions.filter((tx) => {
    if (transactionFilter === "all") return true;
    return tx.type === transactionFilter;
  });

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            <AdminMobileSidebar admin={admin} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("financePage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("financePage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="h-10 px-4 border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:border-[#002D87]"
                  >
                    <option value="today">{t("financePage.dateRange.today")}</option>
                    <option value="week">{t("financePage.dateRange.week")}</option>
                    <option value="mtd">{t("financePage.dateRange.mtd")}</option>
                    <option value="ytd">{t("financePage.dateRange.ytd")}</option>
                  </select>
                  <button className="flex items-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors">
                    <Download className="w-4 h-4" />
                    {t("financePage.export")}
                  </button>
                </div>
              </div>

              {/* Revenue Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-[#DCFCE7] rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-[#16A34A]" />
                    </div>
                    <div className={`flex items-center gap-1 ${stats.grossTrend > 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                      {stats.grossTrend > 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">{Math.abs(stats.grossTrend)}%</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                    {(stats.grossRevenue / 1000).toFixed(0)}K
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("financePage.stats.gross")}</p>
                </div>

                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
                    </div>
                    <div className={`flex items-center gap-1 ${stats.netTrend > 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                      {stats.netTrend > 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">{Math.abs(stats.netTrend)}%</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                    {(stats.netRevenue / 1000).toFixed(0)}K
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("financePage.stats.net")}</p>
                </div>

                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-[#FEE2E2] rounded-lg flex items-center justify-center">
                      <RefreshCcw className="w-5 h-5 text-[#DC2626]" />
                    </div>
                    <div className={`flex items-center gap-1 ${stats.refundTrend < 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                      {stats.refundTrend < 0 ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">{Math.abs(stats.refundTrend)}%</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                    {(stats.refunds / 1000).toFixed(0)}K
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("financePage.stats.refunds")}</p>
                </div>

                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-[var(--gold-gold-100)] rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-[var(--color-star)]" />
                    </div>
                    <div className={`flex items-center gap-1 ${stats.aovTrend > 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                      {stats.aovTrend > 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">{Math.abs(stats.aovTrend)}%</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                    {stats.avgOrderValue.toLocaleString()}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("financePage.stats.aov")}</p>
                </div>
              </div>

              {/* Gateway Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2 bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                    {t("financePage.revenueChart")}
                  </h3>
                  <div className="h-48 bg-[var(--color-surface-page)] rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-12 h-12 text-[var(--color-text-secondary)]" />
                  </div>
                </div>

                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                    {t("financePage.gatewayBreakdown")}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--color-text-secondary)]">Tap/Moyasar</span>
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">72%</span>
                      </div>
                      <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: "72%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--color-text-secondary)]">BNPL (Tamara)</span>
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">28%</span>
                      </div>
                      <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: "28%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="p-5 border-b border-[var(--color-border)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {t("financePage.recentTransactions")}
                    </h3>
                    <select
                      value={transactionFilter}
                      onChange={(e) => setTransactionFilter(e.target.value)}
                      className="h-9 px-3 border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:border-[#002D87]"
                    >
                      <option value="all">{t("financePage.filters.all")}</option>
                      <option value="payment">{t("financePage.filters.payments")}</option>
                      <option value="refund">{t("financePage.filters.refunds")}</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[var(--color-surface-page)]">
                      <tr>
                        <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("financePage.table.date")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("financePage.table.description")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("financePage.table.user")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("financePage.table.gateway")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("financePage.table.status")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("financePage.table.amount")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)]"
                        >
                          <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{tx.date}</td>
                          <td className="px-4 py-4 text-sm text-[var(--color-text-primary)]">{tx.description}</td>
                          <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{tx.user}</td>
                          <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{tx.gateway}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeStyle(tx.status)}`}
                            >
                              {t(`financePage.status.${tx.status}`)}
                            </span>
                          </td>
                          <td className={`px-4 py-4 text-sm font-medium ${tx.amount > 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                            {tx.amount > 0 ? "+" : ""}SAR {Math.abs(tx.amount).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FinanceContent;
