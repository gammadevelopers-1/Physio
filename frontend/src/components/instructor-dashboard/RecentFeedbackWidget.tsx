"use client";

import { useLocale, useTranslations } from "next-intl";
import { Star, MessageSquare } from "lucide-react";

interface FeedbackItem {
  id: string;
  learnerName: string;
  learnerInitials: string;
  courseName: string;
  rating: number;
  comment: string;
  /** Optional — no longer rendered; kept for backwards-compat with
   *  the transform layer until that fan-out is also stripped. */
  sentiment?: "positive" | "neutral" | "negative";
  /** ISO timestamp from the backend. Rendered as locale date only —
   *  the time portion adds clutter without value on a dashboard widget. */
  date: string;
}

interface RecentFeedbackWidgetProps {
  overallRating: number;
  totalReviews: number;
  feedbackItems: FeedbackItem[];
}

const RecentFeedbackWidget = ({
  overallRating,
  totalReviews,
  feedbackItems,
}: RecentFeedbackWidgetProps) => {
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();

  // Show only the 3 most recent — beyond that the widget bloats the
  // dashboard. Per-course reviews live on each course's detail page.
  const visibleItems = feedbackItems.slice(0, 3);

  // ISO → "May 11, 2026" (locale-aware). Fall through unchanged if the
  // backend ever sends a non-ISO string.
  const formatDate = (raw: string) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderStars = (rating: number, size: "sm" | "lg" = "sm") => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const starSize = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star
            key={i}
            className={`${starSize} text-[var(--color-star)] fill-[var(--color-star)]`}
          />,
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative">
            <Star className={`${starSize} text-[var(--color-star-border)]`} />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className={`${starSize} text-[var(--color-star)] fill-[var(--color-star)]`} />
            </div>
          </div>,
        );
      } else {
        stars.push(
          <Star key={i} className={`${starSize} text-[var(--color-star-border)]`} />,
        );
      }
    }
    return stars;
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[var(--color-primary)]" />
            {t("feedback.title")}
          </h3>
        </div>

        {/* Overall Rating Card */}
        <div className="bg-gradient-to-r from-[#FEF3C7] to-[#FDE68A] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#92400E] font-medium mb-1">
                {t("feedback.overallRating")}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[#92400E]">
                  {overallRating.toFixed(1)}
                </span>
                <span className="text-lg text-[#B45309]">/5</span>
              </div>
              <p className="text-xs text-[#92400E] mt-1">
                {totalReviews} {t("feedback.reviews")}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-0.5">{renderStars(overallRating, "lg")}</div>
            </div>
          </div>
        </div>

        {/* Feedback cards — neutral surface, no sentiment tagging. The
            star count already conveys whether the review was good or bad. */}
        <div className="space-y-3">
          {visibleItems.map((feedback) => (
            <div
              key={feedback.id}
              className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-page)]"
            >
              {/* Header: learner info + rating */}
              <div className="flex items-start justify-between mb-2 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-secondary)] flex-shrink-0">
                    {feedback.learnerInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {feedback.learnerName}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] truncate">
                      {feedback.courseName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {renderStars(feedback.rating, "sm")}
                </div>
              </div>

              {/* Comment */}
              {feedback.comment && (
                <p className="text-xs text-[var(--color-text-secondary)] mb-2 line-clamp-2">
                  &ldquo;{feedback.comment}&rdquo;
                </p>
              )}

              {/* Date only — no sentiment chip */}
              <p className="text-[10px] text-[var(--color-text-secondary)] text-end">
                {formatDate(feedback.date)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecentFeedbackWidget;
