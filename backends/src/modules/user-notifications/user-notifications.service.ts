import { Injectable, Logger } from '@nestjs/common';
import { eq, and, desc, count, sql, inArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  userNotifications,
  NewUserNotification,
  userRoles,
  roles,
  ROLE_NAMES,
} from '../../database/schema';
import { userPreferences } from '../../database/schema/user-preferences';

/**
 * Resolve the user IDs that belong to the SUPPORT role.
 * Used by supervisor scope expansion so a supervisor's bell shows the
 * team-wide notification stream, not just their own.
 */
async function getSupportTeamUserIds(): Promise<string[]> {
  const rows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(roles.name, ROLE_NAMES.SUPPORT));
  return rows.map((r) => r.userId);
}

@Injectable()
export class UserNotificationsService {
  private readonly logger = new Logger(UserNotificationsService.name);

  /**
   * Check if a user has in-app notifications enabled.
   * Returns true if no preferences exist (default ON) or any push pref is true.
   */
  private async isInAppEnabled(userId: string): Promise<boolean> {
    const [prefs] = await db
      .select({
        pushNewSession: userPreferences.pushNewSession,
        pushStudentMessage: userPreferences.pushStudentMessage,
        pushSystemUpdates: userPreferences.pushSystemUpdates,
      })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    // No preferences row = defaults (all ON)
    if (!prefs) return true;

    // If ANY push pref is true, in-app is enabled
    return !!(prefs.pushNewSession || prefs.pushStudentMessage || prefs.pushSystemUpdates);
  }

  /**
   * Create a single notification (respects user preferences)
   */
  async create(data: Omit<NewUserNotification, 'id' | 'createdAt'>) {
    // Check if recipient has in-app notifications enabled
    const enabled = await this.isInAppEnabled(data.recipientId);
    if (!enabled) {
      this.logger.log(`Skipping in-app notification for ${data.recipientId} — disabled by preference`);
      return null;
    }

    const [notif] = await db
      .insert(userNotifications)
      .values(data)
      .returning();
    return notif;
  }

  /**
   * Create notifications for multiple recipients (respects user preferences)
   */
  async createBulk(
    recipientIds: string[],
    data: Omit<NewUserNotification, 'id' | 'createdAt' | 'recipientId'>,
  ) {
    if (recipientIds.length === 0) return;

    // Filter out users who have in-app notifications disabled
    const prefs = await db
      .select({
        userId: userPreferences.userId,
        pushNewSession: userPreferences.pushNewSession,
        pushStudentMessage: userPreferences.pushStudentMessage,
        pushSystemUpdates: userPreferences.pushSystemUpdates,
      })
      .from(userPreferences)
      .where(inArray(userPreferences.userId, recipientIds));

    const disabledUsers = new Set(
      prefs
        .filter((p) => !(p.pushNewSession || p.pushStudentMessage || p.pushSystemUpdates))
        .map((p) => p.userId),
    );

    const enabledRecipients = recipientIds.filter((id) => !disabledUsers.has(id));

    if (enabledRecipients.length === 0) {
      this.logger.log(`All ${recipientIds.length} recipients have in-app notifications disabled — skipping`);
      return;
    }

    const values = enabledRecipients.map((recipientId) => ({
      ...data,
      recipientId,
    }));

    await db.insert(userNotifications).values(values);
    this.logger.log(
      `Created ${enabledRecipients.length} notification(s) (${recipientIds.length - enabledRecipients.length} skipped): ${data.title}`,
    );
  }

  /**
   * Get all notifications for a user with unread count.
   *
   * `teamScope=true` (only honored when the caller is a support supervisor
   * or admin — enforced by the controller) widens the recipient filter to
   * cover every member of the SUPPORT role, so a supervisor's bell shows
   * the team-wide feed instead of just their own.
   */
  async findAllForUser(
    userId: string,
    opts: { limit?: number; unreadOnly?: boolean; teamScope?: boolean } = {},
  ) {
    const limit = opts.limit || 50;
    const recipientIds = opts.teamScope
      ? await getSupportTeamUserIds()
      : [userId];
    const recipientFilter =
      recipientIds.length === 1
        ? eq(userNotifications.recipientId, recipientIds[0])
        : inArray(userNotifications.recipientId, recipientIds);

    const conditions = [recipientFilter];
    if (opts.unreadOnly) {
      conditions.push(eq(userNotifications.isRead, false));
    }

    const [data, [countResult]] = await Promise.all([
      db
        .select()
        .from(userNotifications)
        .where(and(...conditions))
        .orderBy(desc(userNotifications.createdAt))
        .limit(limit),
      db
        .select({ count: count() })
        .from(userNotifications)
        .where(
          and(recipientFilter, eq(userNotifications.isRead, false)),
        ),
    ]);

    return {
      data,
      unreadCount: countResult?.count || 0,
    };
  }

  /**
   * Lightweight unread count for polling. Same teamScope semantics as
   * findAllForUser so the bell badge agrees with the dropdown contents.
   */
  async getUnreadCount(
    userId: string,
    opts: { teamScope?: boolean } = {},
  ): Promise<number> {
    const recipientIds = opts.teamScope
      ? await getSupportTeamUserIds()
      : [userId];
    const recipientFilter =
      recipientIds.length === 1
        ? eq(userNotifications.recipientId, recipientIds[0])
        : inArray(userNotifications.recipientId, recipientIds);

    const [result] = await db
      .select({ count: count() })
      .from(userNotifications)
      .where(and(recipientFilter, eq(userNotifications.isRead, false)));
    return result?.count || 0;
  }

  /**
   * Mark a single notification as read (with ownership check)
   */
  async markAsRead(id: string, userId: string) {
    const [updated] = await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(userNotifications.id, id),
          eq(userNotifications.recipientId, userId),
        ),
      )
      .returning();
    return updated;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(userNotifications.recipientId, userId),
          eq(userNotifications.isRead, false),
        ),
      );
    return { message: 'All notifications marked as read' };
  }

  /**
   * Delete all notifications for a user
   */
  async clearAll(userId: string) {
    await db
      .delete(userNotifications)
      .where(eq(userNotifications.recipientId, userId));
    return { message: 'All notifications cleared' };
  }
}
