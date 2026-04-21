/**
 * Resolve a Strapi-managed link string to a valid href.
 *
 * Rules:
 *   - null / empty         → null (caller decides whether to hide or render #)
 *   - http(s)://...        → external, passes through unchanged
 *   - /foo/bar             → internal, prefixed with the current locale
 *   - /en/foo or /ar/foo   → locale already present, normalized to the current one
 *   - foo/bar              → treated as internal relative; prefixed with locale
 *
 * This keeps Amna's authoring simple: she can type `/courses`, `courses`, or
 * `/en/courses` and all three work. External links (`https://...`) are left alone.
 */
export function resolveHref(
  link: string | null | undefined,
  locale: string,
): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) return trimmed;
  // Strip leading slash so we can do consistent handling
  const withoutLeadingSlash = trimmed.replace(/^\/+/, "");
  // If the first segment is an existing locale prefix, strip it
  const stripped = withoutLeadingSlash.replace(/^(en|ar)(?=\/|$)/, "");
  const cleanPath = stripped.startsWith("/") ? stripped : `/${stripped}`;
  return `/${locale}${cleanPath === "/" ? "" : cleanPath}`;
}
