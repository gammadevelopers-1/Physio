/**
 * Saudi Arabian mobile-number validator + normalizer.
 *
 * Mirrors `backends/src/common/validators/saudi-phone.validator.ts`.
 *
 * KSA mobile rules:
 *   - All Saudi mobile numbers start with the prefix `5` after the country
 *     code (i.e. `+9665XXXXXXXX`), followed by exactly 8 more digits
 *   - Local notation prepends a zero: `05XXXXXXXX` (10 digits)
 *
 * Inputs we accept and normalize to canonical E.164 (`+9665XXXXXXXX`):
 *   - `5XXXXXXXX`           (9 digits, local-without-zero)
 *   - `05XXXXXXXX`          (10 digits, local)
 *   - `9665XXXXXXXX`        (12 digits)
 *   - `+9665XXXXXXXX`       (13 chars including '+', canonical)
 *   - `009665XXXXXXXX`      (14 digits, international-dial form)
 *   - Any of the above with embedded spaces, dashes, parens — all stripped
 *
 * Any other shape returns null (invalid).
 *
 * Storage policy: always persist the canonical E.164 form. The UI shows a
 * locked `+966` adornment and a 9-digit input field.
 */

const E164_REGEX = /^\+9665\d{8}$/;

/** Strip everything that isn't a digit or a leading '+'. Internal helper. */
function stripFormatting(raw: string): string {
  // Keep a leading + (if present) but drop all other non-digits.
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D+/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normalize any accepted Saudi mobile representation to canonical E.164.
 * Returns `+9665XXXXXXXX` on success, or null if the input doesn't match
 * the KSA mobile format.
 */
export function normalizeSaudiMobile(
  input: string | null | undefined,
): string | null {
  if (typeof input !== 'string') return null;
  if (input.trim() === '') return null;
  const cleaned = stripFormatting(input);

  // Already canonical
  if (E164_REGEX.test(cleaned)) return cleaned;

  // Strip '+' prefix to work with digit-only forms below.
  const digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

  // 9 digits, must start with 5  → 5XXXXXXXX
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;

  // 10 digits, local with leading zero → 05XXXXXXXX
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;

  // 12 digits, country code without plus → 9665XXXXXXXX
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`;

  // 14 digits, 00-prefixed international dial → 009665XXXXXXXX
  if (/^009665\d{8}$/.test(digits)) return `+${digits.slice(2)}`;

  return null;
}

/** True if the value can be normalized to a valid KSA mobile. */
export function isValidSaudiMobile(input: string | null | undefined): boolean {
  return normalizeSaudiMobile(input) !== null;
}

/**
 * Extract the 9-digit local part (no leading zero, no country code) from a
 * stored value. Useful when prefilling the locked-prefix input from an
 * already-saved record. Returns empty string when the stored value isn't a
 * valid KSA mobile — caller should treat that as "ask user to re-enter".
 */
export function localPartFromStored(stored: string | null | undefined): string {
  const normalized = normalizeSaudiMobile(stored);
  if (!normalized) return '';
  // canonical is `+9665XXXXXXXX` (13 chars) → local part is the last 9.
  return normalized.slice(-9);
}

/** Display-friendly formatting of canonical E.164: `+966 5X XXX XXXX`. */
export function formatSaudiMobileForDisplay(
  stored: string | null | undefined,
): string {
  const normalized = normalizeSaudiMobile(stored);
  if (!normalized) return '';
  const local = normalized.slice(-9); // 5XXXXXXXX
  return `+966 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}
