"use client";

/**
 * Read-only "About this student" context card.
 *
 * Rendered on the ticket-detail page for tickets that were filed about
 * a third party (instructor → support follow-up about a struggling
 * student). The data shape is composed server-side by
 * supportService.composeAboutUserCard and is gated to staff only —
 * the requesting instructor sees their own filed copy of the ticket
 * without this card, and the student themselves can never see this
 * ticket because it's not in their inbox.
 */

import { useLocale, useTranslations } from "next-intl";
import {
  User as UserIcon,
  BookOpen,
  Calendar,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";

export interface AboutUserData {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  course: {
    id: string;
    title: string;
    titleAr: string | null;
    enrolledAt: string | null;
    progress: number;
    lastAccessedAt: string | null;
    status: string | null;
  } | null;
  attendance: {
    attended: number;
    total: number;
    percentage: number;
  } | null;
  assessmentAvg: {
    avgPercentage: number;
    count: number;
  } | null;
}

interface Props {
  data: AboutUserData;
}

function formatRelative(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return locale === "ar" ? "اليوم" : "Today";
  if (days < 2) return locale === "ar" ? "أمس" : "Yesterday";
  if (days < 7) return locale === "ar" ? `قبل ${days} أيام` : `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return locale === "ar"
      ? `قبل ${weeks} أسبوع`
      : `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const AboutThisStudentCard = ({ data }: Props) => {
  const locale = useLocale();
  const t = useTranslations("aboutThisStudent");
  const isRTL = locale === "ar";

  const initials = data.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Pick a heat color for attendance and average — green ≥80, amber 60-79, red <60.
  const heatClass = (pct: number) =>
    pct >= 80
      ? "text-[#15803D] bg-[#DCFCE7]"
      : pct >= 60
        ? "text-[#A16207] bg-[#FEF9C3]"
        : "text-[#991B1B] bg-[#FEE2E2]";

  return (
    <section
      dir={isRTL ? "rtl" : "ltr"}
      aria-label={t("title")}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] overflow-hidden"
    >
      <header className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-border-subtle)] flex items-center gap-2">
        <UserIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
        <h3 className="text-xs font-semibold text-[var(--color-text-primary)]">
          {t("title")}
        </h3>
      </header>

      <div className="p-4 space-y-3">
        {/* Identity row */}
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[#001f5c] flex items-center justify-center flex-shrink-0">
            {data.avatar ? (
              <Image
                src={data.avatar}
                alt={data.name}
                width={48}
                height={48}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <span className="text-sm font-semibold text-white">
                {initials || "?"}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold text-[var(--color-text-primary)] truncate"
              title={data.name}
            >
              {data.name}
            </p>
            <p
              className="text-xs text-[var(--color-text-secondary)] truncate"
              title={data.email}
            >
              {data.email}
            </p>
          </div>
        </div>

        {/* Course context */}
        {data.course && (
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <div className="flex items-start gap-2 mb-2">
              <BookOpen className="w-3.5 h-3.5 text-[var(--color-text-secondary)] mt-0.5 flex-shrink-0" />
              <p
                className="text-xs font-medium text-[var(--color-text-primary)] line-clamp-2"
                title={
                  isRTL && data.course.titleAr
                    ? data.course.titleAr
                    : data.course.title
                }
              >
                {isRTL && data.course.titleAr
                  ? data.course.titleAr
                  : data.course.title}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <p className="text-[var(--color-text-secondary)] mb-0.5">
                  {t("progress")}
                </p>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {data.course.progress}%
                </p>
              </div>
              <div>
                <p className="text-[var(--color-text-secondary)] mb-0.5">
                  {t("lastAccessed")}
                </p>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {formatRelative(data.course.lastAccessedAt, locale)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[var(--color-text-secondary)] mb-0.5">
                  {t("enrolled")}
                </p>
                <p className="font-medium text-[var(--color-text-primary)]">
                  <Calendar className="w-3 h-3 inline-block me-1 -mt-0.5" />
                  {data.course.enrolledAt
                    ? new Date(data.course.enrolledAt).toLocaleDateString(
                        locale === "ar" ? "ar-SA" : "en-US",
                        { year: "numeric", month: "short", day: "numeric" },
                      )
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Performance row */}
        {(data.attendance || data.assessmentAvg) && (
          <div className="grid grid-cols-2 gap-2">
            {data.attendance && (
              <div
                className={`rounded-lg p-2.5 ${heatClass(data.attendance.percentage)}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <ClipboardList className="w-3.5 h-3.5" />
                  <p className="text-[10px] font-medium">{t("attendance")}</p>
                </div>
                <p className="text-base font-bold">
                  {data.attendance.percentage}%
                </p>
                <p className="text-[10px] opacity-80">
                  {data.attendance.attended}/{data.attendance.total}{" "}
                  {t("sessions")}
                </p>
              </div>
            )}
            {data.assessmentAvg && (
              <div
                className={`rounded-lg p-2.5 ${heatClass(data.assessmentAvg.avgPercentage)}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <p className="text-[10px] font-medium">
                    {t("assessmentAvg")}
                  </p>
                </div>
                <p className="text-base font-bold">
                  {data.assessmentAvg.avgPercentage}%
                </p>
                <p className="text-[10px] opacity-80">
                  {t("lastN", { count: data.assessmentAvg.count })}
                </p>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-[var(--color-text-secondary)] italic">
          {t("footnote")}
        </p>
      </div>
    </section>
  );
};

export default AboutThisStudentCard;
