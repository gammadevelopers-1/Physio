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
  Sparkles,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { paymentApi, discountApi, studentApi, publicTaxApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, CartItem } from "@/contexts/CartContext";
import NonStudentEnrollmentNotice from "@/components/courses/NonStudentEnrollmentNotice";
import BnplPromoWidgets from "@/components/courses/BnplPromoWidgets";
import type { SiteSettings, NavigationLink } from "@/lib/strapi/types";

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

// VAT shown on checkout is informational — server recomputes from
// system_settings.tax + per-course vat_treatment. Default used until
// the public tax-display fetch resolves.
const DEFAULT_VAT_RATE = 15;

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

interface CheckoutPageClientProps {
  siteSettings: SiteSettings | null;
  navbarLinks: NavigationLink[];
  footerLinks: {
    platform: NavigationLink[];
    organization: NavigationLink[];
    support: NavigationLink[];
  };
}

export default function CheckoutPageClient({
  siteSettings,
  navbarLinks,
  footerLinks,
}: CheckoutPageClientProps) {
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

  // Bulk enrollment lookup — same as cart, plus the express-mode case
  // where the buyer landed here via Buy Now on a course they already own.
  // Map is keyed by courseId so render code can show per-item badges +
  // disable the Pay button when at least one item is already enrolled.
  const [enrolledMap, setEnrolledMap] = useState<Record<string, boolean>>({});
  // Course ids the buyer already has a bank-transfer payment in review for.
  // Value is the payment id so the badge / takeover can deep-link back.
  const [pendingPaymentMap, setPendingPaymentMap] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !isStudent) return;
    if (items.length === 0) {
      setEnrolledMap({});
      setPendingPaymentMap({});
      return;
    }
    let cancelled = false;
    studentApi
      .getEnrollmentStatus(items.map((it) => it.id))
      .then((res) => {
        if (cancelled) return;
        const enrolledNext: Record<string, boolean> = {};
        const pendingNext: Record<string, string> = {};
        for (const [id, entry] of Object.entries(res.byId || {})) {
          enrolledNext[id] = !!entry?.isEnrolled;
          if (entry?.pendingBankTransferPaymentId) {
            pendingNext[id] = entry.pendingBankTransferPaymentId;
          }
        }
        setEnrolledMap(enrolledNext);
        setPendingPaymentMap(pendingNext);
      })
      .catch(() => {
        if (!cancelled) {
          setEnrolledMap({});
          setPendingPaymentMap({});
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, isStudent, items.map((it) => it.id).join(",")]);

  const enrolledItemCount = items.filter((it) => enrolledMap[it.id]).length;
  const hasEnrolledItems = enrolledItemCount > 0;
  const allItemsEnrolled =
    items.length > 0 && enrolledItemCount === items.length;
  const pendingItemCount = items.filter((it) => pendingPaymentMap[it.id]).length;
  const hasPendingItems = pendingItemCount > 0;
  const allItemsPending =
    items.length > 0 && pendingItemCount === items.length;
  // When every cart item is a pending payment AND none are enrolled, link to
  // the single payment (if there's only one) so the takeover CTA goes
  // straight to the right place.
  const singlePendingPaymentId =
    Object.values(pendingPaymentMap)[0] || null;

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
  /** True when the active discount came from the auto-apply endpoint
   * (early-bird), false when the user typed it manually. Controls the
   * "Auto-applied" pill. */
  const [isAutoApplied, setIsAutoApplied] = useState(false);
  /** Tracks the campaign name (if any) attached to the active code so
   * we can surface "Part of <campaign>" in the breakdown. */
  const [autoAppliedCampaign, setAutoAppliedCampaign] = useState<string | null>(null);

  // VAT rate from public tax-display endpoint (finance-manager controlled).
  const [vatRate, setVatRate] = useState<number>(DEFAULT_VAT_RATE);
  const [vatEnabled, setVatEnabled] = useState<boolean>(true);
  useEffect(() => {
    let cancelled = false;
    publicTaxApi
      .getDisplay()
      .then((d) => {
        if (cancelled) return;
        setVatRate(d.vatRate);
        setVatEnabled(d.vatEnabled);
      })
      .catch(() => {
        /* fall back to default; backend recomputes authoritative total */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tabby background pre-scoring — per their docs we run an eligibility
  // check before the buyer clicks Pay Now. Three terminal states:
  //   - 'checking' → request in flight / empty cart; don't render anything
  //   - 'eligible' → render the Tabby radio normally
  //   - 'rejected' → render the Tabby radio in a disabled state with the
  //                  rejection message (the second option Tabby's docs
  //                  permit — hide OR show-with-message; we picked show).
  // Fails open to 'eligible' so a flaky pre-score endpoint doesn't hide
  // Tabby from buyers it would actually approve.
  type TabbyEligibility =
    | { status: "checking" }
    | { status: "eligible" }
    | { status: "rejected"; message?: string };
  const [tabbyEligibility, setTabbyEligibility] = useState<TabbyEligibility>({
    status: "checking",
  });

  // Totals
  const originalSubtotal = items.reduce((s, it) => s + it.price, 0);
  const subtotal = items.reduce((s, it) => s + it.effectivePrice, 0);
  const saleDiscount = Math.max(0, originalSubtotal - subtotal);
  const couponDiscount = discountResult?.valid ? discountResult.discountAmount : 0;
  const taxableAmount = Math.max(0, subtotal - couponDiscount);
  const effectiveVatRate = vatEnabled ? vatRate / 100 : 0;
  const vat = Math.round(taxableAmount * effectiveVatRate * 100) / 100;
  const total = Math.round((taxableAmount + vat) * 100) / 100;

  // Pre-score Tabby after the cart settles. Debounce so changing the
  // discount field doesn't fire 5 calls in 2 seconds. Re-running the
  // check on amount changes catches the "above your limit" case once
  // the buyer adds an item that pushes them past Tabby's cap.
  const cartIdsKey = items.map((it) => it.id).join(",");
  useEffect(() => {
    if (items.length === 0 || total <= 0) {
      // Nothing to score yet — keep the slot in `checking` so we don't
      // render a Tabby radio (eligible or rejected) for an empty cart.
      setTabbyEligibility({ status: "checking" });
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      paymentApi
        .tabbyPreScore({
          courseIds: items.map((it) => it.id),
          discountCode: discountResult?.valid ? discountCode : undefined,
          locale: locale as "ar" | "en",
        })
        .then((res) => {
          if (cancelled) return;
          if (res.eligible) {
            setTabbyEligibility({ status: "eligible" });
          } else {
            setTabbyEligibility({ status: "rejected", message: res.message });
            // If the buyer was already on Tabby and just got rejected,
            // bump them onto a usable method so they can't submit.
            if (gateway === "tabby") {
              setGateway("moyasar");
              setPaymentMethod("card");
            }
          }
        })
        .catch(() => {
          // Fail open — keep Tabby visible.
          if (!cancelled) setTabbyEligibility({ status: "eligible" });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartIdsKey, total, discountResult?.valid]);

  const handleValidateDiscount = async () => {
    if (!discountCode.trim() || items.length === 0) return;
    setValidatingDiscount(true);
    try {
      // The backend validates against the cart subtotal but keys the lookup
      // by the first course id (same as Phase 2A's initiate flow). Mirror
      // that here so the preview matches the authoritative server result.
      const result = await discountApi.validate(discountCode, items[0].id);
      setDiscountResult(result);
      // Manual entry overrides any prior auto-apply — re-fetch campaign meta
      // would require an extra call; clear the campaign label for clarity.
      setIsAutoApplied(false);
      setAutoAppliedCampaign(null);
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

  // Auto-apply early-bird discount on cart load. Runs once when items
  // first populate. Skipped if the user has already typed a code.
  useEffect(() => {
    if (items.length === 0) return;
    if (discountCode || discountResult) return;
    let cancelled = false;
    (async () => {
      try {
        const best = await discountApi.autoApply(items.map((i) => i.id));
        // `best` can be `null` (no match) OR `{}` (when the backend returns
        // 201 with empty body — Express tags that as text/html, and the
        // fetch wrapper coerces to `{}`). Require `.code` so we never call
        // `.trim()` / `.toUpperCase()` on undefined later.
        if (cancelled || !best || !best.code) return;
        setDiscountCode(best.code);
        setDiscountResult({
          valid: true,
          discountAmount: best.discountAmount,
          discountId: best.discountId,
        });
        setIsAutoApplied(true);
        setAutoAppliedCampaign(best.campaign?.name || null);
      } catch {
        /* silent — auto-apply is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Debounced live re-validation when user edits the code (after the
  // first manual Apply). Keeps preview in sync without forcing a click.
  useEffect(() => {
    if (!discountCode.trim()) {
      // Cleared: drop the result too
      if (discountResult) setDiscountResult(null);
      setIsAutoApplied(false);
      setAutoAppliedCampaign(null);
      return;
    }
    if (isAutoApplied) return; // auto-applied codes don't re-validate on each keystroke
    if (items.length === 0) return;
    const handle = setTimeout(() => {
      handleValidateDiscount();
    }, 450);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountCode, items.length]);

  const handleSubmit = async () => {
    if (items.length === 0 || processing) return;
    if (!isStudent) return; // defensive — UI hides the button for non-students
    if (hasEnrolledItems) return; // UI hides the button; this is the second wall
    if (hasPendingItems) return; // pending bank-transfer for one of these courses — server would 409 anyway

    setProcessing(true);
    setError(null);

    // Bank transfer is intentionally NOT created server-side until the buyer
    // commits by uploading their receipt + clicking Submit. Skip the
    // /payments/initiate call (no DB row, no orphan in the finance dashboard)
    // and route the buyer straight to the draft bank-transfer page with the
    // cart state in the URL. The page calls /payments/quote on load for
    // accurate totals and POSTs everything to /submit-draft on submit.
    if (gateway === "bank_transfer") {
      const params = new URLSearchParams();
      params.set("courseIds", items.map((it) => it.id).join(","));
      if (discountResult?.valid && discountCode) {
        params.set("discountCode", discountCode);
      }
      if (isExpressMode) params.set("isExpress", "true");
      router.push(`/${locale}/payment/bank-transfer/draft?${params.toString()}`);
      return;
    }

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
        <Navbar
          siteSettings={siteSettings}
          navLinks={navbarLinks}
          footerLinks={footerLinks}
        />
        <main className="flex-1 flex items-center justify-center" aria-label={t("payment.title")}>
          <Loader2 className="w-8 h-8 animate-spin text-[var(--on-surface-variant)]" />
        </main>
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    );
  }

  // Empty: cart mode with no items OR express mode where the course didn't load.
  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
        <Navbar
          siteSettings={siteSettings}
          navLinks={navbarLinks}
          footerLinks={footerLinks}
        />
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
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    );
  }

  // ────────────────────────── render ──────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
      <Navbar
        siteSettings={siteSettings}
        navLinks={navbarLinks}
        footerLinks={footerLinks}
      />

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
        ) : allItemsEnrolled ? (
          /* Express mode → buyer clicked Buy Now on a course they already
             own; OR cart mode where every line is already enrolled. Either
             way, nothing to pay for — skip the whole order/payment grid. */
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#BBF7D0]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#F0FDF4] flex items-center justify-center">
                  <Lock className="w-5 h-5 text-[#16A34A]" />
                </div>
                <h2 className="text-xl font-semibold text-[#166534]">
                  {t("alreadyEnrolled.title")}
                </h2>
              </div>
              <p className="text-sm text-[#15803D] mb-5">
                {isExpressMode
                  ? t("alreadyEnrolled.expressBody")
                  : t("alreadyEnrolled.cartBody", { count: items.length })}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {isExpressMode && items[0] ? (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/${locale}/dashboard/student/courses/${items[0].id}`,
                      )
                    }
                    className="flex-1 h-12 btn-gold rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    {t("alreadyEnrolled.goToCourse")}
                    <Chevron size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/${locale}/dashboard/student/courses`)
                    }
                    className="flex-1 h-12 btn-gold rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    {t("alreadyEnrolled.goToMyCourses")}
                    <Chevron size={16} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/${locale}/courses`)}
                  className="flex-1 h-12 border border-[#D1D5DB] rounded-xl text-sm font-medium text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
                >
                  {t("alreadyEnrolled.browseMore")}
                </button>
              </div>
            </div>
          </div>
        ) : allItemsPending ? (
          /* Every cart line is a pending bank-transfer — block payment and
             route them back to the existing payment instead of letting them
             open a second one. */
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#BFDBFE]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                  {t("pendingPayment.title")}
                </h2>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                {isExpressMode
                  ? t("pendingPayment.expressBody")
                  : t("pendingPayment.cartBody", { count: items.length })}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {singlePendingPaymentId && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/${locale}/payment/bank-transfer/${singlePendingPaymentId}`,
                      )
                    }
                    className="flex-1 h-12 btn-gold rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    {t("pendingPayment.viewPayment")}
                    <Chevron size={16} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/${locale}/courses`)}
                  className="flex-1 h-12 border border-[#D1D5DB] rounded-xl text-sm font-medium text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
                >
                  {t("pendingPayment.browseMore")}
                </button>
              </div>
            </div>
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

                {hasEnrolledItems && (
                  <div className="mb-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3">
                    <p className="text-xs font-semibold text-[#7F1D1D] mb-1">
                      {t("alreadyEnrolled.partialTitle", { count: enrolledItemCount })}
                    </p>
                    <p className="text-[11px] text-[#991B1B]">
                      {t("alreadyEnrolled.partialBody")}
                    </p>
                  </div>
                )}

                {!hasEnrolledItems && hasPendingItems && !allItemsPending && (
                  <div className="mb-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3">
                    <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                      {t("pendingPayment.partialTitle", { count: pendingItemCount })}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      {t("pendingPayment.partialBody")}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {items.map((item) => {
                    const title = isRTL && item.titleAr ? item.titleAr : item.title;
                    const isAlreadyEnrolled = !!enrolledMap[item.id];
                    const isPendingPayment = !!pendingPaymentMap[item.id];
                    return (
                      <div
                        key={item.id}
                        className={`flex gap-4 p-3 border ${
                          isAlreadyEnrolled
                            ? "border-[#FCA5A5] bg-[#FEF2F2]/40"
                            : isPendingPayment
                            ? "border-[#BFDBFE] bg-[#EFF6FF]/40"
                            : "border-[#E5E7EB]"
                        } rounded-xl`}
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
                          {isAlreadyEnrolled && (
                            <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">
                              {t("alreadyEnrolled.itemBadge")}
                            </p>
                          )}
                          {!isAlreadyEnrolled && isPendingPayment && (
                            <p className="mt-1 text-[11px] font-semibold text-[var(--color-primary)]">
                              {t("pendingPayment.itemBadge")}
                            </p>
                          )}
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
                  {isAutoApplied && discountResult?.valid && (
                    <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-[12px] text-amber-800 leading-snug">
                        <p className="font-semibold">
                          {t("discount.autoAppliedTitle")} · {discountCode}
                        </p>
                        <p>{t("discount.autoAppliedBody")}</p>
                        {autoAppliedCampaign && (
                          <p className="opacity-80 mt-0.5">
                            {t("discount.campaignTag", { campaign: autoAppliedCampaign })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--on-surface-variant)]`} aria-hidden="true" />
                      <input
                        type="text"
                        value={discountCode}
                        onChange={(e) => {
                          setDiscountCode(e.target.value.toUpperCase());
                          // Manual edit overrides auto-applied — let the
                          // debounced effect re-validate the new code.
                          setIsAutoApplied(false);
                          setAutoAppliedCampaign(null);
                          if (discountResult) setDiscountResult(null);
                        }}
                        placeholder={t("discount.placeholder")}
                        aria-label={t("discount.title")}
                        className={`w-full h-12 ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-[var(--outline-focused)] focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 transition-colors`}
                        dir="ltr"
                      />
                      {validatingDiscount && !isAutoApplied && (
                        <Loader2
                          className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--on-surface-variant)] animate-spin`}
                        />
                      )}
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
                  {/* Synchronized skeleton column — every payment radio
                      shimmers in together once Tabby pre-score resolves,
                      so the slow gateway never visually lags the others.
                      Trade-off: instant gateways are gated on Tabby for
                      ~500ms-1s; we accept that for the layout-stable UX. */}
                  {tabbyEligibility.status === "checking" ? (
                    <>
                      {/* 4 skeleton rows, sized to match the real radios so
                          there's no shift when they resolve. iconBoxes is
                          the number of right-side logo placeholders. */}
                      {[
                        { iconBoxes: 2 }, // Moyasar (mada + visa)
                        { iconBoxes: 1 }, // Tabby
                        { iconBoxes: 1 }, // Tamara
                        { iconBoxes: 0 }, // Bank Transfer
                      ].map((row, i) => (
                        <div
                          key={`payment-skeleton-${i}`}
                          className="border border-[#e5e5e5] rounded-xl p-[14px] bg-white"
                          aria-hidden="true"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-[11px]">
                              <div className="w-[18px] h-[18px] rounded-full bg-[#f2f4f7] animate-pulse" />
                              <div className="h-4 w-20 rounded bg-[#f2f4f7] animate-pulse" />
                            </div>
                            {row.iconBoxes > 0 && (
                              <div className="flex items-center gap-[11px]">
                                {Array.from({ length: row.iconBoxes }).map((_, j) => (
                                  <div
                                    key={j}
                                    className="h-5 w-[34px] rounded bg-[#f2f4f7] animate-pulse"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
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

                  {/* Tabby — three render states driven by background
                      pre-scoring (see [[tabbyEligibility]]):
                        checking → not rendered (avoids the flash-then-gone
                                   problem when pre-score rejects)
                        eligible → fully interactive radio + their widget
                        rejected → disabled radio with Tabby's verbatim
                                   rejection message below, per their docs
                                   (https://docs.tabby.ai/pay-in-4-custom-
                                    integration/checkout-flow#background-
                                    pre-scoring-check). The outer ternary
                      already excludes 'checking', so this branch only
                      sees eligible / rejected. */}
                  <div
                    role="radio"
                    aria-checked={gateway === "tabby"}
                    aria-disabled={tabbyEligibility.status === "rejected" ? true : undefined}
                    tabIndex={tabbyEligibility.status === "rejected" ? -1 : 0}
                    onKeyDown={(e) => {
                      if (tabbyEligibility.status === "eligible") handleGatewayKeyDown(e, "tabby");
                    }}
                    className={`transition-colors border rounded-xl outline-none ${
                      tabbyEligibility.status === "rejected"
                        ? "border-[#e5e5e5] opacity-60 cursor-not-allowed"
                        : `cursor-pointer focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 ${gateway === "tabby" ? "border-[#005bd3]" : "border-[#e5e5e5]"}`
                    }`}
                    onClick={() => {
                      if (tabbyEligibility.status === "eligible") handleGatewayChange("tabby");
                    }}
                  >
                    <div className={`flex flex-col gap-2 p-[14px] ${gateway === "tabby" && tabbyEligibility.status === "eligible" ? "bg-[#e5edf4]" : "bg-white"} rounded-xl`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-[11px]">
                          <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${gateway === "tabby" && tabbyEligibility.status === "eligible" ? "bg-white border-[6px] border-[#005bd3]" : "border-2 border-[#d5d7da] bg-white"}`} aria-hidden="true" />
                          <span className="font-medium text-[var(--on-surface-default)]">{t("payment.tabby")}</span>
                        </div>
                        <Image src="/checkout_cart/tabby.svg" alt="Tabby" width={60} height={24} className="object-contain" />
                      </div>
                      {/* Eligible state: Tabby's OFFICIAL checkout snippet —
                          per their QA we must use this instead of custom
                          text like "4 interest-free payments of SAR X". */}
                      {tabbyEligibility.status === "eligible" && total > 0 && (
                        <div className={isRTL ? "pr-7" : "pl-7"}>
                          <BnplPromoWidgets
                            price={total}
                            currency="SAR"
                            source="checkout"
                            only="tabby"
                          />
                        </div>
                      )}
                      {/* Rejected state: surface Tabby's localized rejection
                          message (not_available / order_amount_too_high /
                          order_amount_too_low) so the buyer knows why the
                          option is disabled. */}
                      {tabbyEligibility.status === "rejected" && tabbyEligibility.message && (
                        <div className={`text-xs text-[#b42318] leading-snug ${isRTL ? "pr-7" : "pl-7"}`}>
                          {tabbyEligibility.message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tamara — 3 monthly instalments, interest-free */}
                  <div
                    role="radio"
                    aria-checked={gateway === "tamara"}
                    tabIndex={0}
                    onKeyDown={(e) => handleGatewayKeyDown(e, "tamara")}
                    className={`cursor-pointer transition-colors border rounded-xl focus-visible:ring-2 focus-visible:ring-[#005bd3] focus-visible:ring-offset-2 outline-none ${gateway === "tamara" ? "border-[#005bd3]" : "border-[#e5e5e5]"}`}
                    onClick={() => handleGatewayChange("tamara")}
                  >
                    <div className={`flex flex-col gap-2 p-[14px] ${gateway === "tamara" ? "bg-[#e5edf4]" : "bg-white"} rounded-xl`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-[11px]">
                          <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${gateway === "tamara" ? "bg-white border-[6px] border-[#005bd3]" : "border-2 border-[#d5d7da] bg-white"}`} aria-hidden="true" />
                          <span className="font-medium text-[var(--on-surface-default)]">{t("payment.tamara")}</span>
                        </div>
                        <Image src="/checkout_cart/tamara.svg" alt="Tamara" width={70} height={24} className="object-contain" />
                      </div>
                      {/* Tamara's own widget — consistent with the Tabby
                          treatment above, no hand-rolled custom text. */}
                      {total > 0 && (
                        <div className={isRTL ? "pr-7" : "pl-7"}>
                          <BnplPromoWidgets
                            price={total}
                            currency="SAR"
                            source="checkout"
                            only="tamara"
                          />
                        </div>
                      )}
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
                    </>
                  )}
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
                    <span className="text-sm text-[var(--on-surface-variant)]">{t("vatLabel", { rate: vatRate })}</span>
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

                {/* Single Pay button — disabled if any cart line is a course
                    the buyer already owns (banner above tells them to remove
                    it from cart). Backend's INSERT-time guard is the safety
                    net if a buyer somehow bypasses the disabled state. */}
                <button
                  onClick={handleSubmit}
                  disabled={processing || hasEnrolledItems || hasPendingItems}
                  aria-busy={processing}
                  aria-label={processing ? (isRTL ? "جاري المعالجة" : "Processing payment") : `${t("payment.payNow")} SAR ${total.toFixed(2)}`}
                  title={
                    hasEnrolledItems
                      ? t("alreadyEnrolled.partialBody")
                      : hasPendingItems
                      ? t("pendingPayment.partialBody")
                      : undefined
                  }
                  className="w-full h-12 rounded-xl text-white font-medium btn-gold hover:opacity-90 transition-opacity mb-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
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

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </div>
  );
}
