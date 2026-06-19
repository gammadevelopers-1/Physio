"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, Download, ArrowRight, ArrowLeft, Loader2, Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { paymentApi, invoiceApi } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import type { SiteSettings, NavigationLink } from "@/lib/strapi/types";

interface PaymentDetails {
  status: string;
  paymentId: string;
  amount?: string;
  currency?: string;
  gateway?: string;
  paidAt?: string;
}

interface PaymentSuccessPageClientProps {
  siteSettings: SiteSettings | null;
  navbarLinks: NavigationLink[];
  footerLinks: {
    platform: NavigationLink[];
    organization: NavigationLink[];
    support: NavigationLink[];
  };
}

export default function PaymentSuccessPageClient({
  siteSettings,
  navbarLinks,
  footerLinks,
}: PaymentSuccessPageClientProps) {
  const t = useTranslations("paymentSuccess");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId");

  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const { clearCart } = useCart();

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Tamara orders briefly sit in PENDING after redirect while our webhook
    // handler does authorise+capture (usually <2s). Poll once a second for
    // up to ~30s so buyers don't see a stuck spinner on the rare race where
    // the redirect arrives before the webhook processes.
    const MAX_POLL_ATTEMPTS = 30;
    const POLL_INTERVAL_MS = 1000;

    const checkAndMaybePoll = async (attempt: number) => {
      try {
        const data = await paymentApi.verify(paymentId);
        if (cancelled) return;
        setPayment(data);

        if (data?.status === 'paid' || data?.status === 'awaiting_approval') {
          // Terminal success — clear cart + checkout markers. Both "paid"
          // (live gateways) and "awaiting_approval" (bank transfer pending
          // review) count as cart-consumed.
          try {
            clearCart();
            sessionStorage.removeItem('checkout_courseId');
            sessionStorage.removeItem('checkout_paymentId');
          } catch {}
          setLoading(false);
          return;
        }

        if (
          (data?.status === 'pending' || data?.status === 'processing') &&
          attempt < MAX_POLL_ATTEMPTS
        ) {
          setTimeout(() => checkAndMaybePoll(attempt + 1), POLL_INTERVAL_MS);
          return;
        }

        // Terminal failure or polling exhausted — show whatever we last saw.
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    checkAndMaybePoll(0);
    return () => {
      cancelled = true;
    };
  }, [paymentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a confirmed payment, take the buyer to their courses (the one they
  // just bought is now unlocked there) — mirroring how real course platforms behave.
  useEffect(() => {
    if (payment?.status !== "paid") return;
    const timer = setTimeout(() => {
      router.replace(`/${locale}/dashboard/student/courses`);
    }, 4000);
    return () => clearTimeout(timer);
  }, [payment?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadInvoice = async () => {
    if (!paymentId) return;
    setDownloading(true);
    try {
      const myInvoices = await invoiceApi.getMyInvoices(1, 100);
      const invoice = myInvoices.data?.find(
        (inv: { paymentId?: string }) => inv.paymentId === paymentId
      );
      if (invoice) {
        const result = await invoiceApi.getPdfUrl(invoice.id);
        if (result.url) {
          window.open(result.url, "_blank");
        } else {
          toast.info(
            locale === "ar"
              ? "جاري إنشاء الفاتورة. سيتم إرسالها إلى بريدك الإلكتروني قريبًا."
              : "Invoice is being generated. It will be emailed to you shortly.",
          );
        }
      } else {
        toast.info(
          locale === "ar"
            ? "جاري إنشاء الفاتورة. سيتم إرسالها إلى بريدك الإلكتروني قريبًا."
            : "Invoice is being generated. It will be emailed to you shortly.",
        );
      }
    } catch {
      toast.info(
        locale === "ar"
          ? "جاري إنشاء الفاتورة. سيتم إرسالها إلى بريدك الإلكتروني قريبًا."
          : "Invoice is being generated. It will be emailed to you shortly.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-[#EEF3F7] flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      <Navbar
        siteSettings={siteSettings}
        navLinks={navbarLinks}
        footerLinks={footerLinks}
      />
      <main className="flex-1 flex items-center justify-center px-4 py-20" aria-label={t("title")}>
        <div role="status" aria-live="polite" className="bg-white rounded-2xl shadow-sm p-8 max-w-lg w-full text-center">
          {loading ? (
            <div className="py-12">
              <div className="w-8 h-8 border-2 border-[#B8860B] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {payment?.status === "awaiting_approval" ? (
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-10 h-10 text-blue-600" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
              )}

              <h1 className="text-2xl font-bold text-[#1a1a1a] mb-2">
                {payment?.status === "awaiting_approval"
                  ? t("pendingReviewTitle")
                  : t("title")}
              </h1>
              <p className="text-[#737373] mb-6">
                {payment?.status === "awaiting_approval"
                  ? t("pendingReviewSubtitle")
                  : t("subtitle")}
              </p>

              {payment && (
                <div
                  className={`${
                    payment.status === "awaiting_approval"
                      ? "bg-[#EFF6FF] border-blue-200"
                      : "bg-[#f0fdf4] border-green-200"
                  } border rounded-xl p-5 mb-6 text-left`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-[#737373]">
                        {t("paymentId")}
                      </span>
                      <span className="text-sm font-medium text-[#1a1a1a] font-mono">
                        {payment.paymentId?.slice(0, 8)}...
                      </span>
                    </div>
                    {payment.amount && (
                      <div className="flex justify-between">
                        <span className="text-sm text-[#737373]">
                          {t("amount")}
                        </span>
                        <span className="text-sm font-medium text-[#1a1a1a]">
                          {payment.currency || "SAR"} {payment.amount}
                        </span>
                      </div>
                    )}
                    {payment.gateway && (
                      <div className="flex justify-between">
                        <span className="text-sm text-[#737373]">
                          {t("gateway")}
                        </span>
                        <span className="text-sm font-medium text-[#1a1a1a] capitalize">
                          {payment.gateway === "bank_transfer"
                            ? t("bankTransfer")
                            : payment.gateway}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-[#737373]">
                        {t("status")}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          payment.status === "awaiting_approval"
                            ? "text-blue-600"
                            : "text-green-600"
                        }`}
                      >
                        {payment.status === "awaiting_approval"
                          ? t("awaitingApproval")
                          : t("paid")}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push(`/${locale}/dashboard/student/courses`)}
                  aria-label={t("goToMyCourses")}
                  className="w-full h-12 btn-gold rounded-xl text-white font-medium flex items-center justify-center gap-2 focus-ring"
                >
                  {t("goToMyCourses")}
                  <Arrow className="w-4 h-4" aria-hidden="true" />
                </button>
                {payment?.status === "paid" && (
                  <p className="text-xs text-[#737373]" aria-live="polite">
                    {t("redirecting")}
                  </p>
                )}
                {payment?.status !== "awaiting_approval" && (
                  <button
                    onClick={handleDownloadInvoice}
                    disabled={downloading}
                    aria-label={t("downloadInvoice")}
                    className="w-full h-12 border border-[#d9d9d9] rounded-xl text-[#1a1a1a] font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition focus-ring disabled:opacity-50"
                  >
                    {downloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="w-4 h-4" aria-hidden="true" />
                    )}
                    {t("downloadInvoice")}
                  </button>
                )}
                <button
                  onClick={() => router.push(`/${locale}/courses`)}
                  aria-label={t("browseCourses")}
                  className="text-sm text-[#737373] hover:text-[#1a1a1a] transition focus-ring rounded"
                >
                  {t("browseCourses")}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </div>
  );
}
