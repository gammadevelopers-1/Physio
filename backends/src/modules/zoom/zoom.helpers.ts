import { sql } from 'drizzle-orm';
import { db } from '../../database';
import { users } from '../../database/schema';

/**
 * Shared helper: match a Zoom participant email to a system user.
 * Case-insensitive matching on user.email and user.zoomEmail.
 * Used by both ZoomWebhookService and ZoomSyncService (DRY — issue #9).
 */
export async function matchParticipantToUser(
  email: string,
): Promise<{ id: string } | null> {
  if (!email) return null;

  const normalizedEmail = email.toLowerCase();

  // Try primary email first (case-insensitive)
  const [byEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = ${normalizedEmail}`)
    .limit(1);

  if (byEmail) return byEmail;

  // Try zoomEmail (case-insensitive)
  const [byZoomEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.zoomEmail}) = ${normalizedEmail}`)
    .limit(1);

  return byZoomEmail || null;
}
