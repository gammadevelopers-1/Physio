"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  MapPin,
  Play,
  RefreshCw,
  Square,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import {
  getHijriParts,
  gregorianMonthNames,
  gregorianMonthNamesAr,
  hijriMonthNames,
  hijriMonthNamesEn,
} from "@/lib/hijri";

interface CalendarSession {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: "zoom" | "onsite" | "hybrid";
  status: "scheduled" | "live" | "ended" | "completed" | "cancelled";
  venue?: string;
  enrolled: number;
  dayIndex: number;
  date: string; // YYYY-MM-DD
}

interface MyLecturesWidgetProps {
  sessions: CalendarSession[];
  onStartSession?: (id: string) => void;
  onEndSession?: (id: string) => void;
  onAttendance?: (id: string) => void;
  onShareMaterials?: (id: string) => void;
  readOnly?: boolean;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Unified instructor lectures widget. Replaces three legacy widgets:
 *   - TodaysSessions (today-only list)
 *   - SessionsCalendarWidget (full week grid)
 *   - InstructorCalendarWidget (sidebar "upcoming" placeholder)
 *
 * One card, one source of truth. Header → week-nav. Day strip below →
 * click any day. Selected-day lecture list with status badges + action
 * buttons. Legend at the bottom. Defaults to today on mount.
 */
const MyLecturesWidget = ({
  sessions,
  onStartSession,
  onEndSession,
  onAttendance,
  onShareMaterials,
  readOnly = false,
}: MyLecturesWidgetProps) => {
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    return new Date().getDay();
  });

  // Build the 7 days for the displayed week.
  const weekDays = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return {
        date,
        iso: `${y}-${m}-${d}`,
        dayNumber: date.getDate(),
        isToday:
          weekOffset === 0 && date.toDateString() === today.toDateString(),
      };
    });
  }, [weekOffset]);

  const weekIsoSet = useMemo(
    () => new Set(weekDays.map((d) => d.iso)),
    [weekDays],
  );

  // Group sessions into the 7 day slots — deduping across todaySessions +
  // upcomingSessions which can overlap when "today" falls in both feeds.
  const sessionsByDay = useMemo(() => {
    const grouped: Record<number, CalendarSession[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    const seen = new Set<string>();
    for (const s of sessions) {
      if (!weekIsoSet.has(s.date)) continue;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      grouped[s.dayIndex]?.push(s);
    }
    return grouped;
  }, [sessions, weekIsoSet]);

  const goPrevWeek = () => setWeekOffset((o) => o - 1);
  const goNextWeek = () => setWeekOffset((o) => o + 1);
  const goToday = () => {
    setWeekOffset(0);
    setSelectedDayIndex(new Date().getDay());
  };

  // Header date (mid-week month, supports Hijri).
  const headerDate = useMemo(() => {
    const first = weekDays[0]?.date;
    const last = weekDays[6]?.date;
    if (!first || !last) return "";
    let firstMonth: string;
    let lastMonth: string;
    let year: number;
    if (calendarFormat === "hijri") {
      const fp = getHijriParts(first);
      const lp = getHijriParts(last);
      firstMonth =
        locale === "ar"
          ? hijriMonthNames[fp.month - 1]
          : hijriMonthNamesEn[fp.month - 1];
      lastMonth =
        locale === "ar"
          ? hijriMonthNames[lp.month - 1]
          : hijriMonthNamesEn[lp.month - 1];
      year = fp.year;
    } else {
      firstMonth =
        locale === "ar"
          ? gregorianMonthNamesAr[first.getMonth()]
          : gregorianMonthNames[first.getMonth()];
      lastMonth =
        locale === "ar"
          ? gregorianMonthNamesAr[last.getMonth()]
          : gregorianMonthNames[last.getMonth()];
      year = first.getFullYear();
    }
    return firstMonth === lastMonth
      ? `${firstMonth} ${year}`
      : `${firstMonth} – ${lastMonth} ${year}`;
  }, [weekDays, calendarFormat, locale]);

  const selectedDay = weekDays[selectedDayIndex];
  const selectedDayLectures = sessionsByDay[selectedDayIndex] || [];

  // Visible day label (e.g. "Today, Mon May 11" or "Mon May 12").
  const selectedDayLabel = useMemo(() => {
    if (!selectedDay) return "";
    const dayName = locale === "ar"
      ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][selectedDayIndex]
      : selectedDay.date.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = selectedDay.date.toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      { month: "short", day: "numeric" },
    );
    const prefix = selectedDay.isToday
      ? locale === "ar" ? "اليوم، " : "Today, "
      : "";
    return `${prefix}${dayName} ${dateStr}`;
  }, [selectedDay, selectedDayIndex, locale]);

  // Status / type styling for lecture cards.
  const cardClassesFor = (s: CalendarSession) => {
    if (s.status === "live")
      return "border-[#FECACA] bg-[#FEF2F2] ring-1 ring-[#EF4444]";
    if (s.status === "completed")
      return "border-[#BBF7D0] bg-[#F0FDF4] opacity-80";
    if (s.status === "ended") return "border-[#FDE68A] bg-[#FFFBEB]";
    if (s.status === "cancelled")
      return "border-[var(--color-border)] bg-[var(--color-border-subtle)] opacity-60";
    // scheduled — coloured by type
    if (s.type === "zoom") return "border-[#BFDBFE] bg-[#EFF6FF]";
    if (s.type === "hybrid") return "border-[#DDD6FE] bg-[#F5F3FF]";
    return "border-[#BBF7D0] bg-[#F0FDF4]";
  };

  const typeIcon = (s: CalendarSession) => {
    if (s.type === "zoom")
      return <Video className="w-4 h-4 text-[var(--color-primary)]" />;
    if (s.type === "hybrid")
      return <RefreshCw className="w-4 h-4 text-[#8B5CF6]" />;
    return <MapPin className="w-4 h-4 text-[#16A34A]" />;
  };

  const typeLabel = (s: CalendarSession) => {
    if (s.type === "zoom") return t("sessionsCalendar.zoomSession");
    if (s.type === "hybrid") return t("sessionsCalendar.hybrid");
    return t("sessionsCalendar.onsiteSession");
  };

  return (
    <div
      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
          <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
            {locale === "ar" ? "محاضراتي" : "My Lectures"}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goPrevWeek}
            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
            aria-label="Previous week"
          >
            {isRTL ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
          <span className="text-sm font-medium text-[var(--color-text-secondary)] min-w-[140px] text-center tabular-nums">
            {headerDate}
          </span>
          <button
            type="button"
            onClick={goNextWeek}
            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
            aria-label="Next week"
          >
            {isRTL ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={goToday}
              className="ml-1 px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              {t("sessionsCalendar.today")}
            </button>
          )}
        </div>
      </div>

      {/* Day strip */}
      <div className="px-3 sm:px-4 py-3 border-b border-[var(--color-border)]">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map((day, i) => {
            const lectures = sessionsByDay[i] || [];
            const isSelected = i === selectedDayIndex;
            const hasLive = lectures.some((s) => s.status === "live");
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => setSelectedDayIndex(i)}
                className={`relative flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${
                  isSelected
                    ? "bg-[var(--color-text-primary)] text-white"
                    : "hover:bg-[var(--color-border-subtle)] text-[var(--color-text-primary)]"
                }`}
              >
                <span
                  className={`text-[10px] sm:text-xs font-medium ${
                    isSelected
                      ? "text-white/80"
                      : day.isToday
                        ? "text-[var(--color-primary)]"
                        : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {t(`sessionsCalendar.days.${DAY_KEYS[i]}`)}
                </span>
                <span
                  className={`text-sm sm:text-lg font-bold tabular-nums ${
                    isSelected
                      ? "text-white"
                      : day.isToday
                        ? "text-[var(--color-primary)]"
                        : "text-[var(--color-text-primary)]"
                  }`}
                >
                  {day.dayNumber}
                </span>
                {/* Lecture dots */}
                {lectures.length > 0 && (
                  <span className="flex items-center gap-0.5 mt-0.5">
                    {lectures.slice(0, 3).map((s, idx) => (
                      <span
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected
                            ? "bg-white/70"
                            : s.status === "live"
                              ? "bg-[#EF4444]"
                              : s.status === "completed"
                                ? "bg-[#16A34A]"
                                : s.type === "zoom"
                                  ? "bg-[var(--color-primary)]"
                                  : s.type === "hybrid"
                                    ? "bg-[#8B5CF6]"
                                    : "bg-[#16A34A]"
                        }`}
                      />
                    ))}
                    {lectures.length > 3 && (
                      <span
                        className={`text-[9px] font-bold ${
                          isSelected ? "text-white" : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        +{lectures.length - 3}
                      </span>
                    )}
                  </span>
                )}
                {hasLive && !isSelected && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected-day lectures list */}
      <div className="px-4 sm:px-5 py-4">
        <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          {selectedDayLabel}
        </p>

        {selectedDayLectures.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-border-subtle)] flex items-center justify-center mb-2">
              <Calendar className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {locale === "ar"
                ? "لا توجد محاضرات في هذا اليوم"
                : "No lectures scheduled"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedDayLectures.map((s) => {
              const isLive = s.status === "live";
              const isScheduled = s.status === "scheduled";
              const isCompleted = s.status === "completed";
              const isCancelled = s.status === "cancelled";

              return (
                <div
                  key={s.id}
                  className={`rounded-lg border ${cardClassesFor(s)}`}
                >
                  <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                    {/* Left: type icon + title + meta */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-md bg-[var(--color-surface-card)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
                        {typeIcon(s)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                            {s.title}
                          </p>
                          {isLive && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-[#EF4444]">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              {locale === "ar" ? "مباشر" : "LIVE"}
                            </span>
                          )}
                          {isCompleted && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#16A34A] font-medium">
                              <CheckCircle className="w-3 h-3" />
                              {locale === "ar" ? "مكتمل" : "Completed"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-text-secondary)] flex-wrap">
                          <span className="font-medium">{s.time}</span>
                          <span aria-hidden className="opacity-50">·</span>
                          <span>{s.duration}</span>
                          <span aria-hidden className="opacity-50">·</span>
                          <span>{typeLabel(s)}</span>
                          {s.venue && (
                            <>
                              <span aria-hidden className="opacity-50">·</span>
                              <span className="truncate">{s.venue}</span>
                            </>
                          )}
                          <span aria-hidden className="opacity-50">·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <Users className="w-3 h-3" />
                            {s.enrolled}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: actions */}
                    {!readOnly && !isCancelled && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isScheduled && onStartSession && (
                          <button
                            type="button"
                            onClick={() => onStartSession(s.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
                          >
                            <Play className="w-3 h-3" />
                            {t("sessionsCalendar.start")}
                          </button>
                        )}
                        {isLive && onEndSession && (
                          <button
                            type="button"
                            onClick={() => onEndSession(s.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[#EF4444] text-white hover:bg-[#DC2626] transition-colors"
                          >
                            <Square className="w-3 h-3" />
                            {locale === "ar" ? "إنهاء" : "End"}
                          </button>
                        )}
                        {onAttendance && (
                          <button
                            type="button"
                            onClick={() => onAttendance(s.id)}
                            className="p-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                            title={t("sessionsCalendar.attendance")}
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isScheduled && onShareMaterials && (
                          <button
                            type="button"
                            onClick={() => onShareMaterials(s.id)}
                            className="p-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                            title={t("sessionsCalendar.shareMaterials")}
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-[var(--color-border)] flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {t("sessionsCalendar.zoomSession")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {t("sessionsCalendar.onsiteSession")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {t("sessionsCalendar.hybrid")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {locale === "ar" ? "مباشر" : "Live"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3 h-3 text-[#16A34A]" />
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {locale === "ar" ? "مكتمل" : "Completed"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MyLecturesWidget;
