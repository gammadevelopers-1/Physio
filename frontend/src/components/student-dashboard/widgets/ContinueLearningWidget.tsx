"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Play, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import type { StudentEnrolledCourse } from "@/types/student-dashboard";

interface ContinueLearningWidgetProps {
  /** Already-loaded enrolled courses. The widget picks the top N most-recently accessed. */
  courses: StudentEnrolledCourse[];
  loading?: boolean;
}

const MAX_ITEMS = 3;

export default function ContinueLearningWidget({
  courses,
  loading,
}: ContinueLearningWidgetProps) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.continueLearning");
  const isRTL = locale === "ar";
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  // Most-recent active courses first (lastAccessedAt desc, fall back to enrollment order)
  const active = (courses || [])
    .filter((c) => c.enrollmentStatus === "active")
    .sort((a, b) => {
      const ta = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
      const tb = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
      return tb - ta;
    });

  const visible = active.slice(0, MAX_ITEMS);

  return (
    <div
      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-5"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className={`flex items-center justify-between mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("title")}
          </h2>
          {active.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-full">
              {active.length}
            </span>
          )}
        </div>
        {active.length > 0 && (
          <Link
            href={`/${locale}/dashboard/student/courses`}
            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("viewAll")}
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-[var(--color-border)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center mb-2">
            <BookOpen className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {t("emptyTitle")}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            {t("emptyDescription")}
          </p>
          <Link
            href={`/${locale}/courses`}
            className="px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            {t("browseCourses")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((course) => {
            const courseTitle = isRTL && course.titleAr ? course.titleAr : course.title;
            const initial = (courseTitle || "?").trim().charAt(0).toUpperCase();
            const actionLabel = course.progress > 0 ? t("resume") : t("start");

            return (
              <li key={course.id}>
                <Link
                  href={`/${locale}/dashboard/student/courses/${course.id}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  {/* Thumbnail (40x40 — small, fast scan) */}
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

                  {/* Title + progress bar */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {courseTitle}
                    </p>
                    <div className={`flex items-center gap-2 mt-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <div className="flex-1 h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#16A34A] rounded-full transition-all duration-300"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-[var(--color-text-secondary)] flex-shrink-0">
                        {course.progress}%
                      </span>
                    </div>
                  </div>

                  {/* Action chip — implies "click to open" */}
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] flex-shrink-0">
                    <Play className="w-3 h-3" />
                    {actionLabel}
                  </span>
                  <ArrowIcon className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 sm:hidden" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
