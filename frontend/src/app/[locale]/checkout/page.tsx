"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ChevronDown, Calendar, Clock, Video, Lock, ChevronRight, ChevronLeft, Tag, Loader2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { paymentApi, discountApi } from "@/lib/api";

interface CourseData {
  id: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  price: string;
  // Course-level sale (no coupon needed). effectivePrice is what we charge.
  effectivePrice?: number;
  onSale?: boolean;
  salePercent?: number | null;
  saleAllowsCoupon?: boolean;
  deliveryType: string;
  startDate: string | null;
  cmeHours: number;
  thumbnail: string | null;
}

export default function CheckoutPage() {
  const t = useTranslations("checkoutPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId");

  // Course data
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment gateway selection
  const [gateway, setGateway] = useState<"moyasar" | "tabby" | "tamara" | "bank_transfer" | "mock">("moyasar");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "mada" | "apple_pay" | "bnpl" | "bank_transfer">("card");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Discount code
  const [discountCode, setDiscountCode] = useState("");
  const [discountResult, setDiscountResult] = useState<{
    valid: boolean;
    discountAmount: number;
    discountId: string | null;
    error?: string;
  } | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);

  // Fetch course data
  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }

    const fetchCourse = async () => {
      try {
        const response = await fetch(`/api/public-courses/${courseId}`);
        if (response.ok) {
          const data = await response.json();
          setCourse(data);
        }
      } catch (err) {
        console.error("Failed to fetch course:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  const originalPrice = Number(course?.price || 0);
  const onSale = course?.onSale ?? false;
  const salePercent = course?.salePercent ?? null;
  const effectivePrice = course?.effectivePrice ?? originalPrice;
  const saleAllowsCoupon = course?.saleAllowsCoupon ?? false;
  // A coupon may only be entered when there's no active sale, or the finance
  // manager explicitly allowed stacking a coupon on top of the sale.
  const couponAllowed = !onSale || saleAllowsCoupon;
  const saleDiscount = onSale ? Math.max(0, originalPrice - effectivePrice) : 0;
  const discountAmount = discountResult?.valid ? discountResult.discountAmount : 0;
  const totalAmount = Math.max(0, effectivePrice - discountAmount);

  const handleValidateDiscount = async () => {
    if (!discountCode.trim() || !courseId) return;
    setValidatingDiscount(true);
    try {
      const result = await discountApi.validate(discountCode, courseId);
      setDiscountResult(result);
    } catch (err: any) {
      setDiscountResult({
        valid: false,
        discountAmount: 0,
        discountId: null,
        error: err.message || t("errors.paymentFailed"),
      });
    } finally {
      setValidatingDiscount(false);
    }
  };

  const handleSubmit = async () => {
    if (!courseId || !course || processing) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await paymentApi.initiate({
        courseId,
        gateway,
        paymentMethod,
        discountCode: discountResult?.valid ? discountCode : undefined,
        locale: locale as "ar" | "en",
      });

      // Store courseId for post-payment flows (success/failed pages)
      try {
        sessionStorage.setItem("checkout_courseId", courseId);
      } catch {}

      // Redirect to gateway payment page
      window.location.href = result.redirectUrl;
    } catch (err: any) {
      setError(err.message || t("errors.paymentFailed"));
      setProcessing(false);
    }
  };

  // Set payment method based on gateway selection
  const handleGatewayChange = (gw: typeof gateway) => {
    setGateway(gw);
    if (gw === "tabby" || gw === "tamara") {
      setPaymentMethod("bnpl");
    } else if (gw === "bank_transfer") {
      setPaymentMethod("bank_transfer");
    } else {
      setPaymentMethod("card");
    }
  };

  // Handle keyboard selection for gateway radio buttons
  const handleGatewayKeyDown = (e: React.KeyboardEvent, gw: typeof gateway) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleGatewayChange(gw);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center" aria-label={t("payment.title")}>
          <Loader2 className="w-8 h-8 animate-spin text-[var(--on-surface-variant)]" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!courseId || !course) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4" dir={isRTL ? "rtl" : "ltr"}>
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">{t("errors.courseNotFound")}</h1>
            <p className="text-[var(--on-surface-variant)] mb-4">{t("errors.selectCourse")}</p>
            <Link href="/courses" className="btn-gold px-6 py-3 rounded-xl text-white font-medium focus-ring">
              {t("errors.browseCourses")}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const courseTitle = isRTL && course.titleAr ? course.titleAr : course.title;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
      <Navbar />

      <main id="main-content" className="flex-1 bg-[#F8FAFC] px-4 py-6 md:px-16 md:py-8" dir={isRTL ? "rtl" : "ltr"} aria-label={t("payment.title")}>
        {/* Breadcrumb */}
        <nav aria-label={isRTL ? "مسار التنقل" : "Breadcrumb"} className="flex items-center gap-2 text-sm mb-6">
          <Link href="/" className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] focus-ring rounded">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M6.66667 14.1667H13.3333M9.18141 2.30333L3.52949 6.69927C3.15168 6.99312 2.96278 7.14005 2.82669 7.32405C2.70614 7.48704 2.61633 7.67065 2.56169 7.86588C2.5 8.08627 2.5 8.32558 2.5 8.80421V14.8333C2.5 15.7667 2.5 16.2335 2.68166 16.59C2.84144 16.9036 3.09641 17.1585 3.41002 17.3183C3.76654 17.5 4.23325 17.5 5.16667 17.5H14.8333C15.7668 17.5 16.2335 17.5 16.59 17.3183C16.9036 17.1585 17.1586 16.9036 17.3183 16.59C17.5 16.2335 17.5 15.7667 17.5 14.8333V8.80421C17.5 8.32558 17.5 8.08627 17.4383 7.86588C17.3837 7.67065 17.2939 7.48704 17.1733 7.32405C17.0372 7.14005 16.8483 6.99312 16.4705 6.69927L10.8186 2.30333C10.5258 2.07562 10.3794 1.96177 10.2178 1.91918C10.0752 1.88168 9.92484 1.88168 9.78221 1.91918C9.62057 1.96177 9.47418 2.07562 9.18141 2.30333Z" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="sr-only">{isRTL ? "الرئيسية" : "Home"}</span>
          </Link>
          {isRTL ? <ChevronLeft size={14} className="text-[var(--on-surface-variant)]" aria-hidden="true" /> : <ChevronRight size={14} className="text-[var(--on-surface-variant)]" aria-hidden="true" />}
          <Link href="/courses" className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] focus-ring rounded">
            {t("breadcrumb.courses")}
          </Link>
          {isRTL ? <ChevronLeft size={14} className="text-[var(--on-surface-variant)]" aria-hidden="true" /> : <ChevronRight size={14} className="text-[var(--on-surface-variant)]" aria-hidden="true" />}
          <span className="text-[var(--on-surface-default)] font-medium" aria-current="page">{t("breadcrumb.buyNow")}</span>
        </nav>

        {/* Main Grid */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column - Course Details */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Course Info Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className={`text-xl font-semibold text-[#071437] mb-4 ${isRTL ? "text-right" : "text-left"}`}>
                {t("courseDetails.title")}
              </h2>

              <div className="flex gap-4">
                {course.thumbnail && (
                  <div className="relative w-[120px] h-[90px] rounded-lg overflow-hidden bg-[#eef3f7] flex-shrink-0">
                    <img
                      src={course.thumbnail.startsWith("http") ? course.thumbnail : `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "")}${course.thumbnail}`}
                      alt={courseTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#06080b] mb-2">{courseTitle}</h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    {course.deliveryType && (
                      <div className="flex items-center gap-1 bg-[#f4f4f5] px-2 py-1 rounded-lg text-sm text-[#4a4c4f]">
                        <Video className="w-4 h-4" aria-hidden="true" />
                        <span>{course.deliveryType}</span>
                      </div>
                    )}
                    {course.startDate && (
                      <div className="flex items-center gap-1 bg-[#f4f4f5] px-2 py-1 rounded-lg text-sm text-[#4a4c4f]">
                        <Calendar className="w-4 h-4" aria-hidden="true" />
                        <span>{new Date(course.startDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}</span>
                      </div>
                    )}
                    {course.cmeHours > 0 && (
                      <div className="flex items-center gap-1 bg-[#f4f4f5] px-2 py-1 rounded-lg text-sm text-[#4a4c4f]">
                        <Clock className="w-4 h-4" aria-hidden="true" />
                        <span>{course.cmeHours} {isRTL ? "ساعات" : "CME Hours"}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Discount Code Card */}
            {couponAllowed ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[var(--on-surface-default)] mb-3">
                {t("discount.title")}
              </h2>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--on-surface-variant)]`} aria-hidden="true" />
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => {
                      setDiscountCode(e.target.value.toUpperCase());
                      setDiscountResult(null);
                    }}
                    placeholder={t("discount.placeholder")}
                    aria-label={t("discount.title")}
                    className={`w-full h-12 ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-[var(--outline-focused)] focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 transition-colors`}
                    dir="ltr"
                  />
                </div>
                <button
                  onClick={handleValidateDiscount}
                  disabled={!discountCode.trim() || validatingDiscount}
                  aria-label={t("discount.apply")}
                  className="h-12 px-6 rounded-lg bg-[#f4f4f5] text-[var(--on-surface-default)] font-medium hover:bg-[#e5e5e5] transition-colors disabled:opacity-50 focus-ring"
                >
                  {validatingDiscount ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t("discount.apply")
                  )}
                </button>
              </div>
              {discountResult && (
                <p aria-live="polite" className={`mt-2 text-sm ${discountResult.valid ? "text-green-600" : "text-red-500"}`}>
                  {discountResult.valid
                    ? `${t("discount.applied")} SAR ${discountResult.discountAmount.toFixed(2)}`
                    : discountResult.error}
                </p>
              )}
            </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-[var(--on-surface-default)] mb-3">
                  {t("discount.title")}
                </h2>
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {t("discount.notAvailableOnSale")}
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Payment */}
          <div className="w-full lg:w-[400px]">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
              <h2 className="text-xl font-semibold text-[var(--on-surface-default)] mb-1">
                {t("payment.title")}
              </h2>
              <p className="text-sm text-[var(--on-surface-variant)] mb-4">
                {t("payment.subtitle")}
              </p>

              {/* Gateway Selection */}
              <div role="radiogroup" aria-label={t("payment.selectGateway")} className="flex flex-col gap-3 mb-4">
                {/* Moyasar */}
                <div
                  role="radio"
                  aria-checked={gateway === "moyasar"}
                  tabIndex={0}
                  onKeyDown={(e) => handleGatewayKeyDown(e, "moyasar")}
                  className={`cursor-pointer transition-colors border rounded-xl focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 outline-none ${
                    gateway === "moyasar" ? "border-[#005bd3]" : "border-[#e5e5e5]"
                  }`}
                  onClick={() => handleGatewayChange("moyasar")}
                >
                  <div className={`flex items-center justify-between p-[14px] ${gateway === "moyasar" ? "bg-[#e5edf4]" : "bg-white"} rounded-xl`}>
                    <div className="flex items-center gap-[11px]">
                      <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${gateway === "moyasar" ? "bg-white border-[6px] border-[#005bd3]" : "border-2 border-[#d5d7da] bg-white"}`} aria-hidden="true" />
                      <span className="font-medium text-[var(--on-surface-default)]">
                        {t("payment.moyasar")}
                      </span>
                    </div>
                    <div className="flex items-center gap-[11px]">
                      <Image src="/checkout_cart/mada.svg.svg" alt="Mada" width={30} height={10} className="object-contain" />
                      <Image src="/checkout_cart/visa.svg.svg" alt="Visa" width={30} height={18} className="object-contain" />
                    </div>
                  </div>
                </div>

                {/* Tabby BNPL */}
                <div
                  role="radio"
                  aria-checked={gateway === "tabby"}
                  tabIndex={0}
                  onKeyDown={(e) => handleGatewayKeyDown(e, "tabby")}
                  className={`cursor-pointer transition-colors border rounded-xl focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 outline-none ${
                    gateway === "tabby" ? "border-[#005bd3]" : "border-[#e5e5e5]"
                  }`}
                  onClick={() => handleGatewayChange("tabby")}
                >
                  <div className={`flex items-center justify-between p-[14px] ${gateway === "tabby" ? "bg-[#e5edf4]" : "bg-white"} rounded-xl`}>
                    <div className="flex items-center gap-[11px]">
                      <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${gateway === "tabby" ? "bg-white border-[6px] border-[#005bd3]" : "border-2 border-[#d5d7da] bg-white"}`} aria-hidden="true" />
                      <span className="font-medium text-[var(--on-surface-default)]">
                        {t("payment.tabby")}
                      </span>
                    </div>
                    <Image src="/checkout_cart/tabby.svg" alt="Tabby" width={60} height={24} className="object-contain" />
                  </div>
                </div>

                {/* Tamara BNPL */}
                <div
                  role="radio"
                  aria-checked={gateway === "tamara"}
                  tabIndex={0}
                  onKeyDown={(e) => handleGatewayKeyDown(e, "tamara")}
                  className={`cursor-pointer transition-colors border rounded-xl focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 outline-none ${
                    gateway === "tamara" ? "border-[#005bd3]" : "border-[#e5e5e5]"
                  }`}
                  onClick={() => handleGatewayChange("tamara")}
                >
                  <div className={`flex items-center justify-between p-[14px] ${gateway === "tamara" ? "bg-[#e5edf4]" : "bg-white"} rounded-xl`}>
                    <div className="flex items-center gap-[11px]">
                      <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${gateway === "tamara" ? "bg-white border-[6px] border-[#005bd3]" : "border-2 border-[#d5d7da] bg-white"}`} aria-hidden="true" />
                      <span className="font-medium text-[var(--on-surface-default)]">
                        {t("payment.tamara")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bank Transfer (out-of-band — buyer is redirected to the
                    receipt upload page after pressing Pay Now). */}
                <div
                  role="radio"
                  aria-checked={gateway === "bank_transfer"}
                  tabIndex={0}
                  onKeyDown={(e) => handleGatewayKeyDown(e, "bank_transfer")}
                  className={`cursor-pointer transition-colors border rounded-xl focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 outline-none ${
                    gateway === "bank_transfer" ? "border-[#005bd3]" : "border-[#e5e5e5]"
                  }`}
                  onClick={() => handleGatewayChange("bank_transfer")}
                >
                  <div className={`flex items-center justify-between p-[14px] ${gateway === "bank_transfer" ? "bg-[#e5edf4]" : "bg-white"} rounded-xl`}>
                    <div className="flex items-center gap-[11px]">
                      <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${gateway === "bank_transfer" ? "bg-white border-[6px] border-[#005bd3]" : "border-2 border-[#d5d7da] bg-white"}`} aria-hidden="true" />
                      <span className="font-medium text-[var(--on-surface-default)]">
                        {t("payment.bankTransfer")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="border-t border-[#e5e5e5] pt-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-[var(--on-surface-variant)]">{t("discount.subtotal")}</span>
                  <span className="text-sm font-medium">SAR {originalPrice.toFixed(2)}</span>
                </div>
                {saleDiscount > 0 && (
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-green-600">
                      {salePercent
                        ? t("discount.saleLabel", { percent: salePercent })
                        : t("discount.saleLabelGeneric")}
                    </span>
                    <span className="text-sm font-medium text-green-600">- SAR {saleDiscount.toFixed(2)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-green-600">{t("discount.discountLabel")}</span>
                    <span className="text-sm font-medium text-green-600">- SAR {discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-[#e5e5e5]">
                  <span className="font-semibold">{t("discount.total")}</span>
                  <span className="font-semibold text-lg">SAR {totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Secure Text */}
              <div className="flex items-center justify-center gap-1.5 text-sm text-[var(--on-surface-variant)] mb-4">
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>{t("payment.secureEncrypted")}</span>
              </div>

              {/* Error Message */}
              {error && (
                <div role="alert" className="bg-[#FEE2E2] rounded-lg px-4 py-3 mb-4">
                  <p className="text-[#DC2626] text-sm">{error}</p>
                </div>
              )}

              {/* Pay Now Button */}
              <button
                onClick={handleSubmit}
                disabled={processing}
                aria-busy={processing}
                aria-label={processing ? (isRTL ? "جاري المعالجة" : "Processing payment") : `${t("payment.payNow")} - SAR ${totalAmount.toFixed(2)}`}
                className="w-full h-12 rounded-xl text-white font-medium btn-gold hover:opacity-90 transition-opacity mb-4 flex items-center justify-center gap-2 disabled:opacity-50 focus-ring"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>{t("payment.processing")}</span>
                  </>
                ) : (
                  <span>{t("payment.payNow")} - SAR {totalAmount.toFixed(2)}</span>
                )}
              </button>

              {/* Secure Payment Footer */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-sm text-[var(--on-surface-variant)]">
                  {t("payment.securePaymentThrough")}
                </span>
                <div className="flex items-center gap-1.5">
                  <Image src="/checkout_cart/mastercard.svg.svg" alt="Mastercard" width={24} height={16} className="object-contain" />
                  <Image src="/checkout_cart/visa.svg.svg" alt="Visa" width={24} height={16} className="object-contain" />
                  <Image src="/checkout_cart/mada.svg.svg" alt="Mada" width={24} height={16} className="object-contain" />
                  <Image src="/checkout_cart/applePay.svg.svg" alt="Apple Pay" width={24} height={16} className="object-contain" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
