"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/types/student-dashboard";

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

  const today = useMemo(() => new Date(), []);

  // Month/year header
  const monthYearLabel = useMemo(() => {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(currentMonth);
  }, [currentMonth, locale]);

  // Day-of-week headers
  const dayHeaders = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // Generate Sunday through Saturday
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      // Jan 4 2026 is a Sunday
      const d = new Date(2026, 0, 4 + i);
      days.push(formatter.format(d));
    }
    return days;
  }, [locale]);

  // Build 42-cell grid
  const gridDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0=Sunday

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(year, month, 1 - startOffset + i));
    }
    return days;
  }, [currentMonth]);

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
    return map;
  }, [events]);

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div>
      {/* Header: Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevMonth}
            className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors"
            title={t("calendarPage.previousMonth")}
          >
            <PrevIcon className="w-5 h-5 text-[#4B5563]" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold text-[#1F2937] min-w-[180px] text-center">
            {monthYearLabel}
          </h2>
          <button
            onClick={onNextMonth}
            className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors"
            title={t("calendarPage.nextMonth")}
          >
            <NextIcon className="w-5 h-5 text-[#4B5563]" />
          </button>
        </div>

        <button
          onClick={onToday}
          className="px-3 py-1.5 text-xs font-medium text-[#002D87] border border-[#002D87] rounded-lg hover:bg-[#F0F7FF] transition-colors"
        >
          {t("calendarPage.today")}
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((day, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium text-[#6B7280] py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7">
        {gridDays.map((day, i) => {
          const isCurrentMonth =
            day.getMonth() === currentMonth.getMonth() &&
            day.getFullYear() === currentMonth.getFullYear();
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const dateKey = toLocalDateKey(day);
          const dayEvents = eventsByDate.get(dateKey) || [];
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={i}
              onClick={() => onSelectDate(day)}
              className={`relative flex flex-col items-center justify-center py-2 sm:py-3 transition-colors ${
                isCurrentMonth ? "" : "opacity-40"
              } ${isSelected ? "" : "hover:bg-[#F9FAFB]"}`}
            >
              <span
                className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
                  isSelected
                    ? "bg-[#002D87] text-white font-medium"
                    : isToday
                      ? "ring-2 ring-[#002D87] text-[#002D87] font-medium"
                      : isCurrentMonth
                        ? "text-[#1F2937]"
                        : "text-[#9CA3AF]"
                }`}
              >
                {day.getDate()}
              </span>

              {/* Event dots */}
              {hasEvents && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.length <= 3 ? (
                    dayEvents.map((_, idx) => (
                      <div
                        key={idx}
                        className="w-1.5 h-1.5 rounded-full bg-blue-500"
                      />
                    ))
                  ) : (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarGrid;
