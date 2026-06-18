"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Calendar,
  Clock,
  Video,
  Lock,
  ChevronRight,
  ChevronLeft,
  Tag,
  Loader2,
  Trash2,
  Edit3,
  AlertCircle,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { paymentApi, discountApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, CartItem } from "@/contexts/CartContext";
import NonStudentEnrollmentNotice from "@/components/courses/NonStudentEnrollmentNotice";

// One course as the checkout page sees it. Cart items + express-mode
// fetches share this shape so the render code doesn't care which source
// the courses came from.
interface CheckoutItem {
  id: string;
  title: string;
  titleAr: string | null;
  description?: string | null;
  price: number;
  effectivePrice: number;
  onSale: boolean;
  salePercent: number | null;
  saleAllowsCoupon: boolean;
  deliveryType: string;
  startDate: string | null;
  cmeHours: number;
  thumbnail: string | null;
}

const VAT_RATE = 0.15;

function cartItemToCheckoutItem(item: CartItem): CheckoutItem {
  const effective = item.effectivePrice ?? item.price;
  return {
    id: item.id,
    title: item.title,
    titleAr: item.titleAr,
    price: item.price,
    effectivePrice: effective,
    onSale: !!item.onSale,
    salePercent: item.salePercent ?? null,
    saleAllowsCoupon: false, // unknown from cart payload; treat as not-stackable for the UI guard
    deliveryType: item.deliveryType || "",
    startDate: item.startDate,
    cmeHours: item.cmeHours || 0,
    thumbnail: item.thumbnail,
  };
}

export default function CheckoutPage() {
  const t = useTranslations("checkoutPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();

  // Two entry modes:
  //   * ?expressCourseId=X → single-course express buy (cart untouched)
  //   * no query param     → checkout the entire cart
  const expressCourseId = searchParams.get("expressCourseId");
  const isExpressMode = !!expressCourseId;

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { items: cartItems, removeItem, clearCart } = useCart();

  const isStudent = isAuthenticated && user?.activeRole === "STUDENT";
  // Non-student users see the inline policy notice instead of payment UI.
  // The backend's @Roles('STUDENT') on /payments/initiate is the real wall.
  const showNonStudentNotice = isAuthenticated && !isStudent;

  // Express-mode single-course fetch.
  const [expressItem, setExpressItem] = useState<CheckoutItem | null>(null);
  const [loadingExpress, setLoadingExpress] = useState(isExpressMode);

  // For SSR/hydration safety: cart lives in localStorage so the first server
  // render shows an empty list until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isExpressMode || !expressCourseId) {
      setLoadingExpress(false);
      return;
    }
    let cancelled = false;
    setLoadingExpress(true);
    fetch(`/api/public-courses/${expressCourseId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((data) => {
        if (cancelled) return;
        setExpressItem({
          id: data.id,
          title: data.title,
          titleAr: data.titleAr,
          description: data.description,
          price: Number(data.price ?? 0),
          effectivePrice: Number(data.effectivePrice ?? data.price ?? 0),
          onSale: !!data.onSale,
          salePercent: data.salePercent ?? null,
          saleAllowsCoupon: !!data.saleAllowsCoupon,
          deliveryType: data.deliveryType || "",
          startDate: data.startDate || null,
          cmeHours: Number(data.cmeHours ?? 0),
          thumbnail: data.thumbnail || null,
        });
      })
      .catch(() => {
        if (!cancelled) setExpressItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingExpress(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isExpressMode, expressCourseId]);

  // Unified item list — render code reads from this regardless of mode.
  const items = useMemo<CheckoutItem[]>(() => {
    if (isExpressMode) {
      return expressItem ? [expressItem] : [];
    }
    return cartItems.map(cartItemToCheckoutItem);
  }, [isExpressMode, expressItem, cartItems]);

  // Coupon stacking: blocked if ANY cart line is on sale without
  // saleAllowsCoupon. In cart mode, we don't know per-line stacking from
  // the localStorage snapshot, so any on-sale line conservatively blocks
  // coupon entry. Express mode reads the authoritative server flag.
  const couponBlocked = items.some(
    (it) => it.onSale && !it.saleAllowsCoupon,
  );
  const showCouponField = !couponBlocked;

  // Gateway state
  const [gateway, setGateway] = useState<
    "moyasar" | "tabby" | "tamara" | "bank_transfer" | "mock"
  >("moyasar");
  const [paymentMethod, setPaymentMethod] = useState<
    "card" | "mada" | "apple_pay" | "bnpl" | "bank_transfer"
  >("card");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Discount state
  const [discountCode, setDiscountCode] = useState("");
  const [discountResult, setDiscountResult] = useState<{
    valid: boolean;
    discountAmount: number;
    discountId: string | null;
    error?: string;
  } | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);

  // Totals
  const originalSubtotal = items.reduce((s, it) => s + it.price, 0);
  const subtotal = items.reduce((s, it) => s + it.effectivePrice, 0);
  const saleDiscount = Math.max(0, originalSubtotal - subtotal);
  const couponDiscount = discountResult?.valid ? discountResult.discountAmount : 0;
  const taxableAmount = Math.max(0, subtotal - couponDiscount);
  const vat = Math.round(taxableAmount * VAT_RATE * 100) / 100;
  const total = Math.round((taxableAmount + vat) * 100) / 100;

  const handleValidateDiscount = async () => {
    if (!discountCode.trim() || items.length === 0) return;
    setValidatingDiscount(true);
    try {
      // The backend validates against the cart subtotal but keys the lookup
      // by the first course id (same as Phase 2A's initiate flow). Mirror
      // that here so the preview matches the authoritative server result.
      const result = await discountApi.validate(discountCode, items[0].id);
      setDiscountResult(result);
    } catch (err: any) {
      setDiscountResult({
        valid: false,
        discountAmount: 0,
        discountId: null,
        error: err?.message || t("errors.paymentFailed"),
      });
    } finally {
      setValidatingDiscount(false);
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0 || processing) return;
    if (!isStudent) return; // defensive — UI hides the button for non-students

    setProcessing(true);
    setError(null);

    try {
      const result = await paymentApi.initiate({
        courseIds: items.map((it) => it.id),
        gateway,
        paymentMethod,
        discountCode: discountResult?.valid ? discountCode : undefined,
        locale: locale as "ar" | "en",
      });

      // Remember the payment id for the success/failed pages (some gateways
      // strip our params from their redirect).
      try {
        sessionStorage.setItem("checkout_paymentId", result.paymentId);
        // Cart will be cleared on the success page once we confirm PAID —
        // until then leave it alone so the buyer can retry on failure.
      } catch {}

      window.location.href = result.redirectUrl;
    } catch (err: any) {
      setError(err?.message || t("errors.paymentFailed"));
      setProcessing(false);
    }
  };

  const handleGatewayChange = (gw: typeof gateway) => {
    setGateway(gw);
    if (gw === "tabby" || gw === "tamara") setPaymentMethod("bnpl");
    else if (gw === "bank_transfer") setPaymentMethod("bank_transfer");
    else setPaymentMethod("card");
  };

  const handleGatewayKeyDown = (e: React.KeyboardEvent, gw: typeof gateway) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleGatewayChange(gw);
    }
  };

  const handleRemoveItem = (id: string) => {
    if (isExpressMode) return; // express mode has exactly one item
    removeItem(id);
    if (discountResult) setDiscountResult(null); // re-validate after change
  };

  // ────────────────────────── render guards ──────────────────────────

  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  if (authLoading || (isExpressMode && loadingExpress) || !mounted) {
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

  // Empty: cart mode with no items OR express mode where the course didn't load.
  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
        <Navbar />
        <main
          className="flex-1 flex items-center justify-center px-4"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-semibold mb-2">
              {isExpressMode
                ? t("errors.courseNotFound")
                : t("errors.emptyCart")}
            </h1>
            <p className="text-[var(--on-surface-variant)] mb-4">
              {isExpressMode
                ? t("errors.selectCourse")
                : t("errors.emptyCartHint")}
            </p>
            <Link
              href={isExpressMode ? `/${locale}/courses` : `/${locale}/cart`}
              className="btn-gold px-6 py-3 rounded-xl text-white font-medium focus-ring"
            >
              {isExpressMode ? t("errors.browseCourses") : t("errors.goToCart")}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ────────────────────────── render ──────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
      <Navbar />

      <main
        id="main-content"
        className="flex-1 bg-[#F8FAFC] px-4 py-6 md:px-16 md:py-8"
        dir={isRTL ? "rtl" : "ltr"}
        aria-label={t("payment.title")}
      >
        {/* Breadcrumb */}
        <nav aria-label={isRTL ? "مسار التنقل" : "Breadcrumb"} className="flex items-center gap-2 text-sm mb-6">
          <Link href="/" className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] focus-ring rounded">
            {isRTL ? "الرئيسية" : "Home"}
          </Link>
          <Chevron size={14} className="text-[var(--on-surface-variant)]" aria-hidden="true" />
          {!isExpressMode && (
            <>
              <Link
                href={`/${locale}/cart`}
                className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] focus-ring rounded"
              >
                {t("breadcrumb.cart")}
              </Link>
              <Chevron size={14} className="text-[var(--on-surface-variant)]" aria-hidden="true" />
            </>
          )}
          <span className="text-[var(--on-surface-default)] font-medium" aria-current="page">
            {t("breadcrumb.checkout")}
          </span>
        </nav>

        {/* Non-student gate — replaces the whole order/payment grid */}
        {showNonStudentNotice ? (
          <div className="max-w-2xl mx-auto">
            <NonStudentEnrollmentNotice
              roleLabel={user?.activeRole || ""}
              canSwitchToStudent={(user?.roles || []).includes("STUDENT")}
            />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* ── Left: Order ── */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-xl font-semibold text-[#071437] ${isRTL ? "text-right" : "text-left"}`}>
                    {t("orderTitle", { count: items.length })}
                  </h2>
                  {!isExpressMode && (
                    <Link
                      href={`/${locale}/cart`}
                      className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {t("editOrder")}
                    </Link>
                  )}
                </div>

                <div className="space-y-3">
                  {items.map((item) => {
                    const title = isRTL && item.titleAr ? item.titleAr : item.title;
                    return (
                      <div
                        key={item.id}
                        className="flex gap-4 p-3 border border-[#E5E7EB] rounded-xl"
                      >
                        {item.thumbnail && (
                          <div className="relative w-[100px] h-[75px] rounded-lg overflow-hidden bg-[#eef3f7] flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                item.thumbnail.startsWith("http")
                                  ? item.thumbnail
                                  : `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "")}${item.thumbnail}`
                              }
                              alt={title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-[#06080b] line-clamp-2">
                              {title}
                            </h3>
                            {!isExpressMode && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="flex-shrink-0 p-1 text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors"
                                aria-label={t("removeItem")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1.5">
                            {item.deliveryType && (
                              <span className="inline-flex items-center gap-1 bg-[#f4f4f5] px-2 py-0.5 rounded text-[11px] text-[#4a4c4f]">
                                <Video className="w-3 h-3" aria-hidden="true" />
                                {item.deliveryType}
                              </span>
                            )}
                            {item.startDate && (
                              <span className="inline-flex items-center gap-1 bg-[#f4f4f5] px-2 py-0.5 rounded text-[11px] text-[#4a4c4f]">
                                <Calendar className="w-3 h-3" aria-hidden="true" />
                                {new Date(item.startDate).toLocaleDateString(
                                  locale === "ar" ? "ar-SA" : "en-US",
                                )}
                              </span>
                            )}
                            {item.cmeHours > 0 && (
                              <span className="inline-flex items-center gap-1 bg-[#f4f4f5] px-2 py-0.5 rounded text-[11px] text-[#4a4c4f]">
                                <Clock className="w-3 h-3" aria-hidden="true" />
                                {item.cmeHours} {isRTL ? "ساعات" : "CME"}
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-2 mt-2">
                            {item.onSale && item.effectivePrice !== item.price ? (
                              <>
                                <span className="text-sm font-bold text-[#06080b]">
                                  SAR {item.effectivePrice.toFixed(2)}
                                </span>
                                <span className="text-xs text-[#9CA3AF] line-through">
                                  SAR {item.price.toFixed(2)}
                                </span>
                                {item.salePercent != null && (
                                  <span className="text-[10px] font-semibold text-[#15803D] bg-[#DCFCE7] px-1.5 py-0.5 rounded">
                                    -{item.salePercent}%
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm font-bold text-[#06080b]">
                                SAR {item.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Buyer Details Card */}
              {user && (
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-[var(--on-surface-default)]">
                      {t("buyerDetails")}
                    </h2>
                    <Link
                      href={`/${locale}/dashboard/student/settings`}
                      className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {t("editProfile")}
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-[var(--on-surface-variant)] mb-0.5">
                        {t("buyerName")}
                      </p>
                      <p className="font-medium text-[var(--on-surface-default)]">
                        {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--on-surface-variant)] mb-0.5">
                        {t("buyerEmail")}
                      </p>
                      <p className="font-medium text-[var(--on-surface-default)] break-all">
                        {user.email}
                      </p>
                    </div>
                    {user.phone && (
                      <div>
                        <p className="text-xs text-[var(--on-surface-variant)] mb-0.5">
                          {t("buyerPhone")}
                        </p>
                        <p className="font-medium text-[var(--on-surface-default)]">
                          {user.phone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Discount Code Card */}
              {showCouponField ? (
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

            {/* ── Right: Payment ── */}
            <div className="w-full lg:w-[400px]">
              <div className="bg-white rounded-2xl p-6 shadow-sm lg:sticky lg:top-24">
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
                    className={`cursor-pointer transition-colors border rounded-xl focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 outline-none ${gateway === "moyasar" ? "border-[#005bd3]" : "border-[#e5e5e5]"}`}
                    onClick={() => handleGatewayChange("moyasar")}
                  >
                    <div className={`flex items-center justify-between p-[14px] ${gateway === "moyasar" ? "bg-[#e5edf4]" : "bg-white"} rounded-xl`}>
                      <div className="flex items-center gap-[11px]">
                        <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${gateway === "moyasar" ? "bg-white border-[6px] border-[#005bd3]" : "border-2 border-[#d5d7da] bg-white"}`} aria-hidden="true" />
                        <span className="font-medium text-[var(--on-surface-default)]">{t("payment.moyasar")}</span>
                      </div>
                      <div className="flex items-center gap-[11px]">
                        <Image src="/checkout_cart/mada.svg.svg" alt="Mada" width={30} height={10} className="object-contain" />
                        <Image src="/checkout_cart/visa.svg.svg" alt="Visa" width={30} height={18} className="object-contain" />
                      </div>
                    </div>
                  </div>

                  {/* Tabby */}
                  <div
                    role="radio"
                    aria-checked={gateway === "tabby"}
                    tabIndex={0}
                    onKeyDown={(e) => handleGatewayKeyDown(e, "tabby")}
                    className={`cursor-pointer transition-colors border rounded-xl focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 outline-none ${gateway === "tabby" ? "border-[#005bd3]" : "border-[#e5e5e5]"}`}
                    onClick={() => handleGatewayChange("tabby")}
                  >
                    <div className={`flex items-center justify-between p-[14px] ${gateway === "tabby" ? "bg-[#e5edf4]" : "bg-white"} rounded-xl`}>
                      <div className="flex items-center gap-[11px]">
                        <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${gateway === "tabby" ? "bg-white border-[6px] border-[#005bd3]" : "border-2 border-[#d5d7da] bg-white"}`} aria-hidden="true" />
                        <span className="font-medium text-[var(--on-surface-default)]">{t("payment.tabby")}</span>
                      </div>
                      <Image src="/checkout_cart/tabby.svg" alt="Tabby" width={60} height={24} className="object-contain" />
                    </div>
                  </div>

                  {/* Tamara */}
                  <div
                    role="radio"
                    aria-checked={gateway === "tamara"}
                    tabIndex={0}
                    onKeyDown={(e) => handleGatewayKeyDown(e, "tamara")}
                    className={`cursor-pointer transition-colors border rounded-xl focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 outline-none ${gateway === "tamara" ? "border-[#005bd3]" : "border-[#e5e5e5]"}`}
                    onClick={() => handleGatewayChange("tamara")}
                  >
                    <div className={`flex items-center justify-between p-[14px] ${gateway === "tamara" ? "bg-[#e5edf4]" : "bg-white"} rounded-xl`}>
                      <div className="flex items-center gap-[11px]">
                        <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${gateway === "tamara" ? "bg-white border-[6px] border-[#005bd3]" : "border-2 border-[#d5d7da] bg-white"}`} aria-hidden="true" />
                        <span className="font-medium text-[var(--on-surface-default)]">{t("payment.tamara")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bank Transfer */}
                  <div
                    role="radio"
                    aria-checked={gateway === "bank_transfer"}
                    tabIndex={0}
                    onKeyDown={(e) => handleGatewayKeyDown(e, "bank_transfer")}
                    className={`cursor-pointer transition-colors border rounded-xl focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 outline-none ${gateway === "bank_transfer" ? "border-[#005bd3]" : "border-[#e5e5e5]"}`}
                    onClick={() => handleGatewayChange("bank_transfer")}
                  >
                    <div className={`flex items-center justify-between p-[14px] ${gateway === "bank_transfer" ? "bg-[#e5edf4]" : "bg-white"} rounded-xl`}>
                      <div className="flex items-center gap-[11px]">
                        <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${gateway === "bank_transfer" ? "bg-white border-[6px] border-[#005bd3]" : "border-2 border-[#d5d7da] bg-white"}`} aria-hidden="true" />
                        <span className="font-medium text-[var(--on-surface-default)]">{t("payment.bankTransfer")}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="border-t border-[#e5e5e5] pt-4 mb-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--on-surface-variant)]">{t("discount.subtotal")}</span>
                    <span className="text-sm font-medium">SAR {originalSubtotal.toFixed(2)}</span>
                  </div>
                  {saleDiscount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-green-600">{t("discount.saleLabelGeneric")}</span>
                      <span className="text-sm font-medium text-green-600">- SAR {saleDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-green-600">{t("discount.discountLabel")}</span>
                      <span className="text-sm font-medium text-green-600">- SAR {couponDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--on-surface-variant)]">{t("vatLabel")}</span>
                    <span className="text-sm font-medium">SAR {vat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#e5e5e5]">
                    <span className="font-semibold">{t("discount.total")}</span>
                    <span className="font-semibold text-lg">SAR {total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Secure Text */}
                <div className="flex items-center justify-center gap-1.5 text-sm text-[var(--on-surface-variant)] mb-4">
                  <Lock className="w-4 h-4" aria-hidden="true" />
                  <span>{t("payment.secureEncrypted")}</span>
                </div>

                {error && (
                  <div role="alert" className="bg-[#FEE2E2] rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
                    <p className="text-[#DC2626] text-sm">{error}</p>
                  </div>
                )}

                {/* Single Pay button */}
                <button
                  onClick={handleSubmit}
                  disabled={processing}
                  aria-busy={processing}
                  aria-label={processing ? (isRTL ? "جاري المعالجة" : "Processing payment") : `${t("payment.payNow")} SAR ${total.toFixed(2)}`}
                  className="w-full h-12 rounded-xl text-white font-medium btn-gold hover:opacity-90 transition-opacity mb-4 flex items-center justify-center gap-2 disabled:opacity-50 focus-ring"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>{t("payment.processing")}</span>
                    </>
                  ) : (
                    <span>{t("payment.payNow")} SAR {total.toFixed(2)}</span>
                  )}
                </button>

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
        )}
      </main>

      <Footer />
    </div>
  );
}
