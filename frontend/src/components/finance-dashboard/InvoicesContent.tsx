"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  FileText,
  Plus,
  Download,
  Send,
  Search,
  Eye,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
} from "lucide-react";

const mockProfile = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  customer: string;
  course: string;
  amount: string;
  status: "issued" | "paid" | "overdue" | "draft";
}

const InvoicesContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = { ...mockProfile, name: t("names.noraAlFahad") };
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const stats = [
    {
      label: t("invoicesPage.stats.totalInvoices"),
      value: "156",
      icon: FileText,
      iconBg: "bg-[var(--color-border-subtle)]",
      iconColor: "text-[var(--color-primary)]",
    },
    {
      label: t("invoicesPage.stats.paidInvoices"),
      value: "132",
      icon: CheckCircle,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: t("invoicesPage.stats.overdueInvoices"),
      value: "8",
      icon: AlertTriangle,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#DC2626]",
    },
    {
      label: t("invoicesPage.stats.totalAmount"),
      value: `${t("kpi.sar")} 245K`,
      icon: DollarSign,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
  ];

  const invoices: Invoice[] = [
    { id: "1", invoiceNumber: "INV-2024-0156", date: t("mockDates.feb10_2026"), dueDate: t("mockDates.feb25_2026"), customer: t("names.fatimaAlNoor"), course: t("courses.aclsTraining"), amount: `${t("kpi.sar")} 1,200`, status: "issued" },
    { id: "2", invoiceNumber: "INV-2024-0155", date: t("mockDates.feb10_2026"), dueDate: t("mockDates.feb25_2026"), customer: t("names.omarAbdullah"), course: t("courses.firstAidCert"), amount: `${t("kpi.sar")} 850`, status: "paid" },
    { id: "3", invoiceNumber: "INV-2024-0154", date: t("mockDates.feb9_2026"), dueDate: t("mockDates.feb24_2026"), customer: t("names.laylaHassan"), course: t("courses.cprCert"), amount: `${t("kpi.sar")} 650`, status: "paid" },
    { id: "4", invoiceNumber: "INV-2024-0153", date: t("mockDates.feb5_2026"), dueDate: t("mockDates.feb20_2026"), customer: t("names.ahmedKhalid"), course: t("courses.emergencyResponse"), amount: `${t("kpi.sar")} 980`, status: "overdue" },
    { id: "5", invoiceNumber: "INV-2024-0152", date: t("mockDates.feb8_2026"), dueDate: t("mockDates.feb23_2026"), customer: t("names.saraMohammed"), course: t("courses.aclsTraining"), amount: `${t("kpi.sar")} 1,200`, status: "paid" },
    { id: "6", invoiceNumber: "INV-2024-0151", date: t("mockDates.feb7_2026"), dueDate: t("mockDates.feb22_2026"), customer: t("names.mohammedAlHarbi"), course: t("courses.infectionControl"), amount: `${t("kpi.sar")} 750`, status: "draft" },
  ];

  const statusStyles: Record<string, string> = {
    issued: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
    paid: "bg-[#DCFCE7] text-[#16A34A]",
    overdue: "bg-[#FEE2E2] text-[#DC2626]",
    draft: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
  };

  const tabs = [
    { key: "all", label: t("discountsPage.tabs.all") },
    { key: "issued", label: t("invoicesPage.statuses.issued") },
    { key: "paid", label: t("invoicesPage.statuses.paid") },
    { key: "overdue", label: t("invoicesPage.statuses.overdue") },
    { key: "draft", label: t("invoicesPage.statuses.draft") },
  ];

  const filteredInvoices = invoices.filter((inv) => {
    const matchesTab = activeTab === "all" || inv.status === activeTab;
    const matchesSearch =
      searchQuery === "" ||
      inv.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Aging Report data
  const agingData = [
    { label: t("invoicesPage.agingCategories.current"), count: 4, amount: `${t("kpi.sar")} 3,680`, color: "bg-[#16A34A]" },
    { label: t("invoicesPage.agingCategories.days30"), count: 3, amount: `${t("kpi.sar")} 2,450`, color: "bg-[#D97706]" },
    { label: t("invoicesPage.agingCategories.days60"), count: 2, amount: `${t("kpi.sar")} 1,800`, color: "bg-[#EA580C]" },
    { label: t("invoicesPage.agingCategories.overdue90"), count: 3, amount: `${t("kpi.sar")} 7,750`, color: "bg-[#DC2626]" },
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
                    {t("invoicesPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("invoicesPage.subtitle")}
                  </p>
                </div>
                <button className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  {t("invoicesPage.createInvoice")}
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div key={index} className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
                      <div className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-secondary)] font-medium">{stat.label}</p>
                        <p className="text-xl font-bold text-[var(--color-text-secondary)]">{stat.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Invoices Table */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6">
                {/* Tabs + Search */}
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex gap-1 bg-[var(--color-border-subtle)] rounded-lg p-0.5">
                      {tabs.map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                            activeTab === tab.key
                              ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative w-full sm:w-auto">
                      <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("paymentsTable.searchPlaceholder")}
                        className={`w-full sm:w-[260px] py-2 border border-[var(--color-input-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.invoice")}</th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.date")}</th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.customer")}</th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.course")}</th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.amount")}</th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.status")}</th>
                        <th className="py-3 px-4 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)] transition-colors">
                          <td className="py-3 px-4">
                            <span className="text-[13px] font-medium text-[var(--color-primary)]">{inv.invoiceNumber}</span>
                          </td>
                          <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)]">{inv.date}</td>
                          <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] font-medium">{inv.customer}</td>
                          <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">{inv.course}</td>
                          <td className="py-3 px-4 text-[13px] font-semibold text-[var(--color-text-primary)]">{inv.amount}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[inv.status]}`}>
                              {t(`invoicesPage.statuses.${inv.status}`)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="relative">
                              <button
                                onClick={() => setOpenActionId(openActionId === inv.id ? null : inv.id)}
                                className="w-7 h-7 flex items-center justify-center border border-[var(--color-border)] rounded-md hover:bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              {openActionId === inv.id && (
                                <div className={`absolute top-full mt-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[140px] z-20 ${isRTL ? "left-0" : "right-0"}`}>
                                  <button className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]">
                                    <Eye className="w-3.5 h-3.5" />
                                    {t("paymentsTable.actions.view")}
                                  </button>
                                  <button className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]">
                                    <Download className="w-3.5 h-3.5" />
                                    {t("invoicesPage.downloadPdf")}
                                  </button>
                                  <button className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]">
                                    <Send className="w-3.5 h-3.5" />
                                    {t("invoicesPage.resendEmail")}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-[#F3F4F6] gap-3">
                  <p className="text-[13px] text-[var(--color-text-secondary)]">
                    {t("paymentsTable.pagination.showing", { from: 1, to: filteredInvoices.length, total: filteredInvoices.length })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]">
                      <ChevronLeft className="w-4 h-4" />
                      {t("paymentsTable.pagination.previous")}
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]">
                      {t("paymentsTable.pagination.next")}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Aging Report */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[#EA580C]" />
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{t("invoicesPage.agingReport")}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {agingData.map((item, index) => (
                    <div key={index} className="p-4 bg-[var(--color-surface-page)] rounded-xl border border-[#F3F4F6]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                        <p className="text-[12px] text-[var(--color-text-secondary)] font-medium">{item.label}</p>
                      </div>
                      <p className="text-lg font-bold text-[var(--color-text-secondary)]">{item.count} {t("invoicesLabel")}</p>
                      <p className="text-[13px] text-[var(--color-text-secondary)]">{item.amount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoicesContent;
