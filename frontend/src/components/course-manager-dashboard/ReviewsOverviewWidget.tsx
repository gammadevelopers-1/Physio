"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Star, ArrowRight, ArrowLeft } from "lucide-react";

interface TopCourse {
  courseId: string;
  title: string;
  titleAr: string | null;
  avgRating: number;
  totalRatings: number;
}

interface ReviewsOverviewWidgetProps {
  overall: {
    avgRating: number;
    totalRatings: number;
    totalCourses: number;
    coursesWithReviews: number;
  };
  topCourses: TopCourse[];
}

const StarRow = ({ value, size = "md" }: { value: number; size?: "sm" | "md" }) => {
  const dim = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.floor(value);
        const half = !filled && star - 0.5 <= value;
        return (
          <Star
            key={star}
            className={`${dim} ${
              filled
                ? "text-[var(--gold-gold-500)] fill-[var(--gold-gold-500)]"
                : half
                  ? "text-[var(--gold-gold-500)] fill-[var(--gold-gold-500)]/50"
                  : "text-[var(--color-border)]"
            }`}
          />
        );
      })}
    </div>
  );
};

const ReviewsOverviewWidget = ({ overall, topCourses }: ReviewsOverviewWidgetProps) => {
  const t = useTranslations("courseManagerDashboard.reviewsOverview");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  if (overall.totalCourses === 0) return null;

  const hasReviews = overall.totalRatings > 0;

  return (
    <div
      className="bg-[var(--surface-intense)] rounded-xl border border-[var(--color-border)] mb-6"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-[var(--gold-gold-100)] rounded-lg flex items-center justify-center flex-shrink-0">
            <Star className="w-4 h-4 text-[var(--gold-gold-500)]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[var(--on-surface-default)] truncate">
              {t("title")}
            </h3>
            <p className="text-xs text-[var(--on-surface-variant)] truncate">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <Link
          href={`/${locale}/dashboard/manager/reviews`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--on-surface-default)] bg-[var(--color-surface-page)] hover:bg-[var(--color-border-subtle)] border border-[var(--color-border)] rounded-lg transition-colors flex-shrink-0"
        >
          <span className="hidden sm:inline">{t("moderate")}</span>
          <ArrowIcon className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Body */}
      {!hasReviews ? (
        <div className="p-6 sm:p-8 text-center">
          <p className="text-sm font-medium text-[var(--on-surface-default)] mb-1">
            {t("emptyTitle")}
          </p>
          <p className="text-xs text-[var(--on-surface-variant)]">
            {t("emptySubtitle")}
          </p>
        </div>
      ) : (
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Overall rating block */}
          <div className="bg-[var(--color-surface-page)] rounded-xl p-4 sm:p-5 border border-[var(--color-border)] lg:w-[200px] lg:flex-shrink-0 text-center">
            <p className="text-4xl font-bold text-[var(--on-surface-default)] mb-2">
              {overall.avgRating.toFixed(1)}
            </p>
            <div className="flex justify-center mb-3">
              <StarRow value={overall.avgRating} />
            </div>
            <p className="text-xs text-[var(--on-surface-variant)]">
              {t("reviewsCount", { count: overall.totalRatings })}
            </p>
            <p className="text-xs text-[var(--on-surface-variant)] mt-1">
              {t("coursesWithReviews", {
                reviewed: overall.coursesWithReviews,
                total: overall.totalCourses,
              })}
            </p>
          </div>

          {/* Top courses */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--on-surface-variant)] uppercase tracking-wider mb-3">
              {t("topRated")}
            </p>
            <ul className="space-y-2">
              {topCourses.map((course, idx) => {
                const displayTitle = isRTL && course.titleAr ? course.titleAr : course.title;
                return (
                  <li key={course.courseId}>
                    <Link
                      href={`/${locale}/dashboard/manager/courses/${course.courseId}/reviews`}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--color-surface-page)] transition-colors group"
                    >
                      <span className="w-6 h-6 rounded-full bg-[var(--gold-gold-100)] text-[var(--gold-gold-500)] text-xs font-semibold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <p className="flex-1 min-w-0 text-sm font-medium text-[var(--on-surface-default)] truncate group-hover:text-[var(--gold-gold-500)] transition-colors">
                        {displayTitle}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <StarRow value={course.avgRating} size="sm" />
                        <span className="text-xs font-semibold text-[var(--on-surface-default)]">
                          {course.avgRating.toFixed(1)}
                        </span>
                        <span className="text-xs text-[var(--on-surface-variant)]">
                          ({course.totalRatings})
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsOverviewWidget;
