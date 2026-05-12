/**
 * Lightweight URL validator/normaliser used by manager-side form fields
 * (e.g. NELC course-evaluation link). Strict enough to catch the common
 * pasting mistakes (missing scheme, garbage strings, no TLD) without
 * being so strict that legitimate URLs get rejected.
 *
 * Note: we cannot detect a user pasting two URLs together
 * (e.g. `physioguidance.com/www.google.com`) — that string is technically
 * a valid URL with `/www.google.com` as the path. The only real defense
 * is the form's preview / human review.
 */

export interface UrlValidationResult {
  /** Cleaned URL with scheme guaranteed. Empty string when input was blank. */
  normalized: string;
  /** True only if the URL parses and passes the soft checks below. */
  valid: boolean;
  /** Human-readable failure reason (i18n-friendly key + fallback text). */
  errorKey?: "missing_scheme" | "malformed" | "bad_protocol" | "no_tld";
}

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Trim, optionally auto-prepend `https://`, then run sanity checks.
 * Pass an empty/whitespace string back as valid (caller decides whether
 * the field is required — this helper does not).
 */
export function normalizeAndValidateUrl(raw: string): UrlValidationResult {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return { normalized: "", valid: true };
  }

  // Auto-prepend https:// for inputs like "www.foo.com" or "foo.com/path".
  // We do this BEFORE parsing so the URL constructor doesn't reject them.
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { normalized: candidate, valid: false, errorKey: "malformed" };
  }

  if (!HTTP_PROTOCOLS.has(url.protocol)) {
    return { normalized: candidate, valid: false, errorKey: "bad_protocol" };
  }

  // Hostname must have at least one dot (rejects "localhost", bare words).
  if (!url.hostname.includes(".")) {
    return { normalized: candidate, valid: false, errorKey: "no_tld" };
  }

  return { normalized: url.toString(), valid: true };
}
