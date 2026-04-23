"use client";

import { useTranslations, useLocale } from "next-intl";
import { Star, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";

interface FeedbackItem {
  id: string;
  learnerName: string;
  learnerInitials: string;
  courseName: string;
  rating: number;
  comment: string;
  sentiment: "positive" | "neutral" | "negative";
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

  // Render star rating
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
            className={`${starSize} text-[#F59E0B] fill-[#F59E0B]`}
          />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative">
            <Star className={`${starSize} text-[var(--color-border)]`} />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className={`${starSize} text-[#F59E0B] fill-[#F59E0B]`} />
            </div>
          </div>
        );
      } else {
        stars.push(
          <Star key={i} className={`${starSize} text-[var(--color-border)]`} />
        );
      }
    }
    return stars;
  };

  // Get sentiment styles
  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return {
          bg: "bg-[#DCFCE7]",
          border: "border-[#22C55E]",
          text: "text-[#22C55E]",
          dot: "bg-[#22C55E]",
        };
      case "neutral":
        return {
          bg: "bg-[#F3F4F6]",
          border: "border-[var(--color-text-secondary)]",
          text: "text-[var(--color-text-secondary)]",
          dot: "bg-[var(--color-text-secondary)]",
        };
      case "negative":
        return {
          bg: "bg-[#FEE2E2]",
          border: "border-[#EF4444]",
          text: "text-[#EF4444]",
          dot: "bg-[#EF4444]",
        };
      default:
        return {
          bg: "bg-[#F3F4F6]",
          border: "border-[var(--color-text-secondary)]",
          text: "text-[var(--color-text-secondary)]",
          dot: "bg-[var(--color-text-secondary)]",
        };
    }
  };

  const getSentimentLabel = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return t("feedback.positive");
      case "neutral":
        return t("feedback.neutral");
      case "negative":
        return t("feedback.negative");
      default:
        return sentiment;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)]">
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#3B82F6]" />
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
              <div className="flex gap-0.5">
                {renderStars(overallRating, "lg")}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Cards */}
        <div className="space-y-3">
          {feedbackItems.map((feedback) => {
            const sentimentStyle = getSentimentStyle(feedback.sentiment);

            return (
              <div
                key={feedback.id}
                className={`p-3 rounded-lg border-s-4 ${sentimentStyle.bg} ${sentimentStyle.border}`}
              >
                {/* Header: Learner info + Rating */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-secondary)]">
                      {feedback.learnerInitials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {feedback.learnerName}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">
                        {feedback.courseName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {renderStars(feedback.rating, "sm")}
                  </div>
                </div>

                {/* Comment */}
                <p className="text-xs text-[var(--color-text-secondary)] mb-2 line-clamp-2">
                  "{feedback.comment}"
                </p>

                {/* Footer: Sentiment + Date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${sentimentStyle.dot}`} />
                    <span className={`text-[10px] font-medium ${sentimentStyle.text}`}>
                      {getSentimentLabel(feedback.sentiment)}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-secondary)]">
                    {feedback.date}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* View All Link */}
        <button className="w-full flex items-center justify-center gap-1 mt-4 py-2.5 text-sm font-medium text-[#3B82F6] hover:underline">
          {t("feedback.viewAll")}
          {locale === "ar" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default RecentFeedbackWidget;
