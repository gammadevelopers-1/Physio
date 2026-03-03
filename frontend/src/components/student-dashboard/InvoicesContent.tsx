"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, MoreVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { invoiceApi } from "@/lib/api";
import RefundRequestModal from "./RefundRequestModal";

interface Invoice {
  id: string;
  paymentId: string;
  invoiceNo: string;
  amount: number;
  date: string;
  status: "paid" | "pending" | "cancelled";
}

const InvoicesContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundModal, setRefundModal] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await invoiceApi.getMyInvoices(1, 50);
        const mapped: Invoice[] = (res.data || []).map((inv: any) => ({
          id: inv.id,
          paymentId: inv.paymentId || inv.id,
          invoiceNo: inv.invoiceNumber || inv.id.slice(0, 8),
          amount: Number(inv.totalAmount) || 0,
          date: new Date(inv.issuedAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { day: "numeric", month: "numeric", year: "2-digit" }),
          status: (inv.status === "issued" ? "pending" : inv.status === "cancelled" ? "cancelled" : "paid") as Invoice["status"],
        }));
        setInvoices(mapped);
      } catch {
        // Keep empty
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [locale]);

  const getStatusLabel = (status: Invoice["status"]) => {
    switch (status) {
      case "paid":
        return t("invoices.statusPaid");
      case "pending":
        return t("invoices.statusPending");
      case "cancelled":
        return t("invoices.statusCancelled");
      default:
        return status;
    }
  };

  const getStatusColor = (status: Invoice["status"]) => {
    switch (status) {
      case "paid":
        return "text-[#16A34A]";
      case "pending":
        return "text-[#D4A520]";
      case "cancelled":
        return "text-[#DC2626]";
      default:
        return "text-[#6B7280]";
    }
  };

  const toggleMenu = (id: string) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleDownload = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    setOpenMenuId(null);
    try {
      const result = await invoiceApi.getPdfUrl(invoiceId);
      if (result.url) {
        window.open(result.url, "_blank");
      } else {
        toast.info(t("invoices.pdfGenerating"));
      }
    } catch {
      toast.info(t("invoices.pdfGenerating"));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <DashboardNavbar user={userData} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar user={userData} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1
                className={`text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6 ${isRTL ? "text-right" : ""}`}
              >
                {t("invoices.title")}
              </h1>

              {/* Invoices Section */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-[#B8860B] animate-spin" />
                  </div>
                ) : invoices.length === 0 ? (
                  // Empty State
                  <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                      <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-[#9CA3AF]" />
                    </div>
                    <h3 className="text-sm sm:text-base font-medium text-[#1F2937] mb-1">
                      {t("invoices.noInvoicesTitle")}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6B7280] text-center px-4">
                      {t("invoices.noInvoicesDescription")}
                    </p>
                  </div>
                ) : (
                  // Invoices Table
                  <div className="overflow-x-auto">
                    {/* Desktop Table */}
                    <table
                      className="w-full hidden sm:table"
                      dir={isRTL ? "rtl" : "ltr"}
                    >
                      <thead>
                        <tr className="border-b border-[#E5E7EB]">
                          <th
                            className={`py-3 px-4 text-xs font-medium text-[#6B7280] ${isRTL ? "text-right" : "text-left"}`}
                          >
                            {t("invoices.invoiceNo")}
                          </th>
                          <th
                            className={`py-3 px-4 text-xs font-medium text-[#6B7280] ${isRTL ? "text-right" : "text-left"}`}
                          >
                            {t("invoices.amount")}
                          </th>
                          <th
                            className={`py-3 px-4 text-xs font-medium text-[#6B7280] ${isRTL ? "text-right" : "text-left"}`}
                          >
                            {t("invoices.date")}
                          </th>
                          <th
                            className={`py-3 px-4 text-xs font-medium text-[#6B7280] ${isRTL ? "text-right" : "text-left"}`}
                          >
                            {t("invoices.status")}
                          </th>
                          <th className="py-3 px-4 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice) => (
                          <tr
                            key={invoice.id}
                            className="border-b border-[#E5E7EB] last:border-b-0 hover:bg-[#F9FAFB] transition-colors"
                          >
                            <td
                              className={`py-4 px-4 text-sm text-[#1F2937] ${isRTL ? "text-right" : "text-left"}`}
                            >
                              {invoice.invoiceNo}
                            </td>
                            <td
                              className={`py-4 px-4 text-sm text-[#1F2937] ${isRTL ? "text-right" : "text-left"}`}
                            >
                              {invoice.amount.toFixed(2)}
                            </td>
                            <td
                              className={`py-4 px-4 text-sm text-[#1F2937] ${isRTL ? "text-right" : "text-left"}`}
                            >
                              {invoice.date}
                            </td>
                            <td
                              className={`py-4 px-4 ${isRTL ? "text-right" : "text-left"}`}
                            >
                              <span
                                className={`inline-flex items-center gap-1.5 text-sm ${getStatusColor(invoice.status)}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                {getStatusLabel(invoice.status)}
                              </span>
                            </td>
                            <td className="py-4 px-4 relative">
                              {downloadingId === invoice.id ? (
                                <div className="p-1">
                                  <Loader2 className="w-5 h-5 text-[#B8860B] animate-spin" />
                                </div>
                              ) : (
                              <button
                                onClick={() => toggleMenu(invoice.id)}
                                className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                                aria-label={t("invoices.moreOptions")}
                              >
                                <MoreVertical className="w-5 h-5 text-[#6B7280]" />
                              </button>
                              )}
                              {openMenuId === invoice.id && (
                                <div
                                  className={`absolute top-full ${isRTL ? "left-0" : "right-0"} mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-10 min-w-[140px]`}
                                >
                                  <button
                                    className={`w-full px-4 py-2 text-sm text-[#1F2937] hover:bg-[#F9FAFB] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                                    onClick={() => handleDownload(invoice.id)}
                                  >
                                    {t("invoices.downloadInvoice")}
                                  </button>
                                  {invoice.status === "paid" && (
                                    <button
                                      className={`w-full px-4 py-2 text-sm text-[#DC2626] hover:bg-[#FEE2E2] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setRefundModal({ open: true, invoice });
                                      }}
                                    >
                                      {t("invoices.requestRefund")}
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile Cards */}
                    <div className="sm:hidden space-y-3">
                      {invoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="border border-[#E5E7EB] rounded-lg p-4"
                          dir={isRTL ? "rtl" : "ltr"}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-[#1F2937]">
                              {invoice.invoiceNo}
                            </span>
                            <div className="relative">
                              {downloadingId === invoice.id ? (
                                <div className="p-1">
                                  <Loader2 className="w-5 h-5 text-[#B8860B] animate-spin" />
                                </div>
                              ) : (
                              <button
                                onClick={() => toggleMenu(invoice.id)}
                                className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                                aria-label={t("invoices.moreOptions")}
                              >
                                <MoreVertical className="w-5 h-5 text-[#6B7280]" />
                              </button>
                              )}
                              {openMenuId === invoice.id && (
                                <div
                                  className={`absolute top-full ${isRTL ? "left-0" : "right-0"} mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-10 min-w-[140px]`}
                                >
                                  <button
                                    className={`w-full px-4 py-2 text-sm text-[#1F2937] hover:bg-[#F9FAFB] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                                    onClick={() => handleDownload(invoice.id)}
                                  >
                                    {t("invoices.downloadInvoice")}
                                  </button>
                                  {invoice.status === "paid" && (
                                    <button
                                      className={`w-full px-4 py-2 text-sm text-[#DC2626] hover:bg-[#FEE2E2] transition-colors ${isRTL ? "text-right" : "text-left"}`}
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setRefundModal({ open: true, invoice });
                                      }}
                                    >
                                      {t("invoices.requestRefund")}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-[#6B7280] text-xs mb-0.5">
                                {t("invoices.amount")}
                              </p>
                              <p className="text-[#1F2937]">
                                {invoice.amount.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[#6B7280] text-xs mb-0.5">
                                {t("invoices.date")}
                              </p>
                              <p className="text-[#1F2937]">{invoice.date}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-[#6B7280] text-xs mb-0.5">
                                {t("invoices.status")}
                              </p>
                              <span
                                className={`inline-flex items-center gap-1.5 text-sm ${getStatusColor(invoice.status)}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                {getStatusLabel(invoice.status)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Refund Request Modal */}
      {refundModal.invoice && (
        <RefundRequestModal
          isOpen={refundModal.open}
          onClose={() => setRefundModal({ open: false, invoice: null })}
          paymentId={refundModal.invoice.paymentId}
          invoiceNumber={refundModal.invoice.invoiceNo}
          amount={refundModal.invoice.amount}
        />
      )}
    </>
  );
};

export default InvoicesContent;
