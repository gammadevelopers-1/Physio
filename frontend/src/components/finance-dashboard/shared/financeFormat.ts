/**
 * Shared number/date formatters for the Finance section.
 *
 * Rule everywhere in Finance: digits ALWAYS render as Latin (0-9), even
 * in Arabic mode. Finance staff cross-reference these figures against
 * bank statements + gateway exports that all use Latin digits, and
 * Arabic-Indic numerals (٠١٢٣…) make reconciliation error-prone. Month
 * names + weekday names DO localize (Arabic month names in AR mode) —
 * we just pin the numbering system to Latin via the `-u-nu-latn` locale
 * extension (or explicit `numberingSystem: 'latn'`).
 *
 * Use these instead of raw `toLocaleString` calls in Finance components
 * so the rule stays enforced in one place.
 */

/** Pick a locale tag that renders Arabic strings with Latin digits. */
function arabicLatinDigitsTag(): string {
  return "ar-SA-u-nu-latn";
}

/**
 * Integer formatter — thousands separators localized to the app locale
 * (comma in en, Arabic thousands separator in ar) but digits stay Latin.
 */
export function formatInt(value: number | string, locale: string): string {
  const num = typeof value === "string" ? Number(value) : value;
  const safe = Number.isFinite(num) ? num : 0;
  const tag = locale === "ar" ? arabicLatinDigitsTag() : "en-US";
  return safe.toLocaleString(tag);
}

/**
 * Money formatter — always Latin digits, always 2 decimals. Prefer the
 * `<Money>` component for anything the user sees so the SAR icon is
 * rendered alongside; use this string helper only for CSV rows, hidden
 * inputs, or contexts where the icon can't render.
 */
export function formatSar(value: number | string, decimals = 2): string {
  const num = typeof value === "string" ? Number(value) : value;
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Percentage formatter — Latin digits, one decimal by default. */
export function formatPercent(value: number, decimals = 1, locale = "en"): string {
  const safe = Number.isFinite(value) ? value : 0;
  const tag = locale === "ar" ? arabicLatinDigitsTag() : "en-US";
  return `${safe.toLocaleString(tag, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/**
 * Long date + time — "16 Jul 2026, 16:35" in en, "١٦ يول ٢٠٢٦…" in ar…
 * NO. In ar we render "16 يول 2026, 16:35" — Arabic month, Latin digits.
 */
export function formatDateTime(
  iso: string | Date | null | undefined,
  locale: string,
): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const tag = locale === "ar" ? arabicLatinDigitsTag() : "en-GB";
  return d.toLocaleString(tag, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Date-only — no time component. */
export function formatDate(
  iso: string | Date | null | undefined,
  locale: string,
): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const tag = locale === "ar" ? arabicLatinDigitsTag() : "en-GB";
  return d.toLocaleDateString(tag, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** Short numeric date "16/07/2026" — same day/month/year in both locales. */
export function formatDateShort(
  iso: string | Date | null | undefined,
  locale: string,
): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const tag = locale === "ar" ? arabicLatinDigitsTag() : "en-GB";
  return d.toLocaleDateString(tag, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
