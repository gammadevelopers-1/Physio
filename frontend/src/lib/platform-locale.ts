/**
 * Shared platform-locale formatters — the frontend mirror of
 * backends/src/common/platform-locale.ts. Used by every component
 * that renders a date or a number so admin-configured Date Format
 * and Number System take effect everywhere consistently.
 *
 * Pure functions; safe to import from server or client components.
 */

export type DateFormatKey = "DD-MM-YYYY" | "MM-DD-YYYY" | "YYYY-MM-DD";
export type NumberSystem = "western" | "arabic_indic";

export interface PlatformLocaleSettings {
  allowedLanguages: ("en" | "ar")[];
  defaultLanguage: "en" | "ar" | "auto";
  dateFormat: DateFormatKey;
  numberSystem: NumberSystem;
}

/** Safe fallback when the public endpoint hasn't loaded yet. */
export const DEFAULT_PLATFORM_LOCALE: PlatformLocaleSettings = {
  allowedLanguages: ["en", "ar"],
  defaultLanguage: "en",
  dateFormat: "DD-MM-YYYY",
  numberSystem: "western",
};

const ARABIC_INDIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toArabicIndic(input: string): string {
  return input.replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

/**
 * Format a date according to the platform's chosen format. Accepts
 * Date | string | null. Returns "—" for null/invalid so callers can
 * drop it directly into JSX without defensive checks.
 */
export function formatPlatformDate(
  input: Date | string | null | undefined,
  settings: Pick<PlatformLocaleSettings, "dateFormat" | "numberSystem">,
  options?: { fallback?: string },
): string {
  if (!input) return options?.fallback ?? "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (isNaN(date.getTime())) return options?.fallback ?? "—";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());

  let out: string;
  switch (settings.dateFormat) {
    case "MM-DD-YYYY":
      out = `${mm}-${dd}-${yyyy}`;
      break;
    case "YYYY-MM-DD":
      out = `${yyyy}-${mm}-${dd}`;
      break;
    case "DD-MM-YYYY":
    default:
      out = `${dd}-${mm}-${yyyy}`;
  }
  return settings.numberSystem === "arabic_indic" ? toArabicIndic(out) : out;
}

/**
 * Format a date in a more "readable" style — e.g. "Apr 10, 2026" or
 * "10 Apr 2026" — while still respecting the configured number system.
 * Use this where space allows (cards, profile headers); use
 * formatPlatformDate for compact rows.
 */
export function formatPlatformDateReadable(
  input: Date | string | null | undefined,
  settings: Pick<PlatformLocaleSettings, "numberSystem">,
  locale: "en" | "ar" = "en",
  options?: { fallback?: string; includeTime?: boolean },
): string {
  if (!input) return options?.fallback ?? "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (isNaN(date.getTime())) return options?.fallback ?? "—";

  // ar-EG defaults to Arabic-Indic digits; force Latin unless the admin
  // explicitly picked arabic_indic in Platform Settings.
  const numberingSystem = settings.numberSystem === "arabic_indic" ? "arab" : "latn";
  const datePart = date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    numberingSystem,
  } as Intl.DateTimeFormatOptions);
  const timePart = options?.includeTime
    ? " " +
      date.toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        numberingSystem,
      } as Intl.DateTimeFormatOptions)
    : "";
  return datePart + timePart;
}

/**
 * Format a time component honoring number system.
 * Defaults to 12-hour AM/PM ("1:00 PM") which matches the project's
 * historical display. Set `hour12: false` for 24-hour ("13:00").
 */
export function formatPlatformTime(
  input: Date | string | null | undefined,
  settings: Pick<PlatformLocaleSettings, "numberSystem">,
  locale: "en" | "ar" = "en",
  options?: { hour12?: boolean },
): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (isNaN(date.getTime())) return "—";
  const hour12 = options?.hour12 !== false;
  const numberingSystem = settings.numberSystem === "arabic_indic" ? "arab" : "latn";
  return date.toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", {
    hour: hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12,
    numberingSystem,
  } as Intl.DateTimeFormatOptions);
}

/**
 * Format a number — currently just digit-system conversion. Pass
 * Intl.NumberFormatOptions for grouping/decimals/currency.
 */
export function formatPlatformNumber(
  input: number | null | undefined,
  settings: Pick<PlatformLocaleSettings, "numberSystem">,
  options?: Intl.NumberFormatOptions,
): string {
  if (input === null || input === undefined || isNaN(input)) return "—";
  const out = input.toLocaleString("en-US", options);
  return settings.numberSystem === "arabic_indic" ? toArabicIndic(out) : out;
}
