import { Injectable, Logger } from '@nestjs/common';
import { eq, and, gte, lte, desc, count, sql } from 'drizzle-orm';
import { db } from '../../database';
import { nelcAuditLogs } from '../../database/schema';

@Injectable()
export class NelcAuditService {
  private readonly logger = new Logger(NelcAuditService.name);

  /**
   * Log an audit event. INSERT only — no update, no delete.
   * This is immutable by design (NELC requirement).
   */
  async log(event: {
    eventType: string;
    entityType: string;
    entityId?: string;
    userId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await db.insert(nelcAuditLogs).values({
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        userId: event.userId,
        metadata: event.metadata,
        ipAddress: event.ipAddress,
      });
    } catch (error) {
      // Audit logging should never break the main operation
      this.logger.error('Failed to write audit log', error);
    }
  }

  /**
   * Query audit logs with filters and pagination. SELECT only.
   */
  async query(filters: {
    eventType?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (filters.eventType) {
      conditions.push(eq(nelcAuditLogs.eventType, filters.eventType));
    }
    if (filters.entityType) {
      conditions.push(eq(nelcAuditLogs.entityType, filters.entityType));
    }
    if (filters.entityId) {
      conditions.push(eq(nelcAuditLogs.entityId, filters.entityId));
    }
    if (filters.userId) {
      conditions.push(eq(nelcAuditLogs.userId, filters.userId));
    }
    if (filters.startDate) {
      conditions.push(gte(nelcAuditLogs.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(nelcAuditLogs.createdAt, filters.endDate));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select()
      .from(nelcAuditLogs)
      .where(whereClause)
      .orderBy(desc(nelcAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(nelcAuditLogs)
      .where(whereClause);

    return {
      data,
      total: countResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    };
  }

  /**
   * Get aggregated counts by event type for a date range.
   */
  async getSummary(startDate: Date, endDate: Date) {
    const results = await db
      .select({
        eventType: nelcAuditLogs.eventType,
        count: count(),
      })
      .from(nelcAuditLogs)
      .where(
        and(
          gte(nelcAuditLogs.createdAt, startDate),
          lte(nelcAuditLogs.createdAt, endDate),
        ),
      )
      .groupBy(nelcAuditLogs.eventType);

    return results;
  }
}
