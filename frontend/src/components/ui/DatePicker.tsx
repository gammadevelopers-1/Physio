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

type ViewMode = "days" | "months" | "years";

/** Convert a Date to YYYY-MM-DD string. */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Jump a Gregorian Date so the Hijri (year, month=1..12) matches target. */
function hijriYearMonthToGregorian(year: number, month: number, ref: Date): Date {
  const d = new Date(ref);
  const curr = getHijriParts(d);
  // Coarse day jump: ~354.37 days/year, ~29.53 days/month
  const yearDelta = year - curr.year;
  const monthDelta = month - curr.month;
  d.setDate(d.getDate() + Math.round(yearDelta * 354 + monthDelta * 29.5));
  // Correct year
  let guard = 0;
  while (getHijriParts(d).year > year && guard++ < 400) d.setDate(d.getDate() - 15);
  guard = 0;
  while (getHijriParts(d).year < year && guard++ < 400) d.setDate(d.getDate() + 15);
  // Correct month within year (walk 1 day at a time)
  guard = 0;
  while (guard++ < 60) {
    const p = getHijriParts(d);
    if (p.year === year && p.month === month) break;
    if (p.year > year || (p.year === year && p.month > month)) d.setDate(d.getDate() - 1);
    else d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Custom date picker that supports both Hijri and Gregorian calendars.
 *
 * - Reads the user's calendar preference from CalendarContext
 * - Internally stores/returns Gregorian ISO dates
 * - Displays dates according to the user's calendar preference
 * - Header is clickable: day view → month grid → year grid for fast jumps
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
  const [viewMode, setViewMode] = useState<ViewMode>("days");
  const [viewDate, setViewDate] = useState(() =>
    value ? new Date(value) : new Date()
  );
  // Anchor for the year grid page (12 years per page)
  const [yearPageStart, setYearPageStart] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Popover viewport coords — position:fixed so the popover escapes any
  // parent overflow (dialogs, drawers, tables) and can flip when there's
  // not enough room on the natural side.
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setViewMode("days");
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Compute popover coords whenever open changes, plus on scroll/resize.
  useEffect(() => {
    if (!open) {
      setPopoverPos(null);
      return;
    }
    const POPOVER_W = 300;
    const POPOVER_H_APPROX = 420;
    const MARGIN = 8;
    const compute = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Vertical: below trigger by default; flip up if it would overflow.
      let top = rect.bottom + 4;
      if (top + POPOVER_H_APPROX > window.innerHeight - MARGIN) {
        top = Math.max(MARGIN, rect.top - POPOVER_H_APPROX - 4);
      }
      // Horizontal: default aligns popover's inline-start to the trigger's
      // inline-start; if that overflows the far edge, anchor to inline-end.
      let left: number;
      if (isRTL) {
        // Align popover's RIGHT edge to trigger's RIGHT edge (popover extends left).
        left = rect.right - POPOVER_W;
        // Flip if that goes off the LEFT edge of the viewport.
        if (left < MARGIN) left = Math.min(rect.left, window.innerWidth - POPOVER_W - MARGIN);
      } else {
        // Align popover's LEFT edge to trigger's LEFT edge (popover extends right).
        left = rect.left;
        // Flip if that goes off the RIGHT edge of the viewport.
        if (left + POPOVER_W > window.innerWidth - MARGIN) {
          left = Math.max(MARGIN, rect.right - POPOVER_W);
        }
      }
      setPopoverPos({ top, left });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, isRTL]);

  // Sync viewDate when value changes
  useEffect(() => {
    if (value) setViewDate(new Date(value));
  }, [value]);

  // ── Current view year/month (in the active calendar) ──
  const viewYear = useHijri ? getHijriParts(viewDate).year : viewDate.getFullYear();
  const viewMonth = useHijri ? getHijriParts(viewDate).month : viewDate.getMonth() + 1; // 1..12

  const monthNames = useHijri
    ? (isRTL ? hijriMonthNames : hijriMonthNamesEn)
    : (isRTL ? gregorianMonthNamesAr : gregorianMonthNames);

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
        monthName,
        year,
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
      monthName,
      year: y,
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

  const openYearsView = () => {
    setYearPageStart(viewYear - 6); // centre current year in the 12-cell grid
    setViewMode("years");
  };
  const openMonthsView = () => setViewMode("months");

  const selectYear = (year: number) => {
    if (useHijri) {
      const next = hijriYearMonthToGregorian(year, viewMonth, viewDate);
      setViewDate(next);
    } else {
      setViewDate(new Date(year, viewDate.getMonth(), 1));
    }
    setViewMode("months");
  };
  const selectMonth = (monthOneBased: number) => {
    if (useHijri) {
      const next = hijriYearMonthToGregorian(viewYear, monthOneBased, viewDate);
      setViewDate(next);
    } else {
      setViewDate(new Date(viewDate.getFullYear(), monthOneBased - 1, 1));
    }
    setViewMode("days");
  };

  // ── Selection helpers ──
  const selectedISO = value || "";
  // Parse YYYY-MM-DD as LOCAL midnight to match gDate (which is built via
  // `new Date(y, m, d)` — also local midnight). `new Date("2026-05-10")`
  // would parse as UTC midnight, which in UTC+3 zones makes the same
  // calendar day appear "before" min and disables it.
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

  // Year grid page bounds
  const pageStart = yearPageStart ?? viewYear - 6;
  const yearsInPage = Array.from({ length: 12 }, (_, i) => pageStart + i);
  const shiftYearPage = (delta: number) => setYearPageStart(pageStart + delta);

  return (
    <div ref={containerRef} className="relative">
      {/* Input trigger */}
      <div
        onClick={() => {
          if (disabled) return;
          setOpen(!open);
          setViewMode("days");
        }}
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

      {/* Popover — position:fixed so it escapes any dialog/drawer overflow
          and can flip horizontally/vertically when there isn't room. Coords
          computed in the effect above based on the trigger's viewport rect. */}
      {open && popoverPos && (
        <div
          style={{ position: "fixed", top: popoverPos.top, left: popoverPos.left }}
          className="z-[100] bg-white border border-[var(--color-input-border)] rounded-xl shadow-lg w-[300px] max-w-[calc(100vw-1rem)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
            {viewMode === "days" ? (
              <>
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                  aria-label={isRTL ? "الشهر السابق" : "Previous month"}
                >
                  {isRTL ? <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" /> : <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={openMonthsView}
                    className="text-sm font-semibold text-[var(--color-text-primary)] px-2 py-0.5 rounded hover:bg-[#F3F4F6] transition-colors"
                  >
                    {calData.monthName}
                  </button>
                  <button
                    type="button"
                    onClick={openYearsView}
                    className="text-sm font-semibold text-[var(--color-text-primary)] px-2 py-0.5 rounded hover:bg-[#F3F4F6] transition-colors"
                  >
                    {calData.year}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                  aria-label={isRTL ? "الشهر التالي" : "Next month"}
                >
                  {isRTL ? <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                </button>
              </>
            ) : viewMode === "months" ? (
              <>
                <button
                  type="button"
                  onClick={() => selectYear(viewYear - 1)}
                  className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                  aria-label={isRTL ? "السنة السابقة" : "Previous year"}
                >
                  {isRTL ? <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" /> : <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                </button>
                <button
                  type="button"
                  onClick={openYearsView}
                  className="text-sm font-semibold text-[var(--color-text-primary)] px-2 py-0.5 rounded hover:bg-[#F3F4F6] transition-colors"
                >
                  {viewYear}
                </button>
                <button
                  type="button"
                  onClick={() => selectYear(viewYear + 1)}
                  className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                  aria-label={isRTL ? "السنة التالية" : "Next year"}
                >
                  {isRTL ? <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => shiftYearPage(-12)}
                  className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                  aria-label={isRTL ? "السنوات السابقة" : "Previous years"}
                >
                  {isRTL ? <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" /> : <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                </button>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {pageStart}–{pageStart + 11}
                </span>
                <button
                  type="button"
                  onClick={() => shiftYearPage(12)}
                  className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
                  aria-label={isRTL ? "السنوات التالية" : "Next years"}
                >
                  {isRTL ? <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                </button>
              </>
            )}
          </div>

          {/* Per-picker calendar toggle — local to this instance. */}
          <div className="flex justify-center px-3 py-2 border-b border-[var(--color-border)]">
            <div className="inline-flex bg-[var(--color-border-subtle)] rounded-md p-0.5">
              {(["gregorian", "hijri"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setTouched(true);
                    setLocalFormat(opt);
                    setViewMode("days");
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

          {/* View: Days */}
          {viewMode === "days" && (
            <>
              <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
                {dayLabels.map((d) => (
                  <div key={d} className="py-1.5 text-center text-[10px] font-medium text-[var(--color-text-secondary)]">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 p-1">
                {Array.from({ length: calData.firstDayOfWeek }).map((_, i) => (
                  <div key={`e-${i}`} className="w-full aspect-square" />
                ))}
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
                        setViewMode("days");
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
            </>
          )}

          {/* View: Months (3×4 grid) */}
          {viewMode === "months" && (
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {monthNames.map((name, i) => {
                const monthOneBased = i + 1;
                const isCurrent = monthOneBased === viewMonth;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => selectMonth(monthOneBased)}
                    className={`py-3 text-xs rounded-lg transition-colors truncate ${
                      isCurrent
                        ? "bg-[#3B82F6] text-white font-semibold"
                        : "text-[var(--color-text-primary)] hover:bg-[#F3F4F6]"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}

          {/* View: Years (3×4 grid, ±6 around current view) */}
          {viewMode === "years" && (
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {yearsInPage.map((yr) => {
                const isCurrent = yr === viewYear;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => selectYear(yr)}
                    className={`py-3 text-xs rounded-lg transition-colors ${
                      isCurrent
                        ? "bg-[#3B82F6] text-white font-semibold"
                        : "text-[var(--color-text-primary)] hover:bg-[#F3F4F6]"
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer — calendar type indicator */}
          <div className="flex items-center justify-center px-3 py-1.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)]">
            {useHijri ? "هجري (Hijri)" : "ميلادي (Gregorian)"}
          </div>
        </div>
      )}
    </div>
  );
}
