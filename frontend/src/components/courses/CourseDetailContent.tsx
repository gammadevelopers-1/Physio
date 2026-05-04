"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, usePathname } from "next/navigation";
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
  ShoppingCart,
  Video,
  Award,
  AlertTriangle,
  X,
} from "lucide-react";
import { CourseCard, MobileCourseCard } from "@/components/courses";
import { PublicCourse } from "@/types/instructor-dashboard";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { studentApi, publicApi, ApiError } from "@/lib/api";
import { formatDuration } from "@/lib/utils";
import { getCityLabel } from "@/lib/saudi-cities";
import { Loader2 } from "lucide-react";

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
    new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

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
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="text-sm border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--color-surface-page)]"
            >
              <option value="highest">{isRTL ? "الأعلى تقييماً" : "Highest rated"}</option>
              <option value="lowest">{isRTL ? "الأقل تقييماً" : "Lowest rated"}</option>
              <option value="newest">{isRTL ? "الأحدث" : "Newest"}</option>
              <option value="oldest">{isRTL ? "الأقدم" : "Oldest"}</option>
            </select>
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
  const locale = useLocale();
  const isRTL = locale === "ar";

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

  // Auth + enrollment state
  const { user, isAuthenticated } = useAuth();
  const isStudent = isAuthenticated && user?.activeRole === "STUDENT";
  const [enrolling, setEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [shareTooltip, setShareTooltip] = useState(false);
  const [sessionFilterCity, setSessionFilterCity] = useState<string>("");
  const [sessionFilterMonth, setSessionFilterMonth] = useState<string>("");
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);

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

  // Derive pricing/capacity from API data
  const apiPrice = apiCourse?.price ?? 0;
  const apiIsFree = apiPrice === 0;
  const apiIsFull = apiCourse?.isFull ?? false;
  const apiRemainingSeats = apiCourse?.remainingSeats ?? null;
  const apiCmeAccredited = apiCourse?.isCmeAccredited ?? false;
  const apiCmeHours = apiCourse?.cmeHours ?? 0;
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
  // Sessions list shown only for onsite/blended (zoom-only courses hide lectures list)
  const showSessions = dt === "onsite" || dt === "blended";
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
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    );
  };

  // Delivery type label
  const getDeliveryLabel = () => {
    if (dt === "zoom") return isRTL ? "عبر الإنترنت" : "Live Online";
    if (dt === "onsite") return isRTL ? "حضوري" : "On-site";
    if (dt === "blended") return isRTL ? "مدمج" : "Blended";
    if (dt === "self-paced") return isRTL ? "ذاتي" : "Self-paced";
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
        <h2 className={`${isMobile ? "text-lg" : "text-[20px]"} font-semibold mb-4 ${isRTL ? "text-right" : "text-left"}`}>
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
                <select
                  value={sessionFilterCity}
                  onChange={(e) => setSessionFilterCity(e.target.value)}
                  className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-surface-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">{locale === "ar" ? "كل المدن" : "All cities"}</option>
                  {uniqueCities.map((city) => (
                    <option key={city} value={city}>
                      {getCityLabel(city, locale)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showMonthFilter && (
              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-[var(--color-text-secondary)] font-medium">
                  {locale === "ar" ? "الشهر" : "Month"}
                </label>
                <select
                  value={sessionFilterMonth}
                  onChange={(e) => setSessionFilterMonth(e.target.value)}
                  className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-surface-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">{locale === "ar" ? "كل الأشهر" : "All months"}</option>
                  {uniqueMonths.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
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
                <div className={isRTL ? "text-right" : "text-left"}>
                  <p className="font-medium text-[14px]">{session.title}</p>
                  <p className="text-[13px] text-[var(--color-text-secondary)]">
                    {new Date(session.scheduledAt).toLocaleDateString(
                      locale === "ar" ? "ar-SA" : "en-US",
                      { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
                    )}
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

  // Overview section renderer — renders HTML from rich text editor
  const renderOverview = (isMobile: boolean = false) => {
    const overview = getOverview();
    if (!overview) return null;
    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-8 mb-8"}`}>
        <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg mb-3" : "text-xl mb-4"} ${isRTL ? "text-right" : "text-left"}`}>
          {overviewHeading || t("overview") || "Overview"}
        </h2>
        <div
          className={`course-overview-content text-[var(--color-text-secondary)] ${isMobile ? "text-sm" : "text-base"} leading-relaxed ${isRTL ? "text-right" : "text-left"}`}
          dir={isRTL ? "rtl" : "ltr"}
          dangerouslySetInnerHTML={{ __html: overview }}
        />
      </div>
    );
  };

  // Objectives section renderer
  const renderObjectives = (isMobile: boolean = false) => {
    const objectives = getObjectives();
    if (!objectives.length) return null;
    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-8 mb-8"}`}>
        <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg mb-4" : "text-xl mb-6"} ${isRTL ? "text-right" : "text-left"}`}>
          {objectivesHeading || t("whatYouWillLearn.title")}
        </h2>
        <div className={isMobile ? "space-y-3" : "space-y-4"}>
          {objectives.map((item, index) => (
            <div key={index} className={`flex items-start ${isMobile ? "gap-2.5" : "gap-3"}`}>
              <Check className={`${isMobile ? "w-4 h-4" : "w-5 h-5"} text-[var(--color-text-primary)] flex-shrink-0 mt-0.5`} />
              <p className={`text-[var(--color-text-secondary)] ${isMobile ? "text-sm" : "text-base"} ${isRTL ? "text-right" : "text-left"}`}>{item}</p>
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
        <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg mb-4" : "text-xl mb-6"} ${isRTL ? "text-right" : "text-left"}`}>
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
        <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg mb-3" : "text-xl mb-4"} ${isRTL ? "text-right" : "text-left"}`}>
          {requirementsHeading || t("requirements") || "Requirements"}
        </h2>
        <p className={`text-[var(--color-text-secondary)] ${isMobile ? "text-sm" : "text-base"} leading-relaxed ${isRTL ? "text-right" : "text-left"}`}>
          {getRequirements()}
        </p>
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
            <p className={`text-[#92400E] ${isMobile ? "text-xs" : "text-sm"} leading-relaxed ${isRTL ? "text-right" : "text-left"}`}>
              {notices}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Reviews section renderer — always shows, with empty state
  const renderReviews = (isMobile: boolean = false) => {
    return (
      <div className={`bg-[var(--color-surface-card)] ${isMobile ? "rounded-xl p-4 mb-4" : "rounded-2xl p-8 mb-8"}`}>
        <div className={`flex items-center justify-between mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
          <h2 className={`font-bold text-[var(--color-text-primary)] ${isMobile ? "text-lg" : "text-xl"}`}>
            {reviewsHeading || t("reviews")}
          </h2>
          <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className={`flex items-center gap-0.5 ${isRTL ? "flex-row-reverse" : ""}`}>
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${i < Math.floor(apiCourse.avgRating) ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)] fill-[var(--color-star-border)]"}`}
                />
              ))}
            </div>
            <span className="text-sm text-[var(--color-text-secondary)]">({apiCourse.totalRatings} {t("reviews")})</span>
          </div>
        </div>
        {apiCourse.ratings.length > 0 ? (
          <>
            <div className="flex flex-col divide-y divide-[var(--color-border)]">
              {apiCourse.ratings.map((review, index) => (
                <div key={index} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-[14px] text-[var(--color-text-secondary)]">{review.studentName}</p>
                    <p className="text-[12px] text-[var(--color-text-secondary)]">
                      {new Date(review.createdAt).toLocaleDateString(
                        locale === "ar" ? "ar-SA" : "en-US",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </p>
                  </div>
                  <div className={`flex items-center gap-0.5 mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${i < review.rating ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)] fill-[var(--color-star-border)]"}`}
                      />
                    ))}
                  </div>
                  {review.reviewText && (
                    <p dir="auto" className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                      {review.reviewText}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {apiCourse.totalRatings > 5 && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setReviewsModalOpen(true)}
                  className="px-6 py-2.5 rounded-full border-2 border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-semibold hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                >
                  {isRTL ? `عرض كل المراجعات (${apiCourse.totalRatings})` : `View all reviews (${apiCourse.totalRatings})`}
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
                  className={`font-bold text-[var(--color-text-primary)] mb-4 ${isRTL ? "text-right" : "text-left"}`}
                  style={{ fontSize: "40px", lineHeight: "1.2" }}
                >
                  {getTitle()}
                </h1>
                {getDescription() && (
                  <p className={`text-[var(--color-text-secondary)] text-lg mb-6 ${isRTL ? "text-right" : "text-left"}`}>{getDescription()}</p>
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
                  <h2 className={`font-bold text-[var(--color-text-primary)] text-xl mb-6 ${isRTL ? "text-right" : "text-left"}`}>{courseDetailsHeading || t("courseDetails.title")}</h2>

                  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                    {apiCourse.enrollmentDeadline && (
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                        <div className={isRTL ? "text-right" : "text-left"}>
                          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.registrationDeadline")}</p>
                          <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(apiCourse.enrollmentDeadline)}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <Globe className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                      <div className={isRTL ? "text-right" : "text-left"}>
                        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.language")}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{getLanguageLabel()}</p>
                      </div>
                    </div>
                    {apiCourse.startDate && (
                      <div className={`relative bg-[var(--color-border-subtle)] rounded-lg p-3 ${isRTL ? "pr-5" : "pl-5"} overflow-hidden`}>
                        <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[var(--color-border-subtle)]`} />
                        <p className={`text-sm font-semibold text-[var(--color-text-secondary)] ${isRTL ? "text-right" : "text-left"}`}>{t("courseDetails.startTime")}</p>
                        <p className={`text-sm text-[var(--color-text-secondary)] ${isRTL ? "text-right" : "text-left"}`}>{formatDate(apiCourse.startDate)}</p>
                      </div>
                    )}
                    {apiCourse.endDate && (
                      <div className={`relative bg-[var(--color-border-subtle)] rounded-lg p-3 ${isRTL ? "pr-5" : "pl-5"} overflow-hidden`}>
                        <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[var(--color-border-subtle)]`} />
                        <p className={`text-sm font-semibold text-[var(--color-text-secondary)] ${isRTL ? "text-right" : "text-left"}`}>{t("courseDetails.endTime")}</p>
                        <p className={`text-sm text-[var(--color-text-secondary)] ${isRTL ? "text-right" : "text-left"}`}>{formatDate(apiCourse.endDate)}</p>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                      <div className={isRTL ? "text-right" : "text-left"}>
                        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.duration")}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{apiCourse.totalHours} {t("courseDetails.hours")}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Video className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                      <div className={isRTL ? "text-right" : "text-left"}>
                        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{locale === "ar" ? "نوع التقديم" : "Delivery Type"}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{getDeliveryLabel()}</p>
                      </div>
                    </div>
                    {apiCmeAccredited && (
                      <div className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" />
                        <div className={isRTL ? "text-right" : "text-left"}>
                          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{locale === "ar" ? "ساعات CME" : "CME Hours"}</p>
                          <p className="text-sm text-[var(--color-text-secondary)]">{apiCmeHours} {t("courseDetails.hours")}</p>
                        </div>
                      </div>
                    )}
                    {showVenue && getVenue() && (
                      <div className={`relative bg-[var(--color-border-subtle)] rounded-lg p-3 ${isRTL ? "pr-5" : "pl-5"} overflow-hidden`}>
                        <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[var(--color-border-subtle)]`} />
                        <p className={`text-sm font-semibold text-[var(--color-text-secondary)] ${isRTL ? "text-right" : "text-left"}`}>{t("courseDetails.venue")}</p>
                        <p className={`text-sm text-[var(--color-text-secondary)] ${isRTL ? "text-right" : "text-left"}`}>{getVenue()}</p>
                      </div>
                    )}
                  </div>

                  {/* Target Audience — inline */}
                  {getTargetAudience().length > 0 && (
                    <div className={`mt-6 pt-6 border-t border-[var(--color-border)] ${isRTL ? "text-right" : "text-left"}`}>
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
                      <h3 className={`text-[15px] font-semibold text-[var(--color-text-primary)] mb-3 ${isRTL ? "text-right" : "text-left"}`}>
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
                        ) : (
                          <>
                            <Image src="/icons/rayal-icon.svg" alt="SAR" width={22} height={24} />
                            <span className="text-3xl font-bold text-[var(--color-text-primary)]">{apiPrice}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 relative">
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

                    {/* Tabby Payment — only for PAID courses */}
                    {!apiIsFree && (
                      <div className="border border-[var(--color-border)] rounded-xl p-4 mb-4">
                        <div className="flex items-start justify-between">
                          <div className={isRTL ? "text-right" : "text-left"}>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {t("pricingCard.asLowAs")}{" "}
                              <span className="font-semibold">
                                <Image src="/icons/rayal-icon.svg" alt="SAR" width={12} height={13} className="inline -mt-0.5" />
                                {" "}{(apiPrice / 4).toFixed(2)}{t("pricingCard.perMonth")}
                              </span>
                            </p>
                            <p className="text-sm text-[var(--color-text-secondary)]">{t("pricingCard.interestFree")}</p>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {t("pricingCard.shariahCompliant")}{" "}
                              <Link href="#" className="font-semibold underline">{t("pricingCard.learnMore")}</Link>
                            </p>
                          </div>
                          <Image src="/images/tabby.svg" alt="Tabby" width={70} height={28} className="mt-1" />
                        </div>
                      </div>
                    )}

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
                    ) : (
                      /* PAID COURSE — Buy Now + Add to Cart */
                      <>
                        <button
                          onClick={() => {
                            if (!isAuthenticated) {
                              handleGuestRedirect();
                            } else if (isStudent) {
                              alert(t("enrollment.contactMessage"));
                            }
                          }}
                          className="w-full h-12 btn-gold rounded-xl text-white font-medium mb-3"
                        >
                          {t("pricingCard.buyNow")}
                        </button>
                        <button
                          onClick={() => {
                            if (!isAuthenticated) {
                              handleGuestRedirect();
                            } else if (isStudent) {
                              alert(t("enrollment.contactMessage"));
                            }
                          }}
                          className="w-full h-12 bg-[var(--color-text-primary)] rounded-xl text-white font-medium flex items-center justify-center gap-2 mb-3"
                        >
                          {t("pricingCard.addToCart")}
                          <ShoppingCart className="w-4 h-4" />
                        </button>
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
              const defaultOrder = ["overview", "objectives", "contents", "requirements", "reviews"];
              const order = (apiCourse.sectionsOrder && apiCourse.sectionsOrder.length > 0)
                ? apiCourse.sectionsOrder
                : defaultOrder;
              const sectionMap: Record<string, React.ReactNode> = {
                overview: <div key="overview">{renderOverview(false)}</div>,
                objectives: <div key="objectives">{renderObjectives(false)}</div>,
                contents: <div key="contents">{renderModules(false)}</div>,
                requirements: <div key="requirements">{renderRequirements(false)}</div>,
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
            className={`font-bold text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : "text-left"}`}
            style={{ fontSize: "24px", lineHeight: "1.3" }}
          >
            {getTitle()}
          </h1>
          {getDescription() && (
            <p className={`text-[var(--color-text-secondary)] text-sm mb-4 ${isRTL ? "text-right" : "text-left"}`}>{getDescription()}</p>
          )}

          {/* Language Tags */}
          <div className="mb-6">
            {renderLanguageTags("text-xs")}
          </div>

          {/* Stats */}
          <div className="relative bg-[var(--color-surface-card)] rounded-xl overflow-hidden mb-6">
            <div
              className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1`}
              style={{ background: "linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
            />
            <div className={`flex items-center p-3 ${isRTL ? "pr-4" : "pl-4"}`}>
              <div className={`flex-1 text-center ${isRTL ? "border-l" : "border-r"} border-[var(--color-border)]`}>
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
                ) : (
                  <>
                    <Image src="/icons/rayal-icon.svg" alt="SAR" width={18} height={20} />
                    <span className="text-2xl font-bold text-[var(--color-text-primary)]">{apiPrice}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 relative">
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
                <h3 className={`text-sm font-semibold text-[var(--color-text-primary)] mb-3 ${isRTL ? "text-right" : "text-left"}`}>
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

            {/* Tabby Payment — only for PAID courses */}
            {!apiIsFree && (
              <div className="border border-[var(--color-border)] rounded-xl p-3 mb-4">
                <div className="flex items-start justify-between">
                  <div className={isRTL ? "text-right" : "text-left"}>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("pricingCard.asLowAs")} <span className="font-semibold">{(apiPrice / 4).toFixed(2)}{t("pricingCard.perMonth")}</span>
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("pricingCard.interestFree")}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t("pricingCard.shariahCompliant")} <Link href="#" className="font-semibold underline">{t("pricingCard.learnMore")}</Link>
                    </p>
                  </div>
                  <Image src="/images/tabby.svg" alt="Tabby" width={50} height={20} />
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
            ) : (
              <>
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      handleGuestRedirect();
                    } else if (isStudent) {
                      alert(t("enrollment.contactMessage"));
                    }
                  }}
                  className="w-full h-10 btn-gold rounded-xl text-white text-sm font-medium mb-2"
                >
                  {t("pricingCard.buyNow")}
                </button>
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      handleGuestRedirect();
                    } else if (isStudent) {
                      alert(t("enrollment.contactMessage"));
                    }
                  }}
                  className="w-full h-10 bg-[var(--color-text-primary)] rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 mb-2"
                >
                  {t("pricingCard.addToCart")}
                  <ShoppingCart className="w-4 h-4" />
                </button>
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
            <h2 className={`font-bold text-[var(--color-text-primary)] text-lg mb-4 ${isRTL ? "text-right" : "text-left"}`}>{courseDetailsHeading || t("courseDetails.title")}</h2>
            <div className="space-y-4">
              {apiCourse.enrollmentDeadline && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <div className={isRTL ? "text-right" : "text-left"}>
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.registrationDeadline")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(apiCourse.enrollmentDeadline)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <div className={isRTL ? "text-right" : "text-left"}>
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.language")}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{getLanguageLabel()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <div className={isRTL ? "text-right" : "text-left"}>
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.duration")}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{apiCourse.totalHours} {t("courseDetails.hours")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Video className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <div className={isRTL ? "text-right" : "text-left"}>
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{locale === "ar" ? "نوع التقديم" : "Delivery Type"}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{getDeliveryLabel()}</p>
                </div>
              </div>
              {apiCmeAccredited && (
                <div className="flex items-center gap-3">
                  <Award className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <div className={isRTL ? "text-right" : "text-left"}>
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{locale === "ar" ? "ساعات CME" : "CME Hours"}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{apiCmeHours} {t("courseDetails.hours")}</p>
                  </div>
                </div>
              )}
              {showVenue && getVenue() && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <div className={isRTL ? "text-right" : "text-left"}>
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{t("courseDetails.venue")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{getVenue()}</p>
                  </div>
                </div>
              )}
            </div>
            {/* Target Audience — inline in course details (mobile) */}
            {getTargetAudience().length > 0 && (
              <div className={`mt-4 pt-4 border-t border-[var(--color-border)] ${isRTL ? "text-right" : "text-left"}`}>
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
            const defaultOrder = ["overview", "objectives", "contents", "requirements", "reviews"];
            const order = (apiCourse.sectionsOrder && apiCourse.sectionsOrder.length > 0)
              ? apiCourse.sectionsOrder
              : defaultOrder;
            const sectionMap: Record<string, React.ReactNode> = {
              overview: <div key="overview">{renderOverview(true)}</div>,
              objectives: <div key="objectives">{renderObjectives(true)}</div>,
              contents: <div key="contents">{renderModules(true)}</div>,
              requirements: <div key="requirements">{renderRequirements(true)}</div>,
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
    </>
  );
};

export default CourseDetailContent;
