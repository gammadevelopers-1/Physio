import { Injectable, Logger } from '@nestjs/common';
import { sql, and, gte, lte, eq, desc } from 'drizzle-orm';
import * as PDFDocument from 'pdfkit';
import { db } from '../../../database';
import { payments, invoices, users, courses } from '../../../database/schema';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  private buildDateConditions(startDate?: string, endDate?: string) {
    const conditions: any[] = [];
    if (startDate) {
      conditions.push(gte(payments.createdAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(payments.createdAt, new Date(endDate)));
    }
    return conditions;
  }

  async getSummary(startDate?: string, endDate?: string) {
    const dateConditions = this.buildDateConditions(startDate, endDate);
    const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const [stats] = await db
      .select({
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        totalPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)`,
        totalRefunds: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        pendingPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'pending' THEN 1 END)`,
        pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'pending' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        failedPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'failed' THEN 1 END)`,
      })
      .from(payments)
      .where(whereClause);

    const totalRevenue = Number(stats?.totalRevenue || 0);
    const totalPayments = Number(stats?.totalPayments || 0);
    const totalRefunds = Number(stats?.totalRefunds || 0);

    return {
      totalRevenue,
      totalPayments,
      totalRefunds,
      netRevenue: totalRevenue - totalRefunds,
      pendingPayments: Number(stats?.pendingPayments || 0),
      pendingAmount: Number(stats?.pendingAmount || 0),
      failedPayments: Number(stats?.failedPayments || 0),
      averageOrderValue: totalPayments > 0 ? totalRevenue / totalPayments : 0,
    };
  }

  async getRevenueBySource(startDate?: string, endDate?: string) {
    const dateConditions = this.buildDateConditions(startDate, endDate);
    const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const results = await db
      .select({
        gateway: payments.gateway,
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        count: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)`,
      })
      .from(payments)
      .where(whereClause)
      .groupBy(payments.gateway);

    return results.map((r) => ({
      gateway: r.gateway,
      totalRevenue: Number(r.totalRevenue),
      count: Number(r.count),
    }));
  }

  async getRevenueTrend(
    period: 'day' | 'week' | 'month' = 'day',
    startDate?: string,
    endDate?: string,
  ): Promise<{ period: string; revenue: number; count: number }[]> {
    const safePeriod = ['day', 'week', 'month'].includes(period) ? period : 'day';
    const conditions: any[] = [eq(payments.status, 'paid' as any)];
    const dateConditions = this.buildDateConditions(startDate, endDate);
    conditions.push(...dateConditions);

    const result = await db
      .select({
        period: sql<string>`date_trunc(${safePeriod}, ${payments.createdAt})::text`,
        revenue: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(payments)
      .where(and(...conditions))
      .groupBy(sql`date_trunc(${safePeriod}, ${payments.createdAt})`)
      .orderBy(sql`date_trunc(${safePeriod}, ${payments.createdAt})`);

    return result.map((r) => ({
      period: r.period,
      revenue: Number(r.revenue),
      count: Number(r.count),
    }));
  }

  async getTopCourses(
    limit: number = 5,
    startDate?: string,
    endDate?: string,
  ): Promise<{ courseId: string; title: string; titleAr: string | null; revenue: number; count: number }[]> {
    const conditions: any[] = [eq(payments.status, 'paid' as any)];
    const dateConditions = this.buildDateConditions(startDate, endDate);
    conditions.push(...dateConditions);

    const result = await db
      .select({
        courseId: payments.courseId,
        title: courses.title,
        titleAr: courses.titleAr,
        revenue: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(and(...conditions))
      .groupBy(payments.courseId, courses.title, courses.titleAr)
      .orderBy(sql`SUM(${payments.amount}::numeric) DESC`)
      .limit(Math.min(limit, 20));

    return result.map((r) => ({
      courseId: r.courseId,
      title: r.title || 'Unknown Course',
      titleAr: r.titleAr,
      revenue: Number(r.revenue),
      count: Number(r.count),
    }));
  }

  async getPaymentStatus(startDate?: string, endDate?: string) {
    const dateConditions = this.buildDateConditions(startDate, endDate);
    const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const results = await db
      .select({
        status: payments.status,
        count: sql<number>`COUNT(*)`,
        totalAmount: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
      })
      .from(payments)
      .where(whereClause)
      .groupBy(payments.status);

    return results.map((r) => ({
      status: r.status,
      count: Number(r.count),
      totalAmount: Number(r.totalAmount),
    }));
  }

  async getRefundRate(startDate?: string, endDate?: string) {
    const dateConditions = this.buildDateConditions(startDate, endDate);
    const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const [stats] = await db
      .select({
        totalPaid: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)`,
        totalRefunded: sql<number>`COUNT(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN 1 END)`,
        refundedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        paidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(payments)
      .where(whereClause);

    const totalPaid = Number(stats?.totalPaid || 0);
    const totalRefunded = Number(stats?.totalRefunded || 0);

    return {
      totalPaid,
      totalRefunded,
      refundRate:
        totalPaid > 0
          ? ((totalRefunded / (totalPaid + totalRefunded)) * 100).toFixed(2)
          : '0.00',
      refundedAmount: Number(stats?.refundedAmount || 0),
      paidAmount: Number(stats?.paidAmount || 0),
    };
  }

  async getInvoiceAging() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [result] = await db
      .select({
        current: sql<number>`COUNT(CASE WHEN ${invoices.status} = 'issued' AND ${invoices.issuedAt} >= ${thirtyDaysAgo} THEN 1 END)`,
        thirtyDay: sql<number>`COUNT(CASE WHEN ${invoices.status} = 'issued' AND ${invoices.issuedAt} < ${thirtyDaysAgo} AND ${invoices.issuedAt} >= ${sixtyDaysAgo} THEN 1 END)`,
        sixtyDay: sql<number>`COUNT(CASE WHEN ${invoices.status} = 'issued' AND ${invoices.issuedAt} < ${sixtyDaysAgo} AND ${invoices.issuedAt} >= ${ninetyDaysAgo} THEN 1 END)`,
        ninetyPlus: sql<number>`COUNT(CASE WHEN ${invoices.status} = 'issued' AND ${invoices.issuedAt} < ${ninetyDaysAgo} THEN 1 END)`,
        paid: sql<number>`COUNT(CASE WHEN ${invoices.status} = 'paid' THEN 1 END)`,
      })
      .from(invoices);

    return {
      current: Number(result?.current || 0),
      thirtyDay: Number(result?.thirtyDay || 0),
      sixtyDay: Number(result?.sixtyDay || 0),
      ninetyPlus: Number(result?.ninetyPlus || 0),
      paid: Number(result?.paid || 0),
    };
  }

  async exportPaymentsCsv(startDate?: string, endDate?: string, status?: string): Promise<string> {
    const conditions: any[] = [];
    if (startDate) {
      conditions.push(gte(payments.createdAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(payments.createdAt, new Date(endDate)));
    }
    if (status) {
      conditions.push(eq(payments.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: payments.id,
        userEmail: users.email,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        courseId: payments.courseId,
        courseTitle: courses.title,
        amount: payments.amount,
        currency: payments.currency,
        gateway: payments.gateway,
        paymentMethod: payments.paymentMethod,
        status: payments.status,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(whereClause)
      .orderBy(desc(payments.createdAt));

    // Build CSV
    const lines: string[] = [];

    // Metadata header
    lines.push(`# PhysioGuidance Payment Export | NELC Compliant`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    if (startDate || endDate) {
      lines.push(`# Date Range: ${startDate || 'beginning'} to ${endDate || 'now'}`);
    }
    if (status) {
      lines.push(`# Status Filter: ${status}`);
    }
    lines.push('');

    // CSV header
    lines.push('PaymentID,UserEmail,UserName,CourseID,CourseTitle,Amount,Currency,Gateway,PaymentMethod,Status,PaidAt,CreatedAt');

    // Data rows
    for (const row of rows) {
      const escapeCsv = (val: any) => {
        if (val == null) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      };

      lines.push([
        escapeCsv(row.id),
        escapeCsv(row.userEmail),
        escapeCsv(row.userName),
        escapeCsv(row.courseId),
        escapeCsv(row.courseTitle),
        escapeCsv(row.amount),
        escapeCsv(row.currency),
        escapeCsv(row.gateway),
        escapeCsv(row.paymentMethod),
        escapeCsv(row.status),
        escapeCsv(row.paidAt ? new Date(row.paidAt).toISOString() : ''),
        escapeCsv(row.createdAt ? new Date(row.createdAt).toISOString() : ''),
      ].join(','));
    }

    return lines.join('\n');
  }

  async exportPaymentsPdf(startDate?: string, endDate?: string, status?: string): Promise<Buffer> {
    const conditions: any[] = [];
    if (startDate) conditions.push(gte(payments.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(payments.createdAt, new Date(endDate)));
    if (status) conditions.push(eq(payments.status, status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: payments.id,
        userEmail: users.email,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        courseTitle: courses.title,
        amount: payments.amount,
        currency: payments.currency,
        gateway: payments.gateway,
        paymentMethod: payments.paymentMethod,
        status: payments.status,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(whereClause)
      .orderBy(desc(payments.createdAt));

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── Header ──
        doc.font('Helvetica-Bold').fontSize(16)
          .text('PhysioGuidance — Payment Report', 40, 40);
        doc.font('Helvetica').fontSize(9)
          .text(`Generated: ${new Date().toISOString()}  |  NELC Audit Evidence`, 40, 62);

        const filterParts: string[] = [];
        if (startDate || endDate) filterParts.push(`Date: ${startDate || 'beginning'} → ${endDate || 'now'}`);
        if (status) filterParts.push(`Status: ${status}`);
        if (filterParts.length) doc.text(`Filters: ${filterParts.join('  |  ')}`, 40, 74);

        doc.moveTo(40, 88).lineTo(800, 88).stroke();

        // ── Column layout ──
        const cols = [
          { label: 'Date', x: 40,  w: 80  },
          { label: 'User Email', x: 125, w: 130 },
          { label: 'Course', x: 260, w: 130 },
          { label: 'Gateway', x: 395, w: 65  },
          { label: 'Method', x: 465, w: 65  },
          { label: 'Amount', x: 535, w: 70  },
          { label: 'Status', x: 610, w: 70  },
          { label: 'Paid At', x: 685, w: 110 },
        ];

        // Table header
        let y = 96;
        doc.font('Helvetica-Bold').fontSize(8);
        for (const col of cols) {
          doc.text(col.label, col.x, y, { width: col.w });
        }
        y += 14;
        doc.moveTo(40, y).lineTo(800, y).stroke();
        y += 4;

        doc.font('Helvetica').fontSize(7.5);
        const truncate = (s: string | null | undefined, len: number) =>
          s && s.length > len ? s.substring(0, len - 1) + '…' : (s || '—');

        for (const row of rows) {
          if (y > 530) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
            y = 40;
            doc.font('Helvetica-Bold').fontSize(8);
            for (const col of cols) doc.text(col.label, col.x, y, { width: col.w });
            y += 14;
            doc.moveTo(40, y).lineTo(800, y).stroke();
            y += 4;
            doc.font('Helvetica').fontSize(7.5);
          }

          const dateStr = row.createdAt
            ? new Date(row.createdAt).toLocaleDateString('en-US')
            : '—';
          const paidStr = row.paidAt
            ? new Date(row.paidAt).toLocaleDateString('en-US')
            : '—';

          doc.text(dateStr,                               cols[0].x, y, { width: cols[0].w });
          doc.text(truncate(row.userEmail, 22),           cols[1].x, y, { width: cols[1].w });
          doc.text(truncate(row.courseTitle, 22),         cols[2].x, y, { width: cols[2].w });
          doc.text(truncate(row.gateway, 10),             cols[3].x, y, { width: cols[3].w });
          doc.text(truncate(row.paymentMethod, 10),       cols[4].x, y, { width: cols[4].w });
          doc.text(`${row.currency} ${row.amount}`,       cols[5].x, y, { width: cols[5].w });
          doc.text(truncate(row.status, 14),              cols[6].x, y, { width: cols[6].w });
          doc.text(paidStr,                               cols[7].x, y, { width: cols[7].w });

          y += 13;
        }

        // ── Footer summary ──
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
