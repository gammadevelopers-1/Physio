/**
 * NELC (National eLearning Center) Configuration
 * These limits are configurable. In a future iteration,
 * they should be stored in a settings table editable via admin dashboard.
 */
export const NELC_LIMITS = {
  LONG_COURSE_DAYS_THRESHOLD: 5,
  LONG_COURSE_MAX_LEARNERS: 40,
  SHORT_COURSE_MAX_LEARNERS: 50,
} as const;

/**
 * Classify a course as 'long' or 'short' based on its date range.
 * Long courses: more than 5 calendar days
 * Short courses: 5 days or fewer
 */
export function classifyCourse(
  startDate: string | Date | null,
  endDate: string | Date | null,
): 'long' | 'short' {
  if (!startDate || !endDate) return 'short'; // default to short if no dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > NELC_LIMITS.LONG_COURSE_DAYS_THRESHOLD ? 'long' : 'short';
}

/**
 * Get the NELC maximum enrollment for a course classification.
 * Long courses: max 40 learners
 * Short courses: max 50 learners
 */
export function getNelcMaxEnrollment(classification: 'long' | 'short'): number {
  return classification === 'long'
    ? NELC_LIMITS.LONG_COURSE_MAX_LEARNERS
    : NELC_LIMITS.SHORT_COURSE_MAX_LEARNERS;
}
