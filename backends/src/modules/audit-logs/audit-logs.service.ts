import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database';
import { auditLogs, users } from '../../database/schema';
import { eq, and, desc, count, gte, lte, or, ilike, sql, inArray, isNotNull } from 'drizzle-orm';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { RequestContextService } from '../../common/request-context.service';

/**
 * Entity types written by the finance modules (payments, refunds, invoices,
 * discounts, and payment-gateway webhooks). The finance audit log + its
 * filters/exports are scoped to these so a Finance user sees only finance
 * activity. Admins (findAllAdmin) remain unscoped and see every log.
 */
const FINANCE_AUDIT_ENTITY_TYPES = [
  'payment',
  'refund',
  'invoice',
  'discount_code',
  'discount',
  'coupon_campaign',
  'webhook',
  // Reconciliation is owned by finance — finding resolve/ignore/escalate
  // and the escalation lifecycle (claim/send_back/decline/enroll/refund)
  // all need to show up on the finance audit log page. Cron-triggered
  // scans also land here so finance can see "system did the nightly scan".
  'reconciliation_finding',
  'reconciliation_escalation',
  'reconciliation_scan',
  // Meta-audit: when a finance user exports report data or the audit log
  // itself, that download is its own audit row. Lets compliance see who
  // pulled what data and when.
  'report_export',
  'audit_log_export',
];

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
      actorId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      adminOnly?: boolean;
    },
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;
    const conditions = this.buildFinanceConditions(filters);
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
      .where(inArray(auditLogs.entityType, FINANCE_AUDIT_ENTITY_TYPES))
      .orderBy(auditLogs.entityType);

    const actions = await db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .where(inArray(auditLogs.entityType, FINANCE_AUDIT_ENTITY_TYPES))
      .orderBy(auditLogs.action);

    return {
      entityTypes: entityTypes.map((r) => r.entityType),
      actions: actions.map((r) => r.action),
    };
  }

  /**
   * Distinct actors (humans only — `performedBy IS NOT NULL`) who have
   * performed any finance-scoped action. Powers the Actor filter dropdown.
   * System / cron-driven rows (performedBy null) are intentionally excluded
   * — those surface as "System" in the table and don't need a filter entry.
   */
  async getFinanceActors() {
    const rows = await db
      .selectDistinct({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.performedBy, users.id))
      .where(
        and(
          inArray(auditLogs.entityType, FINANCE_AUDIT_ENTITY_TYPES),
          isNotNull(auditLogs.performedBy),
        ),
      )
      .orderBy(users.firstName, users.lastName);

    return rows.map((r) => ({
      id: r.id,
      name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email,
      email: r.email,
    }));
  }

  /**
   * KPI rollup for the Audit Log page header.
   *
   * Returns total events in the window, distinct actor count, and the top
   * 5 actions / entity types by frequency. Single round-trip per metric;
   * runs the same finance-scope filter as the list query so the KPIs
   * always reflect what the operator is looking at.
   */
  async getFinanceSummary(filters: {
    entityType?: string;
    action?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    adminOnly?: boolean;
  }) {
    const conditions = this.buildFinanceConditions(filters);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow, actorsRow] = await Promise.all([
      db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause),
      db
        .select({ count: sql<number>`COUNT(DISTINCT ${auditLogs.performedBy})::int` })
        .from(auditLogs)
        .where(whereClause),
    ]);

    const topActions = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.action)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5);

    const topEntities = await db
      .select({
        entityType: auditLogs.entityType,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.entityType)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5);

    return {
      totalEvents: Number(totalRow[0]?.count || 0),
      uniqueActors: Number(actorsRow[0]?.count || 0),
      topActions: topActions.map((r) => ({ action: r.action, count: Number(r.count) })),
      topEntityTypes: topEntities.map((r) => ({
        entityType: r.entityType,
        count: Number(r.count),
      })),
    };
  }

  /**
   * Shared WHERE-builder for every finance-scope audit query. Keeps the list,
   * summary, CSV, XLSX, and PDF queries from drifting out of sync as the
   * filter set evolves.
   */
  private buildFinanceConditions(filters: {
    entityType?: string;
    action?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    adminOnly?: boolean;
  }) {
    const conditions: any[] = [
      inArray(auditLogs.entityType, FINANCE_AUDIT_ENTITY_TYPES),
    ];
    if (filters.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters.actorId) {
      conditions.push(eq(auditLogs.performedBy, filters.actorId));
    }
    if (filters.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.createdAt, end));
    }
    // Admin-overrides-only: actions written by admin super-actions all share
    // the `_admin_` infix (e.g. payment_status_admin_override,
    // refund_approve_admin_override, gateway_admin_test). Match on that.
    if (filters.adminOnly) {
      conditions.push(ilike(auditLogs.action, '%_admin_%'));
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
    return conditions;
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
      actorId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
    userId?: string,
  ): Promise<string> {
    const whereClause = and(...this.buildFinanceConditions(filters));

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
   * Styling intentionally mirrors the Reports-page PDFs (light grey header
   * band, alternating zebra rows, right-aligned where appropriate) so the
   * finance section feels coherent.
   */
  async exportAuditPdf(
    filters: {
      entityType?: string;
      action?: string;
      actorId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
    userId?: string,
  ): Promise<Buffer> {
    const whereClause = and(...this.buildFinanceConditions(filters));

    const rows = await db
      .select({
        createdAt: auditLogs.createdAt,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        performerFirstName: users.firstName,
        performerLastName: users.lastName,
        performerEmail: users.email,
        ipAddress: auditLogs.ipAddress,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt));

    // Per-column widths sum to 760 (landscape-A4 content). Picks the print-
    // essential columns; CSV/XLSX exports still include every column.
    const colHeaders = ['Date', 'Entity', 'Entity ID', 'Action', 'Performer', 'IP'];
    const colWidths = [130, 90, 180, 150, 130, 80];
    const colX: number[] = [];
    let cursor = 40;
    for (const w of colWidths) {
      colX.push(cursor);
      cursor += w;
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Branding
        doc.font('Helvetica-Bold').fontSize(16)
          .text('PhysioGuidance — Audit Trail Report', 40, 40);
        doc.font('Helvetica').fontSize(8).fillColor('#666666')
          .text('Gamma Developers  |  PhysioGuidance Platform', 40, 58);
        doc.fillColor('#000000').fontSize(9)
          .text(
            `Generated: ${new Date().toISOString()}  |  Generated by: ${userId || 'system'}  |  NELC Audit Evidence`,
            40, 70,
          );
        if (filters.startDate || filters.endDate) {
          doc.text(
            `Date Range: ${filters.startDate || 'beginning'} → ${filters.endDate || 'now'}`,
            40, 82,
          );
        }
        doc.moveTo(40, 96).lineTo(800, 96).stroke('#CCCCCC');

        const drawHeader = (y: number) => {
          doc.rect(40, y - 3, 760, 18).fill('#F3F4F6');
          doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);
          colHeaders.forEach((h, i) => {
            doc.text(h, colX[i] + 4, y + 1, { width: colWidths[i] - 8 });
          });
          doc.fillColor('#000000');
          return y + 18;
        };

        let y = 108;
        y = drawHeader(y);

        const truncate = (s: string | null | undefined, len: number) => {
          const str = String(s ?? '—');
          return str.length > len ? str.substring(0, len - 1) + '…' : str;
        };
        const charBudget = colWidths.map((w) => Math.max(8, Math.floor((w - 8) / 4.2)));

        const ROW_HEIGHT = 16;
        doc.font('Helvetica').fontSize(7.5);
        for (let ri = 0; ri < rows.length; ri++) {
          if (y > 530) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
            y = drawHeader(40);
            doc.font('Helvetica').fontSize(7.5);
          }
          if (ri % 2 === 1) {
            doc.rect(40, y - 2, 760, ROW_HEIGHT).fill('#FAFAFA');
            doc.fillColor('#000000');
          }
          const row = rows[ri];
          const performer = row.performerFirstName
            ? `${row.performerFirstName} ${row.performerLastName || ''}`.trim()
            : 'System';
          const cells = [
            row.createdAt
              ? new Date(row.createdAt).toISOString().replace('T', ' ').substring(0, 19)
              : '',
            row.entityType,
            row.entityId,
            row.action.replace(/_/g, ' '),
            performer,
            row.ipAddress || '',
          ];
          cells.forEach((cell, i) => {
            doc.text(truncate(cell, charBudget[i]), colX[i] + 4, y + 2, {
              width: colWidths[i] - 8,
            });
          });
          y += ROW_HEIGHT;
        }

        // Footer summary
        doc.moveTo(40, y + 4).lineTo(800, y + 4).stroke('#CCCCCC');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151')
          .text(`Total rows: ${rows.length}`, 40, y + 10);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Excel export of the audit trail. Adds a separate Metadata sheet so
   * compliance can pivot on the metadata payload without parsing JSON
   * in the data sheet's wide column.
   */
  async exportAuditXlsx(
    filters: {
      entityType?: string;
      action?: string;
      actorId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
    userId?: string,
  ): Promise<Buffer> {
    const whereClause = and(...this.buildFinanceConditions(filters));

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
        performerEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PhysioGuidance Platform';
    workbook.created = new Date();

    // Metadata sheet (sheet 1) — top-of-file context for the export
    const metaSheet = workbook.addWorksheet('Export Metadata');
    metaSheet.addRow(['PhysioGuidance Platform — Audit Trail Export']);
    metaSheet.addRow(['Generated', new Date().toISOString()]);
    metaSheet.addRow(['Generated by', userId || 'system']);
    metaSheet.addRow(['Date Range', `${filters.startDate || 'all'} to ${filters.endDate || 'all'}`]);
    metaSheet.addRow(['Filters', JSON.stringify(filters)]);
    metaSheet.addRow(['Row Count', rows.length]);
    metaSheet.addRow(['Publisher', 'Gamma Developers']);
    metaSheet.addRow(['Notice', 'Card numbers and emails inside metadata are masked.']);
    metaSheet.getColumn(1).width = 18;
    metaSheet.getColumn(2).width = 60;

    // Data sheet (sheet 2)
    const dataSheet = workbook.addWorksheet('Audit Log');
    const headers = [
      'Timestamp (ISO)',
      'Entity Type',
      'Entity ID',
      'Action',
      'Performer',
      'Performer Email',
      'IP Address',
      'Metadata',
    ];
    const headerRow = dataSheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.alignment = { horizontal: 'center' };
    });

    for (const row of rows) {
      const performer = row.performerFirstName
        ? `${row.performerFirstName} ${row.performerLastName || ''}`.trim()
        : 'System';
      dataSheet.addRow([
        row.createdAt ? new Date(row.createdAt).toISOString() : '',
        row.entityType,
        row.entityId,
        row.action,
        performer,
        row.performerEmail || '',
        row.ipAddress || '',
        this.sanitizeMetadata(row.metadata as Record<string, unknown> | null),
      ]);
    }

    // Reasonable column widths — metadata column wide enough to be useful
    // but capped so the sheet isn't horizontal-scroll only.
    const widths = [24, 18, 38, 28, 24, 28, 16, 60];
    dataSheet.columns.forEach((col, i) => {
      col.width = widths[i] || 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
