"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/types/student-dashboard";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import {
  getCalendarHeaderLabel,
  getHijriParts,
  getHijriMonthDays,
  hijriMonthNames,
  hijriMonthNamesEn,
  dayNamesAr,
  dayNamesEn,
} from "@/lib/hijri";

interface CalendarGridProps {
  currentMonth: Date;
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Returns Tailwind class pair (bg + text) for a given event, used in the
 *  day-cell event bars. Mirrors the legend below the grid. */
function getEventBarClasses(event: CalendarEvent): { bg: string; text: string } {
  if (event.status === "cancelled") return { bg: "bg-[#F3F4F6]", text: "text-[#9CA3AF] line-through" };
  if (event.eventType === "assessment") return { bg: "bg-red-100", text: "text-red-700" };
  if (event.eventType === "assignment") return { bg: "bg-orange-100", text: "text-orange-700" };
  switch (event.sessionType) {
    case "zoom":
      return { bg: "bg-blue-100", text: "text-blue-700" };
    case "onsite":
      return { bg: "bg-green-100", text: "text-green-700" };
    case "hybrid":
    case "blended":
      return { bg: "bg-purple-100", text: "text-purple-700" };
    default:
      return { bg: "bg-blue-100", text: "text-blue-700" };
  }
}

const MAX_BARS_PER_CELL = 2;

const CalendarGrid = ({
  currentMonth,
  events,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarGridProps) => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();
  const useHijri = calendarFormat === "hijri";

  const today = useMemo(() => new Date(), []);

  // Month/year header — Hijri-aware
  const monthYearLabel = useMemo(() => {
    if (useHijri) {
      return getCalendarHeaderLabel(currentMonth, "hijri", locale);
    }
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(currentMonth);
  }, [currentMonth, locale, useHijri]);

  // Day-of-week headers (locale-aware Sunday → Saturday)
  const dayHeaders = useMemo(() => {
    if (useHijri) return isRTL ? dayNamesAr : dayNamesEn;
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 0, 4 + i); // Jan 4 2026 = Sunday
      days.push(formatter.format(d));
    }
    return days;
  }, [locale, useHijri, isRTL]);

  // Build 42-cell grid — Hijri or Gregorian
  const gridDays = useMemo(() => {
    if (useHijri) {
      // Hijri: take days for the Hijri month containing currentMonth, pad to start on Sunday
      const hijriDays = getHijriMonthDays(currentMonth);
      const firstDay = hijriDays[0];
      const startOffset = firstDay.getDay();
      const days: Date[] = [];
      for (let i = 0; i < startOffset; i++) {
        const d = new Date(firstDay);
        d.setDate(d.getDate() - (startOffset - i));
        days.push(d);
      }
      days.push(...hijriDays);
      while (days.length < 42) {
        const last = days[days.length - 1];
        const next = new Date(last);
        next.setDate(next.getDate() + 1);
        days.push(next);
      }
      return days.slice(0, 42);
    }
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(year, month, 1 - startOffset + i));
    }
    return days;
  }, [currentMonth, useHijri]);

  // Group events by local date key
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const eventLocal = new Date(event.date);
      const key = toLocalDateKey(eventLocal);
      const arr = map.get(key) || [];
      arr.push(event);
      map.set(key, arr);
    }
    // Sort each day's events by time (ascending)
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return map;
  }, [events]);

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  // Derive whether grid days belong to the displayed (Hijri or Gregorian) month
  const isDayInDisplayedMonth = (day: Date): boolean => {
    if (useHijri) {
      const target = getHijriParts(currentMonth);
      const cur = getHijriParts(day);
      return target.month === cur.month && target.year === cur.year;
    }
    return (
      day.getMonth() === currentMonth.getMonth() &&
      day.getFullYear() === currentMonth.getFullYear()
    );
  };

  const dayLabel = (day: Date): string => {
    if (useHijri) {
      const { day: hijriDay } = getHijriParts(day);
      return String(hijriDay);
    }
    return String(day.getDate());
  };

  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      {/* Header: Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevMonth}
            className="p-1.5 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            aria-label={t("calendarPage.previousMonth")}
          >
            <PrevIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] min-w-[200px] text-center">
            {monthYearLabel}
          </h2>
          <button
            onClick={onNextMonth}
            className="p-1.5 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            aria-label={t("calendarPage.nextMonth")}
          >
            <NextIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <button
          onClick={onToday}
          className="px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
        >
          {t("calendarPage.today")}
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((day, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium text-[var(--color-text-secondary)] py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date grid — bars instead of dots */}
      <div className="grid grid-cols-7 gap-1">
        {gridDays.map((day, i) => {
          const inMonth = isDayInDisplayedMonth(day);
          const isTodayCell = isSameDay(day, today);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const dateKey = toLocalDateKey(day);
          const dayEvents = eventsByDate.get(dateKey) || [];
          const visibleEvents = dayEvents.slice(0, MAX_BARS_PER_CELL);
          const overflow = dayEvents.length - visibleEvents.length;

          return (
            <button
              key={i}
              onClick={() => onSelectDate(day)}
              className={`relative flex flex-col items-stretch text-start p-1.5 min-h-[80px] sm:min-h-[96px] rounded-lg border transition-colors ${
                isSelected
                  ? "border-[var(--color-primary)] bg-[var(--color-border-subtle)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
              } ${inMonth ? "" : "opacity-40"}`}
              aria-label={`${dayLabel(day)}${dayEvents.length > 0 ? `, ${dayEvents.length} event(s)` : ""}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 text-xs rounded-full ${
                    isTodayCell
                      ? "bg-[var(--color-primary)] text-white font-semibold px-1.5"
                      : inMonth
                        ? "text-[var(--color-text-primary)] font-medium"
                        : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {dayLabel(day)}
                </span>
              </div>

              {/* Event bars */}
              {visibleEvents.length > 0 && (
                <div className="flex flex-col gap-0.5 flex-1">
                  {visibleEvents.map((evt) => {
                    const { bg, text } = getEventBarClasses(evt);
                    const time = timeFmt.format(new Date(evt.date));
                    return (
                      <div
                        key={evt.id}
                        title={`${time} · ${evt.title}`}
                        className={`text-[10px] leading-tight ${bg} ${text} rounded px-1 py-0.5 truncate`}
                      >
                        <span className="font-medium">{time}</span> {evt.title}
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <div className="text-[10px] text-[var(--color-text-secondary)] px-1">
                      +{overflow} {t("calendarPage.more")}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Color Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">{t("calendarPage.legendZoom")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">{t("calendarPage.legendOnsite")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">{t("calendarPage.legendHybrid")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">{t("calendarPage.legendAssessment")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-100 border border-orange-200" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">{t("calendarPage.legendAssignment")}</span>
        </div>
      </div>
    </div>
  );
};

export default CalendarGrid;
