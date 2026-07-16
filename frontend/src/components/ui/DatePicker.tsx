"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useLocale } from "next-intl";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import {
  getHijriParts,
  getHijriMonthStart,
  getHijriMonthDays,
  hijriMonthNames,
  hijriMonthNamesEn,
  gregorianMonthNames,
  gregorianMonthNamesAr,
  dayNamesEn,
  dayNamesAr,
  formatDate,
} from "@/lib/hijri";

interface DatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD) — always Gregorian internally
  onChange: (isoDate: string) => void;
  min?: string;
  max?: string;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

/** Convert a Date to YYYY-MM-DD string. */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Custom date picker that supports both Hijri and Gregorian calendars.
 *
 * - Reads the user's calendar preference from CalendarContext
 * - Internally stores/returns Gregorian ISO dates
 * - Displays dates according to the user's calendar preference
 */
export default function DatePicker({
  value,
  onChange,
  min,
  max,
  id,
  className = "",
  placeholder,
  disabled,
}: DatePickerProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();
  const platformLocale = usePlatformLocale();
  // Picker has its own calendar override so flipping it never mutates the
  // user's global preference nor any other picker. Default mirrors the
  // global setting; legacy "both" coerces to Gregorian.
  const settingDefault: "hijri" | "gregorian" =
    calendarFormat === "hijri" ? "hijri" : "gregorian";
  const [localFormat, setLocalFormat] = useState<"hijri" | "gregorian">(settingDefault);
  // Re-sync when the global setting changes BEFORE the user has interacted
  // (i.e. the local state still matches what the default was last time).
  // Once they pick their own calendar, we stop syncing.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setLocalFormat(settingDefault);
  }, [settingDefault, touched]);
  const useHijri = localFormat === "hijri";

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() =>
    value ? new Date(value) : new Date()
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Sync viewDate when value changes
  useEffect(() => {
    if (value) setViewDate(new Date(value));
  }, [value]);

  // ── Calendar data ──
  const calData = (() => {
    if (useHijri) {
      const hijriDays = getHijriMonthDays(viewDate);
      const firstDay = hijriDays[0];
      const { month, year } = getHijriParts(firstDay);
      const monthName = isRTL ? hijriMonthNames[month - 1] : hijriMonthNamesEn[month - 1];
      return {
        daysInMonth: hijriDays.length,
        firstDayOfWeek: firstDay.getDay(),
        headerLabel: `${monthName} ${year}`,
        getGregorianDate: (dayIndex: number) => hijriDays[dayIndex - 1],
      };
    }
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDayOfWeek = new Date(y, m, 1).getDay();
    const monthName = isRTL ? gregorianMonthNamesAr[m] : gregorianMonthNames[m];
    return {
      daysInMonth,
      firstDayOfWeek,
      headerLabel: `${monthName} ${y}`,
      getGregorianDate: (dayIndex: number) => new Date(y, m, dayIndex),
    };
  })();

  const dayLabels = isRTL ? dayNamesAr : dayNamesEn;

  // ── Navigation ──
  const goToPrevMonth = () => {
    if (useHijri) {
      const start = getHijriMonthStart(viewDate);
      const prev = new Date(start);
      prev.setDate(prev.getDate() - 1);
      setViewDate(prev);
    } else {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    }
  };
  const goToNextMonth = () => {
    if (useHijri) {
      const days = getHijriMonthDays(viewDate);
      const next = new Date(days[days.length - 1]);
      next.setDate(next.getDate() + 1);
      setViewDate(next);
    } else {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    }
  };

  // ── Selection helpers ──
  const selectedISO = value || "";
  // Parse YYYY-MM-DD as LOCAL midnight to match gDate (which is built via
  // `new Date(y, m, d)` — also local midnight). `new Date("2026-05-10")`
  // would parse as UTC midnight, which in UTC+3 zones makes the same
  // calendar day appear "before" min and disables it. That was making
  // it impossible to pick the same day as start for end (single-day course).
  const parseLocalISO = (iso: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const minDate = min ? parseLocalISO(min) : null;
  const maxDate = max ? parseLocalISO(max) : null;

  const isDisabledDay = (gDate: Date) => {
    if (minDate && gDate < minDate) return true;
    if (maxDate && gDate > maxDate) return true;
    return false;
  };

  const now = new Date();
  const todayISO = toISO(now);

  const displayValue = value
    ? formatDate(value, localFormat, { locale, platformSettings: platformLocale })
    : "";

  return (
    <div ref={containerRef} className="relative">
      {/* Input trigger */}
      <div
        onClick={() => !disabled && setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm cursor-pointer bg-white hover:border-[var(--color-text-secondary)] transition-colors ${
          disabled ? "opacity-60 cursor-not-allowed bg-[var(--color-surface-page)]" : ""
        } ${open ? "ring-2 ring-[#3B82F6] border-[#3B82F6]" : ""} ${className}`}
      >
        <Calendar className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
        <span className={`flex-1 ${displayValue ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
          {displayValue || placeholder || (isRTL ? "اختر تاريخ" : "Select date")}
        </span>
        <input type="hidden" id={id} name={id} value={value} />
      </div>

      {/* Dropdown calendar — anchored so the popover always extends toward
          the viewport CENTER, never past the trailing edge:
            • LTR: `start-0` (= left:0) anchors the LEFT edge of the popover
              to the trigger's LEFT edge → extends rightward.
            • RTL: `end-0` (= left:0 physically, because in RTL the inline
              END is the LEFT edge) anchors the LEFT edge of the popover
              to the trigger's LEFT edge → extends rightward.
          Wave-2 used `start-0` in both directions, which in RTL resolved to
          `right:0` and pushed the 300px popover LEFT of the trigger. On
          the reconciliation "to date" filter the trigger sits near the
          LEFT edge of the viewport in RTL, so the popover clipped past x=0
          and caused horizontal page scroll. `max-w-[calc(100vw-1rem)]` is
          kept as a belt-and-braces cap for very narrow viewports. */}
      {open && (
        <div
          className={`absolute z-50 mt-1 bg-white border border-[var(--color-input-border)] rounded-xl shadow-lg w-[300px] max-w-[calc(100vw-1rem)] ${
            isRTL ? "end-0" : "start-0"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
            >
              {isRTL ? <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" /> : <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" />}
            </button>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{calData.headerLabel}</span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
            >
              {isRTL ? <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />}
            </button>
          </div>

          {/* Per-picker calendar toggle — local to this instance. Flipping
              does not mutate the global preference nor any other picker. */}
          <div className="flex justify-center px-3 py-2 border-b border-[var(--color-border)]">
            <div className="inline-flex bg-[var(--color-border-subtle)] rounded-md p-0.5">
              {(["gregorian", "hijri"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setTouched(true);
                    setLocalFormat(opt);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    localFormat === opt
                      ? "bg-white text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {opt === "gregorian"
                    ? isRTL ? "ميلادي" : "Gregorian"
                    : isRTL ? "هجري" : "Hijri"}
                </button>
              ))}
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
            {dayLabels.map((d) => (
              <div key={d} className="py-1.5 text-center text-[10px] font-medium text-[var(--color-text-secondary)]">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 p-1">
            {/* Empty leading cells */}
            {Array.from({ length: calData.firstDayOfWeek }).map((_, i) => (
              <div key={`e-${i}`} className="w-full aspect-square" />
            ))}

            {/* Day cells */}
            {Array.from({ length: calData.daysInMonth }).map((_, i) => {
              const day = i + 1;
              const gDate = calData.getGregorianDate(day);
              const iso = toISO(gDate);
              const isSelected = iso === selectedISO;
              const isToday = iso === todayISO;
              const isDis = isDisabledDay(gDate);

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDis}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-colors ${
                    isSelected
                      ? "bg-[#3B82F6] text-white font-semibold"
                      : isToday
                        ? "bg-[#EFF6FF] text-[#3B82F6] font-semibold"
                        : isDis
                          ? "text-[var(--color-border)] cursor-not-allowed"
                          : "text-[var(--color-text-secondary)] hover:bg-[#F3F4F6]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer — calendar type indicator */}
          <div className="flex items-center justify-center px-3 py-1.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)]">
            {useHijri ? "هجري (Hijri)" : "ميلادي (Gregorian)"}
          </div>
        </div>
      )}
    </div>
  );
}
