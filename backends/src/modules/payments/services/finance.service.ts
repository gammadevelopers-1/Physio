import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { sql, and, gte, lte, eq, desc } from 'drizzle-orm';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { db } from '../../../database';
import { payments, invoices, users, courses } from '../../../database/schema';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private readonly platformFeePercent = 15; // Platform fee percentage — configurable later

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

  private computeTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  async getSummary(startDate?: string, endDate?: string) {
    const dateConditions = this.buildDateConditions(startDate, endDate);
    const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const selectFields = {
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      totalPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)`,
      totalRefunds: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      pendingPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'pending' THEN 1 END)`,
      pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'pending' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      failedPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'failed' THEN 1 END)`,
    };

    const [stats] = await db
      .select(selectFields)
      .from(payments)
      .where(whereClause);

    const totalRevenue = Number(stats?.totalRevenue || 0);
    const totalPayments = Number(stats?.totalPayments || 0);
    const totalRefunds = Number(stats?.totalRefunds || 0);
    const averageOrderValue = totalPayments > 0 ? totalRevenue / totalPayments : 0;

    // Compute previous period for trend comparison
    let revenueTrend = 0;
    let avgOrderTrend = 0;
    let refundRateTrend = 0;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1); // day before current start
      const prevStart = new Date(prevEnd.getTime() - durationMs);

      const prevConditions = [
        gte(payments.createdAt, prevStart),
        lte(payments.createdAt, prevEnd),
      ];

      const [prevStats] = await db
        .select(selectFields)
        .from(payments)
        .where(and(...prevConditions));

      const prevRevenue = Number(prevStats?.totalRevenue || 0);
      const prevPayments = Number(prevStats?.totalPayments || 0);
      const prevRefunds = Number(prevStats?.totalRefunds || 0);
      const prevAvgOrder = prevPayments > 0 ? prevRevenue / prevPayments : 0;
      const currentRefundRate = totalPayments > 0 ? (totalRefunds / totalRevenue) * 100 : 0;
      const prevRefundRate = prevPayments > 0 ? (prevRefunds / prevRevenue) * 100 : 0;

      revenueTrend = this.computeTrend(totalRevenue, prevRevenue);
      avgOrderTrend = this.computeTrend(averageOrderValue, prevAvgOrder);
      refundRateTrend = Number((currentRefundRate - prevRefundRate).toFixed(1));
    }

    return {
      totalRevenue,
      totalPayments,
      totalRefunds,
      netRevenue: totalRevenue - totalRefunds,
      pendingPayments: Number(stats?.pendingPayments || 0),
      pendingAmount: Number(stats?.pendingAmount || 0),
      failedPayments: Number(stats?.failedPayments || 0),
      averageOrderValue,
      revenueTrend,
      avgOrderTrend,
      refundRateTrend,
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

  async getInvoiceAging(startDate?: string, endDate?: string) {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const d60 = new Date(now.getTime() - 60 * 86400000);
    const d90 = new Date(now.getTime() - 90 * 86400000);

    const conditions: any[] = [];
    if (startDate) conditions.push(gte(invoices.issuedAt, new Date(startDate)));
    if (endDate) conditions.push(lte(invoices.issuedAt, new Date(endDate)));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Use dueDate for aging (fall back to issuedAt if dueDate is null)
    const ageDate = sql`COALESCE(${invoices.dueDate}, ${invoices.issuedAt})`;
    const outstanding = sql`${invoices.status} IN ('issued', 'overdue')`;

    const [result] = await db
      .select({
        currentCount: sql<number>`COUNT(CASE WHEN ${outstanding} AND ${ageDate} >= ${d30} THEN 1 END)`,
        currentAmount: sql<string>`COALESCE(SUM(CASE WHEN ${outstanding} AND ${ageDate} >= ${d30} THEN ${invoices.totalAmount}::numeric ELSE 0 END), 0)`,
        thirtyDayCount: sql<number>`COUNT(CASE WHEN ${outstanding} AND ${ageDate} < ${d30} AND ${ageDate} >= ${d60} THEN 1 END)`,
        thirtyDayAmount: sql<string>`COALESCE(SUM(CASE WHEN ${outstanding} AND ${ageDate} < ${d30} AND ${ageDate} >= ${d60} THEN ${invoices.totalAmount}::numeric ELSE 0 END), 0)`,
        sixtyDayCount: sql<number>`COUNT(CASE WHEN ${outstanding} AND ${ageDate} < ${d60} AND ${ageDate} >= ${d90} THEN 1 END)`,
        sixtyDayAmount: sql<string>`COALESCE(SUM(CASE WHEN ${outstanding} AND ${ageDate} < ${d60} AND ${ageDate} >= ${d90} THEN ${invoices.totalAmount}::numeric ELSE 0 END), 0)`,
        ninetyPlusCount: sql<number>`COUNT(CASE WHEN ${outstanding} AND ${ageDate} < ${d90} THEN 1 END)`,
        ninetyPlusAmount: sql<string>`COALESCE(SUM(CASE WHEN ${outstanding} AND ${ageDate} < ${d90} THEN ${invoices.totalAmount}::numeric ELSE 0 END), 0)`,
        paidCount: sql<number>`COUNT(CASE WHEN ${invoices.status} = 'paid' THEN 1 END)`,
        paidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.totalAmount}::numeric ELSE 0 END), 0)`,
      })
      .from(invoices)
      .where(whereClause);

    return {
      current: { count: Number(result?.currentCount || 0), amount: Number(result?.currentAmount || 0) },
      thirtyDay: { count: Number(result?.thirtyDayCount || 0), amount: Number(result?.thirtyDayAmount || 0) },
      sixtyDay: { count: Number(result?.sixtyDayCount || 0), amount: Number(result?.sixtyDayAmount || 0) },
      ninetyPlus: { count: Number(result?.ninetyPlusCount || 0), amount: Number(result?.ninetyPlusAmount || 0) },
      paid: { count: Number(result?.paidCount || 0), amount: Number(result?.paidAmount || 0) },
    };
  }

  async getRevenueByCourse(startDate?: string, endDate?: string) {
    const dateConditions = this.buildDateConditions(startDate, endDate);
    const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const result = await db
      .select({
        courseId: payments.courseId,
        title: courses.title,
        titleAr: courses.titleAr,
        revenue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        refundAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        enrollmentCount: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)::int`,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(whereClause)
      .groupBy(payments.courseId, courses.title, courses.titleAr)
      .orderBy(sql`SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END) DESC`);

    return result.map((r) => {
      const revenue = Number(r.revenue);
      const refundAmount = Number(r.refundAmount);
      const netRevenue = revenue - refundAmount;
      return {
        courseId: r.courseId,
        title: r.title || 'Unknown Course',
        titleAr: r.titleAr,
        revenue,
        refundAmount,
        netRevenue,
        marginPercent: revenue > 0 ? Number(((netRevenue / revenue) * 100).toFixed(2)) : 0,
        enrollmentCount: Number(r.enrollmentCount),
      };
    });
  }

  async getRevenueByInstructor(startDate?: string, endDate?: string) {
    const dateConditions = this.buildDateConditions(startDate, endDate);
    const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const result = await db
      .select({
        instructorId: courses.instructorId,
        instructorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        courseCount: sql<number>`COUNT(DISTINCT ${payments.courseId})::int`,
        revenue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        refundAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        enrollmentCount: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)::int`,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .leftJoin(users, eq(courses.instructorId, users.id))
      .where(whereClause)
      .groupBy(courses.instructorId, users.firstName, users.lastName)
      .orderBy(sql`SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END) DESC`);

    return result.map((r) => {
      const revenue = Number(r.revenue);
      const refundAmount = Number(r.refundAmount);
      const netRevenue = revenue - refundAmount;
      const platformFee = Number((netRevenue * (this.platformFeePercent / 100)).toFixed(2));
      const netPayout = Number((netRevenue - platformFee).toFixed(2));
      return {
        instructorId: r.instructorId,
        instructorName: r.instructorName,
        courseCount: Number(r.courseCount),
        revenue,
        refundAmount,
        netRevenue,
        platformFee,
        netPayout,
        enrollmentCount: Number(r.enrollmentCount),
      };
    });
  }

  async getRevenueByDeliveryType(startDate?: string, endDate?: string) {
    const dateConditions = this.buildDateConditions(startDate, endDate);
    const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const result = await db
      .select({
        deliveryType: courses.deliveryType,
        revenue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        refundAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        enrollmentCount: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)::int`,
        courseCount: sql<number>`COUNT(DISTINCT ${payments.courseId})::int`,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(whereClause)
      .groupBy(courses.deliveryType)
      .orderBy(sql`SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END) DESC`);

    return result.map((r) => {
      const revenue = Number(r.revenue);
      const refundAmount = Number(r.refundAmount);
      const netRevenue = revenue - refundAmount;
      return {
        deliveryType: r.deliveryType || 'unknown',
        revenue,
        refundAmount,
        netRevenue,
        marginPercent: revenue > 0 ? Number(((netRevenue / revenue) * 100).toFixed(2)) : 0,
        enrollmentCount: Number(r.enrollmentCount),
        courseCount: Number(r.courseCount),
      };
    });
  }

  async getChargebackRate(startDate?: string, endDate?: string) {
    const dateConditions = this.buildDateConditions(startDate, endDate);
    const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;

    const [totals] = await db
      .select({
        totalTransactions: sql<number>`COUNT(*)::int`,
        chargebackCount: sql<number>`COUNT(CASE WHEN ${payments.status} = 'chargeback' THEN 1 END)::int`,
        chargebackAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'chargeback' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(payments)
      .where(whereClause);

    const chargebackConditions: any[] = [eq(payments.status, 'chargeback' as any)];
    if (dateConditions.length > 0) chargebackConditions.push(...dateConditions);

    const breakdown = await db
      .select({
        courseId: payments.courseId,
        courseTitle: courses.title,
        gateway: payments.gateway,
        chargebackCount: sql<number>`COUNT(*)::int`,
        chargebackAmount: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(and(...chargebackConditions))
      .groupBy(payments.courseId, courses.title, payments.gateway)
      .orderBy(sql`COUNT(*) DESC`);

    const totalTransactions = Number(totals?.totalTransactions || 0);
    const chargebackCount = Number(totals?.chargebackCount || 0);

    return {
      chargebackCount,
      chargebackAmount: Number(totals?.chargebackAmount || 0),
      totalTransactions,
      chargebackRate: totalTransactions > 0
        ? ((chargebackCount / totalTransactions) * 100).toFixed(4)
        : '0.0000',
      breakdown: breakdown.map((r) => ({
        courseId: r.courseId,
        courseTitle: r.courseTitle || 'Unknown',
        gateway: r.gateway,
        chargebackCount: Number(r.chargebackCount),
        chargebackAmount: Number(r.chargebackAmount),
      })),
    };
  }

  private readonly csvHeaders: Record<string, Record<string, string>> = {
    en: {
      paymentId: 'PaymentID', userEmail: 'UserEmail', userName: 'UserName',
      courseId: 'CourseID', courseTitle: 'CourseTitle', amount: 'Amount',
      currency: 'Currency', gateway: 'Gateway', paymentMethod: 'PaymentMethod',
      status: 'Status', paidAt: 'PaidAt', createdAt: 'CreatedAt',
    },
    ar: {
      paymentId: 'معرّف الدفع', userEmail: 'البريد الإلكتروني', userName: 'اسم المستخدم',
      courseId: 'معرّف الدورة', courseTitle: 'عنوان الدورة', amount: 'المبلغ',
      currency: 'العملة', gateway: 'البوابة', paymentMethod: 'طريقة الدفع',
      status: 'الحالة', paidAt: 'تاريخ الدفع', createdAt: 'تاريخ الإنشاء',
    },
  };

  private readonly pdfHeaders: Record<string, Record<string, string>> = {
    en: {
      date: 'Date', userEmail: 'User Email', course: 'Course',
      gateway: 'Gateway', method: 'Method', amount: 'Amount',
      status: 'Status', paidAt: 'Paid At',
    },
    ar: {
      date: 'التاريخ', userEmail: 'البريد الإلكتروني', course: 'الدورة',
      gateway: 'البوابة', method: 'الطريقة', amount: 'المبلغ',
      status: 'الحالة', paidAt: 'تاريخ الدفع',
    },
  };

  async exportPaymentsCsv(startDate?: string, endDate?: string, status?: string, userId?: string, locale?: string): Promise<string> {
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
    lines.push(`# Generated by: ${userId || 'system'}`);
    if (startDate || endDate) {
      lines.push(`# Date Range: ${startDate || 'beginning'} to ${endDate || 'now'}`);
    }
    if (status) {
      lines.push(`# Status Filter: ${status}`);
    }
    lines.push(`# Platform Version: 1.0.0`);
    lines.push('');

    // CSV header
    const h = this.csvHeaders[locale === 'ar' ? 'ar' : 'en'];
    lines.push([h.paymentId, h.userEmail, h.userName, h.courseId, h.courseTitle, h.amount, h.currency, h.gateway, h.paymentMethod, h.status, h.paidAt, h.createdAt].join(','));

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

  async exportPaymentsPdf(startDate?: string, endDate?: string, status?: string, userId?: string, locale?: string): Promise<Buffer> {
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
        doc.font('Helvetica').fontSize(8)
          .text('Gamma Developers  |  PhysioGuidance Platform', 40, 58);
        doc.font('Helvetica').fontSize(9)
          .text(`Generated: ${new Date().toISOString()}  |  Generated by: ${userId || 'system'}  |  NELC Audit Evidence`, 40, 70);

        const filterParts: string[] = [];
        if (startDate || endDate) filterParts.push(`Date: ${startDate || 'beginning'} → ${endDate || 'now'}`);
        if (status) filterParts.push(`Status: ${status}`);
        if (filterParts.length) doc.text(`Filters: ${filterParts.join('  |  ')}`, 40, 82);

        doc.moveTo(40, 96).lineTo(800, 96).stroke();

        // ── Column layout ──
        const ph = this.pdfHeaders[locale === 'ar' ? 'ar' : 'en'];
        const cols = [
          { label: ph.date, x: 40,  w: 80  },
          { label: ph.userEmail, x: 125, w: 130 },
          { label: ph.course, x: 260, w: 130 },
          { label: ph.gateway, x: 395, w: 65  },
          { label: ph.method, x: 465, w: 65  },
          { label: ph.amount, x: 535, w: 70  },
          { label: ph.status, x: 610, w: 70  },
          { label: ph.paidAt, x: 685, w: 110 },
        ];

        // Table header
        let y = 104;
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

  async exportReport(
    reportType: string,
    format: string,
    startDate?: string,
    endDate?: string,
    userId?: string,
  ): Promise<Buffer | string> {
    // Fetch data based on report type
    const { title, headers, rows } = await this.getReportData(reportType, startDate, endDate);

    switch (format) {
      case 'xlsx':
        return this.buildExcelExport(title, headers, rows, reportType, startDate, endDate, userId);
      case 'pdf':
        return this.buildPdfExport(title, headers, rows, reportType, startDate, endDate, userId);
      default:
        return this.buildCsvExport(title, headers, rows, reportType, startDate, endDate, userId);
    }
  }

  private async getReportData(
    reportType: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ title: string; headers: string[]; rows: (string | number)[][] }> {
    switch (reportType) {
      case 'profitByCourse': {
        const data = await this.getRevenueByCourse(startDate, endDate);
        return {
          title: 'Profitability by Course',
          headers: ['Course', 'Revenue (SAR)', 'Refunds (SAR)', 'Net Profit (SAR)', 'Margin %', 'Enrollments'],
          rows: data.map((r) => [r.title, r.revenue, r.refundAmount, r.netRevenue, r.marginPercent, r.enrollmentCount]),
        };
      }
      case 'profitByInstructor': {
        const data = await this.getRevenueByInstructor(startDate, endDate);
        return {
          title: 'Profitability by Instructor',
          headers: ['Instructor', 'Courses', 'Revenue (SAR)', 'Refunds (SAR)', 'Net Profit (SAR)', 'Enrollments'],
          rows: data.map((r) => [r.instructorName, r.courseCount, r.revenue, r.refundAmount, r.netRevenue, r.enrollmentCount]),
        };
      }
      case 'profitByDelivery': {
        const data = await this.getRevenueByDeliveryType(startDate, endDate);
        return {
          title: 'Profitability by Delivery Type',
          headers: ['Delivery Type', 'Revenue (SAR)', 'Refunds (SAR)', 'Net Profit (SAR)', 'Margin %', 'Courses', 'Enrollments'],
          rows: data.map((r) => [r.deliveryType, r.revenue, r.refundAmount, r.netRevenue, r.marginPercent, r.courseCount, r.enrollmentCount]),
        };
      }
      case 'invoiceAging': {
        const data = await this.getInvoiceAging(startDate, endDate);
        return {
          title: 'Invoice Aging Report',
          headers: ['Age Bucket', 'Count', 'Amount (SAR)'],
          rows: [
            ['0-30 Days', data.current.count, data.current.amount],
            ['31-60 Days', data.thirtyDay.count, data.thirtyDay.amount],
            ['61-90 Days', data.sixtyDay.count, data.sixtyDay.amount],
            ['90+ Days', data.ninetyPlus.count, data.ninetyPlus.amount],
            ['Paid', data.paid.count, data.paid.amount],
          ],
        };
      }
      case 'chargeback': {
        const data = await this.getChargebackRate(startDate, endDate);
        return {
          title: 'Chargeback Rate Report',
          headers: ['Course', 'Gateway', 'Count', 'Amount (SAR)'],
          rows: data.breakdown.map((r) => [r.courseTitle, r.gateway, r.chargebackCount, r.chargebackAmount]),
        };
      }
      default:
        throw new BadRequestException(`Unknown report type: ${reportType}`);
    }
  }

  private async buildExcelExport(
    title: string,
    headers: string[],
    rows: (string | number)[][],
    reportType: string,
    startDate?: string,
    endDate?: string,
    userId?: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PhysioGuidance Platform';
    workbook.created = new Date();

    // Metadata sheet
    const metaSheet = workbook.addWorksheet('Metadata');
    metaSheet.addRow(['PhysioGuidance Platform — Financial Report']);
    metaSheet.addRow(['Report', title]);
    metaSheet.addRow(['Generated', new Date().toISOString()]);
    metaSheet.addRow(['Generated by', userId || 'system']);
    metaSheet.addRow(['Date Range', `${startDate || 'all'} to ${endDate || 'all'}`]);
    metaSheet.addRow(['Platform Version', '1.0.0']);
    metaSheet.addRow(['Publisher', 'Gamma Developers']);
    metaSheet.getColumn(1).width = 20;
    metaSheet.getColumn(2).width = 50;

    // Data sheet
    const dataSheet = workbook.addWorksheet('Report Data');

    // Header row with bold styling
    const headerRow = dataSheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.alignment = { horizontal: 'center' };
    });

    // Data rows
    for (const row of rows) {
      const dataRow = dataSheet.addRow(row);
      dataRow.eachCell((cell, colIdx) => {
        // Right-align numeric columns
        if (typeof row[colIdx - 1] === 'number') {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        }
      });
    }

    // Auto-width columns
    dataSheet.columns.forEach((col) => {
      let maxLen = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value || '').length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 4, 40);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private buildCsvExport(
    title: string,
    headers: string[],
    rows: (string | number)[][],
    reportType: string,
    startDate?: string,
    endDate?: string,
    userId?: string,
  ): string {
    const lines: string[] = [];

    // NELC metadata header
    lines.push(`# PhysioGuidance Platform — ${title}`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push(`# Generated by: ${userId || 'system'}`);
    lines.push(`# Report Type: ${reportType}`);
    lines.push(`# Date Range: ${startDate || 'all'} to ${endDate || 'all'}`);
    lines.push(`# Platform Version: 1.0.0`);
    lines.push('');

    // CSV content
    const escapeCsv = (val: any) => {
      if (val == null) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    lines.push(headers.map(escapeCsv).join(','));
    for (const row of rows) {
      lines.push(row.map(escapeCsv).join(','));
    }

    return lines.join('\n');
  }

  private buildPdfExport(
    title: string,
    headers: string[],
    rows: (string | number)[][],
    reportType: string,
    startDate?: string,
    endDate?: string,
    userId?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header with Gamma branding
        doc.font('Helvetica-Bold').fontSize(16)
          .text(`PhysioGuidance — ${title}`, 40, 40);
        doc.font('Helvetica').fontSize(8)
          .text('Gamma Developers  |  PhysioGuidance Platform', 40, 58);
        doc.font('Helvetica').fontSize(9)
          .text(`Generated: ${new Date().toISOString()}  |  Generated by: ${userId || 'system'}  |  NELC Audit Evidence`, 40, 70);

        if (startDate || endDate) {
          doc.text(`Date Range: ${startDate || 'beginning'} → ${endDate || 'now'}`, 40, 82);
        }

        doc.moveTo(40, 96).lineTo(800, 96).stroke();

        // Calculate column widths
        const colCount = headers.length;
        const totalWidth = 760;
        const colWidth = Math.floor(totalWidth / colCount);

        // Table header
        let y = 104;
        doc.font('Helvetica-Bold').fontSize(8);
        headers.forEach((h, i) => {
          doc.text(h, 40 + i * colWidth, y, { width: colWidth });
        });
        y += 14;
        doc.moveTo(40, y).lineTo(800, y).stroke();
        y += 4;

        // Data rows
        doc.font('Helvetica').fontSize(7.5);
        const truncate = (s: string | number | null | undefined, len: number) => {
          const str = String(s ?? '—');
          return str.length > len ? str.substring(0, len - 1) + '…' : str;
        };

        for (const row of rows) {
          if (y > 530) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
            y = 40;
            doc.font('Helvetica-Bold').fontSize(8);
            headers.forEach((h, i) => {
              doc.text(h, 40 + i * colWidth, y, { width: colWidth });
            });
            y += 14;
            doc.moveTo(40, y).lineTo(800, y).stroke();
            y += 4;
            doc.font('Helvetica').fontSize(7.5);
          }

          row.forEach((cell, i) => {
            const val = typeof cell === 'number' ? cell.toLocaleString('en-US', { maximumFractionDigits: 2 }) : truncate(cell, 30);
            doc.text(val, 40 + i * colWidth, y, { width: colWidth });
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
