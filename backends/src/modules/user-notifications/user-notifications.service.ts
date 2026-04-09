import { Injectable, Logger } from '@nestjs/common';
import { eq, and, desc, count, sql, inArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  userNotifications,
  NewUserNotification,
} from '../../database/schema';
import { userPreferences } from '../../database/schema/user-preferences';

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
   * Get all notifications for a user with unread count
   */
  async findAllForUser(
    userId: string,
    opts: { limit?: number; unreadOnly?: boolean } = {},
  ) {
    const limit = opts.limit || 50;
    const conditions = [eq(userNotifications.recipientId, userId)];

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
          and(
            eq(userNotifications.recipientId, userId),
            eq(userNotifications.isRead, false),
          ),
        ),
    ]);

    return {
      data,
      unreadCount: countResult?.count || 0,
    };
  }

  /**
   * Lightweight unread count for polling
   */
  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.recipientId, userId),
          eq(userNotifications.isRead, false),
        ),
      );
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
