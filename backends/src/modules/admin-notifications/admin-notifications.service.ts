import { Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  adminNotifications,
  type AdminNotification,
  type NewAdminNotification,
} from '../../database/schema';

export type AdminNotificationType = 'critical' | 'warning' | 'info';

export interface ListAdminNotificationsFilters {
  type?: AdminNotificationType;
  /** true → only unread, false → only read, undefined → both. */
  unread?: boolean;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminNotificationsService {
  /**
   * Create a new admin alert. Other modules call this when something
   * needs admin attention (e.g. a brute-force burst, a course flagged
   * for content review, a payment dispute opened).
   */
  async create(data: NewAdminNotification): Promise<AdminNotification> {
    const [row] = await db.insert(adminNotifications).values(data).returning();
    return row;
  }

  async list(filters: ListAdminNotificationsFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 200);
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (filters.type) conditions.push(eq(adminNotifications.type, filters.type));
    if (filters.unread === true) conditions.push(eq(adminNotifications.isRead, false));
    if (filters.unread === false) conditions.push(eq(adminNotifications.isRead, true));
    if (filters.from) conditions.push(gte(adminNotifications.createdAt, filters.from));
    if (filters.to) conditions.push(lte(adminNotifications.createdAt, filters.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select()
      .from(adminNotifications)
      .where(where)
      // Unread first, then newest first — admin's eye lands on what
      // actually needs handling without sorting state in the UI.
      .orderBy(
        sql`${adminNotifications.isRead} ASC`,
        desc(adminNotifications.createdAt),
      )
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(adminNotifications)
      .where(where);

    const total = countResult?.count || 0;
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCounts() {
    const [unreadResult, totalResult, criticalUnreadResult] = await Promise.all([
      db
        .select({ count: count() })
        .from(adminNotifications)
        .where(eq(adminNotifications.isRead, false)),
      db.select({ count: count() }).from(adminNotifications),
      db
        .select({ count: count() })
        .from(adminNotifications)
        .where(
          and(
            eq(adminNotifications.isRead, false),
            eq(adminNotifications.type, 'critical'),
          ),
        ),
    ]);
    return {
      unread: unreadResult[0]?.count || 0,
      criticalUnread: criticalUnreadResult[0]?.count || 0,
      total: totalResult[0]?.count || 0,
    };
  }

  async markRead(id: string): Promise<AdminNotification> {
    const [row] = await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(eq(adminNotifications.id, id))
      .returning();
    if (!row) throw new NotFoundException('Notification not found');
    return row;
  }

  async markAllRead(): Promise<{ updated: number }> {
    const updated = await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(eq(adminNotifications.isRead, false))
      .returning({ id: adminNotifications.id });
    return { updated: updated.length };
  }
}
