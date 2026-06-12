"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  review: {
    score: number | null;
    comment: string | null;
    submittedAt: string | null;
    channel?: string | null;
  } | null;
  locale: string;
}

// CSAT review card — surfaces the customer's score + comment inline on
// the ticket detail view so staff don't have to bounce to the Reports
// tab to see how the customer rated this specific ticket. Visible to
// support staff, admins, and the customer themselves.
export default function CsatReviewCard({ review, locale }: Props) {
  const t = useTranslations("supportDashboard.ticketDetail.csatReview");

  if (!review || review.score == null) return null;

  const dateLabel = review.submittedAt
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(review.submittedAt))
    : null;

  // Tone the badge from green (5) → red (1).
  const tone =
    review.score >= 4
      ? "bg-[#DCFCE7] text-[#15803D] ring-1 ring-inset ring-[#4ADE80]"
      : review.score === 3
        ? "bg-[#FEF3C7] text-[#92400E] ring-1 ring-inset ring-[#FBBF24]"
        : "bg-[#FEE2E2] text-[#B91C1C] ring-1 ring-inset ring-[#F87171]";

  const scoreLabel =
    review.score >= 4
      ? t("toneSatisfied")
      : review.score === 3
        ? t("toneNeutral")
        : t("toneDissatisfied");

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] inline-flex items-center gap-1.5">
          <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
          {t("title")}
        </h3>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tone}`}
        >
          {scoreLabel}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
          <Star
            key={n}
            className={`w-4 h-4 ${
              n <= (review.score ?? 0)
                ? "text-[#F59E0B] fill-[#F59E0B]"
                : "text-[var(--color-border)]"
            }`}
          />
        ))}
        <span className="text-xs font-semibold text-[var(--color-text-primary)] tabular-nums ms-1">
          {review.score}/5
        </span>
      </div>
      {review.comment ? (
        <blockquote className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words border-s-2 border-[var(--color-primary)] ps-3 leading-relaxed">
          “{review.comment}”
        </blockquote>
      ) : (
        <p className="text-xs italic text-[var(--color-text-secondary)]">
          {t("noComment")}
        </p>
      )}
      {dateLabel && (
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-3">
          {t("submittedAt", { date: dateLabel })}
        </p>
      )}
    </div>
  );
}
