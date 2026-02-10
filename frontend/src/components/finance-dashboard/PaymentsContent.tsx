"use client";

import { useState } from "react";
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
  RefreshCcw,
} from "lucide-react";

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

  const stats = [
    {
      label: t("paymentsPage.stats.totalPayments"),
      value: "1,245",
      icon: CreditCard,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
      trend: "+8%",
      trendUp: true,
    },
    {
      label: t("paymentsPage.stats.successRate"),
      value: "96.2%",
      icon: CheckCircle,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
      trend: "+1.5%",
      trendUp: true,
    },
    {
      label: t("paymentsPage.stats.failedPayments"),
      value: "47",
      icon: XCircle,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#DC2626]",
      trend: "-12%",
      trendUp: true,
    },
    {
      label: t("paymentsPage.stats.totalVolume"),
      value: "SAR 892K",
      icon: DollarSign,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
      trend: "+15%",
      trendUp: true,
    },
  ];

  const allTransactions = [
    { id: "1", invoiceNumber: "INV-2024-0156", date: "Feb 10, 2026", customer: "Fatima Al-Noor", course: "ACLS Training", amount: "SAR 1,200", gateway: "Tap" as const, status: "paid" as const },
    { id: "2", invoiceNumber: "INV-2024-0155", date: "Feb 10, 2026", customer: "Omar Abdullah", course: "First Aid Cert", amount: "SAR 850", gateway: "Tamara" as const, status: "paid" as const },
    { id: "3", invoiceNumber: "INV-2024-0154", date: "Feb 9, 2026", customer: "Layla Hassan", course: "CPR Certification", amount: "SAR 650", gateway: "Moyasar" as const, status: "pending" as const },
    { id: "4", invoiceNumber: "INV-2024-0153", date: "Feb 9, 2026", customer: "Ahmed Khalid", course: "Emergency Response", amount: "SAR 980", gateway: "Tap" as const, status: "failed" as const },
    { id: "5", invoiceNumber: "INV-2024-0152", date: "Feb 8, 2026", customer: "Sara Mohammed", course: "ACLS Training", amount: "SAR 1,200", gateway: "Tamara" as const, status: "refunded" as const },
    { id: "6", invoiceNumber: "INV-2024-0151", date: "Feb 8, 2026", customer: "Mohammed Al-Harbi", course: "Infection Control", amount: "SAR 750", gateway: "Tap" as const, status: "paid" as const },
    { id: "7", invoiceNumber: "INV-2024-0150", date: "Feb 7, 2026", customer: "Noura Al-Qahtani", course: "CPR Certification", amount: "SAR 650", gateway: "Tabby" as const, status: "paid" as const },
    { id: "8", invoiceNumber: "INV-2024-0149", date: "Feb 7, 2026", customer: "Yusuf Al-Rashid", course: "Emergency Response", amount: "SAR 980", gateway: "Moyasar" as const, status: "pending" as const },
  ];

  return (
    <>
      <FinanceNavbar profile={mockProfile} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={mockProfile} />
            </div>

            <FinanceMobileSidebar profile={mockProfile} />

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
                          {stat.value}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <TrendingUp className="w-3 h-3 text-[#16A34A]" />
                          <span className="text-[11px] font-semibold text-[#16A34A]">
                            {stat.trend}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* All Payments Table */}
              <PaymentsInvoicesTable
                transactions={allTransactions}
                showPagination={true}
                showExport={true}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentsContent;
