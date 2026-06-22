"use client";

import { useState, useEffect, use } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, XCircle, Loader2, ShieldCheck } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

interface VerifyResult {
  invoiceNumber: string;
  status: string;
  amount: string;
  subtotal?: string;
  taxAmount?: string;
  currency: string;
  issuedDate: string;
  paidDate: string | null;
  buyerName?: string | null;
  courseTitle?: string | null;
  courseTitleAr?: string | null;
  gateway?: string | null;
  paymentMethod?: string | null;
  itemCount?: number;
  verified: boolean;
}

interface Props {
  params: Promise<{ locale: string; number: string }>;
}

/**
 * QR-friendly variant of /verify-invoice that takes the invoice number as a
 * URL path segment (matches what we encode on the PDF QR code). The original
 * /verify-invoice page (with ?number=…) is kept for backwards compatibility
 * with older QRs already in customer wallets — same fetch, same UI.
 */
export default function VerifyInvoicePathPage({ params }: Props) {
  const { number: invoiceNumber } = use(params);
  const t = useTranslations("verifyInvoice");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!invoiceNumber) {
      setLoading(false);
      setError(true);
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/invoices/verify/${encodeURIComponent(invoiceNumber)}`
        );
        if (!res.ok) {
          setError(true);
        } else {
          setResult(await res.json());
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [invoiceNumber]);

  return (
    <div
      className="min-h-screen bg-[#EEF3F7] flex flex-col"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-lg w-full text-center">
          {loading ? (
            <div className="py-12">
              <Loader2 className="w-8 h-8 text-[#B8860B] animate-spin mx-auto" />
              <p className="text-sm text-[#737373] mt-4">{t("verifying")}</p>
            </div>
          ) : error ? (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-[#1a1a1a] mb-2">
                {t("notFound")}
              </h1>
              <p className="text-[#737373]">{t("notFoundDesc")}</p>
              <p className="text-xs text-[#9CA3AF] font-mono mt-4">
                {invoiceNumber}
              </p>
            </>
          ) : result ? (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-[#1a1a1a] mb-2">
                {t("verified")}
              </h1>
              <p className="text-[#737373] mb-6">{t("verifiedDesc")}</p>

              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-5 text-left space-y-3">
                <VerifyRow
                  label={t("invoiceNumber")}
                  value={<span className="font-mono">{result.invoiceNumber}</span>}
                />
                <VerifyRow
                  label={t("status")}
                  value={
                    <span
                      className={`font-medium capitalize ${
                        result.status === "paid"
                          ? "text-green-600"
                          : result.status === "cancelled"
                            ? "text-red-600"
                            : result.status === "refunded"
                              ? "text-violet-600"
                              : "text-yellow-600"
                      }`}
                    >
                      {result.status === "paid"
                        ? t("paid")
                        : result.status === "cancelled"
                          ? t("cancelled") || "Cancelled"
                          : result.status === "refunded"
                            ? t("refunded") || "Refunded"
                            : t("pending")}
                    </span>
                  }
                />
                {result.buyerName && (
                  <VerifyRow label={t("buyer") || "Issued to"} value={result.buyerName} />
                )}
                {(result.courseTitle || result.courseTitleAr) && (
                  <VerifyRow
                    label={t("course") || "Course"}
                    value={
                      <span>
                        {(isRTL && result.courseTitleAr) || result.courseTitle}
                        {(result.itemCount || 0) > 1 && (
                          <span className="text-[10px] text-[#9CA3AF] ms-1">
                            +{(result.itemCount || 1) - 1}
                          </span>
                        )}
                      </span>
                    }
                  />
                )}
                {result.gateway && (
                  <VerifyRow
                    label={t("paymentMethod") || "Payment"}
                    value={
                      <span className="capitalize">
                        {result.gateway === "bank_transfer"
                          ? "Bank Transfer"
                          : result.gateway}
                        {result.paymentMethod && (
                          <span className="text-[#6B7280] ms-1">
                            · {result.paymentMethod.replace(/_/g, " ")}
                          </span>
                        )}
                      </span>
                    }
                  />
                )}
                {result.subtotal && Number(result.subtotal) !== Number(result.amount) && (
                  <VerifyRow
                    label={t("subtotal") || "Subtotal"}
                    value={`${result.currency} ${Number(result.subtotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                  />
                )}
                {result.taxAmount && Number(result.taxAmount) > 0 && (
                  <VerifyRow
                    label={t("vat") || "VAT (15%)"}
                    value={`${result.currency} ${Number(result.taxAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                  />
                )}
                <VerifyRow
                  label={t("amount")}
                  value={
                    <span className="font-bold text-base">
                      {result.currency}{" "}
                      {Number(result.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  }
                />
                <VerifyRow
                  label={t("issuedDate")}
                  value={new Date(result.issuedDate).toLocaleString(
                    isRTL ? "ar-SA-u-nu-latn" : "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                />
                {result.paidDate && (
                  <VerifyRow
                    label={t("paidDate") || "Paid"}
                    value={new Date(result.paidDate).toLocaleString(
                      isRTL ? "ar-SA-u-nu-latn" : "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  />
                )}
              </div>

              <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#6B7280]">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                {t("verifiedFootnote") || "Verified directly against the PhysioGuidance ledger"}
              </div>
            </>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function VerifyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-[#6B7280] shrink-0">{label}</span>
      <span className="text-sm text-[#111827] text-right break-all">{value}</span>
    </div>
  );
}
