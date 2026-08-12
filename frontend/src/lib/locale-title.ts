/**
 * Locale-aware title picker for bilingual entities.
 *
 * When `locale === "ar"` and `titleAr` is set, returns the Arabic title.
 * Otherwise returns the English title. If one is missing, falls back to
 * whichever is present so the row never renders an empty string.
 *
 * Used everywhere a `title` + optional `titleAr` pair is displayed:
 * course materials, assessments, and any future bilingual entity.
 */
export function pickLocaleTitle(
  title: string | null | undefined,
  titleAr: string | null | undefined,
  locale: string,
): string {
  const en = title?.trim() || "";
  const ar = titleAr?.trim() || "";
  if (locale === "ar") return ar || en;
  return en || ar;
}
