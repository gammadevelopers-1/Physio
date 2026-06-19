"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart, CartItem } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import NonStudentEnrollmentNotice from "@/components/courses/NonStudentEnrollmentNotice";
import BnplPromoWidgets from "@/components/courses/BnplPromoWidgets";
import { studentApi } from "@/lib/api";
import {
  ShoppingCart,
  Trash2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Clock,
  Award,
  User,
  Lock,
} from "lucide-react";
import type { SiteSettings, NavigationLink } from "@/lib/strapi/types";

// VAT shown on the cart page is informational only — final tax + gateway
// rounding happen on the checkout/payment server. Keep this in sync with
// PaymentsService VAT_RATE on the backend.
const VAT_RATE = 0.15;

const lineFor = (item: CartItem) =>
  item.effectivePrice != null ? item.effectivePrice : item.price;

interface CartPageClientProps {
  siteSettings: SiteSettings | null;
  navbarLinks: NavigationLink[];
  footerLinks: {
    platform: NavigationLink[];
    organization: NavigationLink[];
    support: NavigationLink[];
  };
}

export default function CartPageClient({
  siteSettings,
  navbarLinks,
  footerLinks,
}: CartPageClientProps) {
  const t = useTranslations("cartPage");
  const locale = useLocale();
  const router = useRouter();
  const isRTL = locale === "ar";
  const { items, removeItem, clearCart, itemCount } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);

  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  // Non-students see the same inline notice as the course detail page.
  // The backend's @Roles('STUDENT') on /payments/initiate is the real wall;
  // this just stops them from getting to the checkout button at all.
  const isStudent = isAuthenticated && user?.activeRole === "STUDENT";
  const showNonStudentNotice = isAuthenticated && !isStudent;

  // Prevent hydration mismatch — cart lives in localStorage.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Already-enrolled lookup for everything in the cart. We disable the
  // proceed button (and surface a per-item badge below) so the buyer
  // never tries to pay for a course they already own. Map is keyed by
  // course id; unknown ids default to "not enrolled" so the regular
  // line item renders as-is.
  const [enrolledMap, setEnrolledMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated || !isStudent) return;
    if (items.length === 0) {
      setEnrolledMap({});
      return;
    }
    let cancelled = false;
    studentApi
      .getEnrollmentStatus(items.map((it) => it.id))
      .then((res) => {
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        for (const [id, entry] of Object.entries(res.byId || {})) {
          next[id] = !!entry?.isEnrolled;
        }
        setEnrolledMap(next);
      })
      .catch(() => {
        // Silent — backend's INSERT-time guard catches anything we miss.
        if (!cancelled) setEnrolledMap({});
      });
    return () => {
      cancelled = true;
    };
    // Recompute when the cart items change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAuthenticated, isStudent, items.map((it) => it.id).join(",")]);

  const enrolledCount = items.filter((it) => enrolledMap[it.id]).length;
  const hasEnrolledItems = enrolledCount > 0;

  const removeEnrolledItems = () => {
    items.forEach((it) => {
      if (enrolledMap[it.id]) removeItem(it.id);
    });
  };

  const getTitle = (item: CartItem) => {
    if (isRTL && item.titleAr) return item.titleAr;
    return item.title;
  };

  // Cart totals — all numbers shown to the buyer before the gateway redirect.
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + lineFor(it), 0);
    const originalSubtotal = items.reduce((sum, it) => sum + it.price, 0);
    const saleDiscount = Math.max(0, originalSubtotal - subtotal);
    const vat = subtotal * VAT_RATE;
    const total = subtotal + vat;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      saleDiscount: Math.round(saleDiscount * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [items]);

  const handleProceedToCheckout = () => {
    if (!isAuthenticated) {
      // Cart survives signup via localStorage — land them on /cart after.
      router.push(
        `/${locale}/signup?redirect=${encodeURIComponent(`/${locale}/cart`)}`,
      );
      return;
    }
    if (!isStudent) return; // defensive — button is hidden when notice shows
    if (hasEnrolledItems) return; // forces buyer to remove the duplicates first
    router.push(`/${locale}/checkout`);
  };

  return (
    <>
      <Navbar
        siteSettings={siteSettings}
        navLinks={navbarLinks}
        footerLinks={footerLinks}
      />
      <main className="bg-[#F9FAFB] min-h-screen">
        <div
          className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {/* Breadcrumb */}
          <nav
            aria-label={isRTL ? "مسار التنقل" : "Breadcrumb"}
            className="flex items-center gap-2 text-sm text-[#6B7280] mb-6"
          >
            <Link
              href={`/${locale}`}
              className="hover:text-[#1F2937] transition-colors"
            >
              {t("breadcrumb.home")}
            </Link>
            <Chevron className="w-4 h-4" />
            <span className="text-[#1F2937] font-medium">
              {t("breadcrumb.cart")}
            </span>
          </nav>

          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-[#1F2937]" />
              <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                {t("title")}
              </h1>
            </div>
            {mounted && itemCount > 0 && (
              <span aria-live="polite" className="text-sm text-[#6B7280]">
                {t("itemCount", { count: itemCount })}
              </span>
            )}
          </div>

          {/* Non-student notice — appears above the cart contents if the
              signed-in user can't actually purchase */}
          {mounted && items.length > 0 && showNonStudentNotice && (
            <div className="mb-6">
              <NonStudentEnrollmentNotice
                roleLabel={user?.activeRole || ""}
                canSwitchToStudent={(user?.roles || []).includes("STUDENT")}
              />
            </div>
          )}

          {/* Cart Content */}
          {!mounted ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-[#B8860B] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 sm:p-16 text-center">
              <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-[#9CA3AF]" />
              </div>
              <h2 className="text-lg font-semibold text-[#1F2937] mb-2">
                {t("emptyTitle")}
              </h2>
              <p className="text-sm text-[#6B7280] mb-6 max-w-md mx-auto">
                {t("emptyDescription")}
              </p>
              <Link
                href={`/${locale}/courses`}
                className="inline-flex items-center gap-2 px-6 py-3 btn-gold text-white rounded-xl font-medium text-sm"
              >
                {t("browseCourses")}
                <Arrow className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            /* Two-column layout: items on the left, summary sticky on the right */
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              {/* Items column */}
              <div className="space-y-4">
                {hasEnrolledItems && (
                  <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-4">
                    <div className="flex items-start gap-3">
                      <ShoppingCart className="w-5 h-5 text-[#B91C1C] flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#7F1D1D] mb-1">
                          {t("enrolledBanner.title", { count: enrolledCount })}
                        </p>
                        <p className="text-xs text-[#991B1B] mb-3">
                          {t("enrolledBanner.body")}
                        </p>
                        <button
                          type="button"
                          onClick={removeEnrolledItems}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t("enrolledBanner.removeAll")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {items.map((item) => {
                  const onSale = item.onSale && item.effectivePrice != null;
                  const isAlreadyEnrolled = !!enrolledMap[item.id];
                  return (
                    <div
                      key={item.id}
                      role="article"
                      aria-label={getTitle(item)}
                      className={`bg-white rounded-xl border ${
                        isAlreadyEnrolled
                          ? "border-[#FCA5A5] opacity-75"
                          : "border-[#E5E7EB]"
                      } overflow-hidden hover:shadow-sm transition-shadow`}
                    >
                      {isAlreadyEnrolled && (
                        <div className="bg-[#FEF2F2] border-b border-[#FCA5A5] px-4 py-2 text-xs font-medium text-[#7F1D1D]">
                          {t("enrolledBanner.itemBadge")}
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row">
                        {/* Thumbnail */}
                        <div className="sm:w-40 sm:flex-shrink-0">
                          {item.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={
                                item.thumbnail.startsWith("http")
                                  ? item.thumbnail
                                  : `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "")}${item.thumbnail}`
                              }
                              alt={getTitle(item)}
                              className="w-full h-32 sm:h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-32 sm:h-full bg-[#F3F4F6] flex items-center justify-center">
                              <ShoppingCart className="w-8 h-8 text-[#D1D5DB]" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-[#1F2937] line-clamp-2">
                              {getTitle(item)}
                            </h3>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="flex-shrink-0 p-1.5 text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                              aria-label={t("removeItem")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Meta Info */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280] mb-3">
                            {item.deliveryType && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {item.deliveryType}
                              </span>
                            )}
                            {item.cmeHours > 0 && (
                              <span className="flex items-center gap-1 text-[#92400E]">
                                <Award className="w-3.5 h-3.5" />
                                {item.cmeHours} CME
                              </span>
                            )}
                            {item.instructorName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                {item.instructorName}
                              </span>
                            )}
                          </div>

                          {/* Price */}
                          <div className="flex items-baseline gap-2">
                            {onSale ? (
                              <>
                                <span className="text-lg font-bold text-[#1F2937]">
                                  SAR {item.effectivePrice!.toLocaleString()}
                                </span>
                                <span className="text-sm text-[#9CA3AF] line-through">
                                  SAR {item.price.toLocaleString()}
                                </span>
                                {item.salePercent != null && (
                                  <span className="text-xs font-semibold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-full">
                                    -{item.salePercent}%
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-lg font-bold text-[#1F2937]">
                                SAR {item.price.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Continue shopping + clear cart */}
                <div className="flex items-center justify-between pt-2">
                  <Link
                    href={`/${locale}/courses`}
                    className="inline-flex items-center gap-2 text-sm text-[#B8860B] hover:text-[#96700A] font-medium transition-colors"
                  >
                    {Arrow === ArrowLeft ? <Arrow className="w-4 h-4" /> : null}
                    {t("continueShopping")}
                    {Arrow === ArrowRight ? <Arrow className="w-4 h-4" /> : null}
                  </Link>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-sm text-[#6B7280] hover:text-[#DC2626] transition-colors"
                  >
                    {t("clearCart")}
                  </button>
                </div>
              </div>

              {/* Summary column (sticky on desktop, inline on mobile) */}
              <aside
                aria-label={t("orderSummary")}
                className="lg:sticky lg:top-24 lg:self-start"
              >
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4">
                  <h2 className="text-base font-semibold text-[#1F2937]">
                    {t("orderSummary")}
                  </h2>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[#6B7280]">
                        {t("subtotalLabel", { count: itemCount })}
                      </span>
                      <span className="font-medium text-[#1F2937]">
                        SAR {totals.subtotal.toFixed(2)}
                      </span>
                    </div>
                    {totals.saleDiscount > 0 && (
                      <div className="flex items-center justify-between text-[#15803D]">
                        <span>{t("saleDiscountLabel")}</span>
                        <span className="font-medium">
                          - SAR {totals.saleDiscount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[#6B7280]">{t("vatLabel")}</span>
                      <span className="font-medium text-[#1F2937]">
                        SAR {totals.vat.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-[#E5E7EB]" />

                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-[#1F2937]">
                      {t("totalLabel")}
                    </span>
                    <span className="text-xl font-bold text-[#1F2937]">
                      SAR {totals.total.toFixed(2)}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#9CA3AF] leading-snug">
                    {t("vatDisclaimer")}
                  </p>

                  {/* BNPL widgets — installment preview on the cart total */}
                  {!showNonStudentNotice && (
                    <BnplPromoWidgets
                      price={totals.total}
                      currency="SAR"
                      source="cart"
                    />
                  )}

                  {/* Proceed CTA — hidden for non-students who see the notice above */}
                  {!showNonStudentNotice && (
                    <>
                      <button
                        type="button"
                        onClick={handleProceedToCheckout}
                        disabled={hasEnrolledItems}
                        title={
                          hasEnrolledItems
                            ? t("enrolledBanner.proceedBlocked")
                            : undefined
                        }
                        className="w-full h-12 btn-gold text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {t("proceedToCheckout")}
                        <Arrow className="w-4 h-4" />
                      </button>
                      {hasEnrolledItems && (
                        <p className="text-[11px] text-[#B91C1C] text-center leading-snug">
                          {t("enrolledBanner.proceedBlocked")}
                        </p>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-center gap-1.5 text-xs text-[#6B7280]">
                    <Lock className="w-3.5 h-3.5" />
                    {t("secureNote")}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </>
  );
}
