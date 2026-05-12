"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Star, X } from "lucide-react";
import { studentApi } from "@/lib/api";

export type ReviewKind = "course" | "instructor";

interface ReviewsModalProps {
  /** Which sections to show. Pass only the kinds the student still needs to submit. */
  kinds: ReviewKind[];
  courseId: string;
  courseTitle: string;
  /** Display name of the instructor — required if `kinds` includes "instructor". */
  instructorName?: string;
  onClose: () => void;
  /** Called with the kinds that were successfully submitted, so the parent
   *  can update its local "already submitted" state. */
  onSubmitted: (submitted: ReviewKind[]) => void;
  isRTL: boolean;
}

/**
 * One modal collects up to two reviews — course + instructor — and submits
 * them with a single button. Hides any kind already submitted (caller filters
 * `kinds`). On submit, fires both API calls in parallel and reports per-kind
 * success/failure so the UI can update accurately even on partial success.
 */
export default function ReviewModal({
  kinds,
  courseId,
  courseTitle,
  instructorName,
  onClose,
  onSubmitted,
  isRTL,
}: ReviewsModalProps) {
  const t = useTranslations("studentDashboard");
  const [submitting, setSubmitting] = useState(false);
  const [ratings, setRatings] = useState<Record<ReviewKind, number>>({
    course: 0,
    instructor: 0,
  });
  const [texts, setTexts] = useState<Record<ReviewKind, string>>({
    course: "",
    instructor: "",
  });

  const showCourse = kinds.includes("course");
  const showInstructor = kinds.includes("instructor");
  const allRated = kinds.every((k) => ratings[k] >= 1);

  const setRating = (kind: ReviewKind, value: number) =>
    setRatings((prev) => ({ ...prev, [kind]: value }));
  const setText = (kind: ReviewKind, value: string) =>
    setTexts((prev) => ({ ...prev, [kind]: value }));

  const handleSubmit = async () => {
    if (!allRated) {
      toast.error(t("myCourses.reviewRatingRequired"));
      return;
    }
    setSubmitting(true);
    try {
      // Submit each kind in parallel. Use allSettled so a partial failure
      // still updates state for the side that succeeded.
      const calls = kinds.map((kind) => {
        const text = texts[kind].trim() || undefined;
        const promise =
          kind === "course"
            ? studentApi.submitCourseRating(courseId, ratings[kind], text)
            : studentApi.submitInstructorRating(courseId, ratings[kind], text);
        return promise.then(
          () => ({ kind, ok: true as const }),
          (e: unknown) => {
            const err = e as { status?: number };
            // 409 means already submitted server-side — treat as success
            // because the desired end-state is achieved.
            if (err?.status === 409) return { kind, ok: true as const };
            return { kind, ok: false as const };
          },
        );
      });

      const results = await Promise.all(calls);
      const submitted = results.filter((r) => r.ok).map((r) => r.kind);
      const failed = results.filter((r) => !r.ok);

      if (failed.length === 0) {
        toast.success(t("myCourses.reviewSuccess"));
      } else if (submitted.length > 0) {
        // Partial success — keep modal open for the failed side
        toast.warning(t("myCourses.reviewPartialSuccess"));
      } else {
        toast.error(t("myCourses.reviewError"));
      }

      if (submitted.length > 0) {
        onSubmitted(submitted);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderRatingSection = (kind: ReviewKind, heading: string) => (
    <div>
      <h4 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
        {heading}
      </h4>
      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          {t("myCourses.reviewStarsLabel")} *
        </label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(kind, s)}
              className="p-1.5 hover:scale-110 transition-transform cursor-pointer"
              aria-label={`${s} star${s > 1 ? "s" : ""}`}
            >
              <Star
                className={`w-9 h-9 ${
                  s <= ratings[kind]
                    ? "text-[var(--color-star)] fill-[var(--color-star)]"
                    : "text-[var(--color-star-border)]"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          {t("myCourses.reviewTextLabel")}
        </label>
        <textarea
          value={texts[kind]}
          onChange={(e) => setText(kind, e.target.value)}
          rows={4}
          maxLength={2000}
          dir="auto"
          placeholder={t("myCourses.reviewTextPlaceholder")}
          className="w-full px-3.5 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] resize-none"
        />
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-end">
          {texts[kind].length} / 2000
        </p>
      </div>
    </div>
  );

  // Modal title adapts to which sections we're showing
  const modalTitle =
    showCourse && showInstructor
      ? t("myCourses.combinedReviewTitle")
      : showInstructor
        ? t("myCourses.instructorReviewTitle")
        : t("myCourses.reviewTitle");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto my-8"
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">
              {modalTitle}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[var(--color-border-subtle)] rounded-lg"
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          <p className="text-sm text-[var(--color-text-secondary)] mb-6 truncate">
            {courseTitle}
          </p>

          <div className="space-y-7">
            {showCourse &&
              renderRatingSection(
                "course",
                t("myCourses.reviewSectionCourse"),
              )}
            {showCourse && showInstructor && (
              <div className="border-t border-[var(--color-border)]" />
            )}
            {showInstructor &&
              renderRatingSection(
                "instructor",
                instructorName
                  ? t("myCourses.reviewSectionInstructorNamed", {
                      name: instructorName,
                    })
                  : t("myCourses.reviewSectionInstructor"),
              )}
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--color-border)]">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
            >
              {t("courseDetail.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !allRated}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting
                ? t("myCourses.reviewSubmitting")
                : t("myCourses.reviewSubmit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
