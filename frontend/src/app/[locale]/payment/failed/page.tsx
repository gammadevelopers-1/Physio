"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { XCircle, RefreshCw, ArrowRight, ArrowLeft } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

export default function PaymentFailedPage() {
  const t = useTranslations("paymentFailed");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId");

  // Get courseId from sessionStorage for retry
  let courseId: string | null = null;
  try {
    courseId = typeof window !== "undefined" ? sessionStorage.getItem("checkout_courseId") : null;
  } catch {}

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-[#EEF3F7] flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>

          <h1 className="text-2xl font-bold text-[#1a1a1a] mb-2">
            {t("title")}
          </h1>
          <p className="text-[#737373] mb-6">{t("subtitle")}</p>

          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
            <p className="text-sm text-red-700">{t("message")}</p>
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
              className="w-full h-12 btn-gold rounded-xl text-white font-medium flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {t("tryAgain")}
            </button>
            <button
              onClick={() => router.push(`/${locale}/courses`)}
              className="w-full h-12 border border-[#d9d9d9] rounded-xl text-[#1a1a1a] font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition"
            >
              {t("browseCourses")}
              <Arrow className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
