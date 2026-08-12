"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Award, GraduationCap, X } from "lucide-react";
import { useStudentRecentGrades } from "@/hooks/useStudentRecentGrades";
import { pickLocaleTitle } from "@/lib/locale-title";

const STORAGE_KEY = "physioguidance:dismissed-grades";
const MAX_VISIBLE = 5;

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export default function RecentGradesWidget() {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.recentGrades");
  const isRTL = locale === "ar";
  const { data: grades, loading } = useStudentRecentGrades(MAX_VISIBLE * 2);

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDismissed(loadDismissed());
    setHydrated(true);
  }, []);

  const visible = useMemo(
    () => grades.filter((g) => !dismissed.has(g.id)).slice(0, MAX_VISIBLE),
    [grades, dismissed],
  );

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  };

  return (
    <div
      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-5"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
        {t("title")}
      </h2>

      {loading || !hydrated ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-[var(--color-border)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center mb-2">
            <GraduationCap className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t("emptyDescription")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((g) => {
            const courseTitle = isRTL && g.courseTitleAr ? g.courseTitleAr : g.courseTitle;
            const reviewHref = `/${locale}/dashboard/student/courses/${g.courseId}/assessment/${g.assessmentId}?review=true`;

            return (
              <li
                key={g.id}
                className={`group relative flex items-center gap-3 p-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
              >
                <Link
                  href={reviewHref}
                  className={`flex items-center gap-3 flex-1 min-w-0 ${isRTL ? "flex-row-reverse" : ""}`}
                  aria-label={`${pickLocaleTitle(g.assessmentTitle, g.assessmentTitleAr, locale)} — ${Math.round(g.percentage)}%`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      g.passed ? "bg-[#DCFCE7]" : "bg-[#FEE2E2]"
                    }`}
                  >
                    <Award
                      className={`w-4 h-4 ${g.passed ? "text-[#16A34A]" : "text-[#DC2626]"}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                      {pickLocaleTitle(g.assessmentTitle, g.assessmentTitleAr, locale)}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] truncate">
                      {courseTitle}
                    </p>
                  </div>
                  <div className={`text-right flex-shrink-0 ${isRTL ? "text-left" : ""}`}>
                    <span
                      className={`text-sm font-bold ${
                        g.passed ? "text-[#16A34A]" : "text-[#DC2626]"
                      }`}
                    >
                      {Math.round(g.percentage)}%
                    </span>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      {g.score}/{g.totalMarks}
                    </p>
                  </div>
                </Link>

                {/* Dismiss button — appears on hover (or always on touch) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dismiss(g.id);
                  }}
                  aria-label={t("dismiss")}
                  className={`absolute top-1.5 ${isRTL ? "left-1.5" : "right-1.5"} w-5 h-5 rounded-full bg-[var(--color-surface-card)] border border-[var(--color-border)] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all cursor-pointer text-[var(--color-text-secondary)]`}
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
