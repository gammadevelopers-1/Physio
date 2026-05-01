"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { ArrowRight, ArrowLeft, Star } from "lucide-react";
import type { Testimonial, HomePage } from "@/lib/strapi/types";

interface TestimonialsProps {
  testimonials?: Testimonial[];
  sectionData?: HomePage | null;
}

interface ApiReview {
  id: string;
  rating: number;
  reviewText: string;
  studentName: string;
  studentAvatar: string | null;
  courseTitle: string;
  createdAt: string;
}

interface DisplayReview {
  id: string;
  rating: number;
  text: string;
  name: string;
  avatar: string | null;
  subtitle: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

const StarRow = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-1" dir="ltr">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`w-4 h-4 ${
          n <= rating
            ? "text-[var(--color-primary)] fill-[var(--color-primary)]"
            : "text-[var(--color-border-subtle)]"
        }`}
        strokeWidth={1.5}
      />
    ))}
  </div>
);

const Testimonials = ({
  testimonials: strapiTestimonials = [],
  sectionData,
}: TestimonialsProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [apiReviews, setApiReviews] = useState<ApiReview[] | null>(null);
  const locale = useLocale();
  const isRTL = locale === "ar";

  const title = sectionData?.testimonialsTitle || "";
  const description = sectionData?.testimonialsDescription || "";

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/public-stats/reviews?limit=10`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setApiReviews(data);
      })
      .catch(() => {
        if (!cancelled) setApiReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefer real student reviews; fall back to Strapi-curated quotes if API empty
  let reviews: DisplayReview[] = [];
  if (apiReviews && apiReviews.length > 0) {
    reviews = apiReviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.reviewText,
      name: r.studentName,
      avatar: r.studentAvatar,
      subtitle: r.courseTitle,
    }));
  } else if (strapiTestimonials.length > 0) {
    reviews = strapiTestimonials.map((t, i) => ({
      id: `strapi-${i}`,
      rating: 5,
      text: t.quote,
      name: t.authorName,
      avatar: null,
      subtitle: t.authorRole || "",
    }));
  }

  // Hide section entirely if no reviews and no API response yet null/empty
  if (apiReviews !== null && reviews.length === 0) {
    return null;
  }
  if (apiReviews === null && strapiTestimonials.length === 0) {
    return null;
  }

  const total = reviews.length;
  const safeIndex = total > 0 ? Math.min(currentSlide, total - 1) : 0;
  const review = reviews[safeIndex];

  const handlePrev = () =>
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : total - 1));
  const handleNext = () =>
    setCurrentSlide((prev) => (prev < total - 1 ? prev + 1 : 0));

  // While we're loading and have nothing to show yet, render a sized placeholder
  // so the page doesn't jump.
  const isLoading = apiReviews === null && strapiTestimonials.length === 0;

  return (
    <section
      className="px-4 lg:px-16 py-12 lg:py-20 bg-[var(--color-surface-page)]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-[1100px] mx-auto flex flex-col gap-8 items-center">
        {/* Header */}
        {(title || description) && (
          <div className="text-center max-w-[720px]">
            {title && (
              <h2 className="font-bold text-[var(--color-primary)] text-[28px] lg:text-[40px] leading-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-3 text-[var(--color-text-secondary)] text-[15px] lg:text-[17px] leading-7">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Review card */}
        <div
          className="w-full bg-[var(--color-surface-card)] rounded-3xl shadow-sm px-6 py-10 lg:px-12 lg:py-14"
          aria-live="polite"
        >
          {isLoading ? (
            <div className="min-h-[180px]" />
          ) : review ? (
            <div className="flex flex-col items-center text-center gap-5 max-w-[640px] mx-auto">
              <StarRow rating={review.rating} />

              <p className="text-[var(--color-text-primary)] text-[18px] lg:text-[22px] leading-relaxed font-medium">
                &ldquo;{review.text}&rdquo;
              </p>

              <div className="flex flex-col items-center gap-2 mt-2">
                {review.avatar ? (
                  <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-[var(--color-border-subtle)]">
                    <Image
                      src={review.avatar}
                      alt={review.name}
                      fill
                      className="object-cover"
                      unoptimized={review.avatar.startsWith("http")}
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)] text-lg font-semibold">
                    {review.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="font-semibold text-[var(--color-primary)] text-[15px]">
                  {review.name}
                </p>
                {review.subtitle && (
                  <p className="text-[var(--color-text-secondary)] text-[13px]">
                    {review.subtitle}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Navigation — only when more than one review */}
        {total > 1 && (
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
              {reviews.map((_, i) => (
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
};

export default Testimonials;
