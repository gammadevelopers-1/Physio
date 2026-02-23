import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database';
import { auditLogs, users } from '../../database/schema';
import { eq, and, desc, count } from 'drizzle-orm';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  /**
   * Log an immutable audit entry. No update/delete methods exist by design.
   */
  async log(data: {
    entityType: string;
    entityId: string;
    action: string;
    performedBy: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        performedBy: data.performedBy,
        metadata: data.metadata || null,
        ipAddress: data.ipAddress || null,
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
    }
  }

  /**
   * Retrieve audit entries for a specific entity — paginated, with performer info.
   */
  async getByEntity(entityType: string, entityId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const data = await db
      .select({
        id: auditLogs.id,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        performedBy: auditLogs.performedBy,
        metadata: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        performerFirstName: users.firstName,
        performerLastName: users.lastName,
        performerEmail: users.email,
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.performedBy, users.id))
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)));

    return {
      data,
      total: countResult?.count || 0,
      page,
      limit,
    };
  }

  /**
   * Retrieve all audit entries with optional filters — paginated.
   */
  async findAll(
    filters: { entityType?: string; entityId?: string },
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;
    const conditions = [];

    if (filters.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }

    const data = await db
      .select({
        id: auditLogs.id,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        performedBy: auditLogs.performedBy,
        metadata: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        performerFirstName: users.firstName,
        performerLastName: users.lastName,
        performerEmail: users.email,
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.performedBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      data,
      total: countResult?.count || 0,
      page,
      limit,
    };
  }
}
