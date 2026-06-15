import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database';
import { auditLogs, users } from '../../database/schema';
import { eq, and, desc, count, gte, lte, or, ilike, sql } from 'drizzle-orm';
import * as PDFDocument from 'pdfkit';
import { RequestContextService } from '../../common/request-context.service';

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

  constructor(private readonly requestContext: RequestContextService) {}

  /**
   * Log an immutable audit entry. No update/delete methods exist by design.
   *
   * IP resolution order:
   *   1. Explicit `ipAddress` argument (e.g. workers passing 'system').
   *   2. Per-request store populated by RequestContextMiddleware.
   *   3. null — only happens for non-HTTP code paths that forgot to
   *      tag themselves; the admin Logs page will flag those rows.
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
      const ipAddress = data.ipAddress || this.requestContext.getIp() || null;
      // Convert 'system' string to null — the column is a UUID FK to users
      const performedBy =
        data.performedBy && data.performedBy !== 'system'
          ? data.performedBy
          : null;

      await db.insert(auditLogs).values({
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        performedBy,
        metadata: data.metadata || null,
        ipAddress,
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
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
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
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
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

  /**
   * Finance-specific audit log query with rich filters (date range, action, search).
   */
  async findAllFinance(
    filters: {
      entityType?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;
    const conditions: any[] = [];

    if (filters.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(filters.endDate)));
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(auditLogs.action, term),
          ilike(auditLogs.entityType, term),
          sql`${auditLogs.entityId}::text ILIKE ${term}`,
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);

    return {
      data,
      total: countResult?.count || 0,
      page,
      limit,
    };
  }

  /**
   * Get distinct entity types and actions for filter dropdowns.
   */
  async getFilterOptions() {
    const entityTypes = await db
      .selectDistinct({ entityType: auditLogs.entityType })
      .from(auditLogs)
      .orderBy(auditLogs.entityType);

    const actions = await db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .orderBy(auditLogs.action);

    return {
      entityTypes: entityTypes.map((r) => r.entityType),
      actions: actions.map((r) => r.action),
    };
  }

  /**
   * PDP-compliant: strip PII from metadata before export.
   */
  private sanitizeMetadata(
    metadata: Record<string, unknown> | null,
  ): string {
    if (!metadata) return '';
    const json = JSON.stringify(metadata);
    return json
      .replace(/\b\d{13,19}\b/g, '****')
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        '***@***.***',
      );
  }

  /**
   * NELC-compliant CSV export of audit trail.
   */
  async exportAuditCsv(
    filters: {
      entityType?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
    userId?: string,
  ): Promise<string> {
    // Fetch all matching rows (no pagination)
    const conditions: any[] = [];
    if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.startDate) conditions.push(gte(auditLogs.createdAt, new Date(filters.startDate)));
    if (filters.endDate) conditions.push(lte(auditLogs.createdAt, new Date(filters.endDate)));
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(auditLogs.action, term),
          ilike(auditLogs.entityType, term),
          sql`${auditLogs.entityId}::text ILIKE ${term}`,
        ),
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        createdAt: auditLogs.createdAt,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        performedBy: auditLogs.performedBy,
        ipAddress: auditLogs.ipAddress,
        metadata: auditLogs.metadata,
        performerFirstName: users.firstName,
        performerLastName: users.lastName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt));

    // NELC metadata header
    const lines: string[] = [
      '# PhysioGuidance Platform — Audit Trail Export',
      `# Generated: ${new Date().toISOString()}`,
      `# Generated by: ${userId || 'system'}`,
      `# Filters: entityType=${filters.entityType || 'all'}, action=${filters.action || 'all'}, dateRange=${filters.startDate || 'beginning'} to ${filters.endDate || 'now'}`,
      '# Platform Version: 1.0.0',
      '# NELC Audit Evidence',
      '',
      'Timestamp,Entity Type,Entity ID,Action,Performed By,IP Address,Metadata',
    ];

    for (const row of rows) {
      const performer = row.performerFirstName
        ? `${row.performerFirstName} ${row.performerLastName || ''}`.trim()
        : 'System';
      const meta = this.sanitizeMetadata(row.metadata as Record<string, unknown> | null);
      const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

      lines.push(
        [
          row.createdAt ? new Date(row.createdAt).toISOString() : '',
          row.entityType,
          row.entityId,
          row.action,
          performer,
          row.ipAddress || '',
          escape(meta),
        ].join(','),
      );
    }

    return lines.join('\n');
  }

  /**
   * NELC-compliant PDF export of audit trail with Gamma Developers branding.
   */
  async exportAuditPdf(
    filters: {
      entityType?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
    userId?: string,
  ): Promise<Buffer> {
    // Fetch all matching rows
    const conditions: any[] = [];
    if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.startDate) conditions.push(gte(auditLogs.createdAt, new Date(filters.startDate)));
    if (filters.endDate) conditions.push(lte(auditLogs.createdAt, new Date(filters.endDate)));
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(auditLogs.action, term),
          ilike(auditLogs.entityType, term),
          sql`${auditLogs.entityId}::text ILIKE ${term}`,
        ),
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        createdAt: auditLogs.createdAt,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        performerFirstName: users.firstName,
        performerLastName: users.lastName,
        ipAddress: auditLogs.ipAddress,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt));

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header with Gamma branding
        doc.font('Helvetica-Bold').fontSize(16)
          .text('PhysioGuidance — Audit Trail Report', 40, 40);
        doc.font('Helvetica').fontSize(8)
          .text('Gamma Developers  |  PhysioGuidance Platform', 40, 58);
        doc.font('Helvetica').fontSize(9)
          .text(`Generated: ${new Date().toISOString()}  |  Generated by: ${userId || 'system'}  |  NELC Audit Evidence`, 40, 70);

        if (filters.startDate || filters.endDate) {
          doc.text(`Date Range: ${filters.startDate || 'beginning'} → ${filters.endDate || 'now'}`, 40, 82);
        }

        doc.moveTo(40, 96).lineTo(800, 96).stroke();

        // Table setup
        const headers = ['Date', 'Entity Type', 'Entity ID', 'Action', 'Performed By', 'IP Address'];
        const colWidths = [130, 90, 200, 130, 120, 90];

        let y = 104;
        const drawHeaders = () => {
          doc.font('Helvetica-Bold').fontSize(8);
          let x = 40;
          headers.forEach((h, i) => {
            doc.text(h, x, y, { width: colWidths[i] });
            x += colWidths[i];
          });
          y += 14;
          doc.moveTo(40, y).lineTo(800, y).stroke();
          y += 4;
        };

        drawHeaders();

        const truncate = (s: string, len: number) =>
          s.length > len ? s.substring(0, len - 1) + '…' : s;

        doc.font('Helvetica').fontSize(7.5);
        for (const row of rows) {
          if (y > 530) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
            y = 40;
            drawHeaders();
            doc.font('Helvetica').fontSize(7.5);
          }

          const performer = row.performerFirstName
            ? `${row.performerFirstName} ${row.performerLastName || ''}`.trim()
            : 'System';

          const cells = [
            row.createdAt ? new Date(row.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '',
            row.entityType,
            truncate(row.entityId, 32),
            row.action,
            performer,
            row.ipAddress || '',
          ];

          let x = 40;
          cells.forEach((cell, i) => {
            doc.text(cell, x, y, { width: colWidths[i] });
            x += colWidths[i];
          });
          y += 13;
        }

        // Footer
        doc.moveTo(40, y + 4).lineTo(800, y + 4).stroke();
        doc.font('Helvetica-Bold').fontSize(8)
          .text(`Total rows: ${rows.length}`, 40, y + 10);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
