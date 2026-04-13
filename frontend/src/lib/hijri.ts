/**
 * Hijri (Islamic — Umm al-Qura) calendar utilities.
 *
 * Uses the built-in Intl.DateTimeFormat with the "islamic-umalqura" calendar
 * system. No external libraries required.
 *
 * All functions accept/return standard Gregorian `Date` objects — the Hijri
 * representation is used only for display purposes.
 */

// ── Formatter (singleton) ──────────────────────────────────────────────────
const hijriFormatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

// ── Core helpers ───────────────────────────────────────────────────────────

/** Extract the Hijri day / month / year from a Gregorian Date. */
export function getHijriParts(date: Date) {
  const parts = hijriFormatter.formatToParts(date);
  return {
    day: parseInt(parts.find((p) => p.type === "day")?.value || "0"),
    month: parseInt(parts.find((p) => p.type === "month")?.value || "0"),
    year: parseInt(parts.find((p) => p.type === "year")?.value || "0"),
  };
}

/** Find the Gregorian date of the 1st of the Hijri month containing `date`. */
export function getHijriMonthStart(date: Date): Date {
  const d = new Date(date);
  while (getHijriParts(d).day > 1) d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Build an array of Gregorian dates — one per day — for the entire Hijri
 * month that contains `date`.
 */
export function getHijriMonthDays(date: Date): Date[] {
  const start = getHijriMonthStart(date);
  const { month } = getHijriParts(start);
  const days: Date[] = [];
  const d = new Date(start);
  while (getHijriParts(d).month === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ── Month names ────────────────────────────────────────────────────────────

export const hijriMonthNames = [
  "محرّم",
  "صفر",
  "ربيع الأول",
  "ربيع الثاني",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوّال",
  "ذو القعدة",
  "ذو الحجة",
];

export const hijriMonthNamesEn = [
  "Muharram",
  "Safar",
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  "Jumada al-Ula",
  "Jumada al-Akhirah",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhul-Qi'dah",
  "Dhul-Hijjah",
];

export const gregorianMonthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const gregorianMonthNamesAr = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// ── Day names ──────────────────────────────────────────────────────────────

export const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const dayNamesAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// ── Date formatting ────────────────────────────────────────────────────────

export type CalendarFormat = "hijri" | "gregorian";

/**
 * Format a date according to the user's calendar preference.
 *
 * - Gregorian → DD/MM/YYYY
 * - Hijri     → DD/MM/YYYY هـ
 *
 * Accepts a Date object or ISO string.
 */
export function formatDate(
  dateInput: Date | string | null | undefined,
  calendarFormat: CalendarFormat = "gregorian",
  options?: { includeTime?: boolean; locale?: string },
): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";

  if (calendarFormat === "hijri") {
    const { day, month, year } = getHijriParts(date);
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    const base = `${dd}/${mm}/${year} هـ`;
    if (options?.includeTime) {
      const time = date.toLocaleTimeString(options?.locale === "ar" ? "ar-SA" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${base} ${time}`;
    }
    return base;
  }

  // Gregorian
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const base = `${dd}/${mm}/${yyyy}`;
  if (options?.includeTime) {
    const time = date.toLocaleTimeString(options?.locale === "ar" ? "ar-SA" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${base} ${time}`;
  }
  return base;
}

/**
 * Format a date in a more readable style (e.g. "Apr 10, 2026" or "١٠ ربيع الأول ١٤٤٧ هـ").
 */
export function formatDateReadable(
  dateInput: Date | string | null | undefined,
  calendarFormat: CalendarFormat = "gregorian",
  locale: string = "en",
): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";

  if (calendarFormat === "hijri") {
    const { day, month, year } = getHijriParts(date);
    const monthName = locale === "ar" ? hijriMonthNames[month - 1] : hijriMonthNamesEn[month - 1];
    return locale === "ar"
      ? `${day} ${monthName} ${year} هـ`
      : `${monthName} ${day}, ${year} AH`;
  }

  return date.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get the calendar header label for a month view.
 */
export function getCalendarHeaderLabel(
  date: Date,
  calendarFormat: CalendarFormat,
  locale: string = "en",
): string {
  if (calendarFormat === "hijri") {
    const hijriDays = getHijriMonthDays(date);
    const { month, year } = getHijriParts(hijriDays[0]);
    const monthName = locale === "ar" ? hijriMonthNames[month - 1] : hijriMonthNamesEn[month - 1];
    return `${monthName} ${year}`;
  }
  const monthName = locale === "ar"
    ? gregorianMonthNamesAr[date.getMonth()]
    : gregorianMonthNames[date.getMonth()];
  return `${monthName} ${date.getFullYear()}`;
}
