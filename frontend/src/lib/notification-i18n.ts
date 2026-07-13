import { useTranslations } from "next-intl";

/**
 * Notification bodies now travel as (key, params) pairs on the wire so the
 * client renders in the viewer's current UI locale. These helpers wrap the
 * "translate if a key is present, otherwise fall back to the pre-rendered
 * string" pattern so every surface (bell dropdown, alerts panel, logs page)
 * behaves identically.
 *
 * Legacy rows written before migration 0098 have NULL keys — they render
 * as-is from `title` / `message`. New rows use full-path keys like
 * `notifications.instructor.profile_updated.title`.
 */

type TFn = ReturnType<typeof useTranslations>;

type MaybeParams = Record<string, string | number> | null | undefined;

/**
 * Look up `key` in the catalog with `params` and return the localized string,
 * falling back to `fallback` if the key isn't in the catalog (or if `key`
 * is null/undefined — which is the case for pre-migration rows).
 *
 * Pass the ROOT translator (`useTranslations()` with no namespace) so full
 * paths like `notifications.foo.bar.title` resolve correctly.
 */
export function tOrFallback(
  tRoot: TFn,
  key: string | null | undefined,
  params: MaybeParams,
  fallback: string,
): string {
  if (!key) return fallback;
  if (!tRoot.has(key)) return fallback;
  return tRoot(key, (params ?? undefined) as Record<string, string | number> | undefined);
}

/**
 * Locale-aware relative time. Uses catalog entries `notifications.justNow`,
 * `minutesAgo`, `hoursAgo`, `daysAgo`, `weeksAgo`, `monthsAgo`, `yearsAgo`.
 *
 * `tNotifications` should be `useTranslations('notifications')` — the caller
 * already has one for the surrounding UI, so we reuse it here.
 */
export function relativeTime(
  tNotifications: TFn,
  isoDate: string,
): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = Math.max(0, now - then);
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMin < 1) return tNotifications("justNow");
  if (diffMin < 60) return tNotifications("minutesAgo", { m: diffMin });
  if (diffHrs < 24) return tNotifications("hoursAgo", { h: diffHrs });
  if (diffDays < 7) return tNotifications("daysAgo", { d: diffDays });
  if (diffWeeks < 5) return tNotifications("weeksAgo", { w: diffWeeks });
  if (diffMonths < 12) return tNotifications("monthsAgo", { mo: diffMonths });
  return tNotifications("yearsAgo", { y: diffYears });
}
