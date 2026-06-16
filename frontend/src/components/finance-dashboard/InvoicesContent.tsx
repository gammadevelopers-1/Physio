"use client";

import { useState, useEffect, useCallback } from "react";
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
  Loader2,
} from "lucide-react";
import { invoiceApi, financeApi } from "@/lib/api";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

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
  const profile = useFinanceProfile();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [agingData, setAgingData] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { status?: string; startDate?: string; endDate?: string } = {};
      if (activeTab !== "all") filters.status = activeTab;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const [invoicesRes, agingRes] = await Promise.all([
        invoiceApi.getAll(page, 50, filters),
        financeApi.getInvoiceAging(startDate && endDate ? { startDate, endDate } : undefined),
      ]);

      const mapped: Invoice[] = (invoicesRes.data || []).map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber || inv.id.slice(0, 13).toUpperCase(),
        date: new Date(inv.issuedAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" }),
        dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" }) : "-",
        customer: inv.userName || inv.userEmail || "-",
        course: isRTL ? (inv.courseTitleAr || inv.courseTitle || "-") : (inv.courseTitle || "-"),
        amount: `${t("kpi.sar")} ${Number(inv.totalAmount).toLocaleString()}`,
        status: inv.status as Invoice["status"],
      }));

      setInvoices(mapped);
      setTotalCount(invoicesRes.pagination?.total || mapped.length);

      if (agingRes) {
        const bucket = (b: any) => (b && typeof b === 'object' ? b : { count: b || 0, amount: 0 });
        const cur = bucket(agingRes.current);
        const d30 = bucket(agingRes.thirtyDay);
        const d60 = bucket(agingRes.sixtyDay);
        const d90 = bucket(agingRes.ninetyPlus);
        setAgingData([
          { label: t("invoicesPage.agingCategories.current"), count: cur.count, amount: `${t("kpi.sar")} ${Number(cur.amount).toLocaleString()}`, color: "bg-[#16A34A]" },
          { label: t("invoicesPage.agingCategories.days30"), count: d30.count, amount: `${t("kpi.sar")} ${Number(d30.amount).toLocaleString()}`, color: "bg-[#D97706]" },
          { label: t("invoicesPage.agingCategories.days60"), count: d60.count, amount: `${t("kpi.sar")} ${Number(d60.amount).toLocaleString()}`, color: "bg-[#EA580C]" },
          { label: t("invoicesPage.agingCategories.overdue90"), count: d90.count, amount: `${t("kpi.sar")} ${Number(d90.amount).toLocaleString()}`, color: "bg-[#DC2626]" },
        ]);
      }
    } catch {
      // Fallback to empty
    } finally {
      setLoading(false);
    }
  }, [page, locale, isRTL, t, activeTab, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusStyles: Record<string, string> = {
    issued: "bg-[#EFF6FF] text-[#3B82F6]",
    paid: "bg-[#DCFCE7] text-[#16A34A]",
    overdue: "bg-[#FEE2E2] text-[#DC2626]",
    draft: "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]",
    cancelled: "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]",
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

  const paidCount = invoices.filter((i) => i.status === "paid").length;
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  const stats = [
    { label: t("invoicesPage.stats.totalInvoices"), value: totalCount.toString(), icon: FileText, iconBg: "bg-[#EFF6FF]", iconColor: "text-[#3B82F6]" },
    { label: t("invoicesPage.stats.paidInvoices"), value: paidCount.toString(), icon: CheckCircle, iconBg: "bg-[#DCFCE7]", iconColor: "text-[#16A34A]" },
    { label: t("invoicesPage.stats.overdueInvoices"), value: overdueCount.toString(), icon: AlertTriangle, iconBg: "bg-[#FEE2E2]", iconColor: "text-[#DC2626]" },
    { label: t("invoicesPage.stats.totalAmount"), value: `${t("kpi.sar")} ${totalCount}`, icon: DollarSign, iconBg: "bg-[#DCFCE7]", iconColor: "text-[#16A34A]" },
  ];

  const handleDownloadPdf = async (invoiceId: string) => {
    try {
      const result = await invoiceApi.getPdfUrl(invoiceId);
      if (result.url) window.open(result.url, "_blank");
    } catch {}
    setOpenActionId(null);
  };

  const handleResendEmail = async (invoiceId: string) => {
    try {
      await invoiceApi.resend(invoiceId);
    } catch {}
    setOpenActionId(null);
  };

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
                <button className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
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
                        <p className="text-xl font-bold text-[var(--color-text-primary)]">{loading ? "..." : stat.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Invoices Table */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6">
                {/* Tabs + Search */}
                <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex gap-1 bg-[var(--color-surface-page)] rounded-lg p-0.5">
                        {tabs.map((tab) => (
                          <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setPage(1); }}
                            className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                              activeTab === tab.key
                                ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
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
                          className={`w-full sm:w-[260px] py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-[12px] text-[var(--color-text-secondary)]">{t("invoicesPage.filters.startDate")}</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                          className="px-2.5 py-1.5 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[12px] text-[var(--color-text-secondary)]">{t("invoicesPage.filters.endDate")}</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                          className="px-2.5 py-1.5 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]"
                        />
                      </div>
                      {(startDate || endDate) && (
                        <button
                          onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }}
                          className="text-[12px] text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium hover:underline"
                        >
                          {t("invoicesPage.filters.clearDates")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="p-12 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-[#B8860B] animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full" aria-label="Invoices">
                        <thead>
                          <tr className="border-b border-[var(--color-border)]">
                            <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.invoice")}</th>
                            <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.date")}</th>
                            <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.customer")}</th>
                            <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.course")}</th>
                            <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.amount")}</th>
                            <th scope="col" className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.status")}</th>
                            <th scope="col" className="py-3 px-4 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInvoices.map((inv) => (
                            <tr key={inv.id} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] transition-colors">
                              <td className="py-3 px-4">
                                <span className="text-[13px] font-medium text-[var(--color-primary)]">{inv.invoiceNumber}</span>
                              </td>
                              <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)]">{inv.date}</td>
                              <td className="py-3 px-4 text-[13px] text-[var(--color-text-primary)] font-medium">{inv.customer}</td>
                              <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">{inv.course}</td>
                              <td className="py-3 px-4 text-[13px] font-semibold text-[var(--color-text-primary)]">{inv.amount}</td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[inv.status] || statusStyles.draft}`}>
                                  {t(`invoicesPage.statuses.${inv.status}`)}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="relative">
                                  <button
                                    onClick={() => setOpenActionId(openActionId === inv.id ? null : inv.id)}
                                    aria-label="Actions"
                                    className="w-7 h-7 flex items-center justify-center border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>
                                  {openActionId === inv.id && (
                                    <div className={`absolute top-full mt-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[140px] z-20 ${isRTL ? "left-0" : "right-0"}`}>
                                      <button
                                        onClick={() => handleDownloadPdf(inv.id)}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        {t("invoicesPage.downloadPdf")}
                                      </button>
                                      <button
                                        onClick={() => handleResendEmail(inv.id)}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
                                      >
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
                    <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-[var(--color-border-subtle)] gap-3">
                      <p className="text-[13px] text-[var(--color-text-secondary)]">
                        {t("paymentsTable.pagination.showing", { from: 1, to: filteredInvoices.length, total: totalCount })}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          aria-label="Previous page"
                          className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          {t("paymentsTable.pagination.previous")}
                        </button>
                        <button
                          onClick={() => setPage((p) => p + 1)}
                          disabled={page >= totalCount / 50}
                          aria-label="Next page"
                          className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-50"
                        >
                          {t("paymentsTable.pagination.next")}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Aging Report */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[#EA580C]" />
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{t("invoicesPage.agingReport")}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {agingData.map((item, index) => (
                    <div key={index} className="p-4 bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                        <p className="text-[12px] text-[var(--color-text-secondary)] font-medium">{item.label}</p>
                      </div>
                      <p className="text-lg font-bold text-[var(--color-text-primary)]">{item.count} {t("invoicesLabel")}</p>
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
