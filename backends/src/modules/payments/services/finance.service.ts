import { Injectable, Logger } from '@nestjs/common';
import { sql, and, gte, lte, eq, desc } from 'drizzle-orm';
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
}
