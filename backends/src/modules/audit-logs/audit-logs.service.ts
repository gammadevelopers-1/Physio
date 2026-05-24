import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database';
import { auditLogs, users } from '../../database/schema';
import { eq, and, desc, count, gte, lte, or, ilike, sql } from 'drizzle-orm';

export interface AdminAuditLogFilters {
  entityType?: string;
  action?: string;
  performedBy?: string;
  search?: string; // matches performer first/last/email
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

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
   * Admin-only broad query — supports the filters surfaced on the admin
   * Logs page. Performer name/email search uses an inner-joined users row
   * so the same search box covers both name and email.
   */
  async findAllAdmin(filters: AdminAuditLogFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 200);
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.performedBy) conditions.push(eq(auditLogs.performedBy, filters.performedBy));
    if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to));
    if (filters.search) {
      const q = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(users.firstName, q),
          ilike(users.lastName, q),
          ilike(users.email, q),
        ),
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

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
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.performedBy, users.id))
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

  /**
   * Distinct entity types + actions for filter dropdowns. Cached at the
   * application layer would be ideal but counts are cheap here.
   */
  async getDistinctValues() {
    const [entityTypes, actions] = await Promise.all([
      db
        .selectDistinct({ value: auditLogs.entityType })
        .from(auditLogs)
        .orderBy(auditLogs.entityType),
      db
        .selectDistinct({ value: auditLogs.action })
        .from(auditLogs)
        .orderBy(auditLogs.action),
    ]);
    return {
      entityTypes: entityTypes.map((e) => e.value).filter(Boolean),
      actions: actions.map((a) => a.value).filter(Boolean),
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
