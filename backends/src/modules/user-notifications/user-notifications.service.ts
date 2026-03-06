import { Injectable, Logger } from '@nestjs/common';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  userNotifications,
  NewUserNotification,
} from '../../database/schema';

@Injectable()
export class UserNotificationsService {
  private readonly logger = new Logger(UserNotificationsService.name);

  /**
   * Create a single notification
   */
  async create(data: Omit<NewUserNotification, 'id' | 'createdAt'>) {
    const [notif] = await db
      .insert(userNotifications)
      .values(data)
      .returning();
    return notif;
  }

  /**
   * Create notifications for multiple recipients in a single INSERT
   */
  async createBulk(
    recipientIds: string[],
    data: Omit<NewUserNotification, 'id' | 'createdAt' | 'recipientId'>,
  ) {
    if (recipientIds.length === 0) return;

    const values = recipientIds.map((recipientId) => ({
      ...data,
      recipientId,
    }));

    await db.insert(userNotifications).values(values);
    this.logger.log(
      `Created ${recipientIds.length} notification(s): ${data.title}`,
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
