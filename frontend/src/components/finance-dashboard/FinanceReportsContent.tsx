"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  BarChart3,
  FileText,
  Download,
  DollarSign,
  CreditCard,
  RotateCcw,
  TrendingUp,
  Calendar,
  Filter,
  FileSpreadsheet,
} from "lucide-react";

const mockProfile = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

const FinanceReportsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [selectedReport, setSelectedReport] = useState("revenue");
  const [period, setPeriod] = useState("thisMonth");
  const [groupBy, setGroupBy] = useState("byCourse");

  const reportTypes = [
    {
      key: "revenue",
      title: t("reportsPage.reportTypes.revenue"),
      description: t("reportsPage.reportTypes.revenueDesc"),
      icon: DollarSign,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      key: "payments",
      title: t("reportsPage.reportTypes.payments"),
      description: t("reportsPage.reportTypes.paymentsDesc"),
      icon: CreditCard,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      key: "refunds",
      title: t("reportsPage.reportTypes.refunds"),
      description: t("reportsPage.reportTypes.refundsDesc"),
      icon: RotateCcw,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#EA580C]",
    },
    {
      key: "summary",
      title: t("reportsPage.reportTypes.summary"),
      description: t("reportsPage.reportTypes.summaryDesc"),
      icon: BarChart3,
      iconBg: "bg-[#EDE9FE]",
      iconColor: "text-[#8B5CF6]",
    },
  ];

  // Mock report data
  const mockRevenueReport = [
    { name: "ACLS Training", revenue: "SAR 52,000", transactions: 48, growth: "+15%" },
    { name: "First Aid Certification", revenue: "SAR 38,000", transactions: 45, growth: "+8%" },
    { name: "CPR Certification", revenue: "SAR 28,000", transactions: 43, growth: "+12%" },
    { name: "Emergency Response", revenue: "SAR 24,000", transactions: 24, growth: "+5%" },
    { name: "Infection Control", revenue: "SAR 18,000", transactions: 24, growth: "+3%" },
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
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("reportsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors">
                    <FileSpreadsheet className="w-4 h-4" />
                    {t("reportsPage.exportExcel")}
                  </button>
                  <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors">
                    <Download className="w-4 h-4" />
                    {t("reportsPage.exportPdf")}
                  </button>
                </div>
              </div>

              {/* Report Type Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {reportTypes.map((report) => {
                  const Icon = report.icon;
                  const isSelected = selectedReport === report.key;
                  return (
                    <button
                      key={report.key}
                      onClick={() => setSelectedReport(report.key)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-[#FDF6EC] border-[#a37f49] ring-1 ring-[#a37f49]"
                          : "bg-white border-[#E5E7EB] hover:border-[#D1D5DB]"
                      }`}
                    >
                      <div className={`w-10 h-10 ${report.iconBg} rounded-lg flex items-center justify-center mb-3`}>
                        <Icon className={`w-5 h-5 ${report.iconColor}`} />
                      </div>
                      <p className={`text-sm font-semibold ${isSelected ? "text-[#a37f49]" : "text-[#111827]"}`}>
                        {report.title}
                      </p>
                      <p className="text-[12px] text-[#6B7280] mt-0.5">{report.description}</p>
                    </button>
                  );
                })}
              </div>

              {/* Filters */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-[#6B7280]" />
                  <h3 className="text-sm font-semibold text-[#111827]">{t("reportsPage.filters.period")}</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div>
                    <label className="block text-[12px] text-[#6B7280] mb-1">{t("reportsPage.filters.period")}</label>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] text-[#374151] bg-white focus:outline-none focus:border-[#059669]"
                    >
                      <option value="thisMonth">{t("reportsPage.filters.thisMonth")}</option>
                      <option value="lastMonth">{t("reportsPage.filters.lastMonth")}</option>
                      <option value="thisQuarter">{t("reportsPage.filters.thisQuarter")}</option>
                      <option value="thisYear">{t("reportsPage.filters.thisYear")}</option>
                      <option value="custom">{t("reportsPage.filters.custom")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#6B7280] mb-1">{t("reportsPage.filters.groupBy")}</label>
                    <select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] text-[#374151] bg-white focus:outline-none focus:border-[#059669]"
                    >
                      <option value="byCourse">{t("reportsPage.filters.byCourse")}</option>
                      <option value="byInstructor">{t("reportsPage.filters.byInstructor")}</option>
                      <option value="byGateway">{t("reportsPage.filters.byGateway")}</option>
                      <option value="byStatus">{t("reportsPage.filters.byStatus")}</option>
                    </select>
                  </div>
                  <div className="sm:ml-auto flex items-end">
                    <button className="flex items-center gap-1.5 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                      <BarChart3 className="w-4 h-4" />
                      {t("reportsPage.generateReport")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Report Results */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <h3 className="text-base font-semibold text-[#111827]">
                    {reportTypes.find((r) => r.key === selectedReport)?.title}
                  </h3>
                </div>

                {/* Chart Placeholder */}
                <div className="px-5 py-4">
                  <div className="h-[200px] bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB] flex flex-col items-center justify-center text-[#9CA3AF] mb-4">
                    <BarChart3 className="w-8 h-8 mb-2" />
                    <span className="text-sm">{t("revenueSummary.chartPlaceholder")}</span>
                  </div>
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.course")}</th>
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("sidebar.revenue")}</th>
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>Transactions</th>
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>Growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockRevenueReport.map((item, index) => (
                        <tr key={index} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                          <td className="py-3 px-5 text-[13px] font-medium text-[#111827]">{item.name}</td>
                          <td className="py-3 px-5 text-[13px] font-semibold text-[#111827]">{item.revenue}</td>
                          <td className="py-3 px-5 text-[13px] text-[#6B7280] hidden md:table-cell">{item.transactions}</td>
                          <td className="py-3 px-5">
                            <span className="flex items-center gap-1 text-[13px] font-semibold text-[#16A34A]">
                              <TrendingUp className="w-3 h-3" />
                              {item.growth}
                            </span>
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

export default FinanceReportsContent;
