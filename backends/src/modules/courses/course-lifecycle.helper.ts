import { Course, COURSE_STATUS } from '../../database/schema';

/**
 * Course lifecycle predicates — one truth-source for every code path that
 * decides "can I still act on this course?"
 *
 * These live outside CoursesService so intake paths (payments, self-enrol,
 * manual enrol, bank-transfer approval, reconciliation escalation, ...) can
 * import them without pulling in the whole service graph.
 *
 * All predicates return a discriminated result: `{ ok: true }` for the go
 * path, or `{ ok: false, reason }` so callers can surface an accurate error
 * message instead of a generic "not found". Never throw here — the caller
 * knows what HTTP status is appropriate for its context.
 */

export type LifecycleGate =
  | { ok: true }
  | { ok: false; reason: LifecycleBlockReason };

export type LifecycleBlockReason =
  | 'course_not_found'
  | 'course_deleted'
  | 'course_cancelled'
  | 'course_not_active'
  | 'course_archived'
  | 'course_completed'
  | 'enrollment_deadline_passed';

/**
 * The minimum a course row must supply for gating. `Course` from the schema
 * satisfies this — but we accept a subset so lightweight loaders that only
 * select these columns can also gate.
 */
type GateableCourse = Pick<
  Course,
  'status' | 'deletedAt' | 'cancelledAt' | 'enrollmentDeadline'
> | null | undefined;

/**
 * Can a new student be enrolled in this course right now?
 *
 * Used by every enrollment intake:
 *   1. Manual admin/instructor enrol (`EnrollmentsService.createEnrollment`)
 *   2. Paid checkout (`PaymentsService.initiatePayment`)
 *   3. Free self-enrol (`StudentService.selfEnroll`)
 *   4. Bank-transfer approval + reconciliation escalation enrolments
 *
 * The pre-migration code checked only `deletedAt` in path 1 and `status=active`
 * in paths 2-3. Consolidating here closes the gap and adds cancelled + deadline
 * uniformly.
 */
export function canEnroll(course: GateableCourse): LifecycleGate {
  if (!course) return { ok: false, reason: 'course_not_found' };
  if (course.deletedAt) return { ok: false, reason: 'course_deleted' };
  if (course.cancelledAt || course.status === COURSE_STATUS.CANCELLED) {
    return { ok: false, reason: 'course_cancelled' };
  }
  if (course.status === COURSE_STATUS.ARCHIVED) {
    return { ok: false, reason: 'course_archived' };
  }
  if (course.status === COURSE_STATUS.COMPLETED) {
    return { ok: false, reason: 'course_completed' };
  }
  if (course.status !== COURSE_STATUS.ACTIVE) {
    return { ok: false, reason: 'course_not_active' };
  }
  if (
    course.enrollmentDeadline &&
    new Date(course.enrollmentDeadline).getTime() < Date.now()
  ) {
    return { ok: false, reason: 'enrollment_deadline_passed' };
  }
  return { ok: true };
}

/**
 * Human-readable reason for a blocked enrollment. Callers should prefer
 * calling t() on their side with a proper key, but this is fine for logs
 * and non-i18n contexts.
 */
export function describeEnrollBlock(reason: LifecycleBlockReason): string {
  switch (reason) {
    case 'course_not_found':
      return 'Course not found';
    case 'course_deleted':
      return 'Course has been deleted';
    case 'course_cancelled':
      return 'Course has been cancelled and is not accepting new enrollments';
    case 'course_archived':
      return 'Course is archived and is not accepting new enrollments';
    case 'course_completed':
      return 'Course has already ended';
    case 'course_not_active':
      return 'Course is not yet active';
    case 'enrollment_deadline_passed':
      return 'Enrollment deadline has passed';
  }
}
