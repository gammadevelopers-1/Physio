"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Star,
} from "lucide-react";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi } from "@/lib/api";

interface CourseReviewsContentProps {
  courseId: string;
}

type Review = {
  id: string;
  rating: number;
  reviewText: string | null;
  createdAt: string;
  studentName: string;
};

type SortOption = "highest" | "lowest" | "newest" | "oldest";

const PAGE_SIZE = 20;

export default function CourseReviewsContent({ courseId }: CourseReviewsContentProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const manager = useManagerProfile();
  const t = useTranslations("courseManagerDashboard");

  const [courseTitle, setCourseTitle] = useState<string>("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRatings, setTotalRatings] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [distribution, setDistribution] = useState<Record<"1" | "2" | "3" | "4" | "5", number>>({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 });

  const [sort, setSort] = useState<SortOption>("newest");
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    courseManagerApi
      .getCourseDetail(courseId)
      .then((c) => setCourseTitle(isRTL && c.titleAr ? c.titleAr : c.title))
      .catch(() => setCourseTitle(""));
  }, [courseId, isRTL]);

  const fetchReviews = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const res = await courseManagerApi.getCourseRatings(courseId, {
          page: nextPage,
          limit: PAGE_SIZE,
          sort,
          rating: starFilter ?? undefined,
          search: search || undefined,
        });
        setReviews(res.data);
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotalRatings(res.totalRatings);
        setAvgRating(res.avgRating);
        setDistribution(res.distribution);
      } catch {
        setReviews([]);
      } finally {
        setLoading(false);
      }
    },
    [courseId, sort, starFilter, search],
  );

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const maxDist = Math.max(1, ...Object.values(distribution));
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const pageNumbers = () => {
    const pages: (number | "...")[] = [];
    const window = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
    return pages;
  };

  return (
    <>
      <CourseManagerNavbar manager={manager} />
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="mb-6">
                <Link
                  href={`/${locale}/dashboard/manager/courses/${courseId}`}
                  className={`inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-3 ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  <Arrow className="w-4 h-4" />
                  {isRTL ? "العودة إلى الدورة" : "Back to Course"}
                </Link>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {isRTL ? "مراجعات الطلاب" : "Student Reviews"}
                </h1>
                {courseTitle && (
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1 truncate">{courseTitle}</p>
                )}
              </div>

              {/* Aggregate stats */}
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-1">{isRTL ? "متوسط التقييم" : "Average rating"}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-[var(--color-text-primary)]">{avgRating.toFixed(1)}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${s <= Math.round(avgRating) ? "fill-[#FBBF24] text-[#FBBF24]" : "text-[var(--color-border)]"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {isRTL ? `${totalRatings} مراجعة` : `${totalRatings} ${totalRatings === 1 ? "review" : "reviews"}`}
                    </p>
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((s) => {
                      const c = distribution[String(s) as "1" | "2" | "3" | "4" | "5"] || 0;
                      const pct = (c / maxDist) * 100;
                      return (
                        <div key={s} className="flex items-center gap-2 text-xs">
                          <span className="w-6 text-[var(--color-text-secondary)]">{s}★</span>
                          <div className="flex-1 h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div className="h-full bg-[#FBBF24]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-end text-[var(--color-text-secondary)] tabular-nums">{c}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className={`w-4 h-4 text-[var(--color-text-secondary)] absolute top-2.5 ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSearch(searchInput);
                      }}
                      onBlur={() => setSearch(searchInput)}
                      placeholder={isRTL ? "ابحث باسم الطالب أو نص المراجعة..." : "Search by student name or review text..."}
                      className={`w-full ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6]`}
                    />
                  </div>

                  {/* Sort */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">{isRTL ? "الترتيب:" : "Sort:"}</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortOption)}
                      className="text-sm border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] bg-white"
                    >
                      <option value="newest">{isRTL ? "الأحدث" : "Newest"}</option>
                      <option value="oldest">{isRTL ? "الأقدم" : "Oldest"}</option>
                      <option value="highest">{isRTL ? "الأعلى تقييماً" : "Highest rated"}</option>
                      <option value="lowest">{isRTL ? "الأقل تقييماً" : "Lowest rated"}</option>
                    </select>
                  </div>
                </div>

                {/* Star chips */}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setStarFilter(null)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      starFilter === null ? "bg-[var(--color-text-primary)] text-white" : "bg-[#F3F4F6] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                    }`}
                  >
                    {isRTL ? "الكل" : "All"} ({totalRatings})
                  </button>
                  {[5, 4, 3, 2, 1].map((s) => {
                    const c = distribution[String(s) as "1" | "2" | "3" | "4" | "5"] || 0;
                    return (
                      <button
                        key={s}
                        onClick={() => setStarFilter(starFilter === s ? null : s)}
                        disabled={c === 0}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          starFilter === s ? "bg-[#FBBF24] text-white" : "bg-[#F3F4F6] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                        }`}
                      >
                        {s} <Star className="w-3 h-3 fill-current" /> ({c})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reviews list */}
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-xl bg-[#F3F4F6] flex items-center justify-center mb-3">
                      <Star className="w-7 h-7 text-[var(--color-text-secondary)]" />
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {totalRatings === 0
                        ? (t("courseDetail.noReviewsYet") || (isRTL ? "لا توجد مراجعات بعد" : "No reviews yet"))
                        : (isRTL ? "لا توجد مراجعات مطابقة للفلاتر" : "No reviews match your filters")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((r) => (
                      <div key={r.id} className="border border-[var(--color-border)] rounded-lg p-4 bg-[#FAFAFA]">
                        <div className="flex items-start justify-between mb-2 gap-3">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{r.studentName}</p>
                            <p className="text-xs text-[var(--color-text-secondary)]">{formatDate(r.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-4 h-4 ${s <= r.rating ? "fill-[#FBBF24] text-[#FBBF24]" : "text-[var(--color-border)]"}`}
                              />
                            ))}
                          </div>
                        </div>
                        {r.reviewText && (
                          <p dir="auto" className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line">{r.reviewText}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {!loading && reviews.length > 0 && totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {isRTL
                        ? `صفحة ${page} من ${totalPages}`
                        : `Page ${page} of ${totalPages}`}
                    </p>
                    <div className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <button
                        onClick={() => fetchReviews(page - 1)}
                        disabled={page <= 1}
                        className="p-1.5 rounded hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={isRTL ? "السابق" : "Previous"}
                      >
                        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </button>
                      {pageNumbers().map((p, i) =>
                        p === "..." ? (
                          <span key={`d-${i}`} className="px-2 text-xs text-[var(--color-text-secondary)]">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => fetchReviews(p)}
                            className={`min-w-[28px] h-7 px-2 text-xs font-medium rounded ${
                              p === page ? "bg-[var(--color-text-primary)] text-white" : "text-[var(--color-text-secondary)] hover:bg-[#F3F4F6]"
                            }`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                      <button
                        onClick={() => fetchReviews(page + 1)}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={isRTL ? "التالي" : "Next"}
                      >
                        {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
