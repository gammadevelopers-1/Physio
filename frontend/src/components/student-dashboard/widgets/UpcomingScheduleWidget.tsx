"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Video, MapPin, Globe, Calendar as CalendarIcon, Loader2, Clock } from "lucide-react";
import type { CalendarEvent } from "@/types/student-dashboard";
import { studentApi } from "@/lib/api";
import { formatTimeUntil } from "@/lib/calendar-utils";

interface UpcomingScheduleWidgetProps {
  events: CalendarEvent[];
}

const MAX_ITEMS = 5;

function isJoinable(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  return diff <= 15 * 60 * 1000 && diff > -2 * 60 * 60 * 1000;
}

export default function UpcomingScheduleWidget({ events }: UpcomingScheduleWidgetProps) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.upcomingSchedule");
  const isRTL = locale === "ar";

  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Future events only, soonest first. Excludes cancelled so the widget
  // matches the Lectures page and Course Detail upcoming list — otherwise
  // a cancelled session can appear here while the other two hide it.
  const now = Date.now();
  const upcoming = (events || [])
    .filter((e) => e.status !== "cancelled")
    .filter((e) => new Date(e.date).getTime() >= now - 60 * 60 * 1000) // include in-progress
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const visible = upcoming.slice(0, MAX_ITEMS);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleJoin = async (e: CalendarEvent) => {
    setJoiningId(e.id);
    try {
      const { joinUrl } = await studentApi.getSessionJoinUrl(e.id);
      window.open(joinUrl, "_blank");
    } catch {
      if (e.zoomLink) window.open(e.zoomLink, "_blank");
    } finally {
      setJoiningId(null);
    }
  };

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
          {upcoming.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-full">
              {upcoming.length}
            </span>
          )}
        </div>
        <Link
          href={`/${locale}/dashboard/student/calendar`}
          className="text-xs font-medium text-[var(--color-primary)] hover:underline"
        >
          {t("viewAll")}
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center mb-2">
            <CalendarIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("emptyDescription")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((event) => {
            const TypeIcon =
              event.sessionType === "onsite"
                ? MapPin
                : event.sessionType === "zoom"
                  ? Video
                  : Globe;
            const courseTitle =
              isRTL && event.courseTitleAr ? event.courseTitleAr : event.courseTitle;
            const eventDate = new Date(event.date);
            const joinable = event.sessionType === "zoom" && event.zoomLink && isJoinable(event.date);

            return (
              <li
                key={event.id}
                className={`flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] ${isRTL ? "flex-row-reverse" : ""}`}
              >
                <div className="w-9 h-9 rounded-lg bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                  <TypeIcon className="w-4 h-4 text-[#D4A520]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {event.title}
                  </p>
                  <div className={`flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-xs text-[var(--color-text-secondary)] ${isRTL ? "flex-row-reverse" : ""}`}>
                    <span className="whitespace-nowrap">{dateFmt.format(eventDate)} · {timeFmt.format(eventDate)}</span>
                    {courseTitle && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate max-w-[120px]">{courseTitle}</span>
                      </>
                    )}
                    {!joinable && event.sessionType === "zoom" && event.zoomLink && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap opacity-70">
                          <Clock className="w-3 h-3" />
                          {t("opensIn", { time: formatTimeUntil(event.date) })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {joinable ? (
                  <button
                    type="button"
                    onClick={() => handleJoin(event)}
                    disabled={joiningId === event.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#2D8CFF] text-white rounded-lg hover:bg-[#1A73E8] transition-colors disabled:opacity-60 cursor-pointer flex-shrink-0"
                  >
                    {joiningId === event.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Video className="w-3 h-3" />
                    )}
                    {t("join")}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
