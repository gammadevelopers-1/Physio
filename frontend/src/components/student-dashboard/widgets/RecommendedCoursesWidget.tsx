"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, ArrowRight, ArrowLeft, BookOpen } from "lucide-react";
import { publicApi } from "@/lib/api";
import type { PublicCourse } from "@/types/instructor-dashboard";
import type { StudentEnrolledCourse } from "@/types/student-dashboard";

interface RecommendedCoursesWidgetProps {
  /** Active enrollments — used to filter out courses the student is already in. */
  enrolledCourses: StudentEnrolledCourse[];
}

const MAX_ITEMS = 3;

export default function RecommendedCoursesWidget({
  enrolledCourses,
}: RecommendedCoursesWidgetProps) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.recommendedCourses");
  const isRTL = locale === "ar";
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const [data, setData] = useState<PublicCourse[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    publicApi
      .getCourses({ limit: 12 })
      .then((res) => {
        if (cancelled) return;
        const enrolledIds = new Set(enrolledCourses.map((c) => c.id));
        const filtered = (res.data || [])
          .filter((c) => !enrolledIds.has(c.id))
          .filter((c) => c.availabilityStatus !== "completed")
          .slice(0, MAX_ITEMS);
        setData(filtered);
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enrolledCourses]);

  return (
    <div
      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-5"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className={`flex items-center justify-between gap-3 mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles className="w-4 h-4 text-[#D4A520] flex-shrink-0" />
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
            {t("title")}
          </h2>
        </div>
        <Link
          href={`/${locale}/courses`}
          className="text-xs font-medium text-[var(--color-primary)] hover:underline whitespace-nowrap flex-shrink-0"
        >
          {t("viewAll")}
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-[var(--color-border)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center mb-2">
            <BookOpen className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("emptyDescription")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((course) => {
            const courseTitle = isRTL && course.titleAr ? course.titleAr : course.title;
            const initial = (courseTitle || "?").trim().charAt(0).toUpperCase();
            const price = course.price ?? 0;
            const isFree = price === 0;

            return (
              <li key={course.id}>
                <Link
                  href={`/${locale}/courses/${course.id}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-border-subtle)] overflow-hidden flex-shrink-0">
                    {course.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={course.thumbnail}
                        alt={courseTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))",
                        }}
                      >
                        <span className="text-white text-sm font-bold">{initial}</span>
                      </div>
                    )}
                  </div>

                  {/* Title + price */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {courseTitle}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                      {isFree ? t("free") : `${price} SAR`}
                      {course.cmeHours
                        ? ` · ${course.cmeHours} ${t("cmeHours")}`
                        : null}
                    </p>
                  </div>

                  <ArrowIcon className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
