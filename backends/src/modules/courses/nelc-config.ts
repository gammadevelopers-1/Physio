/**
 * NELC (National eLearning Center) Configuration
 * These limits are configurable. In a future iteration,
 * they should be stored in a settings table editable via admin dashboard.
 *
 * Synchronous (live/zoom/hybrid): default max 2000 (adjustable by admin/manager)
 * Asynchronous (self-paced): unlimited (no cap unless manager sets one)
 */
export const NELC_LIMITS = {
  LONG_COURSE_DAYS_THRESHOLD: 5,
  /** Default max for synchronous courses — can be adjusted per-course */
  SYNC_MAX_LEARNERS: 2000,
  /** Keep legacy aliases so existing code compiles; both now resolve to SYNC_MAX_LEARNERS */
  LONG_COURSE_MAX_LEARNERS: 2000,
  SHORT_COURSE_MAX_LEARNERS: 2000,
} as const;

/**
 * Classify a course as 'long' or 'short' based on its date range.
 * Kept for backward compatibility — other services still reference it.
 */
export function classifyCourse(
  startDate: string | Date | null,
  endDate: string | Date | null,
): 'long' | 'short' {
  if (!startDate || !endDate) return 'short';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > NELC_LIMITS.LONG_COURSE_DAYS_THRESHOLD ? 'long' : 'short';
}

/**
 * Get the default max enrollment for synchronous courses.
 * Both long and short now return 2000 (adjustable per-course by admin).
 */
export function getNelcMaxEnrollment(_classification: 'long' | 'short'): number {
  return NELC_LIMITS.SYNC_MAX_LEARNERS;
}
