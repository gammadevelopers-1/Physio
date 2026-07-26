"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { pointsApi, type RedeemableCourse } from "@/lib/api";

interface CoursesRedemptionGridProps {
  /**
   * Current spendable balance — used to decide whether a redeem CTA is
   * fully-lit or muted with a "Need X more points" label. The actual
   * redemption happens on the course-detail page (Phase 3), so click
   * still navigates there regardless of the affordability state.
   */
  balance: number;
}

/**
 * Phase-4 course grid — thumbnails, price striked, points cost, and a
 * navigate-to-detail CTA. This component doesn't run the redemption
 * flow; it hands off to `/{locale}/courses/{id}` where the Phase-3
 * redeem CTA + confirmation modal live.
 */
export default function CoursesRedemptionGrid({
  balance,
}: CoursesRedemptionGridProps) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.myPoints.redeemCourses");
  const isRTL = locale === "ar";

  const [items, setItems] = useState<RedeemableCourse[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await pointsApi.getRedeemableCourses();
        if (!cancelled) setItems(res.courses);
      } catch (err) {
        console.error("Failed to load eligible courses", err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const list = items ?? [];

  return (
    <section
      id="redeem-courses"
      aria-labelledby="redeem-courses-heading"
      className="scroll-mt-24 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 sm:p-6"
    >
      <header className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-violet-600" strokeWidth={2} />
        </div>
        <h2
          id="redeem-courses-heading"
          className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]"
        >
          {t("title")}
        </h2>
      </header>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4 ms-11">
        {t("subtitle")}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <BookOpen className="w-8 h-8 text-[var(--color-text-secondary)] opacity-60 mb-2" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("emptyState")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => (
            <CourseRedemptionCard
              key={c.id}
              course={c}
              balance={balance}
              locale={locale}
              isRTL={isRTL}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface CourseRedemptionCardProps {
  course: RedeemableCourse;
  balance: number;
  locale: string;
  isRTL: boolean;
}

function CourseRedemptionCard({
  course,
  balance,
  locale,
  isRTL,
}: CourseRedemptionCardProps) {
  const t = useTranslations("studentDashboard.myPoints.redeemCourses");
  const title = isRTL && course.titleAr ? course.titleAr : course.title;
  const initial = (title || "?").trim().charAt(0).toUpperCase();
  const short = Math.max(0, course.costPoints - balance);
  const canAfford = short === 0;
  const enrolled = course.alreadyEnrolled;

  // Navigate to the public course detail page — Phase 3 owns the redeem
  // CTA + confirmation modal + success flow there. We never mutate
  // points from this grid.
  const href = `/${locale}/courses/${course.id}`;

  return (
    <article className="flex flex-col bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative w-full aspect-[16/9] bg-[var(--color-surface-page)] overflow-hidden">
        {course.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail}
            alt=""
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600">
            <span className="text-white text-5xl font-bold opacity-90 select-none">
              {initial}
            </span>
          </div>
        )}
        {course.deliveryType && (
          <div
            className={`absolute top-2 ${isRTL ? "right-2" : "left-2"} px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 text-[var(--color-text-primary)] backdrop-blur-sm`}
          >
            {course.deliveryType}
          </div>
        )}
        {enrolled && (
          <div
            className={`absolute top-2 ${isRTL ? "left-2" : "right-2"} px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500 text-white flex items-center gap-1`}
          >
            <CheckCircle2 className="w-3 h-3" />
            {t("enrolledBadge")}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2 min-h-[2.5rem]">
          {title}
        </h3>

        <div className="mt-2 flex items-center gap-2">
          {course.price > 0 && (
            <span className="line-through text-sm text-[var(--color-text-secondary)]">
              {t("originalPrice", { price: course.price.toLocaleString(locale) })}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-lg font-semibold text-violet-600">
            <Sparkles className="w-4 h-4" strokeWidth={2} />
            {t("pointsCost", { count: course.costPoints.toLocaleString(locale) })}
          </span>
        </div>

        <div className="mt-4">
          {enrolled ? (
            <div className="w-full text-center py-2 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium inline-flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {t("enrolledBadge")}
            </div>
          ) : (
            <Link
              href={href}
              className={`w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-opacity ${
                canAfford
                  ? "bg-violet-600 text-white hover:opacity-90"
                  : "bg-violet-600 text-white opacity-70 hover:opacity-90"
              }`}
            >
              {canAfford
                ? t("redeemCta")
                : t("needMorePoints", { count: short.toLocaleString(locale) })}
              <span aria-hidden>{isRTL ? "←" : "→"}</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
