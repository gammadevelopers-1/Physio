"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardCheck, Upload, ArrowRight, ArrowLeft } from "lucide-react";
import type { StudentEnrolledCourse } from "@/types/student-dashboard";

interface PendingAssessmentsWidgetProps {
  courses: StudentEnrolledCourse[];
  loading?: boolean;
}

const MAX_ITEMS = 5;

function deadlineLabel(
  iso: string | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
): { text: string; tone: "overdue" | "soon" | "ok" } | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return { text: t("overdue"), tone: "overdue" };
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days <= 0) return { text: t("dueInHours", { count: hours }), tone: "soon" };
  if (days <= 3) return { text: t("dueInDays", { count: days }), tone: "soon" };
  return { text: t("dueInDays", { count: days }), tone: "ok" };
}

export default function PendingAssessmentsWidget({
  courses,
  loading,
}: PendingAssessmentsWidgetProps) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.pendingAssessments");
  const tTime = useTranslations("studentDashboard.time");
  const isRTL = locale === "ar";
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  // Exclude courses past their live window. On `ended` the backend rejects
  // new attempts, so surfacing them here as "pending" is misleading.
  const isLiveCourseStatus = (s?: string) =>
    !s || (s !== "ended" && s !== "completed" && s !== "archived" && s !== "cancelled");
  const pending = (courses || [])
    .filter(
      (c) =>
        c.enrollmentStatus === "active" &&
        isLiveCourseStatus(c.courseStatus) &&
        (c.nextAction === "take_quiz" || c.nextAction === "upload_assignment"),
    )
    .sort((a, b) => {
      const ta = a.nextDeadline ? new Date(a.nextDeadline).getTime() : Infinity;
      const tb = b.nextDeadline ? new Date(b.nextDeadline).getTime() : Infinity;
      return ta - tb;
    });

  const visible = pending.slice(0, MAX_ITEMS);

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
          {pending.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-full">
              {pending.length}
            </span>
          )}
        </div>
        {pending.length > MAX_ITEMS && (
          <Link
            href={`/${locale}/dashboard/student/courses`}
            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("viewAll")}
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-[var(--color-border)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center mb-2">
            <ClipboardCheck className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("emptyDescription")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((course) => {
            const deadline = deadlineLabel(course.nextDeadline, tTime);
            const isQuiz = course.nextAction === "take_quiz";
            const Icon = isQuiz ? ClipboardCheck : Upload;
            const actionLabel = isQuiz ? t("takeQuiz") : t("uploadAssignment");
            const courseTitle = isRTL && course.titleAr ? course.titleAr : course.title;

            return (
              <li key={course.id}>
                <Link
                  href={`/${locale}/dashboard/student/courses/${course.id}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#D4A520]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {courseTitle}
                    </p>
                    <div className={`flex items-center gap-2 mt-0.5 text-xs text-[var(--color-text-secondary)] ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span>{actionLabel}</span>
                      {deadline && (
                        <>
                          <span>·</span>
                          <span
                            className={
                              deadline.tone === "overdue"
                                ? "text-[#DC2626] font-medium"
                                : deadline.tone === "soon"
                                  ? "text-[#D97706] font-medium"
                                  : ""
                            }
                          >
                            {deadline.text}
                          </span>
                        </>
                      )}
                    </div>
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
