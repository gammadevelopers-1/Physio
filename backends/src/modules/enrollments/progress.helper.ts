import { and, count, eq, gt, gte, isNotNull, lt, ne, or, sql } from 'drizzle-orm';
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
 * Webinar Courses branch: attendance-only per product spec. Modules and
 * assessments MAY exist as supplementary content but do NOT feed
 * progress% or CME eligibility — only session attendance drives the
 * numerator/denominator for delivery_type='webinar'.
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
/** Result of a recompute. `prior` is the enrollment's progress value
 *  BEFORE this recompute (0 when no enrollment row existed yet),
 *  `current` is the value after.
 *
 *  Callers firing NELC `progressed` xAPI statements MUST gate on
 *  `progressIncreased` (NOT `current > prior`). Two concurrent
 *  recomputes can both read the same `prior` and compute the same
 *  `current`, so `current > prior` would be true in BOTH, causing
 *  duplicate xAPI statements at the same millisecond (NELC checklist
 *  SEQ003). `progressIncreased` is set ONLY on the request that
 *  actually wrote the new value to disk — the race winner. */
export interface RecomputeResult {
  prior: number;
  current: number;
  progressIncreased: boolean;
}

export async function recomputeEnrollmentProgress(
  studentId: string,
  courseId: string,
): Promise<RecomputeResult> {
  // Snapshot prior progress + enrolledAt BEFORE recomputing. `prior` is
  // returned to callers; `enrolledAt` gates the session denominator so
  // students enrolling AFTER a webinar has already happened aren't
  // penalised by an inflated denominator (they couldn't have attended,
  // so the past session shouldn't count toward their 100%).
  const [priorRow] = await db
    .select({
      progress: enrollments.progress,
      enrolledAt: enrollments.enrolledAt,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.courseId, courseId),
      ),
    )
    .limit(1);
  const prior = Number(priorRow?.progress ?? 0);
  const enrolledAt = priorRow?.enrolledAt ?? null;

  // Webinar Courses are attendance-only per product spec: modules and
  // assessments MAY exist as supplementary content but do NOT feed
  // progress% or CME eligibility. Only session attendance drives progress.
  const [deliveryRow] = await db
    .select({ deliveryType: courses.deliveryType })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const isWebinarCourse = deliveryRow?.deliveryType === 'webinar';

  // ── DENOMINATOR ────────────────────────────────────────────
  const [moduleTotalRow] = await db
    .select({ c: count() })
    .from(courseModules)
    .where(eq(courseModules.courseId, courseId));

  // Sessions count toward the denominator only when the student had
  // (or still has) a real chance to attend them: future sessions OR
  // sessions that happened AFTER the student enrolled. Past sessions
  // from before the student joined are excluded so late enrollees can
  // still hit 100% — matches the expected webinar-enrolment flow.
  const sessionDenominatorCondition = enrolledAt
    ? or(
        gte(sessions.scheduledAt, new Date()),
        gte(sessions.scheduledAt, enrolledAt),
      )
    : gte(sessions.scheduledAt, new Date());

  const [sessionTotalRow] = await db
    .select({ c: count() })
    .from(sessions)
    .where(
      and(
        eq(sessions.courseId, courseId),
        ne(sessions.status, 'cancelled'),
        sessionDenominatorCondition,
      ),
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
  const denominator = isWebinarCourse
    ? totalSessions
    : totalModules + totalSessions + totalAssessments;

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
    return { prior, current: 0, progressIncreased: false };
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
  const numerator = isWebinarCourse
    ? sessionsDone
    : modulesDone + sessionsDone + assessmentsDone;

  const progress = Math.min(
    100,
    Math.max(0, Math.round((numerator / denominator) * 100)),
  );

  // Atomic conditional write — only update if the new value is STRICTLY
  // greater than what's currently on disk. Two concurrent recomputes
  // can both compute the same `progress`; exactly one will see
  // `progress < new` and win the race. The loser's UPDATE matches 0
  // rows and `progressIncreased` stays false, so it skips the xAPI
  // emit. lastAccessedAt is updated in a separate non-conditional
  // pass so both paths still bump it.
  const winnerRows = await db
    .update(enrollments)
    .set({ progress, lastAccessedAt: new Date() })
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.courseId, courseId),
        lt(enrollments.progress, progress),
      ),
    )
    .returning({ id: enrollments.id });

  const progressIncreased = winnerRows.length > 0;

  // If we lost the race or the value didn't change, still bump
  // lastAccessedAt so the dashboard "recently accessed" surface stays
  // accurate. No-op for the winner (already updated above).
  if (!progressIncreased) {
    await db
      .update(enrollments)
      .set({ lastAccessedAt: new Date() })
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, courseId),
        ),
      );
  }

  return { prior, current: progress, progressIncreased };
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
