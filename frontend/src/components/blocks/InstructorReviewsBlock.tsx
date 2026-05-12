"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { ArrowLeft, ArrowRight, Loader2, Star } from "lucide-react";
import type { InstructorReviewsBlockData } from "@/lib/strapi/types";

interface FeaturedReview {
  id: string;
  courseId: string;
  courseTitle: string;
  courseTitleAr: string | null;
  rating: number;
  reviewText: string | null;
  createdAt: string;
  studentName: string;
  instructor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    firstNameAr: string | null;
    lastNameAr: string | null;
    avatar: string | null;
  };
}

interface Props {
  data: InstructorReviewsBlockData;
}

/**
 * Strapi-driven block: shuffled, round-robin sample of approved instructor
 * reviews across all instructors. Single-card carousel matching the
 * courses-reviews visual language (centered card, large quote, instructor
 * avatar + name, prev/next + dot indicators below).
 */
export function InstructorReviewsBlock({ data }: Props) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const limit = data.limit && data.limit > 0 ? data.limit : 6;

  const [reviews, setReviews] = useState<FeaturedReview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/instructor-reviews-featured?limit=${limit}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((json: FeaturedReview[]) => {
        if (!cancelled) setReviews(Array.isArray(json) ? json : []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (!loading && (!reviews || reviews.length === 0)) {
    return null;
  }

  const visibilityClass =
    data.visibility === "desktop-only"
      ? "hidden lg:block"
      : data.visibility === "mobile-only"
        ? "lg:hidden"
        : "";

  const total = reviews?.length || 0;
  const safeIndex = total > 0 ? Math.min(currentSlide, total - 1) : 0;
  const review = reviews?.[safeIndex];

  const handlePrev = () =>
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : total - 1));
  const handleNext = () =>
    setCurrentSlide((prev) => (prev < total - 1 ? prev + 1 : 0));

  // Resolve display name + course title for the active card.
  const arName = review
    ? `${review.instructor.firstNameAr || ""} ${review.instructor.lastNameAr || ""}`.trim()
    : "";
  const enName = review
    ? `${review.instructor.firstName || ""} ${review.instructor.lastName || ""}`.trim()
    : "";
  const instructorName =
    (isRTL && arName) || enName || arName || "Instructor";
  const initials = instructorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const courseTitle = review
    ? isRTL && review.courseTitleAr
      ? review.courseTitleAr
      : review.courseTitle
    : "";

  return (
    <section
      className={`px-4 lg:px-16 py-12 lg:py-20 bg-[var(--color-surface-page)] ${visibilityClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-[1100px] mx-auto flex flex-col gap-8 items-center">
        {/* Header */}
        {(data.title || data.description) && (
          <div className="text-center max-w-[720px]">
            {data.title && (
              <h2 className="font-bold text-[var(--color-primary)] text-[28px] lg:text-[40px] leading-tight">
                {data.title}
              </h2>
            )}
            {data.description && (
              <p className="mt-3 text-[var(--color-text-secondary)] text-[15px] lg:text-[17px] leading-7">
                {data.description}
              </p>
            )}
          </div>
        )}

        {/* Single-card carousel */}
        <div
          className="w-full bg-[var(--color-surface-card)] rounded-3xl shadow-sm px-6 py-10 lg:px-12 lg:py-14"
          aria-live="polite"
        >
          {loading ? (
            <div className="min-h-[260px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : review ? (
            <div className="flex flex-col items-center text-center gap-5 max-w-[680px] mx-auto">
              {/* Star row */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-5 h-5 ${
                      s <= review.rating
                        ? "text-[var(--color-star)] fill-[var(--color-star)]"
                        : "text-[var(--color-star-border)]"
                    }`}
                  />
                ))}
              </div>

              {/* Quote */}
              {review.reviewText && (
                <p
                  dir="auto"
                  className="text-[var(--color-text-primary)] text-[18px] lg:text-[22px] leading-relaxed font-medium"
                >
                  &ldquo;{review.reviewText}&rdquo;
                </p>
              )}

              {/* Instructor identity */}
              <div className="flex flex-col items-center gap-2 mt-2">
                {review.instructor.avatar ? (
                  <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-[var(--color-border-subtle)]">
                    <Image
                      src={review.instructor.avatar}
                      alt={instructorName}
                      fill
                      className="object-cover"
                      unoptimized={review.instructor.avatar.startsWith("http")}
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)] text-lg font-semibold">
                    {initials || "?"}
                  </div>
                )}
                <p className="font-semibold text-[var(--color-primary)] text-[15px]">
                  {instructorName}
                </p>
                <p className="text-[var(--color-text-secondary)] text-[13px]">
                  {review.studentName}
                  {courseTitle && (
                    <>
                      <span className="mx-1.5">·</span>
                      {courseTitle}
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Navigation — only when more than one review */}
        {!loading && total > 1 && (
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrev}
              aria-label="Previous review"
              className="w-10 h-10 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] flex items-center justify-center text-white transition-colors"
            >
              {isRTL ? (
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              ) : (
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              )}
            </button>

            <div className="flex items-center gap-2">
              {reviews?.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  aria-label={`Go to review ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    i === safeIndex
                      ? "w-6 bg-[var(--color-primary)]"
                      : "w-2 bg-[var(--color-border-subtle)] hover:bg-[var(--color-border)]"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              aria-label="Next review"
              className="w-10 h-10 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] flex items-center justify-center text-white transition-colors"
            >
              {isRTL ? (
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              ) : (
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
