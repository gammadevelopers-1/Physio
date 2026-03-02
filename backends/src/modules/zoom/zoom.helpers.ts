import { sql, eq } from 'drizzle-orm';
import { db } from '../../database';
import { users, courses, sessions } from '../../database/schema';

/**
 * Extract the host email from a Zoom webhook payload.
 * The webhook payload object contains host_id but not host_email directly.
 * We use the meeting object's host_id to check if a participant is the host.
 */
export function getHostEmailFromPayload(payload: any): string | null {
  // The webhook payload may include host_email at the meeting level
  return payload?.host_email || null;
}

/**
 * Check if a participant is the meeting host.
 * Compares the participant's Zoom user ID fields against the meeting's host_id.
 */
export function isParticipantHost(payload: any): boolean {
  const hostId = payload?.host_id;
  const participant = payload?.participant || payload;
  if (!hostId) return false;

  // Compare host_id against participant identifiers
  // participant_user_id is the Zoom user ID (matches host_id when logged in)
  if (participant?.participant_user_id && participant.participant_user_id === hostId) {
    return true;
  }
  // Also check the 'id' field which sometimes contains the user ID
  if (participant?.id && participant.id === hostId) {
    return true;
  }
  return false;
}

/**
 * Shared helper: match a Zoom participant email to a system user.
 * Case-insensitive matching on user.email and user.zoomEmail.
 * Optionally excludes a specific user (e.g., course instructor / Zoom host).
 * Also excludes a list of emails (e.g., Zoom host emails).
 * Used by both ZoomWebhookService and ZoomSyncService (DRY — issue #9).
 */
export async function matchParticipantToUser(
  email: string,
  excludeUserId?: string | null,
  excludeEmails?: string[],
): Promise<{ id: string } | null> {
  if (!email) return null;

  // Check if this email should be excluded (e.g., Zoom host)
  if (excludeEmails?.length) {
    const normalizedExcludes = excludeEmails.map((e) => e.toLowerCase());
    if (normalizedExcludes.includes(email.toLowerCase())) {
      return null;
    }
  }

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
