import { and, count, eq, isNotNull, lt, ne, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  enrollments,
  courseModules,
  moduleCompletions,
  sessions,
  attendance,
  assessments,
  submissions,
  courses,
} from '../../database/schema';

/**
 * Unified course-progress formula.
 *
 *   denominator = non-cancelled sessions
 *               + modules
 *               + published assessments
 *
 *   numerator   = sessions where this student has any attendance record
 *               + modules this student has marked complete
 *               + assessments this student has either submitted, OR are
 *                 past-due / course-ended (i.e. they're "done" for the
 *                 student even without a submission)
 *
 *   progress    = round(numerator / denominator * 100)   ← clamped [0, 100]
 *
 * Called from any path that flips one of those signals:
 *   - module marked complete
 *   - session finalized (status → completed) + attendance recorded
 *   - assessment submitted
 *   - assessment missed by cron
 *
 * Idempotent: re-running with no state change produces the same percent.
 * No-op when there's no content yet (denominator = 0 → 0%).
 */
export async function recomputeEnrollmentProgress(
  studentId: string,
  courseId: string,
): Promise<number> {
  // ── DENOMINATOR ────────────────────────────────────────────
  const [moduleTotalRow] = await db
    .select({ c: count() })
    .from(courseModules)
    .where(eq(courseModules.courseId, courseId));

  const [sessionTotalRow] = await db
    .select({ c: count() })
    .from(sessions)
    .where(
      and(eq(sessions.courseId, courseId), ne(sessions.status, 'cancelled')),
    );

  const [assessmentTotalRow] = await db
    .select({ c: count() })
    .from(assessments)
    .where(
      and(
        eq(assessments.courseId, courseId),
        eq(assessments.status, 'published'),
      ),
    );

  const totalModules = Number(moduleTotalRow?.c ?? 0);
  const totalSessions = Number(sessionTotalRow?.c ?? 0);
  const totalAssessments = Number(assessmentTotalRow?.c ?? 0);
  const denominator = totalModules + totalSessions + totalAssessments;

  if (denominator === 0) {
    await db
      .update(enrollments)
      .set({ progress: 0, lastAccessedAt: new Date() })
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, courseId),
        ),
      );
    return 0;
  }

  // ── NUMERATOR ──────────────────────────────────────────────
  // Modules this student has marked complete (idempotent via UNIQUE).
  const [moduleDoneRow] = await db
    .select({ c: count() })
    .from(moduleCompletions)
    .where(
      and(
        eq(moduleCompletions.studentId, studentId),
        eq(moduleCompletions.courseId, courseId),
      ),
    );

  // Sessions with an attendance record for this student (present/late/absent/
  // excused are all "done" — the event finished and they were either there
  // or not; both count toward progress, eligibility is a separate concern).
  const [attendanceDoneRow] = await db
    .select({ c: count() })
    .from(attendance)
    .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
    .where(
      and(
        eq(attendance.studentId, studentId),
        eq(sessions.courseId, courseId),
        ne(sessions.status, 'cancelled'),
      ),
    );

  // Course end-date — used to mark unsubmitted assessments as "done" once
  // the course wraps.
  const [courseRow] = await db
    .select({ endDate: courses.endDate })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const courseEndDate = courseRow?.endDate
    ? new Date(courseRow.endDate)
    : null;
  const now = new Date();
  const courseEnded =
    courseEndDate !== null && courseEndDate.getTime() < now.getTime();

  // Assessments counted as "done":
  //   - any submission exists from the student (any status), OR
  //   - dueDate has passed, OR
  //   - the course itself has ended
  const submittedAssessmentIds = await db
    .selectDistinct({ id: submissions.assessmentId })
    .from(submissions)
    .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
    .where(
      and(
        eq(submissions.studentId, studentId),
        eq(assessments.courseId, courseId),
        eq(assessments.status, 'published'),
      ),
    );
  const submittedSet = new Set(submittedAssessmentIds.map((r) => r.id));

  // "Past-due" set: every published assessment whose dueDate has passed,
  // OR (when courseEnded) every published assessment. Deduped against the
  // student's existing submissions via Set union below.
  const pastDueIds = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(
      courseEnded
        ? and(
            eq(assessments.courseId, courseId),
            eq(assessments.status, 'published'),
          )
        : and(
            eq(assessments.courseId, courseId),
            eq(assessments.status, 'published'),
            isNotNull(assessments.dueDate),
            lt(assessments.dueDate, now),
          ),
    );

  // Union: assessment "done" = submitted OR past-due/course-ended
  const doneAssessmentIds = new Set<string>(submittedSet);
  for (const row of pastDueIds) doneAssessmentIds.add(row.id);

  const modulesDone = Number(moduleDoneRow?.c ?? 0);
  const sessionsDone = Number(attendanceDoneRow?.c ?? 0);
  const assessmentsDone = doneAssessmentIds.size;
  const numerator = modulesDone + sessionsDone + assessmentsDone;

  const progress = Math.min(
    100,
    Math.max(0, Math.round((numerator / denominator) * 100)),
  );

  await db
    .update(enrollments)
    .set({ progress, lastAccessedAt: new Date() })
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.courseId, courseId),
      ),
    );

  return progress;
}

/**
 * Recompute for every active/completed enrollment in a course. Used after
 * an event that affects ALL students at once — e.g. instructor finalizes
 * a session, which changes the attendance landscape for the cohort.
 */
export async function recomputeProgressForCohort(
  courseId: string,
): Promise<void> {
  const cohort = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        sql`${enrollments.status} IN ('active', 'completed')`,
      ),
    );

  for (const row of cohort) {
    await recomputeEnrollmentProgress(row.studentId, courseId);
  }
}
