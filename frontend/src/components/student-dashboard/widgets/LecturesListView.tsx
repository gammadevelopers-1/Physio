"use client";

import { useState, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Video,
  MapPin,
  Globe,
  Calendar as CalendarIcon,
  ClipboardCheck,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { CalendarEvent } from "@/types/student-dashboard";
import { studentApi } from "@/lib/api";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { formatDate } from "@/lib/hijri";
import { formatTimeUntil } from "@/lib/calendar-utils";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatPlatformTime } from "@/lib/platform-locale";
import EmptyStateIllustration from "../EmptyStateIllustration";

interface LecturesListViewProps {
  events: CalendarEvent[];
}

function isJoinable(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  return diff <= 15 * 60 * 1000 && diff > -2 * 60 * 60 * 1000;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

const TYPE_ICON: Record<string, typeof Video> = {
  zoom: Video,
  onsite: MapPin,
  blended: Globe,
  hybrid: Globe,
};

export default function LecturesListView({ events }: LecturesListViewProps) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.lecturesPage");
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();
  const platformLocale = usePlatformLocale();

  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [pastExpanded, setPastExpanded] = useState(false);

  const { todayList, upcomingList, pastList } = useMemo(() => {
    const now = Date.now();
    const today: CalendarEvent[] = [];
    const upcoming: CalendarEvent[] = [];
    const past: CalendarEvent[] = [];
    for (const e of events) {
      const d = new Date(e.date);
      if (isToday(d)) {
        today.push(e);
      } else if (d.getTime() > now) {
        upcoming.push(e);
      } else {
        past.push(e);
      }
    }
    today.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // newest past first
    return { todayList: today, upcomingList: upcoming, pastList: past };
  }, [events]);

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

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <EmptyStateIllustration variant="calendar" className="mb-3" />
        <h3 className="text-base font-medium text-[var(--color-text-primary)] mb-1">
          {t("emptyTitle")}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
          {t("emptyDescription")}
        </p>
      </div>
    );
  }

  const renderRow = (e: CalendarEvent, isPast = false) => {
    const TypeIcon =
      e.eventType === "assessment"
        ? ClipboardCheck
        : e.eventType === "assignment"
          ? Upload
          : TYPE_ICON[e.sessionType] || Video;
    const courseTitle = isRTL && e.courseTitleAr ? e.courseTitleAr : e.courseTitle;
    const joinable = e.sessionType === "zoom" && e.zoomLink && isJoinable(e.date);

    // Attendance badge for past sessions
    let attendanceBadge: React.ReactNode = null;
    if (isPast && e.eventType === "session") {
      if (e.attendanceStatus === "present" || e.attendanceStatus === "late") {
        attendanceBadge = (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[#DCFCE7] text-[#16A34A] rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            {e.attendanceStatus === "late" ? t("attendanceLate") : t("attendancePresent")}
          </span>
        );
      } else if (e.attendanceStatus === "absent") {
        attendanceBadge = (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[#FEE2E2] text-[#DC2626] rounded-full">
            <XCircle className="w-3 h-3" />
            {t("attendanceAbsent")}
          </span>
        );
      } else if (e.attendanceStatus === "excused") {
        attendanceBadge = (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[#DBEAFE] text-[#1D4ED8] rounded-full">
            {t("attendanceExcused")}
          </span>
        );
      } else {
        attendanceBadge = (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-full">
            <Clock className="w-3 h-3" />
            {t("attendanceUnmarked")}
          </span>
        );
      }
    }

    // Status badge (for cancelled etc.)
    const statusBadge =
      e.status === "cancelled" ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[#FEE2E2] text-[#DC2626] rounded-full">
          {t("statusCancelled")}
        </span>
      ) : e.status === "live" ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 rounded-full">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          {t("statusLive")}
        </span>
      ) : null;

    return (
      <li
        key={e.id}
        className={`flex items-start sm:items-center gap-3 p-3 sm:p-4 rounded-lg border border-[var(--color-border)] ${
          e.status === "cancelled" ? "opacity-60" : ""
        } ${isRTL ? "flex-row-reverse" : ""}`}
      >
        {/* Type icon */}
        <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
          <TypeIcon className="w-5 h-5 text-[#D4A520]" />
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {e.title}
            </p>
            {statusBadge}
            {attendanceBadge}
          </div>
          <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-secondary)] ${isRTL ? "flex-row-reverse" : ""}`}>
            <span>
              {formatDate(e.date, calendarFormat, { locale, platformSettings: platformLocale })} · {formatPlatformTime(e.date, platformLocale, locale === "ar" ? "ar" : "en")}
            </span>
            {courseTitle && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate max-w-[180px]">{courseTitle}</span>
              </>
            )}
            {e.instructorName && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate max-w-[140px]">{e.instructorName}</span>
              </>
            )}
            {e.durationMinutes > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{e.durationMinutes} {t("mins")}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {joinable ? (
            <button
              type="button"
              onClick={() => handleJoin(e)}
              disabled={joiningId === e.id}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#2D8CFF] text-white rounded-lg hover:bg-[#1A73E8] transition-colors disabled:opacity-60 cursor-pointer"
            >
              {joiningId === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
              {t("join")}
            </button>
          ) : e.sessionType === "zoom" && e.zoomLink ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] opacity-70">
              <Clock className="w-3 h-3" />
              {t("opensIn", { time: formatTimeUntil(e.date) })}
            </span>
          ) : null}
          {e.sessionType === "onsite" && e.venueAddress && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.venueAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              <MapPin className="w-3 h-3" />
              {t("directions")}
            </a>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Today */}
      {todayList.length > 0 && (
        <Section
          title={t("today")}
          count={todayList.length}
          accent
        >
          <ul className="space-y-2">{todayList.map((e) => renderRow(e))}</ul>
        </Section>
      )}

      {/* Upcoming */}
      {upcomingList.length > 0 && (
        <Section title={t("upcoming")} count={upcomingList.length}>
          <ul className="space-y-2">{upcomingList.map((e) => renderRow(e))}</ul>
        </Section>
      )}

      {/* Past — collapsible */}
      {pastList.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setPastExpanded((v) => !v)}
            className={`flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-3 transition-colors w-full ${isRTL ? "flex-row-reverse" : ""}`}
            aria-expanded={pastExpanded}
          >
            {pastExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{t("past")}</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-full">
              {pastList.length}
            </span>
          </button>
          {pastExpanded && <ul className="space-y-2">{pastList.map((e) => renderRow(e, true))}</ul>}
        </div>
      )}

      {/* Edge case: only past events exist */}
      {todayList.length === 0 && upcomingList.length === 0 && pastList.length > 0 && !pastExpanded && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarIcon className="w-10 h-10 text-[var(--color-border)] mb-2" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("noUpcomingHint")}
          </p>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3
          className={`text-sm font-semibold ${
            accent ? "text-[var(--color-primary)]" : "text-[var(--color-text-primary)]"
          }`}
        >
          {title}
        </h3>
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
            accent
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
          }`}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}
