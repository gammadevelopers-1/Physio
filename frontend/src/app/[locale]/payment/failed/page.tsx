"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { XCircle, RefreshCw, ArrowRight, ArrowLeft } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { paymentApi } from "@/lib/api";

const ERROR_KEY_MAP: Record<string, string> = {
  card_declined: "cardDeclined",
  insufficient_funds: "insufficientFunds",
  expired_card: "expiredCard",
  gateway_timeout: "gatewayTimeout",
};

export default function PaymentFailedPage() {
  const t = useTranslations("paymentFailed");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId");
  const errorParam = searchParams.get("error");

  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Get courseId from sessionStorage for retry
  let courseId: string | null = null;
  try {
    courseId = typeof window !== "undefined" ? sessionStorage.getItem("checkout_courseId") : null;
  } catch {}

  // Try to get error details from URL param or by verifying the payment
  useEffect(() => {
    if (errorParam) {
      const key = ERROR_KEY_MAP[errorParam];
      if (key) {
        setErrorDetail(t(`errors.${key}`));
      }
      return;
    }

    if (paymentId) {
      paymentApi
        .verify(paymentId)
        .then((data) => {
          if (data?.failureReason) {
            // Try to match known error codes
            const reason = data.failureReason.toLowerCase();
            if (reason.includes("declined")) {
              setErrorDetail(t("errors.cardDeclined"));
            } else if (reason.includes("insufficient")) {
              setErrorDetail(t("errors.insufficientFunds"));
            } else if (reason.includes("expired")) {
              setErrorDetail(t("errors.expiredCard"));
            } else if (reason.includes("timeout")) {
              setErrorDetail(t("errors.gatewayTimeout"));
            }
          }
        })
        .catch(() => {});
    }
  }, [paymentId, errorParam, t]);

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-[#EEF3F7] flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-20" aria-label={t("title")}>
        <div role="alert" className="bg-white rounded-2xl shadow-sm p-8 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-600" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold text-[#1a1a1a] mb-2">
            {t("title")}
          </h1>
          <p className="text-[#737373] mb-6">{t("subtitle")}</p>

          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 space-y-2">
            <p className="text-sm text-red-700">{t("message")}</p>
            {errorDetail && (
              <p className="text-sm font-medium text-red-800">{errorDetail}</p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                if (courseId) {
                  router.push(`/${locale}/checkout?courseId=${courseId}`);
                } else {
                  router.back();
                }
              }}
              aria-label={t("tryAgain")}
              className="w-full h-12 btn-gold rounded-xl text-white font-medium flex items-center justify-center gap-2 focus-ring"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              {t("tryAgain")}
            </button>
            <button
              onClick={() => router.push(`/${locale}/courses`)}
              aria-label={t("browseCourses")}
              className="w-full h-12 border border-[#d9d9d9] rounded-xl text-[#1a1a1a] font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition focus-ring"
            >
              {t("browseCourses")}
              <Arrow className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
