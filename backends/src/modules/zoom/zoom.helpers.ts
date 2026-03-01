import { sql, eq } from 'drizzle-orm';
import { db } from '../../database';
import { users, courses, sessions } from '../../database/schema';

/**
 * Shared helper: match a Zoom participant email to a system user.
 * Case-insensitive matching on user.email and user.zoomEmail.
 * Optionally excludes a specific user (e.g., course instructor / Zoom host).
 * Used by both ZoomWebhookService and ZoomSyncService (DRY — issue #9).
 */
export async function matchParticipantToUser(
  email: string,
  excludeUserId?: string | null,
): Promise<{ id: string } | null> {
  if (!email) return null;

  const normalizedEmail = email.toLowerCase();

  // Try primary email first (case-insensitive)
  const [byEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = ${normalizedEmail}`)
    .limit(1);

  if (byEmail) {
    if (excludeUserId && byEmail.id === excludeUserId) return null;
    return byEmail;
  }

  // Try zoomEmail (case-insensitive)
  const [byZoomEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.zoomEmail}) = ${normalizedEmail}`)
    .limit(1);

  if (byZoomEmail && excludeUserId && byZoomEmail.id === excludeUserId) {
    return null;
  }

  return byZoomEmail || null;
}

/**
 * Get the instructor ID for a session's course.
 */
export async function getSessionInstructorId(
  sessionId: string,
): Promise<string | null> {
  const [session] = await db
    .select({ courseId: sessions.courseId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session?.courseId) return null;

  const [course] = await db
    .select({ instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.id, session.courseId))
    .limit(1);

  return course?.instructorId || null;
}
