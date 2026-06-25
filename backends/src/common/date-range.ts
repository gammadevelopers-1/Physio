/**
 * Date-range filter helpers.
 *
 * Frontends typically send date filters as YYYY-MM-DD strings (date pickers
 * have no time component). Naively passing that to `new Date()` yields
 * midnight UTC for the START of that day. For an `endDate`, that means
 * `lte(col, new Date(endDate))` excludes everything later that same day —
 * so a "last 30 days, up to today" filter silently drops every row created
 * today after 00:00 UTC. Confirmed cause of the missing-Jun-25-invoices
 * report on 2026-06-25 (invoice was issued 06:41 UTC, fell after midnight,
 * was filtered out).
 *
 * These helpers normalise the boundaries:
 *   parseStartDate('2026-06-25') → 2026-06-25T00:00:00.000Z (start of day)
 *   parseEndDate('2026-06-25')   → 2026-06-25T23:59:59.999Z (end of day)
 *
 * Values that already include a time component (ISO with T) are passed
 * through to `new Date()` unchanged — callers that need precision can opt
 * in by sending a full ISO timestamp.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseStartDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  if (DATE_ONLY.test(value)) return new Date(`${value}T00:00:00.000Z`);
  return new Date(value);
}

export function parseEndDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  if (DATE_ONLY.test(value)) return new Date(`${value}T23:59:59.999Z`);
  return new Date(value);
}
