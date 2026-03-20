/**
 * Backfill absent attendance records for all past sessions.
 *
 * For every completed/ended session, creates 'absent' records for enrolled
 * students who have no attendance record, excluding instructors and TAs.
 *
 * Run: npx tsx src/database/backfill-absent-records.ts
 * Safe to run multiple times (uses onConflictDoNothing).
 */

import { db, pool } from './index';
import {
  sessions,
  courses,
  enrollments,
  attendance,
  courseAssistants,
} from './schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

async function backfillAbsentRecords() {
  console.log('Backfilling absent attendance records for past sessions...\n');

  // Get all completed/ended sessions
  const pastSessions = await db
    .select({
      id: sessions.id,
      courseId: sessions.courseId,
      title: sessions.title,
    })
    .from(sessions)
    .where(sql`${sessions.status} IN ('completed', 'ended')`);

  console.log(`Found ${pastSessions.length} past session(s) to process.\n`);

  let totalCreated = 0;

  for (const session of pastSessions) {
    // Get course instructor
    const [course] = await db
      .select({ instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.id, session.courseId))
      .limit(1);

    const excludeIds = new Set<string>();
    if (course?.instructorId) excludeIds.add(course.instructorId);

    // Get TAs to exclude
    const tas = await db
      .select({ userId: courseAssistants.userId })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, session.courseId),
          sql`${courseAssistants.status} IN ('approved', 'pre_assigned')`,
        ),
      );
    for (const ta of tas) excludeIds.add(ta.userId);

    // Get enrolled students
    const enrolled = await db
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, session.courseId),
          sql`${enrollments.status} IN ('active', 'completed')`,
        ),
      );

    // Get students who already have attendance records
    const existing = await db
      .select({ studentId: attendance.studentId })
      .from(attendance)
      .where(eq(attendance.sessionId, session.id));

    const existingIds = new Set(existing.map((e) => e.studentId));

    // Find missing students
    const missing = enrolled.filter(
      (e) => !existingIds.has(e.studentId) && !excludeIds.has(e.studentId),
    );

    if (missing.length === 0) continue;

    // Bulk insert absent records
    await db
      .insert(attendance)
      .values(
        missing.map((s) => ({
          sessionId: session.id,
          studentId: s.studentId,
          status: 'absent',
        })),
      )
      .onConflictDoNothing();

    totalCreated += missing.length;
    console.log(`  ✓ ${session.title || session.id}: ${missing.length} absent record(s) created`);
  }

  console.log(`\nDone! Created ${totalCreated} absent record(s) across ${pastSessions.length} session(s).`);
}

backfillAbsentRecords()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    pool.end();
    process.exit(1);
  });
