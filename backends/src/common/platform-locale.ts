/**
 * Shared platform-locale formatters used by PDFs, emails, exports.
 *
 * Pure functions — no DB calls inside. Callers fetch the settings once
 * (typically via AdminSettingsService.getPublicLocaleSettings) and
 * pass them through. This avoids hammering the cache in tight loops
 * (e.g. PDF row rendering).
 */

export type DateFormatKey = 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
export type NumberSystem = 'western' | 'arabic_indic';

export interface PlatformLocaleSettings {
  allowedLanguages: ('en' | 'ar')[];
  defaultLanguage: 'en' | 'ar' | 'auto';
  dateFormat: DateFormatKey;
  numberSystem: NumberSystem;
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Convert every Western digit in a string to Arabic-Indic. */
export function toArabicIndic(input: string): string {
  return input.replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

/**
 * Format a date according to the admin's chosen format. Accepts Date
 * or ISO string. Returns empty string for null/invalid so callers
 * don't have to defensively check before passing.
 */
export function formatPlatformDate(
  input: Date | string | null | undefined,
  settings: Pick<PlatformLocaleSettings, 'dateFormat' | 'numberSystem'>,
): string {
  if (!input) return '';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(date.getTime())) return '';

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());

  let out: string;
  switch (settings.dateFormat) {
    case 'MM-DD-YYYY':
      out = `${mm}-${dd}-${yyyy}`;
      break;
    case 'YYYY-MM-DD':
      out = `${yyyy}-${mm}-${dd}`;
      break;
    case 'DD-MM-YYYY':
    default:
      out = `${dd}-${mm}-${yyyy}`;
  }
  return settings.numberSystem === 'arabic_indic' ? toArabicIndic(out) : out;
}

/**
 * Format a number — currently just digit-system conversion, since the
 * grouping (e.g. 1,234) is identical between Western and Arabic-Indic
 * for our needs. Pass options through to toLocaleString for grouping
 * or decimals.
 */
export function formatPlatformNumber(
  input: number | null | undefined,
  settings: Pick<PlatformLocaleSettings, 'numberSystem'>,
  options?: Intl.NumberFormatOptions,
): string {
  if (input === null || input === undefined || isNaN(input)) return '';
  const out = input.toLocaleString('en-US', options);
  return settings.numberSystem === 'arabic_indic' ? toArabicIndic(out) : out;
}
