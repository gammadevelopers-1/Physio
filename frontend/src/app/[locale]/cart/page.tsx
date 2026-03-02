"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart, CartItem } from "@/contexts/CartContext";
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
} from "lucide-react";

export default function CartPage() {
  const t = useTranslations("cartPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { items, removeItem, itemCount } = useCart();
  const [mounted, setMounted] = useState(false);

  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const getTitle = (item: CartItem) => {
    if (isRTL && item.titleAr) return item.titleAr;
    return item.title;
  };

  return (
    <>
      <Navbar />
      <main className="bg-[#F9FAFB] min-h-screen">
        <div
          className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-[#6B7280] mb-6">
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
              <span className="text-sm text-[#6B7280]">
                {t("itemCount", { count: itemCount })}
              </span>
            )}
          </div>

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
            /* Cart Items */
            <div className="space-y-6">
              {/* Info Note */}
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-3 text-sm text-[#92400E]">
                {t("checkoutNote")}
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Card Content */}
                    <div className="flex flex-col sm:flex-row">
                      {/* Thumbnail */}
                      <div className="sm:w-40 sm:flex-shrink-0">
                        {item.thumbnail ? (
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

                        {/* Price + Checkout Button */}
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-[#1F2937]">
                            SAR {item.price.toLocaleString()}
                          </span>
                          <Link
                            href={`/${locale}/checkout?courseId=${item.id}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 btn-gold text-white rounded-lg text-sm font-medium"
                          >
                            {t("proceedToCheckout")}
                            <Arrow className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Browse More */}
              <div className="text-center pt-4">
                <Link
                  href={`/${locale}/courses`}
                  className="inline-flex items-center gap-2 text-sm text-[#B8860B] hover:text-[#96700A] font-medium transition-colors"
                >
                  {t("browseCourses")}
                  <Arrow className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
