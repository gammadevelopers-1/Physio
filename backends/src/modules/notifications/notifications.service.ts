import { Injectable } from '@nestjs/common';
import { eq, desc, count, and } from 'drizzle-orm';
import { db } from '../../database';
import { adminNotifications } from '../../database/schema';

@Injectable()
export class NotificationsService {
  // Create a new admin notification
  async create(data: {
    type: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    link?: string;
  }) {
    const [notification] = await db
      .insert(adminNotifications)
      .values(data)
      .returning();

    return notification;
  }

  // Get all notifications (most recent first)
  async findAll(params: { limit?: number; unreadOnly?: boolean } = {}) {
    const limit = params.limit || 50;
    const conditions = params.unreadOnly
      ? eq(adminNotifications.isRead, false)
      : undefined;

    const data = await db
      .select()
      .from(adminNotifications)
      .where(conditions)
      .orderBy(desc(adminNotifications.createdAt))
      .limit(limit);

    const [unreadResult] = await db
      .select({ count: count() })
      .from(adminNotifications)
      .where(eq(adminNotifications.isRead, false));

    return {
      data,
      unreadCount: unreadResult?.count || 0,
    };
  }

  // Mark a notification as read
  async markAsRead(id: string) {
    await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(eq(adminNotifications.id, id));

    return { message: 'Notification marked as read' };
  }

  // Mark all as read
  async markAllAsRead() {
    await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(eq(adminNotifications.isRead, false));

    return { message: 'All notifications marked as read' };
  }
}
