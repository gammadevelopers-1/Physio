"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, usePathname } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Globe,
  Clock,
  Star,
  Users,
  Calendar,
  MapPin,
  Check,
  Share2,
  Heart,
  ShoppingCart,
  Video,
  Award,
  AlertTriangle,
  X,
  Zap,
  Sparkles,
} from "lucide-react";
import { CourseCard, MobileCourseCard } from "@/components/courses";
import Select from "@/components/ui/Select";
import { PublicCourse } from "@/types/instructor-dashboard";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useFavourites } from "@/contexts/FavouritesContext";
import { useCart } from "@/contexts/CartContext";
import { studentApi, publicApi, pointsApi, ApiError } from "@/lib/api";
import NonStudentEnrollmentNotice from "./NonStudentEnrollmentNotice";
import BnplPromoWidgets from "./BnplPromoWidgets";
import { formatDuration } from "@/lib/utils";
import { getCityLabel } from "@/lib/saudi-cities";
import { Loader2 } from "lucide-react";
import Accordion, { type AccordionItem } from "@/components/ui/Accordion";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatPlatformDateReadable } from "@/lib/platform-locale";

interface CourseDetailContentProps {
  noReviewsText?: string;
  moreContentText?: string;
  relatedCoursesTitle?: string;
  relatedCoursesSubtitle?: string;
  overviewHeading?: string;
  objectivesHeading?: string;
  featuresHeading?: string;
  contentsHeading?: string;
  scheduleHeading?: string;
  requirementsHeading?: string;
  noticesHeading?: string;
  reviewsHeading?: string;
  targetAudienceHeading?: string;
  courseDetailsHeading?: string;
}

// ───────────────────────────────────────────────────────────
// All Reviews Modal — paginated, filterable, sortable.
// Opens with default sort (highest → newest) and auto-scrolls past
// the first 5 reviews that are already visible on the main page.
// ───────────────────────────────────────────────────────────

type ModalReview = {
  id: string;
  rating: number;
  reviewText: string | null;
  createdAt: string;
  studentName: string;
};

function AllReviewsModal({
  courseId,
  totalCount,
  avgRating,
  onClose,
  isRTL,
  locale,
  reviewsHeading,
}: {
  courseId: string;
  totalCount: number;
  avgRating: number;
  onClose: () => void;
  isRTL: boolean;
  locale: string;
  reviewsHeading?: string;
}) {
  const PAGE_SIZE = 10;
  const [reviews, setReviews] = useState<ModalReview[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [distribution, setDistribution] = useState<Record<"1" | "2" | "3" | "4" | "5", number>>({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [sort, setSort] = useState<"highest" | "newest" | "oldest" | "lowest">("highest");
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const sixthReviewRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const platformLocale = usePlatformLocale();

  // Fetch first page (or reload when filter/sort changes)
  useEffect(() => {
    hasAutoScrolledRef.current = false;
    setLoadingInitial(true);
    publicApi
      .getCourseRatings(courseId, {
        page: 1,
        limit: PAGE_SIZE,
        sort,
        rating: starFilter ?? undefined,
      })
      .then((res) => {
        setReviews(res.data);
        setPage(1);
        setTotalPages(res.totalPages);
        setDistribution(res.distribution);
      })
      .catch(() => {
        setReviews([]);
      })
      .finally(() => setLoadingInitial(false));
  }, [courseId, sort, starFilter]);

  // Auto-scroll to the 6th review on the first default load so the user
  // resumes from where the main page's 5-review preview left off.
  useEffect(() => {
    if (hasAutoScrolledRef.current) return;
    if (loadingInitial) return;
    if (sort !== "highest" || starFilter !== null) return;
    if (reviews.length < 6) return;
    requestAnimationFrame(() => {
      sixthReviewRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      hasAutoScrolledRef.current = true;
    });
  }, [reviews, loadingInitial, sort, starFilter]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await publicApi.getCourseRatings(courseId, {
        page: next,
        limit: PAGE_SIZE,
        sort,
        rating: starFilter ?? undefined,
      });
      setReviews((prev) => [...prev, ...res.data]);
      setPage(next);
      setTotalPages(res.totalPages);
    } finally {
      setLoadingMore(false);
    }
  };

  const formatDate = (iso: string) =>
    formatPlatformDateReadable(iso, platformLocale, locale === "ar" ? "ar" : "en");

  const filterHasMore = page < totalPages;
  const maxDist = Math.max(1, ...Object.values(distribution));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
              {reviewsHeading || (isRTL ? "المراجعات" : "Reviews")}
            </h3>
            <div className={`flex items-center gap-2 mt-1 ${isRTL ? "flex-row-reverse" : ""}`}>
              <div className={`flex items-center gap-0.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < Math.floor(avgRating) ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)] fill-[var(--color-star-border)]"}`}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-[var(--color-text-secondary)]">
                · {totalCount} {isRTL ? "مراجعة" : totalCount === 1 ? "review" : "reviews"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            aria-label={isRTL ? "إغلاق" : "Close"}
          >
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Filters bar */}
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center gap-3">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">{isRTL ? "الترتيب:" : "Sort:"}</span>
            <Select
              value={sort}
              onChange={(v) => setSort(v as typeof sort)}
              size="sm"
              className="min-w-[160px]"
              options={[
                { value: "highest", label: isRTL ? "الأعلى تقييماً" : "Highest rated" },
                { value: "lowest", label: isRTL ? "الأقل تقييماً" : "Lowest rated" },
                { value: "newest", label: isRTL ? "الأحدث" : "Newest" },
                { value: "oldest", label: isRTL ? "الأقدم" : "Oldest" },
              ]}
            />
          </div>

          {/* Star filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setStarFilter(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                starFilter === null ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
              }`}
            >
              {isRTL ? "الكل" : "All"}
            </button>
            {[5, 4, 3, 2, 1].map((s) => {
              const c = distribution[String(s) as "1" | "2" | "3" | "4" | "5"] || 0;
              return (
                <button
                  key={s}
                  onClick={() => setStarFilter(starFilter === s ? null : s)}
                  disabled={c === 0}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    starFilter === s ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                  }`}
                >
                  {s} <Star className="w-3 h-3 fill-current" /> ({c})
                </button>
              );
            })}
          </div>
        </div>

        {/* Distribution bars (optional visual) */}
        {totalCount > 0 && (
          <div className="px-5 py-3 border-b border-[var(--color-border)] space-y-1.5">
            {[5, 4, 3, 2, 1].map((s) => {
              const c = distribution[String(s) as "1" | "2" | "3" | "4" | "5"] || 0;
              const pct = (c / maxDist) * 100;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-[var(--color-text-secondary)]">{s}★</span>
                  <div className="flex-1 h-2 bg-[var(--color-border-subtle)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-[var(--color-text-secondary)] tabular-nums">{c}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Reviews list */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-4">
          {loadingInitial ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-xl bg-[var(--color-border-subtle)] flex items-center justify-center mb-3">
                <Star className="w-7 h-7 text-[var(--color-star-border)]" />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">{isRTL ? "لا توجد مراجعات مطابقة" : "No matching reviews"}</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--color-border)]">
              {reviews.map((r, i) => (
                <div
                  key={r.id}
                  ref={i === 5 ? sixthReviewRef : undefined}
                  className="py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-[14px] text-[var(--color-text-secondary)]">{r.studentName}</p>
                    <p className="text-[12px] text-[var(--color-text-secondary)]">{formatDate(r.createdAt)}</p>
                  </div>
                  <div className={`flex items-center gap-0.5 mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    {[...Array(5)].map((_, si) => (
                      <Star
                        key={si}
                        className={`w-3.5 h-3.5 ${si < r.rating ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)] fill-[var(--color-star-border)]"}`}
                      />
                    ))}
                  </div>
                  {r.reviewText && (
                    <p dir="auto" className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                      {r.reviewText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — Load more */}
        {!loadingInitial && reviews.length > 0 && (
          <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {isRTL
                ? `عرض ${reviews.length} من ${totalCount}`
                : `Showing ${reviews.length} of ${totalCount}`}
            </p>
            {filterHasMore ? (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-text-primary)] transition-colors disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {isRTL ? "تحميل المزيد" : "Load more"}
              </button>
            ) : (
              <span className="text-xs text-[var(--color-text-secondary)] italic">
                {isRTL ? "لا توجد مراجعات إضافية" : "No more reviews"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CourseDetailContent = ({
  noReviewsText,
  moreContentText,
  relatedCoursesTitle,
  relatedCoursesSubtitle,
  overviewHeading,
  objectivesHeading,
  featuresHeading,
  contentsHeading,
  scheduleHeading,
  requirementsHeading,
  noticesHeading,
  reviewsHeading,
  targetAudienceHeading,
  courseDetailsHeading,
}: CourseDetailContentProps = {}) => {
  const t = useTranslations("courseDetailPage");
  const tCourses = useTranslations("coursesPage");
  const tFav = useTranslations("studentDashboard.favourites");
  const locale = useLocale();
  const { isFavourite, toggleFavourite } = useFavourites();
  const isRTL = locale === "ar";
  const platformLocale = usePlatformLocale();

  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const pathname = usePathname();

  const [showFullDescription, setShowFullDescription] = useState(false);

  // Fetch real course data from API
  const [apiCourse, setApiCourse] = useState<PublicCourse | null>(null);
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public-courses/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.id) setApiCourse(data);
      })
      .catch(() => {});
  }, [slug]);

  // Reviews block toggle: course (existing) vs instructor (cross-course
  // reviews of the course's instructor). Lazy-loaded — only fetched the
  // first time the toggle hits "instructor".
  const [reviewKind, setReviewKind] = useState<"course" | "instructor">("course");
  const [instructorReviews, setInstructorReviews] = useState<{
    data: Array<{
      id: string;
      courseId: string;
      courseTitle: string;
      courseTitleAr: string | null;
      rating: number;
      reviewText: string | null;
      createdAt: string;
      studentName: string;
    }>;
    avgRating: number;
    totalRatings: number;
  } | null>(null);
  const [instructorReviewsLoading, setInstructorReviewsLoading] = useState(false);
  useEffect(() => {
    if (reviewKind !== "instructor") return;
    if (!apiCourse?.id) return;
    if (instructorReviews !== null) return; // cached after first fetch
    let cancelled = false;
    setInstructorReviewsLoading(true);
    fetch(`/api/public-courses/${apiCourse.id}/instructor-aggregated-ratings?limit=10`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setInstructorReviews(json);
      })
      .catch(() => {
        if (!cancelled) setInstructorReviews({ data: [], avgRating: 0, totalRatings: 0 });
      })
      .finally(() => {
        if (!cancelled) setInstructorReviewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reviewKind, apiCourse?.id, instructorReviews]);

  // Auth + enrollment state
  const { user, isAuthenticated } = useAuth();
  const isStudent = isAuthenticated && user?.activeRole === "STUDENT";
  const [enrolling, setEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  // Points redemption — the course-detail response now carries the
  // enable/cost envelope directly (see courses.service.findOnePublic), so
  // no follow-up round-trip is needed. Balance is fetched separately to
  // decide whether the current user can afford it.
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [shareTooltip, setShareTooltip] = useState(false);
  const [sessionFilterCity, setSessionFilterCity] = useState<string>("");
  const [sessionFilterMonth, setSessionFilterMonth] = useState<string>("");
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);

  const favourited = apiCourse && isAuthenticated ? isFavourite(apiCourse.id) : false;
  const handleFavouriteClick = () => {
    if (!apiCourse) return;
    // Guests can't have favourites — push them to signin and bring them
    // back to this same course detail. Once they're authenticated, the
    // dashboard's favourites feature is available like normal.
    if (!isAuthenticated) {
      const redirect = encodeURIComponent(pathname || `/${locale}/courses/${apiCourse.id}`);
      router.push(`/${locale}/signin?redirect=${redirect}`);
      return;
    }
    toggleFavourite({
      id: apiCourse.id,
      title: isRTL && apiCourse.titleAr ? apiCourse.titleAr : apiCourse.title,
      thumbnail: apiCourse.thumbnail || "",
      progress: 0,
      status: "not_started",
      price: apiCourse.price ?? 0,
      cmeHours: apiCourse.cmeHours ?? 0,
      isCmeAccredited: apiCourse.isCmeAccredited ?? false,
      deliveryType: apiCourse.deliveryType,
    });
  };

  const handleShare = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const shareTitle = apiCourse?.title || "";

    // Try native share API first (mobile)
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as any).share({
          title: shareTitle,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or failed — fall through to clipboard
      }
    }

    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareTooltip(true);
      setTimeout(() => setShareTooltip(false), 2000);
    } catch {
      // Clipboard API failed (old browsers)
    }
  };

  // Derive pricing/capacity from API data. Precedence for "what the student
  // actually pays" (top wins):
  //   1. Auto-apply campaign discount (percentage or fixed) — `campaignDiscount.finalPrice`
  //   2. Per-course sale — `effectivePrice`
  //   3. Base price
  const apiPrice = apiCourse?.price ?? 0;
  const apiPerCourseOnSale = (apiCourse as { onSale?: boolean })?.onSale ?? false;
  const apiSalePercent = (apiCourse as { salePercent?: number | null })?.salePercent ?? null;
  const apiSaleAmount = (apiCourse as { saleAmount?: number | null })?.saleAmount ?? null;
  const apiPerCourseSalePrice =
    (apiCourse as { effectivePrice?: number })?.effectivePrice ?? apiPrice;
  const apiCampaignDiscount =
    (apiCourse as { campaignDiscount?: {
      campaignId: string; campaignName: string; campaignNameAr: string | null;
      campaignType: 'standard' | 'early_bird';
      discountType: 'percentage' | 'fixed'; discountValue: number;
      amountOff: number; basePrice: number; finalPrice: number;
    } | null })?.campaignDiscount ?? null;
  const apiEffectivePrice = apiCampaignDiscount?.finalPrice ?? apiPerCourseSalePrice;
  const apiOnSale = apiPerCourseOnSale || !!apiCampaignDiscount;
  const apiIsFree = apiEffectivePrice === 0;
  const apiIsEarlyBirdCampaign = apiCampaignDiscount?.campaignType === "early_bird";
  const apiIsFull = apiCourse?.isFull ?? false;
  const apiRemainingSeats = apiCourse?.remainingSeats ?? null;
  const apiCmeAccredited = apiCourse?.isCmeAccredited ?? false;
  const apiCmeHours = apiCourse?.cmeHours ?? 0;
  const apiAccreditationNumber = apiCourse?.accreditationNumber ?? null;
  const apiSessionCount = apiCourse?.sessionCount ?? 0;
  const availabilityStatus = apiCourse?.availabilityStatus ?? "open";
  const canEnroll = availabilityStatus === "open";

  const handleEnroll = async () => {
    if (!slug) return;
    setEnrolling(true);
    setEnrollResult(null);
    try {
      await studentApi.selfEnroll(slug);
      setEnrollResult({ success: true, message: t("enrollment.success") });
    } catch (err) {
      let message: string;
      if (err instanceof ApiError && err.code === "ENROLLMENT_DEADLINE_PASSED") {
        message = t("enrollment.deadlinePassed");
      } else {
        message = err instanceof Error ? err.message : t("enrollment.error");
      }
      setEnrollResult({ success: false, message });
    } finally {
      setEnrolling(false);
    }
  };

  // Cart state for the new Amazon-style detail-page CTAs. localStorage-backed
  // so a guest's cart survives the signup redirect and lands intact on /cart.
  const { addItem, isInCart } = useCart();
  const courseInCart = apiCourse ? isInCart(apiCourse.id) : false;

  // PRIMARY: "Buy Now" — express checkout. Skips the cart entirely and jumps
  // straight to the checkout page with just this course. The user's existing
  // cart is left untouched so abandoning the express flow doesn't lose it.
  const handleBuyNow = () => {
    if (!apiCourse) return;
    // Guest → signup with redirect=/checkout?expressCourseId=... so they land
    // on the checkout page after signup, not back on the course page.
    if (!isAuthenticated) {
      const next = `/${locale}/checkout?expressCourseId=${apiCourse.id}`;
      router.push(`/${locale}/signup?redirect=${encodeURIComponent(next)}`);
      return;
    }
    // Non-students never see this button (the NonStudentEnrollmentNotice
    // replaces it). Defensive guard against URL-hack callers.
    if (!isStudent) return;
    router.push(`/${locale}/checkout?expressCourseId=${apiCourse.id}`);
  };

  // SECONDARY: "Add to Cart" — adds to the localStorage cart and flips the
  // button to "Go to Cart". User can keep browsing and add more.
  const handleAddToCart = () => {
    if (!apiCourse) return;
    if (!isAuthenticated) {
      // Guests can add to cart too — the cart survives signup. Redirect them
      // to signup landing on /cart so they pick up where they left off.
      addItem({
        id: apiCourse.id,
        title: apiCourse.title,
        titleAr: apiCourse.titleAr || null,
        price: Number(apiCourse.price ?? 0),
        effectivePrice: Number(apiEffectivePrice),
        onSale: apiOnSale,
        salePercent: apiSalePercent ?? null,
        thumbnail: apiCourse.thumbnail || null,
        deliveryType: apiCourse.deliveryType || "",
        startDate: apiCourse.startDate || null,
        cmeHours: apiCourse.cmeHours || 0,
        instructorName: apiCourse.instructorName || "",
        addedAt: new Date().toISOString(),
      });
      router.push(`/${locale}/signup?redirect=${encodeURIComponent(`/${locale}/cart`)}`);
      return;
    }
    if (!isStudent) return; // non-students don't see this button
    addItem({
      id: apiCourse.id,
      title: apiCourse.title,
      titleAr: apiCourse.titleAr || null,
      price: Number(apiCourse.price ?? 0),
      effectivePrice: Number(apiEffectivePrice),
      onSale: apiOnSale,
      salePercent: apiSalePercent ?? null,
      thumbnail: apiCourse.thumbnail || null,
      deliveryType: apiCourse.deliveryType || "",
      startDate: apiCourse.startDate || null,
      cmeHours: apiCourse.cmeHours || 0,
      instructorName: apiCourse.instructorName || "",
      addedAt: new Date().toISOString(),
    });
  };

  // Once added, the secondary button flips to "Go to Cart".
  const goToCart = () => router.push(`/${locale}/cart`);

  // Fetch the student's point balance so the CTA can decide affordability
  // client-side (backend already told us the pointsCost via
  // apiCourse.redemption). Skipped for guests, non-students, and free
  // courses (nothing to redeem toward).
  useEffect(() => {
    if (!apiCourse || !isStudent || apiIsFree) {
      setPointsBalance(null);
      return;
    }
    let cancelled = false;
    pointsApi
      .getBalance()
      .then((res) => {
        if (cancelled) return;
        setPointsBalance(res.balance);
      })
      .catch(() => {
        // Silent — redemption is optional UX
      });
    return () => {
      cancelled = true;
    };
  }, [apiCourse, isStudent, apiIsFree]);

  // Already-enrolled lookup. Decides whether to hide the Buy Now / Add to
  // Cart / payment-method UI in favour of an "Already Enrolled" card.
  // Only runs for signed-in students; guests + non-students get the regular
  // browse flow. 'loading' avoids briefly flashing the wrong CTA state.
  const [enrolledState, setEnrolledState] = useState<
    "loading" | "enrolled" | "pending-payment" | "not-enrolled" | "skip"
  >("skip");
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  useEffect(() => {
    if (!apiCourse?.id) return;
    if (!isAuthenticated || !isStudent) {
      setEnrolledState("skip");
      return;
    }
    let cancelled = false;
    setEnrolledState("loading");
    studentApi
      .getEnrollmentStatus([apiCourse.id])
      .then((res) => {
        if (cancelled) return;
        const entry = res.byId?.[apiCourse.id];
        if (entry?.isEnrolled) {
          setEnrolledState("enrolled");
          setPendingPaymentId(null);
        } else if (entry?.pendingBankTransferPaymentId) {
          // Bank-transfer kicked off but finance hasn't actioned it. Send
          // them back to the existing payment instead of letting them start
          // a duplicate one.
          setEnrolledState("pending-payment");
          setPendingPaymentId(entry.pendingBankTransferPaymentId);
        } else {
          setEnrolledState("not-enrolled");
          setPendingPaymentId(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Network failed — fall through to the regular CTAs rather than
        // blocking the buyer. The server still rejects an INSERT for an
        // already-enrolled course as the safety net.
        setEnrolledState("not-enrolled");
        setPendingPaymentId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [apiCourse?.id, isAuthenticated, isStudent]);

  // Trigger points-based redemption. On success, route the buyer straight
  // to the freshly-unlocked course inside their student dashboard — this
  // matches what a paid purchase does. The confirm modal already showed
  // the "spending X points" language, so no extra confirmation toast.
  const handleRedeem = async () => {
    if (!apiCourse) return;
    setRedeeming(true);
    setEnrollResult(null);
    try {
      const res = await pointsApi.redeemCourse(apiCourse.id);
      setPointsBalance(res.newBalance);
      setEnrollResult({
        success: true,
        message: t("enrollment.redeemSuccess"),
      });
      setRedeemModalOpen(false);
      // Small delay so the toast is visible before the navigation kicks in.
      setTimeout(() => {
        router.push(`/${locale}/dashboard/student/courses/${apiCourse.id}`);
      }, 800);
    } catch (err) {
      // Backend BadRequestException copies our friendly deficit message
      // ("You need X more points to redeem this course") into the ApiError
      // message field, so surfacing err.message is enough — no need to
      // reformat the deficit client-side. ALREADY_ENROLLED comes through
      // as its own message string too.
      const message = err instanceof Error ? err.message : t("enrollment.error");
      setEnrollResult({ success: false, message });
    } finally {
      setRedeeming(false);
    }
  };

  // Guest redirect: sends unauthenticated users to signup with return URL
  const handleGuestRedirect = () => {
    const returnUrl = pathname;
    router.push(`/${locale}/signup?redirect=${encodeURIComponent(returnUrl)}`);
  };

  // Fetch related courses from API
  const [relatedCourses, setRelatedCourses] = useState<PublicCourse[]>([]);
  useEffect(() => {
    fetch("/api/public-courses?limit=5")
      .then((res) => res.json())
      .then((json) => {
        const data = Array.isArray(json.data) ? json.data : [];
        setRelatedCourses(data.filter((c: PublicCourse) => c.id !== slug).slice(0, 4));
      })
      .catch(() => setRelatedCourses([]));
  }, [slug]);

  // Locale-aware helpers
  const getTitle = () => isRTL && apiCourse?.titleAr ? apiCourse.titleAr : (apiCourse?.title || "");
  const getDescription = () => isRTL && apiCourse?.descriptionAr ? apiCourse.descriptionAr : (apiCourse?.description || "");
  const getOverview = () => isRTL && apiCourse?.overviewAr ? apiCourse.overviewAr : (apiCourse?.overview || "");
  const getObjectives = () => isRTL && apiCourse?.objectivesAr?.length ? apiCourse.objectivesAr : (apiCourse?.objectives || []);
  const getFeatures = () => isRTL && apiCourse?.featuresAr?.length ? apiCourse.featuresAr : (apiCourse?.features || []);
  const getTargetAudience = () => isRTL && apiCourse?.targetAudienceAr?.length ? apiCourse.targetAudienceAr : (apiCourse?.targetAudience || []);
  const getRequirements = () => isRTL && apiCourse?.requirementsAr ? apiCourse.requirementsAr : (apiCourse?.requirements || "");
  const getNotices = () => isRTL && apiCourse?.noticesAr ? apiCourse.noticesAr : (apiCourse?.notices || "");
  const getVenue = () => isRTL && apiCourse?.venueAr ? apiCourse.venueAr : (apiCourse?.venue || "");

  // Delivery-type based section visibility
  const dt = apiCourse?.deliveryType || "";
  const isWebinarCourse = dt === "webinar";
  // Sessions list shown for onsite/blended (lecture list) AND webinar
  // (the webinar event itself). Zoom-only meeting courses hide the lectures
  // list because the manager's drip schedule is internal.
  const showSessions = dt === "onsite" || dt === "blended" || isWebinarCourse;
  const showModules = (dt === "self-paced" || dt === "blended") && apiCourse?.showContents !== false;
  const showVenue = dt === "onsite" || dt === "blended";
  const showRequirements = (dt === "onsite" || dt === "blended") && !!getRequirements();

  // Language label helper
  const getLanguageLabel = () => {
    const lang = apiCourse?.language || "en";
    if (lang === "ar") return t("languages.arabic");
    if (lang === "both") return `${t("languages.english")} / ${t("languages.arabic")}`;
    return t("languages.english");
  };

  // Date formatting helper
  const formatDate = (dateStr: string | null) =>
    formatPlatformDateReadable(dateStr, platformLocale, locale === "ar" ? "ar" : "en", {
      includeTime: true,
    });

  // Enrollment deadline: always render in Riyadh time + label it. The
  // manager picks it in Riyadh tz (see riyadh-time.ts) and a viewer in
  // any other zone would otherwise see a shifted time on this public
  // page. Keeping it canonical removes the ambiguity.
  const formatDeadline = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const formatted = new Date(dateStr).toLocaleString(
      locale === "ar" ? "ar-SA" : "en-US",
      {
        timeZone: "Asia/Riyadh",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      },
    );
    const suffix = locale === "ar" ? "بتوقيت الرياض" : "Riyadh time";
    return `${formatted} (${suffix})`;
  };

  // Delivery type label
  const getDeliveryLabel = () => {
    if (dt === "zoom") return isRTL ? "عبر الإنترنت" : "Live Online";
    if (dt === "onsite") return isRTL ? "حضوري" : "On-site";
    if (dt === "blended") return isRTL ? "مدمج" : "Blended";
    if (dt === "self-paced") return isRTL ? "ذاتي" : "Self-paced";
    if (dt === "webinar") return isRTL ? "ويبينار" : "Webinar";
    return dt;
  };

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  // Loading state
  if (!apiCourse) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  // Language tags renderer
  const renderLanguageTags = (sizeClass: string = "text-sm") => {
    const lang = apiCourse.language || "en";
    return (
      <div className={`flex items-center gap-3 ${isRTL ? "justify-start" : ""}`}>
        {(lang === "en" || lang === "both") && (
          <div className="flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <span className={`${sizeClass} text-[var(--color-text-primary)]`}>{t("languages.english")}</span>
          </div>
        )}
        {lang === "both" && <div className="w-px h-4 bg-[var(--color-border)]" />}
        {(lang === "ar" || lang === "both") && (
          <div className="flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <span className={`${sizeClass} text-[var(--color-text-primary)]`}>{t("languages.arabic")}</span>
          </div>
        )}
      </div>
    );
  };

  // Sessions section renderer
  const renderSessions = (isMobile: boolean = false) => {
    if (!showSessions || !apiCourse.sessions.length) return null;

    // Extract unique cities and months from sessions
    const uniqueCities = Array.from(
      new Set(
        apiCourse.sessions
          .filter((s) => s.city)
          .map((s) => s.city as string),
      ),
    );
    const uniqueMonths = Array.from(
      new Set(
        apiCourse.sessions.map((s) => {
          const d = new Date(s.scheduledAt);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }),
      ),
    ).sort();

    // Show city filter only if onsite/blended AND at least one session has a city
    const showCityFilter = (apiCourse.deliveryType === "onsite" || apiCourse.deliveryType === "blended") && uniqueCities.length > 0;
    const showMonthFilter = uniqueMonths.length > 1;

    // Filter sessions
    const filteredSessions = apiCourse.sessions.filter((s) => {
      if (sessionFilterCity && s.city !== sessionFilterCity) return false;
      if (sessionFilterMonth) {
        const d = new Date(s.scheduledAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key !== sessionFilterMonth) return false;
      }
      return true;
    });

    const monthLabel = (key: string) => {
      const [year, month] = key.split("-");
      const date = new Date(Number(year), Number(month) - 1, 1);
      return date.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
        month: "long",
        year: "numeric",
      });
    };

    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl border border-[var(--outline-subtle)] p-6 mb-8"}`}>
        <h2 className={`${isMobile ? "text-lg" : "text-[20px]"} font-semibold mb-4 text-start`}>
          {scheduleHeading || t("schedule") || "Schedule"}
        </h2>

        {/* Filters */}
        {(showCityFilter || showMonthFilter) && (
          <div className={`flex flex-wrap gap-3 mb-5 ${isRTL ? "flex-row-reverse" : ""}`}>
            {showCityFilter && (
              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-[var(--color-text-secondary)] font-medium">
                  {locale === "ar" ? "المدينة" : "City"}
                </label>
                <Select
                  value={sessionFilterCity}
                  onChange={setSessionFilterCity}
                  className="min-w-[160px]"
                  options={[
                    { value: "", label: locale === "ar" ? "كل المدن" : "All cities" },
                    ...uniqueCities.map((city) => ({
                      value: city,
                      label: getCityLabel(city, locale),
                    })),
                  ]}
                />
              </div>
            )}
            {showMonthFilter && (
              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-[var(--color-text-secondary)] font-medium">
                  {locale === "ar" ? "الشهر" : "Month"}
                </label>
                <Select
                  value={sessionFilterMonth}
                  onChange={setSessionFilterMonth}
                  className="min-w-[160px]"
                  options={[
                    { value: "", label: locale === "ar" ? "كل الأشهر" : "All months" },
                    ...uniqueMonths.map((m) => ({ value: m, label: monthLabel(m) })),
                  ]}
                />
              </div>
            )}
            {(sessionFilterCity || sessionFilterMonth) && (
              <button
                onClick={() => {
                  setSessionFilterCity("");
                  setSessionFilterMonth("");
                }}
                className="self-end px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline"
              >
                {locale === "ar" ? "مسح" : "Clear"}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-6 text-sm text-[var(--color-text-secondary)]">
              {locale === "ar"
                ? "لا توجد جلسات تطابق المرشحات"
                : "No sessions match your filters"}
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div key={session.id} className={`flex items-center justify-between p-3 bg-[var(--color-border-subtle)] rounded-lg ${isRTL ? "flex-row-reverse" : ""}`}>
                <div className="text-start">
                  <p className="font-medium text-[14px]">{session.title}</p>
                  <p className="text-[13px] text-[var(--color-text-secondary)]">
                    {formatPlatformDateReadable(session.scheduledAt, platformLocale, locale === "ar" ? "ar" : "en", { includeTime: true })}
                    {" · "}{formatDuration(session.durationMinutes, locale)}
                  </p>
                  {session.city && (
                    <p className="text-[12px] text-[var(--color-text-secondary)] font-medium">
                      {getCityLabel(session.city, locale)}
                    </p>
                  )}
                  {session.venueAddress && (
                    <p className="text-[12px] text-[var(--color-text-secondary)]">{session.venueAddress}</p>
                  )}
                </div>
                <span className={`text-[11px] px-2 py-1 rounded-full ${
                  session.type === "zoom" ? "bg-blue-100 text-blue-700" :
                  session.type === "onsite" ? "bg-green-100 text-green-700" :
                  "bg-purple-100 text-purple-700"
                }`}>{session.type}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // Modules section renderer
  const renderModules = (isMobile: boolean = false) => {
    if (!showModules || !apiCourse.modules.length) return null;
    const totalCount = apiCourse.modules.length;
    const totalMinutes = apiCourse.modules.reduce((sum, m) => sum + (m.durationMinutes || 0), 0);
    const previewModules = apiCourse.modules.slice(0, 2);
    const remaining = totalCount - previewModules.length;
    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl border border-[var(--outline-subtle)] p-6 mb-8"}`}>
        <div className={`flex items-center justify-between mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
          <h2 className={`${isMobile ? "text-lg" : "text-[20px]"} font-semibold`}>
            {contentsHeading || t("contents") || "Contents"} {totalCount}
          </h2>
          {totalMinutes > 0 && (
            <span className="text-[13px] text-[var(--color-text-secondary)]">
              {formatDuration(totalMinutes, locale)} {locale === "ar" ? "من المحتوى" : "of content"}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {previewModules.map((mod, i) => (
            <div key={mod.id} className="border border-[var(--outline-subtle)] rounded-lg overflow-hidden">
              <div className={`flex items-center justify-between p-3 bg-[var(--color-surface-page)] ${isRTL ? "flex-row-reverse" : ""}`}>
                <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <span className="text-[13px] text-[var(--color-text-secondary)] font-medium">{i + 1}.</span>
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                    {isRTL && mod.titleAr ? mod.titleAr : mod.title}
                  </span>
                </div>
                {mod.durationMinutes && (
                  <span className="text-[12px] text-[var(--color-text-secondary)]">{formatDuration(mod.durationMinutes, locale)}</span>
                )}
              </div>
              {mod.materials && mod.materials.length > 0 && (
                <div className="flex flex-col divide-y divide-[var(--outline-subtle)]">
                  {mod.materials.map((mat) => (
                    <div key={mat.id} className={`flex items-center gap-2 p-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span className="text-[11px] text-[var(--color-text-secondary)] uppercase bg-[var(--color-border-subtle)] px-2 py-0.5 rounded">{mat.type}</span>
                      <span className="text-[13px] text-[var(--color-text-secondary)]">{mat.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {(moreContentText?.trim() || remaining > 0) && (
            <div className="mt-2 p-4 bg-[var(--color-surface-page)] rounded-lg text-center">
              <p className="text-[13px] text-[var(--color-text-secondary)]">
                {moreContentText?.trim() || (locale === "ar"
                  ? "المزيد من المحتوى متاح عند التسجيل"
                  : "More content available after enrollment")}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Overview section renderer — renders HTML from rich text editor.
  // The HTML is authored by managers/instructors in a TipTap editor and
  // stored in the DB, so we MUST sanitize before injecting it. DOMPurify
  // is the standard tool; isomorphic-dompurify makes it safe in both
  // server-render and client-render paths.
  const renderOverview = (isMobile: boolean = false) => {
    const overview = getOverview();
    if (!overview) return null;
    const safeHtml = DOMPurify.sanitize(overview, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
        'span', 'div', 'img', 'hr',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'],
      ADD_ATTR: ['target'],
    });
    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-8 mb-8"}`}>
        <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg mb-3" : "text-xl mb-4"} text-start`}>
          {overviewHeading || t("overview") || "Overview"}
        </h2>
        <div
          className={`course-overview-content text-[var(--color-text-secondary)] ${isMobile ? "text-sm" : "text-base"} leading-relaxed text-start`}
          dir={isRTL ? "rtl" : "ltr"}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </div>
    );
  };

  // FAQs section renderer — available for every delivery type. Still
  // hidden when the course has no FAQ entries.
  const renderFaqs = (isMobile: boolean = false) => {
    const list = Array.isArray(apiCourse?.faqs) ? apiCourse.faqs : [];
    const items = list
      .filter((f) => (f?.question || f?.questionAr) && (f?.answer || f?.answerAr))
      .map((f, i): AccordionItem => {
        const q = isRTL ? (f.questionAr || f.question || "") : (f.question || f.questionAr || "");
        const a = isRTL ? (f.answerAr || f.answer || "") : (f.answer || f.answerAr || "");
        return {
          id: `faq-${i}`,
          title: q,
          content: <p className="whitespace-pre-wrap">{a}</p>,
        };
      });
    if (items.length === 0) return null;
    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-8 mb-8"}`}>
        <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg mb-3" : "text-xl mb-4"} text-start`}>
          {isRTL ? "الأسئلة الشائعة" : "FAQs"}
        </h2>
        <Accordion items={items} />
      </div>
    );
  };

  // Objectives section renderer
  const renderObjectives = (isMobile: boolean = false) => {
    const objectives = getObjectives();
    if (!objectives.length) return null;
    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-8 mb-8"}`}>
        <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg mb-4" : "text-xl mb-6"} text-start`}>
          {objectivesHeading || t("whatYouWillLearn.title")}
        </h2>
        <div className={isMobile ? "space-y-3" : "space-y-4"}>
          {objectives.map((item, index) => (
            <div key={index} className={`flex items-start ${isMobile ? "gap-2.5" : "gap-3"}`}>
              <Check className={`${isMobile ? "w-4 h-4" : "w-5 h-5"} text-[var(--color-text-primary)] flex-shrink-0 mt-0.5`} />
              <p className={`text-[var(--color-text-secondary)] ${isMobile ? "text-sm" : "text-base"} text-start`}>{item}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Target audience section renderer
  const renderTargetAudience = (isMobile: boolean = false) => {
    const audience = getTargetAudience();
    if (!audience.length) return null;
    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-8 mb-8"}`}>
        <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg mb-4" : "text-xl mb-6"} text-start`}>
          {targetAudienceHeading || t("targetAudience") || "Target Audience"}
        </h2>
        <div className="flex flex-wrap gap-2">
          {audience.map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center px-3 py-1.5 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm rounded-full"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Requirements section renderer
  const renderRequirements = (isMobile: boolean = false) => {
    if (!showRequirements) return null;
    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-8 mb-8"}`}>
        <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg mb-3" : "text-xl mb-4"} text-start`}>
          {requirementsHeading || t("requirements") || "Requirements"}
        </h2>
        <p className={`text-[var(--color-text-secondary)] ${isMobile ? "text-sm" : "text-base"} leading-relaxed text-start`}>
          {getRequirements()}
        </p>
      </div>
    );
  };

  // Instructor card — only renders when an instructor row exists. Photo
  // and name are clickable and route to the dedicated profile page.
  // Email is intentionally not shown (privacy + spam vector); reach out
  // happens via the profile page or course enrolment.
  const renderInstructor = (isMobile: boolean = false) => {
    const inst = apiCourse?.instructor;
    if (!inst?.id) return null;

    const fullName = (() => {
      const ar = `${inst.firstNameAr || ""} ${inst.lastNameAr || ""}`.trim();
      const en = `${inst.firstName || ""} ${inst.lastName || ""}`.trim();
      if (isRTL && ar) return ar;
      return en || ar || "Instructor";
    })();
    const initials = fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
    const tagline = inst.profession || inst.specialty || inst.qualification || null;
    const profileHref = `/${locale}/instructors/${inst.id}`;
    const twitterHref = inst.twitter
      ? inst.twitter.startsWith("http")
        ? inst.twitter
        : `https://twitter.com/${inst.twitter.replace(/^@/, "")}`
      : null;
    const linkedinHref = inst.linkedin
      ? inst.linkedin.startsWith("http")
        ? inst.linkedin
        : `https://linkedin.com/in/${inst.linkedin}`
      : null;

    return (
      <div
        className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-8 mb-8"}`}
      >
        <h2
          className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg mb-4" : "text-xl mb-6"}`}
        >
          {isRTL ? "المدرب" : "Instructor"}
        </h2>
        <div className={`flex ${isMobile ? "flex-col items-start gap-4" : "items-start gap-5"}`}>
          {/* Avatar — clickable */}
          <Link
            href={profileHref}
            aria-label={fullName}
            className={`flex-shrink-0 ${isMobile ? "w-20 h-20" : "w-24 h-24"} rounded-full overflow-hidden bg-[var(--color-border-subtle)] flex items-center justify-center transition-opacity hover:opacity-90`}
          >
            {inst.avatar ? (
              <Image
                src={inst.avatar}
                alt={fullName}
                width={isMobile ? 80 : 96}
                height={isMobile ? 80 : 96}
                className="w-full h-full object-cover"
                unoptimized={inst.avatar.startsWith("http")}
              />
            ) : (
              <span
                className={`font-semibold text-[var(--color-text-secondary)] ${isMobile ? "text-xl" : "text-2xl"}`}
              >
                {initials || "?"}
              </span>
            )}
          </Link>

          {/* Body */}
          <div className="flex-1 min-w-0 w-full">
            <Link
              href={profileHref}
              className={`block font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors ${isMobile ? "text-base" : "text-lg"}`}
            >
              {fullName}
            </Link>
            {tagline && (
              <p
                className={`mt-0.5 text-[var(--color-primary)] font-medium ${isMobile ? "text-sm" : "text-sm"}`}
              >
                {tagline}
              </p>
            )}

            {/* Rating + secondary meta row */}
            {inst.totalRatings > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= Math.round(inst.avgRating)
                          ? "text-[var(--color-star)] fill-[var(--color-star)]"
                          : "text-[var(--color-star-border)]"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {inst.avgRating.toFixed(1)}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  ({inst.totalRatings} {isRTL ? "تقييم" : inst.totalRatings === 1 ? "review" : "reviews"})
                </span>
              </div>
            )}

            {inst.bio && (
              <p
                className={`text-sm text-[var(--color-text-secondary)] leading-relaxed mt-3 whitespace-pre-line line-clamp-3`}
              >
                {inst.bio}
              </p>
            )}

            {/* Footer: View profile + socials */}
            <div className={`mt-4 flex items-center gap-3 flex-wrap ${isMobile ? "" : "justify-between"}`}>
              <Link
                href={profileHref}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
              >
                {isRTL ? "عرض الملف الشخصي" : "View profile"}
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Link>
              {(twitterHref || linkedinHref) && (
                <div className="flex items-center gap-2">
                  {linkedinHref && (
                    <a
                      href={linkedinHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn"
                      className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                    </a>
                  )}
                  {twitterHref && (
                    <a
                      href={twitterHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Twitter"
                      className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Notices section renderer
  const renderNotices = (isMobile: boolean = false) => {
    const notices = getNotices();
    if (!notices) return null;
    return (
      <div className={`bg-[#FFFBEB] border border-[#FDE68A] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-6 mb-8"}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className={`font-semibold text-[#92400E] ${isMobile ? "text-sm" : "text-base"} mb-1`}>
              {noticesHeading || t("notices") || "Important Notice"}
            </h3>
            <p className={`text-[#92400E] ${isMobile ? "text-xs" : "text-sm"} leading-relaxed text-start`}>
              {notices}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Reviews section renderer — toggle between course reviews (default)
  // and the course-instructor's reviews across all courses they teach.
  const renderReviews = (isMobile: boolean = false) => {
    const showingInstructor = reviewKind === "instructor";
    const items = showingInstructor
      ? instructorReviews?.data ?? []
      : apiCourse.ratings;
    const avg = showingInstructor
      ? instructorReviews?.avgRating ?? 0
      : apiCourse.avgRating;
    const total = showingInstructor
      ? instructorReviews?.totalRatings ?? 0
      : apiCourse.totalRatings;
    const isLoading = showingInstructor && instructorReviewsLoading;

    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-8 mb-8"}`}>
        <div className={`flex items-center justify-between mb-4 gap-3 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
          <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg" : "text-xl"}`}>
            {reviewsHeading || t("reviews")}
          </h2>
          <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className={`flex items-center gap-0.5 ${isRTL ? "flex-row-reverse" : ""}`}>
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${i < Math.floor(avg) ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)] fill-[var(--color-star-border)]"}`}
                />
              ))}
            </div>
            <span className="text-sm text-[var(--color-text-secondary)]">({total} {t("reviews")})</span>
          </div>
        </div>
        {/* Course | Instructor toggle */}
        <div className={`inline-flex p-1 bg-[var(--color-border-subtle)] rounded-lg mb-5`}>
          {(
            [
              { key: "course" as const, label: isRTL ? "الدورة" : "Course" },
              { key: "instructor" as const, label: isRTL ? "المدرب" : "Instructor" },
            ]
          ).map((seg) => (
            <button
              key={seg.key}
              type="button"
              onClick={() => setReviewKind(seg.key)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                reviewKind === seg.key
                  ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {seg.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
          </div>
        ) : items.length > 0 ? (
          <>
            <div className="flex flex-col divide-y divide-[var(--color-border)]">
              {items.map((review, index) => {
                // Instructor reviews carry a course-name chip; course
                // reviews don't (the page IS the course).
                const r = review as {
                  rating: number;
                  reviewText: string | null;
                  createdAt: string;
                  studentName: string;
                  id?: string;
                  courseTitle?: string;
                  courseTitleAr?: string | null;
                };
                const courseChip =
                  showingInstructor && r.courseTitle
                    ? isRTL && r.courseTitleAr
                      ? r.courseTitleAr
                      : r.courseTitle
                    : null;
                return (
                  <div key={r.id ?? `${index}`} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-[14px] text-[var(--color-text-secondary)]">{r.studentName}</p>
                        {courseChip && (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] truncate max-w-[200px]">
                            {courseChip}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--color-text-secondary)]">
                        {formatPlatformDateReadable(r.createdAt, platformLocale, locale === "ar" ? "ar" : "en")}
                      </p>
                    </div>
                    <div className={`flex items-center gap-0.5 mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${i < r.rating ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)] fill-[var(--color-star-border)]"}`}
                        />
                      ))}
                    </div>
                    {r.reviewText && (
                      <p dir="auto" className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                        {r.reviewText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {!showingInstructor && total > 5 && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setReviewsModalOpen(true)}
                  className="px-6 py-2.5 rounded-full border-2 border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-semibold hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                >
                  {isRTL ? `عرض كل المراجعات (${total})` : `View all reviews (${total})`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-xl bg-[var(--color-border-subtle)] flex items-center justify-center mb-3">
              <Star className="w-7 h-7 text-[var(--color-star-border)]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {noReviewsText || (locale === "ar" ? "لا توجد تقييمات بعد" : "No Reviews Yet")}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:block bg-[var(--color-surface-page)]" dir={isRTL ? "rtl" : "ltr"}>
        {/* Main Content Area */}
        <div className="px-16 pt-6">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex gap-8">
              {/* Course Info - flex-1 */}
              <div className="flex-1">
                {/* Breadcrumb */}
                <div className={`flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-6 ${isRTL ? "flex-row" : ""}`}>
                  <Link href="/" className="hover:text-[var(--color-text-primary)]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 6L8 1.33333L14 6V13.3333C14 13.687 13.8595 14.0261 13.6095 14.2761C13.3594 14.5262 13.0203 14.6667 12.6667 14.6667H3.33333C2.97971 14.6667 2.64057 14.5262 2.39052 14.2761C2.14048 14.0261 2 13.687 2 13.3333V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                  <ChevronIcon className="w-4 h-4" />
                  <Link href="/courses" className="hover:text-[var(--color-text-primary)]">
                    {t("breadcrumb.courses")}
                  </Link>
                  <ChevronIcon className="w-4 h-4" />
                  <span className="text-[var(--color-text-primary)]">{getTitle()}</span>
                </div>

                {/* Title */}
                <h1
                  className={`font-bold text-[var(--color-text-primary)] mb-4 text-start`}
                  style={{ fontSize: "40px", lineHeight: "1.2" }}
                >
                  {getTitle()}
                </h1>
                {getDescription() && (
                  <p className={`text-[var(--color-text-secondary)] text-lg mb-6 text-start`}>{getDescription()}</p>
                )}

                {/* Language Tags */}
                <div className="mb-8">
                  {renderLanguageTags("text-sm")}
                </div>

                {/* Seats + Sessions Info Bar */}
                {(apiSessionCount > 0 || apiRemainingSeats !== null) && (
                  <div className={`flex flex-wrap items-center gap-3 mb-6 ${isRTL ? "justify-start" : ""}`}>
                    {apiSessionCount > 0 && (
                      <div className="flex items-center gap-1.5 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] px-3 py-1.5 rounded-full text-sm">
                        <Video className="w-4 h-4" />
                        {apiSessionCount} {tCourses("card.sessions")}
                      </div>
                    )}
                    {availabilityStatus === "completed" ? (
                      <div className="flex items-center gap-1.5 bg-[var(--color-border)] text-[var(--color-text-secondary)] px-3 py-1.5 rounded-full text-sm font-semibold">
                        <Clock className="w-4 h-4" />
                        {tCourses("card.courseEnded")}
                      </div>
                    ) : availabilityStatus === "deadline_passed" ? (
                      <div className="flex items-center gap-1.5 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-sm font-semibold">
                        <Clock className="w-4 h-4" />
                        {tCourses("card.enrollmentClosed")}
                      </div>
                    ) : availabilityStatus === "full" ? (
                      <div className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-sm font-semibold">
                        <Users className="w-4 h-4" />
                        {tCourses("card.capacityFull")}
                      </div>
                    ) : apiRemainingSeats !== null && apiRemainingSeats <= 10 ? (
                      <div className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-sm font-medium">
                        <Users className="w-4 h-4" />
                        {tCourses("card.seatsLeft", { count: apiRemainingSeats })}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Sessions Section */}
                {renderSessions(false)}

                {/* Notices (from course content) */}
                {renderNotices()}

                {/* Course Details — placed in left column to fill space next to pricing card */}
                <div className="bg-[var(--color-surface-card)] rounded-2xl p-8 mb-8 mt-6">
                  <h2 className={`font-bold text-[var(--color-text-primary)] text-xl mb-6 text-start`}>{courseDetailsHeading || t("courseDetails.title")}</h2>

                  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                    {apiCourse.enrollmentDeadline && (
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                        <div className="text-start">
                          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.registrationDeadline")}</p>
                          <p className="text-sm text-[var(--color-text-secondary)]">{formatDeadline(apiCourse.enrollmentDeadline)}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <Globe className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                      <div className="text-start">
                        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.language")}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{getLanguageLabel()}</p>
                      </div>
                    </div>
                    {apiCourse.startDate && (
                      <div className={`relative bg-[var(--color-border-subtle)] rounded-lg p-3 ps-5 overflow-hidden`}>
                        <div className={`absolute start-0 top-0 bottom-0 w-1 bg-[var(--color-border-subtle)]`} />
                        <p className={`text-sm font-semibold text-[var(--color-text-secondary)] text-start`}>{t("courseDetails.startTime")}</p>
                        <p className={`text-sm text-[var(--color-text-secondary)] text-start`}>{formatDate(apiCourse.startDate)}</p>
                      </div>
                    )}
                    {apiCourse.endDate && (
                      <div className={`relative bg-[var(--color-border-subtle)] rounded-lg p-3 ps-5 overflow-hidden`}>
                        <div className={`absolute start-0 top-0 bottom-0 w-1 bg-[var(--color-border-subtle)]`} />
                        <p className={`text-sm font-semibold text-[var(--color-text-secondary)] text-start`}>{t("courseDetails.endTime")}</p>
                        <p className={`text-sm text-[var(--color-text-secondary)] text-start`}>{formatDate(apiCourse.endDate)}</p>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                      <div className="text-start">
                        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.duration")}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{apiCourse.totalHours} {t("courseDetails.hours")}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Video className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                      <div className="text-start">
                        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{locale === "ar" ? "نوع التقديم" : "Delivery Type"}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{getDeliveryLabel()}</p>
                      </div>
                    </div>
                    {apiCmeAccredited && (
                      <div className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                        <div className="text-start">
                          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{locale === "ar" ? "ساعات CME" : "CME Hours"}</p>
                          <p className="text-sm text-[var(--color-text-secondary)]">{apiCmeHours} {t("courseDetails.hours")}</p>
                        </div>
                      </div>
                    )}
                    {showVenue && getVenue() && (
                      <div className={`relative bg-[var(--color-border-subtle)] rounded-lg p-3 ps-5 overflow-hidden`}>
                        <div className={`absolute start-0 top-0 bottom-0 w-1 bg-[var(--color-border-subtle)]`} />
                        <p className={`text-sm font-semibold text-[var(--color-text-secondary)] text-start`}>{t("courseDetails.venue")}</p>
                        <p className={`text-sm text-[var(--color-text-secondary)] text-start`}>{getVenue()}</p>
                      </div>
                    )}
                    {apiAccreditationNumber && (
                      <div className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                        <div className="text-start">
                          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                            {locale === "ar" ? "رقم الاعتماد" : "Accreditation Number"}
                          </p>
                          <p className="text-sm text-[var(--color-text-secondary)] break-all">
                            {apiAccreditationNumber}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Target Audience — inline */}
                  {getTargetAudience().length > 0 && (
                    <div className={`mt-6 pt-6 border-t border-[var(--color-border)] text-start`}>
                      <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
                        {targetAudienceHeading || t("targetAudience") || "Target Audience"}
                      </p>
                      <div className={`flex flex-wrap gap-2 ${isRTL ? "justify-end" : "justify-start"}`}>
                        {getTargetAudience().map((item, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-xs font-medium"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Card */}
              <div className="w-[360px] flex-shrink-0">
                <div className="bg-[var(--color-surface-card)] shadow-sm border border-[var(--color-border)] rounded-2xl sticky top-24">
                  {/* Course Image */}
                  <div className="p-4 pb-0">
                    <div className="relative h-[200px] rounded-xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={apiCourse.thumbnail || "/blogs/blog-hero.png"}
                        alt={getTitle()}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  </div>

                  {/* Features in sidebar */}
                  {getFeatures().length > 0 && (
                    <div className="px-5 pt-5 pb-4">
                      <h3 className={`text-[15px] font-semibold text-[var(--color-text-primary)] mb-3 text-start`}>
                        {featuresHeading || (locale === "ar" ? "المميزات" : "Features")}
                      </h3>
                      <div className="flex flex-col gap-3">
                        {getFeatures().map((feature, index) => (
                          <div key={index} className={`flex items-start gap-2.5 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                            <div className="w-5 h-5 rounded-full bg-[#DCFCE7] flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Check className="w-3 h-3 text-[#16A34A]" strokeWidth={3} />
                            </div>
                            <span className="text-[var(--color-text-secondary)] text-[13px] leading-[18px]">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price */}
                  <div className="px-4 pb-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        {apiIsFree ? (
                          <span className="text-2xl font-bold text-[#16A34A]">{t("pricingCard.free")}</span>
                        ) : apiOnSale ? (
                          <div className={`flex items-center gap-2 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
                            <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                              <Image src="/icons/rayal-icon.svg" alt="SAR" width={22} height={24} />
                              <span className="text-3xl font-bold text-[var(--color-text-primary)]">{apiEffectivePrice}</span>
                            </div>
                            <span className="text-lg text-[var(--color-text-secondary)] line-through">{apiPrice}</span>
                            {apiCampaignDiscount && apiIsEarlyBirdCampaign ? (
                              <span className="text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded px-2 py-1">
                                {tCourses("card.earlyBird")}
                              </span>
                            ) : apiCampaignDiscount ? (
                              <span className="text-xs font-bold text-white bg-red-600 rounded px-2 py-1">
                                {apiCampaignDiscount.discountType === "percentage"
                                  ? t("pricingCard.percentOff", { percent: apiCampaignDiscount.discountValue })
                                  : tCourses("card.amountOff", { amount: apiCampaignDiscount.discountValue })}
                              </span>
                            ) : apiSalePercent ? (
                              <span className="text-xs font-bold text-white bg-red-600 rounded px-2 py-1">
                                {t("pricingCard.percentOff", { percent: apiSalePercent })}
                              </span>
                            ) : apiSaleAmount ? (
                              <span className="text-xs font-bold text-white bg-red-600 rounded px-2 py-1">
                                {tCourses("card.amountOff", { amount: apiSaleAmount })}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <>
                            <Image src="/icons/rayal-icon.svg" alt="SAR" width={22} height={24} />
                            <span className="text-3xl font-bold text-[var(--color-text-primary)]">{apiPrice}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 relative">
                        <button
                          onClick={handleFavouriteClick}
                          aria-label={favourited ? tFav("removeFromFavourites") : tFav("addToFavourites")}
                          aria-pressed={favourited}
                          className="p-2.5 rounded-full bg-[var(--color-border-subtle)] hover:bg-[var(--color-border)] transition-colors cursor-pointer"
                        >
                          <Heart
                            className={`w-4 h-4 ${favourited ? "text-red-500 fill-red-500" : "text-[var(--color-text-secondary)]"}`}
                          />
                        </button>
                        <button
                          onClick={handleShare}
                          className="p-2.5 rounded-full bg-[var(--color-border-subtle)] hover:bg-[var(--color-border)] transition-colors"
                          aria-label="Share course"
                        >
                          <Share2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        </button>
                        {shareTooltip && (
                          <span className="absolute -bottom-8 right-0 bg-[var(--color-primary)] text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            {locale === "ar" ? "تم نسخ الرابط" : "Link copied"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Primary Action Button */}
                    {!canEnroll ? (
                      /* UNAVAILABLE — disabled with reason */
                      <button
                        disabled
                        className="w-full h-12 border-2 border-[var(--color-border)] rounded-xl text-[var(--color-text-secondary)] font-medium flex items-center justify-center gap-2 cursor-not-allowed mb-3"
                      >
                        {availabilityStatus === "completed"
                          ? tCourses("card.courseEnded")
                          : availabilityStatus === "full"
                            ? tCourses("card.capacityFull")
                            : tCourses("card.enrollmentClosed")}
                      </button>
                    ) : apiIsFree ? (
                      /* FREE COURSE — Enroll Now */
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            if (!isAuthenticated) {
                              handleGuestRedirect();
                            } else if (isStudent) {
                              handleEnroll();
                            }
                          }}
                          disabled={enrolling || enrollResult?.success}
                          className="w-full h-12 btn-gold rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {enrolling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : enrollResult?.success ? (
                            <Check className="w-4 h-4" />
                          ) : null}
                          {enrollResult?.success
                            ? t("enrollment.enrolled")
                            : t("enrollment.enrollNow")}
                        </button>
                        {enrollResult && (
                          <p
                            className={`text-xs mt-1.5 text-center ${
                              enrollResult.success ? "text-[#16A34A]" : "text-[#DC2626]"
                            }`}
                          >
                            {enrollResult.message}
                          </p>
                        )}
                      </div>
                    ) : !isStudent && isAuthenticated ? (
                      /* PAID COURSE, non-student — replace CTA with notice */
                      <div className="mb-3">
                        <NonStudentEnrollmentNotice
                          roleLabel={user?.activeRole || ""}
                          canSwitchToStudent={(user?.roles || []).includes("STUDENT")}
                        />
                      </div>
                    ) : enrolledState === "loading" ? (
                      /* PAID COURSE, student auth confirmed — wait on enrollment
                         lookup before deciding whether to show Buy Now or the
                         "Already Enrolled" card, so the CTA never flashes. */
                      <div className="mb-3 h-12 rounded-xl bg-[var(--color-border-subtle)] animate-pulse" />
                    ) : enrolledState === "enrolled" ? (
                      /* ALREADY ENROLLED — no payment methods, no cart, just
                         a path back into the course. */
                      <div className="mb-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Check className="w-5 h-5 text-[#16A34A]" />
                          <span className="text-sm font-semibold text-[#166534]">
                            {t("pricingCard.alreadyEnrolledTitle")}
                          </span>
                        </div>
                        <p className="text-xs text-[#15803D] mb-3">
                          {t("pricingCard.alreadyEnrolledBody")}
                        </p>
                        <button
                          onClick={() =>
                            router.push(
                              `/${locale}/dashboard/student/courses/${apiCourse!.id}`,
                            )
                          }
                          className="w-full h-12 btn-gold rounded-xl text-white font-medium flex items-center justify-center gap-2"
                        >
                          {t("pricingCard.goToMyCourse")}
                          <ChevronIcon className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : enrolledState === "pending-payment" && pendingPaymentId ? (
                      /* BANK TRANSFER PENDING — receipt uploaded but not yet
                         actioned by finance. Block the buy paths so the student
                         can't double-pay for the same course. */
                      <div className="mb-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-[var(--color-primary)]" />
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {t("pricingCard.pendingPaymentTitle")}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                          {t("pricingCard.pendingPaymentBody")}
                        </p>
                        <button
                          onClick={() =>
                            router.push(
                              `/${locale}/payment/bank-transfer/${pendingPaymentId}`,
                            )
                          }
                          className="w-full h-12 btn-gold rounded-xl text-white font-medium flex items-center justify-center gap-2"
                        >
                          {t("pricingCard.viewPendingPayment")}
                          <ChevronIcon className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      /* PAID COURSE — Amazon-style: Buy Now (express) + Add to Cart */
                      <>
                        <BnplPromoWidgets
                          price={apiEffectivePrice}
                          currency="SAR"
                          source="product"
                          className="mb-3"
                        />
                        <button
                          onClick={handleBuyNow}
                          className="w-full h-12 btn-gold rounded-xl text-white font-medium mb-3 flex items-center justify-center gap-2"
                        >
                          <Zap className="w-4 h-4" aria-hidden="true" />
                          {t("pricingCard.buyNow")}
                        </button>
                        {courseInCart ? (
                          <button
                            onClick={goToCart}
                            className="w-full h-12 bg-[var(--color-text-primary)] rounded-xl text-white font-medium flex items-center justify-center gap-2 mb-3"
                          >
                            <Check className="w-4 h-4" aria-hidden="true" />
                            {t("pricingCard.inCartGoToCart")}
                          </button>
                        ) : (
                          <button
                            onClick={handleAddToCart}
                            className="w-full h-12 bg-[var(--color-text-primary)] rounded-xl text-white font-medium flex items-center justify-center gap-2 mb-3"
                          >
                            <ShoppingCart className="w-4 h-4" aria-hidden="true" />
                            {t("pricingCard.addToCart")}
                          </button>
                        )}
                        {apiCourse.redemption?.enabled &&
                          apiCourse.redemption.pointsCost > 0 && (
                            <RedeemCta
                              cost={apiCourse.redemption.pointsCost}
                              balance={pointsBalance}
                              isStudent={!!isStudent}
                              isAuthenticated={isAuthenticated}
                              redeeming={redeeming}
                              enrollResult={enrollResult}
                              onOpenConfirm={() => setRedeemModalOpen(true)}
                              onSignInPrompt={() => {
                                const returnUrl = pathname;
                                router.push(
                                  `/${locale}/signin?redirect=${encodeURIComponent(returnUrl)}`,
                                );
                              }}
                              onEarnMore={() =>
                                router.push(
                                  `/${locale}/dashboard/student/invite-friends#earn`,
                                )
                              }
                            />
                          )}
                      </>
                    )}

                    {/* Payment Methods — only for PAID courses */}
                    {!apiIsFree && (
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <span className="text-sm text-[var(--color-text-secondary)]">{t("pricingCard.securePayment")}</span>
                        <div className="flex items-center gap-2">
                          <div className="relative w-[35px] h-[24px] bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded overflow-hidden">
                            <Image src="/payment icons/Mastercard.svg" alt="Mastercard" fill className="object-contain p-[5px]" />
                          </div>
                          <div className="relative w-[35px] h-[24px] bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded overflow-hidden">
                            <Image src="/payment icons/Visa.svg" alt="Visa" fill className="object-contain p-[6px]" />
                          </div>
                          <div className="relative w-[35px] h-[24px] bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded overflow-hidden">
                            <Image src="/payment icons/image 474.svg" alt="Mada" fill className="object-contain p-[5px]" />
                          </div>
                          <div className="relative w-[35px] h-[24px]">
                            <Image src="/payment icons/ApplePay.svg" alt="Apple Pay" fill className="object-contain" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Sections (below hero) */}
        <section className="px-16 pt-2 pb-12">
          <div className="max-w-[1200px] mx-auto">
            {(() => {
              const defaultOrder = ["overview", "objectives", "instructor", "contents", "requirements", "faqs", "reviews"];
              // Honour the manager's saved ordering, but append any default
              // sections that aren't in it yet (e.g. courses saved before
              // we added "instructor" / "faqs" still get those blocks).
              const saved = apiCourse.sectionsOrder ?? [];
              const order = saved.length > 0
                ? [...saved, ...defaultOrder.filter((k) => !saved.includes(k))]
                : defaultOrder;
              const sectionMap: Record<string, React.ReactNode> = {
                overview: <div key="overview">{renderOverview(false)}</div>,
                objectives: <div key="objectives">{renderObjectives(false)}</div>,
                instructor: <div key="instructor">{renderInstructor(false)}</div>,
                contents: <div key="contents">{renderModules(false)}</div>,
                requirements: <div key="requirements">{renderRequirements(false)}</div>,
                faqs: <div key="faqs">{renderFaqs(false)}</div>,
                reviews: <div key="reviews">{renderReviews(false)}</div>,
              };
              return order.map((key) => sectionMap[key] || null).filter(Boolean);
            })()}
          </div>
        </section>

        {/* Related Courses */}
        <section className="px-16 py-16 bg-[var(--color-surface-page)]">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="font-bold text-[var(--color-text-primary)] text-center mb-3" style={{ fontSize: "36px" }}>
              {relatedCoursesTitle || t("relatedCourses.title")}
            </h2>
            {(relatedCoursesSubtitle || t("relatedCourses.subtitle")) && (
              <p className="text-[var(--color-text-secondary)] text-center text-base mb-10 max-w-[720px] mx-auto">
                {relatedCoursesSubtitle || t("relatedCourses.subtitle")}
              </p>
            )}

            <div className="grid grid-cols-4 gap-6">
              {relatedCourses.map((relatedCourse) => (
                <CourseCard key={relatedCourse.id} course={relatedCourse} isRTL={isRTL} />
              ))}
            </div>

            <div className="text-center mt-10">
              <Link
                href="/courses"
                className="inline-flex items-center justify-center h-10 px-6 btn-gold rounded-xl text-sm font-medium text-white"
              >
                {t("relatedCourses.viewAllButton")}
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden pb-24 bg-[var(--color-surface-page)]" dir={isRTL ? "rtl" : "ltr"}>
        {/* Breadcrumb */}
        <div className="px-4 pt-4">
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] overflow-x-auto">
            <Link href="/" className="flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 6L8 1.33333L14 6V13.3333C14 13.687 13.8595 14.0261 13.6095 14.2761C13.3594 14.5262 13.0203 14.6667 12.6667 14.6667H3.33333C2.97971 14.6667 2.64057 14.5262 2.39052 14.2761C2.14048 14.0261 2 13.687 2 13.3333V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <ChevronIcon className="w-3 h-3 flex-shrink-0" />
            <Link href="/courses" className="flex-shrink-0">{t("breadcrumb.courses")}</Link>
            <ChevronIcon className="w-3 h-3 flex-shrink-0" />
            <span className="text-[var(--color-text-primary)] truncate">{getTitle()}</span>
          </div>
        </div>

        {/* Hero Section */}
        <section className="px-4 py-6">
          <h1
            className={`font-bold text-[var(--color-text-primary)] mb-2 text-start`}
            style={{ fontSize: "24px", lineHeight: "1.3" }}
          >
            {getTitle()}
          </h1>
          {getDescription() && (
            <p className={`text-[var(--color-text-secondary)] text-sm mb-4 text-start`}>{getDescription()}</p>
          )}

          {/* Language Tags */}
          <div className="mb-6">
            {renderLanguageTags("text-xs")}
          </div>

          {/* Stats */}
          <div className="relative bg-[var(--color-surface-card)] rounded-xl overflow-hidden mb-6">
            <div
              className={`absolute start-0 top-0 bottom-0 w-1`}
              style={{ background: "linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
            />
            <div className={`flex items-center p-3 ps-4`}>
              <div className={`flex-1 text-center border-e border-[var(--color-border)]`}>
                <p className="font-bold text-[var(--color-text-secondary)]">{apiCourse.avgRating.toFixed(1)}</p>
                <div className={`flex items-center justify-center gap-0.5 mb-0.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${i < Math.floor(apiCourse.avgRating) ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)] fill-[var(--color-star-border)]"}`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-[var(--color-text-secondary)]">{apiCourse.totalRatings} {t("statsBar.reviews")}</p>
              </div>
              <div className="flex-1 text-center">
                <Users className="w-4 h-4 text-[var(--color-text-secondary)] mx-auto mb-0.5" />
                <p className="font-bold text-[var(--color-text-secondary)]">{apiCourse.enrolledCount}+</p>
                <p className="text-[10px] text-[var(--color-text-secondary)]">{t("statsBar.learners")}</p>
              </div>
            </div>
          </div>

          {/* Price Card */}
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                {apiIsFree ? (
                  <span className="text-xl font-bold text-[#16A34A]">{t("pricingCard.free")}</span>
                ) : apiOnSale ? (
                  <div className={`flex items-center gap-2 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
                    <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <Image src="/icons/rayal-icon.svg" alt="SAR" width={18} height={20} />
                      <span className="text-2xl font-bold text-[var(--color-text-primary)]">{apiEffectivePrice}</span>
                    </div>
                    <span className="text-base text-[var(--color-text-secondary)] line-through">{apiPrice}</span>
                    {apiCampaignDiscount && apiIsEarlyBirdCampaign ? (
                      <span className="text-[11px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded px-2 py-1">
                        {tCourses("card.earlyBird")}
                      </span>
                    ) : apiCampaignDiscount ? (
                      <span className="text-[11px] font-bold text-white bg-red-600 rounded px-2 py-1">
                        {apiCampaignDiscount.discountType === "percentage"
                          ? t("pricingCard.percentOff", { percent: apiCampaignDiscount.discountValue })
                          : tCourses("card.amountOff", { amount: apiCampaignDiscount.discountValue })}
                      </span>
                    ) : apiSalePercent ? (
                      <span className="text-[11px] font-bold text-white bg-red-600 rounded px-2 py-1">
                        {t("pricingCard.percentOff", { percent: apiSalePercent })}
                      </span>
                    ) : apiSaleAmount ? (
                      <span className="text-[11px] font-bold text-white bg-red-600 rounded px-2 py-1">
                        {tCourses("card.amountOff", { amount: apiSaleAmount })}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <Image src="/icons/rayal-icon.svg" alt="SAR" width={18} height={20} />
                    <span className="text-2xl font-bold text-[var(--color-text-primary)]">{apiPrice}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 relative">
                <button
                  onClick={handleFavouriteClick}
                  aria-label={favourited ? tFav("removeFromFavourites") : tFav("addToFavourites")}
                  aria-pressed={favourited}
                  className="p-2 rounded-full bg-[var(--color-border-subtle)] hover:bg-[var(--color-border)] cursor-pointer"
                >
                  <Heart
                    className={`w-4 h-4 ${favourited ? "text-red-500 fill-red-500" : "text-[var(--color-text-secondary)]"}`}
                  />
                </button>
                <button
                  onClick={handleShare}
                  className="p-2 rounded-full bg-[var(--color-border-subtle)] hover:bg-[var(--color-border)]"
                  aria-label="Share course"
                >
                  <Share2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
                </button>
                {shareTooltip && (
                  <span className="absolute -bottom-8 right-0 bg-[var(--color-primary)] text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {locale === "ar" ? "تم نسخ الرابط" : "Link copied"}
                  </span>
                )}
              </div>
            </div>

            {/* Features */}
            {getFeatures().length > 0 && (
              <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
                <h3 className={`text-sm font-semibold text-[var(--color-text-primary)] mb-3 text-start`}>
                  {featuresHeading || (locale === "ar" ? "المميزات" : "Features")}
                </h3>
                <div className="flex flex-col gap-2.5">
                  {getFeatures().map((feature, index) => (
                    <div key={index} className={`flex items-start gap-2 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                      <div className="w-4 h-4 rounded-full bg-[#DCFCE7] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-[#16A34A]" strokeWidth={3} />
                      </div>
                      <span className="text-[var(--color-text-secondary)] text-xs leading-[16px]">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            {!canEnroll ? (
              <button
                disabled
                className="w-full h-10 border-2 border-[var(--color-border)] rounded-xl text-[var(--color-text-secondary)] text-sm font-medium flex items-center justify-center gap-2 cursor-not-allowed mb-2"
              >
                {availabilityStatus === "completed"
                  ? tCourses("card.courseEnded")
                  : availabilityStatus === "full"
                    ? tCourses("card.capacityFull")
                    : tCourses("card.enrollmentClosed")}
              </button>
            ) : apiIsFree ? (
              <div>
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      handleGuestRedirect();
                    } else if (isStudent) {
                      handleEnroll();
                    }
                  }}
                  disabled={enrolling || enrollResult?.success}
                  className="w-full h-10 btn-gold rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 mb-2"
                >
                  {enrolling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : enrollResult?.success ? (
                    <Check className="w-4 h-4" />
                  ) : null}
                  {enrollResult?.success
                    ? t("enrollment.enrolled")
                    : t("enrollment.enrollNow")}
                </button>
                {enrollResult && (
                  <p
                    className={`text-xs mt-1 text-center ${
                      enrollResult.success ? "text-[#16A34A]" : "text-[#DC2626]"
                    }`}
                  >
                    {enrollResult.message}
                  </p>
                )}
              </div>
            ) : !isStudent && isAuthenticated ? (
              <div className="mb-2">
                <NonStudentEnrollmentNotice
                  roleLabel={user?.activeRole || ""}
                  canSwitchToStudent={(user?.roles || []).includes("STUDENT")}
                />
              </div>
            ) : enrolledState === "loading" ? (
              <div className="mb-2 h-10 rounded-xl bg-[var(--color-border-subtle)] animate-pulse" />
            ) : enrolledState === "enrolled" ? (
              <div className="mb-2 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Check className="w-4 h-4 text-[#16A34A]" />
                  <span className="text-sm font-semibold text-[#166534]">
                    {t("pricingCard.alreadyEnrolledTitle")}
                  </span>
                </div>
                <p className="text-xs text-[#15803D] mb-2.5">
                  {t("pricingCard.alreadyEnrolledBody")}
                </p>
                <button
                  onClick={() =>
                    router.push(
                      `/${locale}/dashboard/student/courses/${apiCourse!.id}`,
                    )
                  }
                  className="w-full h-10 btn-gold rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2"
                >
                  {t("pricingCard.goToMyCourse")}
                  <ChevronIcon className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : enrolledState === "pending-payment" && pendingPaymentId ? (
              <div className="mb-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock className="w-4 h-4 text-[var(--color-primary)]" />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {t("pricingCard.pendingPaymentTitle")}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-2.5">
                  {t("pricingCard.pendingPaymentBody")}
                </p>
                <button
                  onClick={() =>
                    router.push(
                      `/${locale}/payment/bank-transfer/${pendingPaymentId}`,
                    )
                  }
                  className="w-full h-10 btn-gold rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2"
                >
                  {t("pricingCard.viewPendingPayment")}
                  <ChevronIcon className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <BnplPromoWidgets
                  price={apiEffectivePrice}
                  currency="SAR"
                  source="product"
                  className="mb-2"
                />
                <button
                  onClick={handleBuyNow}
                  className="w-full h-10 btn-gold rounded-xl text-white text-sm font-medium mb-2 flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" aria-hidden="true" />
                  {t("pricingCard.buyNow")}
                </button>
                {courseInCart ? (
                  <button
                    onClick={goToCart}
                    className="w-full h-10 bg-[var(--color-text-primary)] rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 mb-2"
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                    {t("pricingCard.inCartGoToCart")}
                  </button>
                ) : (
                  <button
                    onClick={handleAddToCart}
                    className="w-full h-10 bg-[var(--color-text-primary)] rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 mb-2"
                  >
                    <ShoppingCart className="w-4 h-4" aria-hidden="true" />
                    {t("pricingCard.addToCart")}
                  </button>
                )}
              </>
            )}
          </div>

          {/* CME + Seats Info — mobile */}
          {(apiSessionCount > 0 || apiRemainingSeats !== null) && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {apiSessionCount > 0 && (
                <div className="flex items-center gap-1 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] px-2.5 py-1 rounded-full text-xs">
                  <Video className="w-3.5 h-3.5" />
                  {apiSessionCount} {tCourses("card.sessions")}
                </div>
              )}
              {availabilityStatus === "completed" ? (
                <div className="flex items-center gap-1 bg-[var(--color-border)] text-[var(--color-text-secondary)] px-2.5 py-1 rounded-full text-xs font-semibold">
                  {tCourses("card.courseEnded")}
                </div>
              ) : availabilityStatus === "deadline_passed" ? (
                <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold">
                  {tCourses("card.enrollmentClosed")}
                </div>
              ) : availabilityStatus === "full" ? (
                <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                  {tCourses("card.capacityFull")}
                </div>
              ) : apiRemainingSeats !== null && apiRemainingSeats <= 10 ? (
                <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-xs font-medium">
                  {tCourses("card.seatsLeft", { count: apiRemainingSeats })}
                </div>
              ) : null}
            </div>
          )}

          {/* Sessions Section — mobile */}
          {renderSessions(true)}

          {/* Notices (from course content) */}
          {renderNotices()}
        </section>

        {/* Course Details */}
        <section className="px-4 py-6">
          <div className="bg-[var(--color-surface-card)] rounded-xl p-4 mb-4">
            <h2 className={`font-bold text-[var(--color-text-primary)] text-lg mb-4 text-start`}>{courseDetailsHeading || t("courseDetails.title")}</h2>
            <div className="space-y-4">
              {apiCourse.enrollmentDeadline && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <div className="text-start">
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.registrationDeadline")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(apiCourse.enrollmentDeadline)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <div className="text-start">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.language")}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{getLanguageLabel()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <div className="text-start">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.duration")}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{apiCourse.totalHours} {t("courseDetails.hours")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Video className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <div className="text-start">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{locale === "ar" ? "نوع التقديم" : "Delivery Type"}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{getDeliveryLabel()}</p>
                </div>
              </div>
              {apiCmeAccredited && (
                <div className="flex items-center gap-3">
                  <Award className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <div className="text-start">
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{locale === "ar" ? "ساعات CME" : "CME Hours"}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{apiCmeHours} {t("courseDetails.hours")}</p>
                  </div>
                </div>
              )}
              {showVenue && getVenue() && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <div className="text-start">
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.venue")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{getVenue()}</p>
                  </div>
                </div>
              )}
              {apiAccreditationNumber && (
                <div className="flex items-center gap-3">
                  <Award className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <div className="text-start">
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      {locale === "ar" ? "رقم الاعتماد" : "Accreditation Number"}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] break-all">
                      {apiAccreditationNumber}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {/* Target Audience — inline in course details (mobile) */}
            {getTargetAudience().length > 0 && (
              <div className={`mt-4 pt-4 border-t border-[var(--color-border)] text-start`}>
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
                  {targetAudienceHeading || t("targetAudience") || "Target Audience"}
                </p>
                <div className={`flex flex-wrap gap-1.5 ${isRTL ? "justify-end" : "justify-start"}`}>
                  {getTargetAudience().map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-xs font-medium"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(() => {
            const defaultOrder = ["overview", "objectives", "instructor", "contents", "requirements", "faqs", "reviews"];
            const saved = apiCourse.sectionsOrder ?? [];
            const order = saved.length > 0
              ? [...saved, ...defaultOrder.filter((k) => !saved.includes(k))]
              : defaultOrder;
            const sectionMap: Record<string, React.ReactNode> = {
              overview: <div key="overview">{renderOverview(true)}</div>,
              objectives: <div key="objectives">{renderObjectives(true)}</div>,
              instructor: <div key="instructor">{renderInstructor(true)}</div>,
              contents: <div key="contents">{renderModules(true)}</div>,
              requirements: <div key="requirements">{renderRequirements(true)}</div>,
              faqs: <div key="faqs">{renderFaqs(true)}</div>,
              reviews: <div key="reviews">{renderReviews(true)}</div>,
            };
            return order.map((key) => sectionMap[key] || null).filter(Boolean);
          })()}
        </section>

        {/* Related Courses */}
        <section className="px-4 py-8 bg-[var(--color-surface-page)]">
          <h2 className="font-bold text-[var(--color-text-primary)] text-center mb-1" style={{ fontSize: "24px" }}>
            {relatedCoursesTitle || t("relatedCourses.title")}
          </h2>
          <p className="text-[var(--color-text-secondary)] text-center text-sm mb-6">
            {relatedCoursesSubtitle || t("relatedCourses.subtitle")}
          </p>

          <div className="flex flex-col gap-6">
            {relatedCourses.slice(0, 3).map((relatedCourse) => (
              <MobileCourseCard key={relatedCourse.id} course={relatedCourse} isRTL={isRTL} />
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/courses"
              className="inline-flex items-center justify-center h-10 px-6 btn-gold rounded-xl text-sm font-medium text-white"
            >
              {t("relatedCourses.viewAllButton")}
            </Link>
          </div>
        </section>
      </div>

      {/* Reviews Modal */}
      {reviewsModalOpen && slug && apiCourse && (
        <AllReviewsModal
          courseId={slug}
          totalCount={apiCourse.totalRatings}
          avgRating={apiCourse.avgRating}
          onClose={() => setReviewsModalOpen(false)}
          isRTL={isRTL}
          locale={locale}
          reviewsHeading={reviewsHeading}
        />
      )}

      {redeemModalOpen && apiCourse?.redemption?.enabled && (
        <RedeemConfirmModal
          cost={apiCourse.redemption.pointsCost}
          courseTitle={getTitle()}
          onClose={() => setRedeemModalOpen(false)}
          onConfirm={handleRedeem}
          redeeming={redeeming}
        />
      )}

    </>
  );
};

// ─── Points-redemption CTA + confirm modal ─────────────────────

interface RedeemCtaProps {
  cost: number;
  balance: number | null;
  isStudent: boolean;
  isAuthenticated: boolean;
  redeeming: boolean;
  enrollResult: { success: boolean; message: string } | null;
  onOpenConfirm: () => void;
  onSignInPrompt: () => void;
  onEarnMore: () => void;
}

/**
 * Violet secondary CTA that sits under the primary Buy Now/Add to Cart
 * pair. Three mutually-exclusive states:
 *  • Unauthed → "Sign in to redeem" → login flow with redirect back
 *  • Insufficient balance → "Need X more points" → routes to earn page
 *  • Affordable → "Redeem for X points" → opens the confirm modal
 * Non-students never see this CTA — the NonStudentEnrollmentNotice
 * replaces the whole enroll block for them.
 */
function RedeemCta({
  cost,
  balance,
  isStudent,
  isAuthenticated,
  redeeming,
  enrollResult,
  onOpenConfirm,
  onSignInPrompt,
  onEarnMore,
}: RedeemCtaProps) {
  const t = useTranslations("coursesPage.detail.redeemCta");
  if (isAuthenticated && !isStudent) return null;

  const affordable = typeof balance === "number" && balance >= cost;
  const deficit = typeof balance === "number" ? Math.max(0, cost - balance) : cost;

  let label: string;
  let disabled = false;
  let handler: () => void;
  if (!isAuthenticated) {
    label = t("signInPrompt");
    handler = onSignInPrompt;
  } else if (!affordable) {
    label = t("needMore", { deficit });
    handler = onEarnMore;
  } else {
    label = t("enabled", { points: cost });
    handler = onOpenConfirm;
  }
  disabled = redeeming;

  const activeStyle = affordable && isAuthenticated
    ? "border-2 border-[#7C3AED] text-[#7C3AED] hover:bg-[#EDE9FE]"
    : "border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]";

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={handler}
        disabled={disabled}
        className={`w-full h-12 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${activeStyle} disabled:opacity-60`}
      >
        {redeeming ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" strokeWidth={2} />
        )}
        {label}
      </button>
      {enrollResult && (
        <p
          className={`text-xs mt-1.5 text-center ${
            enrollResult.success ? "text-[#16A34A]" : "text-[#DC2626]"
          }`}
        >
          {enrollResult.message}
        </p>
      )}
    </div>
  );
}

interface RedeemConfirmModalProps {
  cost: number;
  courseTitle: string;
  onClose: () => void;
  onConfirm: () => void;
  redeeming: boolean;
}

function RedeemConfirmModal({
  cost,
  courseTitle,
  onClose,
  onConfirm,
  redeeming,
}: RedeemConfirmModalProps) {
  const t = useTranslations("coursesPage.detail.redeemModal");
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#EDE9FE] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#7C3AED]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t("title")}
          </h3>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-1">
          {t("body", { points: cost, course: courseTitle })}
        </p>
        <p className="text-xs text-[#DC2626] mb-5">{t("warning")}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={redeeming}
            className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={redeeming}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] inline-flex items-center gap-2 disabled:opacity-60"
          >
            {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CourseDetailContent;
