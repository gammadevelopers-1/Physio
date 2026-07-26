import { Injectable, Logger } from '@nestjs/common';
import { eq, and, gte, lte, desc, count, sql } from 'drizzle-orm';
import { db } from '../../database';
import { nelcAuditLogs } from '../../database/schema';
import { toCsvBuffer, CSV_CONTENT_TYPE } from '../../common/exports/csv.util';

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
   * Export audit logs as CSV buffer (no pagination, up to 10 000 rows).
   */
  async exportCsv(filters: {
    eventType?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters.eventType) conditions.push(eq(nelcAuditLogs.eventType, filters.eventType));
    if (filters.entityType) conditions.push(eq(nelcAuditLogs.entityType, filters.entityType));
    if (filters.entityId) conditions.push(eq(nelcAuditLogs.entityId, filters.entityId));
    if (filters.userId) conditions.push(eq(nelcAuditLogs.userId, filters.userId));
    if (filters.startDate) conditions.push(gte(nelcAuditLogs.createdAt, filters.startDate));
    if (filters.endDate) conditions.push(lte(nelcAuditLogs.createdAt, filters.endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(nelcAuditLogs)
      .where(whereClause)
      .orderBy(desc(nelcAuditLogs.createdAt))
      .limit(10_000);

    const headers = ['ID', 'Event Type', 'Entity Type', 'Entity ID', 'User ID', 'IP Address', 'Metadata', 'Created At'];
    const csvRows: (string | number | null)[][] = rows.map((r) => [
      r.id,
      r.eventType,
      r.entityType ?? '',
      r.entityId ?? '',
      r.userId ?? '',
      r.ipAddress ?? '',
      r.metadata ? JSON.stringify(r.metadata) : '',
      r.createdAt ? new Date(r.createdAt).toISOString() : '',
    ]);

    const ts = new Date().toISOString().slice(0, 10);
    return {
      buffer: toCsvBuffer(csvRows, { headers }),
      filename: `nelc-audit-logs-${ts}.csv`,
      contentType: CSV_CONTENT_TYPE,
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
