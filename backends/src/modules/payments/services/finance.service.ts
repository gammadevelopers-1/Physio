import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { sql, and, gte, lte, eq, desc, or, ilike, inArray, asc, isNotNull } from 'drizzle-orm';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { db } from '../../../database';
import {
  payments,
  invoices,
  users,
  courses,
  paymentReceipts,
  refunds,
  sessions,
  webinarRegistrations,
  auditLogs,
} from '../../../database/schema';
import { isNull } from 'drizzle-orm';
import { parseStartDate, parseEndDate } from '../../../common/date-range';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private readonly platformFeePercent = 15; // Platform fee percentage — configurable later

  private buildDateConditions(startDate?: string, endDate?: string) {
    const conditions: any[] = [];
    const start = parseStartDate(startDate);
    const end = parseEndDate(endDate);
    if (start) conditions.push(gte(payments.createdAt, start));
    if (end) conditions.push(lte(payments.createdAt, end));
    return conditions;
  }

  /**
   * Date conditions anchored on paidAt — the moment the money was recognised.
   * Use for revenue/gateway/top-course/trend queries so a bank transfer
   * created weeks ago but approved today shows up in today's revenue, not
   * in the original creation window. Falls back to createdAt for rows
   * where paidAt is null (which shouldn't happen for paid rows but is
   * defensive).
   */
  private buildPaidAtConditions(startDate?: string, endDate?: string) {
    const conditions: any[] = [];
    const start = parseStartDate(startDate);
    const end = parseEndDate(endDate);
    if (start) {
      conditions.push(
        sql`COALESCE(${payments.paidAt}, ${payments.createdAt}) >= ${start}`,
      );
    }
    if (end) {
      conditions.push(
        sql`COALESCE(${payments.paidAt}, ${payments.createdAt}) <= ${end}`,
      );
    }
    return conditions;
  }

  private computeTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  async getSummary(startDate?: string, endDate?: string) {
    // Two queries — paid/refunded revenue uses paidAt window (when money
    // was recognised); pending/failed/attempts use createdAt window (when
    // activity happened). This fixes the case where a bank transfer is
    // created weeks ago but approved today: today's window must include it.
    const paidConditions = this.buildPaidAtConditions(startDate, endDate);
    const activityConditions = this.buildDateConditions(startDate, endDate);
    const paidWhere = paidConditions.length > 0 ? and(...paidConditions) : undefined;
    const activityWhere = activityConditions.length > 0 ? and(...activityConditions) : undefined;

    const paidSelect = {
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      totalPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)`,
      totalRefunds: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
    };

    const activitySelect = {
      pendingPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'pending' THEN 1 END)`,
      pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'pending' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      awaitingApprovalCount: sql<number>`COUNT(CASE WHEN ${payments.status} = 'awaiting_approval' THEN 1 END)`,
      awaitingApprovalAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'awaiting_approval' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      failedPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'failed' THEN 1 END)`,
      totalAttempts: sql<number>`COUNT(*)`,
    };

    const [paidStats] = await db.select(paidSelect).from(payments).where(paidWhere);
    const [activityStats] = await db
      .select(activitySelect)
      .from(payments)
      .where(activityWhere);

    const totalRevenue = Number(paidStats?.totalRevenue || 0);
    const totalPayments = Number(paidStats?.totalPayments || 0);
    const totalRefunds = Number(paidStats?.totalRefunds || 0);
    const averageOrderValue = totalPayments > 0 ? totalRevenue / totalPayments : 0;

    // Previous-period comparison — same dual-window approach
    let revenueTrend = 0;
    let avgOrderTrend = 0;
    let refundRateTrend = 0;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - durationMs);

      const prevPaidConditions = this.buildPaidAtConditions(
        prevStart.toISOString(),
        prevEnd.toISOString(),
      );

      const [prevPaidStats] = await db
        .select(paidSelect)
        .from(payments)
        .where(and(...prevPaidConditions));

      const prevRevenue = Number(prevPaidStats?.totalRevenue || 0);
      const prevPayments = Number(prevPaidStats?.totalPayments || 0);
      const prevRefunds = Number(prevPaidStats?.totalRefunds || 0);
      const prevAvgOrder = prevPayments > 0 ? prevRevenue / prevPayments : 0;
      const currentRefundRate = totalRevenue > 0 ? (totalRefunds / totalRevenue) * 100 : 0;
      const prevRefundRate = prevRevenue > 0 ? (prevRefunds / prevRevenue) * 100 : 0;

      revenueTrend = this.computeTrend(totalRevenue, prevRevenue);
      avgOrderTrend = this.computeTrend(averageOrderValue, prevAvgOrder);
      refundRateTrend = Number((currentRefundRate - prevRefundRate).toFixed(1));
    }

    const failedPayments = Number(activityStats?.failedPayments || 0);
    const awaitingApprovalCount = Number(activityStats?.awaitingApprovalCount || 0);
    const awaitingApprovalAmount = Number(activityStats?.awaitingApprovalAmount || 0);
    const totalAttempts = Number(activityStats?.totalAttempts || 0);
    const decidedAttempts = totalPayments + failedPayments;
    const successRate =
      decidedAttempts > 0
        ? Number(((totalPayments / decidedAttempts) * 100).toFixed(2))
        : 0;
    const failedRate =
      totalAttempts > 0 ? Number(((failedPayments / totalAttempts) * 100).toFixed(2)) : 0;

    return {
      totalRevenue,
      totalPayments,
      totalRefunds,
      netRevenue: totalRevenue - totalRefunds,
      pendingPayments: Number(activityStats?.pendingPayments || 0),
      pendingAmount: Number(activityStats?.pendingAmount || 0),
      awaitingApprovalCount,
      awaitingApprovalAmount,
      failedPayments,
      totalAttempts,
      successRate,
      failedRate,
      averageOrderValue,
      revenueTrend,
      avgOrderTrend,
      refundRateTrend,
    };
  }

  // ============================================================
  //  REPORTS (Reports page) — 8 typed datasets used by both the
  //  preview JSON endpoints and the CSV/XLSX/PDF export pipeline.
  //  These are deliberately additive to the older analytics methods
  //  (getRevenueByCourse, getRevenueByInstructor, …) which keep
  //  feeding the Overview page KPI widgets.
  // ============================================================

  /** 1. Revenue — totals + gateway split + daily trend in one payload. */
  async getReportRevenue(opts: { startDate?: string; endDate?: string; gateway?: string }) {
    const { startDate, endDate, gateway } = opts;
    const paidConds: any[] = [
      eq(payments.status, 'paid' as any),
      ...this.buildPaidAtConditions(startDate, endDate),
    ];
    if (gateway && gateway !== 'all') paidConds.push(eq(payments.gateway, gateway));

    const refundedConds: any[] = [
      sql`${payments.status} IN ('refunded','partially_refunded')`,
      ...this.buildPaidAtConditions(startDate, endDate),
    ];
    if (gateway && gateway !== 'all') refundedConds.push(eq(payments.gateway, gateway));

    const [byGateway, byMethod, totalsRow, refundsRow, vatRow] = await Promise.all([
      db
        .select({
          gateway: payments.gateway,
          count: sql<number>`COUNT(*)::int`,
          gross: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
        })
        .from(payments)
        .where(and(...paidConds))
        .groupBy(payments.gateway)
        .orderBy(sql`SUM(${payments.amount}::numeric) DESC`),
      db
        .select({
          method: payments.paymentMethod,
          count: sql<number>`COUNT(*)::int`,
          gross: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
        })
        .from(payments)
        .where(and(...paidConds))
        .groupBy(payments.paymentMethod)
        .orderBy(sql`SUM(${payments.amount}::numeric) DESC`),
      db
        .select({
          gross: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(payments)
        .where(and(...paidConds)),
      db
        .select({
          refunds: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
        })
        .from(payments)
        .where(and(...refundedConds)),
      db
        .select({
          vat: sql<string>`COALESCE(SUM(${invoices.taxAmount}::numeric), 0)`,
        })
        .from(invoices)
        .leftJoin(payments, eq(invoices.paymentId, payments.id))
        .where(and(...paidConds)),
    ]);

    const gross = Number(totalsRow[0]?.gross || 0);
    const refundsAmt = Number(refundsRow[0]?.refunds || 0);
    const vat = Number(vatRow[0]?.vat || 0);

    return {
      totals: {
        gross,
        refunds: refundsAmt,
        net: gross - refundsAmt,
        vat,
        count: Number(totalsRow[0]?.count || 0),
      },
      byGateway: byGateway.map((r) => ({
        gateway: r.gateway,
        count: Number(r.count),
        gross: Number(r.gross),
      })),
      byMethod: byMethod.map((r) => ({
        method: r.method,
        count: Number(r.count),
        gross: Number(r.gross),
      })),
    };
  }

  /** 2. Refunds — transactional list grouped by status/reason/agent. */
  async getReportRefunds(opts: {
    startDate?: string;
    endDate?: string;
    status?: string;
    gateway?: string;
    reason?: string;
  }) {
    const { startDate, endDate, status, gateway, reason } = opts;
    const conds: any[] = [];
    if (startDate) conds.push(gte(refunds.createdAt, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conds.push(lte(refunds.createdAt, end));
    }
    if (status && status !== 'all') conds.push(eq(refunds.status, status));
    if (reason && reason !== 'all') conds.push(eq(refunds.reason, reason));
    if (gateway && gateway !== 'all') conds.push(eq(payments.gateway, gateway));

    const rows = await db
      .select({
        id: refunds.id,
        requesterName: sql<string>`CONCAT(requester.first_name, ' ', requester.last_name)`,
        requesterEmail: sql<string>`requester.email`,
        processedByName: sql<string>`CASE WHEN processor.id IS NULL THEN NULL ELSE CONCAT(processor.first_name, ' ', processor.last_name) END`,
        courseTitle: courses.title,
        gateway: payments.gateway,
        reason: refunds.reason,
        reasonNote: refunds.reasonNote,
        originalAmount: refunds.originalAmount,
        refundAmount: refunds.refundAmount,
        deductionAmount: refunds.deductionAmount,
        status: refunds.status,
        createdAt: refunds.createdAt,
        approvedAt: refunds.approvedAt,
        completedAt: refunds.completedAt,
      })
      .from(refunds)
      .leftJoin(sql`${users} AS requester`, eq(refunds.requestedBy, sql`requester.id`))
      .leftJoin(sql`${users} AS processor`, eq(refunds.processedBy, sql`processor.id`))
      .leftJoin(payments, eq(refunds.paymentId, payments.id))
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(refunds.createdAt));

    return rows.map((r) => ({
      ...r,
      originalAmount: Number(r.originalAmount),
      refundAmount: Number(r.refundAmount),
      deductionAmount: Number(r.deductionAmount),
    }));
  }

  /** 3. Payments — full transactional ledger with rich filters. */
  async getReportPayments(opts: {
    startDate?: string;
    endDate?: string;
    gateway?: string;
    status?: string;
    method?: string;
  }) {
    const { startDate, endDate, gateway, status, method } = opts;
    const conds: any[] = [];
    if (startDate) conds.push(gte(payments.createdAt, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conds.push(lte(payments.createdAt, end));
    }
    if (gateway && gateway !== 'all') conds.push(eq(payments.gateway, gateway));
    if (status && status !== 'all') conds.push(eq(payments.status, status));
    if (method && method !== 'all') conds.push(eq(payments.paymentMethod, method));

    const rows = await db
      .select({
        id: payments.id,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        userEmail: users.email,
        courseTitle: courses.title,
        gateway: payments.gateway,
        paymentMethod: payments.paymentMethod,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        gatewayChargeId: payments.gatewayChargeId,
        createdAt: payments.createdAt,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(payments.createdAt))
      .limit(1000);

    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  /** 4. Course Sales — units × gross × refunds × net per course. */
  async getReportCourseSales(opts: {
    startDate?: string;
    endDate?: string;
    courseId?: string;
    deliveryType?: string;
  }) {
    const { startDate, endDate, courseId, deliveryType } = opts;
    const paidConds: any[] = [
      eq(payments.status, 'paid' as any),
      ...this.buildPaidAtConditions(startDate, endDate),
    ];
    if (courseId) paidConds.push(eq(payments.courseId, courseId));
    if (deliveryType && deliveryType !== 'all') {
      paidConds.push(eq(courses.deliveryType, deliveryType));
    }

    const rows = await db
      .select({
        courseId: courses.id,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        deliveryType: courses.deliveryType,
        units: sql<number>`COUNT(*)::int`,
        gross: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
        refunds: sql<string>`COALESCE((SELECT SUM(refund_amount::numeric) FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE course_id = ${courses.id} AND status IN ('refunded','partially_refunded'))), 0)`,
      })
      .from(payments)
      .innerJoin(courses, eq(payments.courseId, courses.id))
      .where(and(...paidConds))
      .groupBy(courses.id, courses.title, courses.titleAr, courses.deliveryType)
      .orderBy(sql`SUM(${payments.amount}::numeric) DESC`);

    return rows.map((r) => {
      const gross = Number(r.gross);
      const refundsAmt = Number(r.refunds);
      return {
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        courseTitleAr: r.courseTitleAr,
        deliveryType: r.deliveryType || 'unknown',
        units: Number(r.units),
        gross,
        refunds: refundsAmt,
        net: gross - refundsAmt,
      };
    });
  }

  /** 5. Webinar Sales — per-session paid registrations + revenue. */
  async getReportWebinarSales(opts: {
    startDate?: string;
    endDate?: string;
    courseId?: string;
    sessionId?: string;
  }) {
    const { startDate, endDate, courseId, sessionId } = opts;
    const conds: any[] = [];
    if (startDate) conds.push(gte(sessions.scheduledAt, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conds.push(lte(sessions.scheduledAt, end));
    }
    if (courseId) conds.push(eq(sessions.courseId, courseId));
    if (sessionId) conds.push(eq(sessions.id, sessionId));

    const rows = await db
      .select({
        sessionId: sessions.id,
        sessionTitle: sessions.title,
        scheduledAt: sessions.scheduledAt,
        courseId: courses.id,
        courseTitle: courses.title,
        totalRegistrations: sql<number>`(SELECT COUNT(*) FROM webinar_registrations WHERE session_id = ${sessions.id})::int`,
        paidRegistrations: sql<number>`(SELECT COUNT(*) FROM webinar_registrations wr LEFT JOIN payments p ON p.user_id = wr.user_id AND p.course_id = ${courses.id} AND p.status = 'paid' WHERE wr.session_id = ${sessions.id} AND p.id IS NOT NULL)::int`,
        revenue: sql<string>`COALESCE((SELECT SUM(p.amount::numeric) FROM webinar_registrations wr INNER JOIN payments p ON p.user_id = wr.user_id AND p.course_id = ${courses.id} AND p.status = 'paid' WHERE wr.session_id = ${sessions.id}), 0)`,
      })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(sessions.scheduledAt))
      .limit(500);

    return rows.map((r) => ({
      ...r,
      totalRegistrations: Number(r.totalRegistrations),
      paidRegistrations: Number(r.paidRegistrations),
      revenue: Number(r.revenue),
    }));
  }

  /** 6. Student Purchases — lifetime spend leaderboard. */
  async getReportStudentPurchases(opts: {
    startDate?: string;
    endDate?: string;
    search?: string;
    top?: number;
  }) {
    const { startDate, endDate, search, top = 100 } = opts;
    const conds: any[] = [eq(payments.status, 'paid' as any)];
    if (startDate) conds.push(gte(payments.paidAt, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conds.push(lte(payments.paidAt, end));
    }
    if (search) {
      const q = `%${search}%`;
      conds.push(
        or(
          ilike(users.email, q),
          ilike(users.firstName, q),
          ilike(users.lastName, q),
        ),
      );
    }

    const rows = await db
      .select({
        userId: users.id,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        userEmail: users.email,
        paymentCount: sql<number>`COUNT(*)::int`,
        totalPaid: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
        totalRefunded: sql<string>`COALESCE((SELECT SUM(refund_amount::numeric) FROM refunds WHERE requested_by = ${users.id} AND status = 'completed'), 0)`,
        courseCount: sql<number>`COUNT(DISTINCT ${payments.courseId})::int`,
        lastPurchaseAt: sql<Date>`MAX(${payments.paidAt})`,
      })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .where(and(...conds))
      .groupBy(users.id, users.firstName, users.lastName, users.email)
      .orderBy(sql`SUM(${payments.amount}::numeric) DESC`)
      .limit(Math.min(top, 500));

    return rows.map((r) => {
      const totalPaid = Number(r.totalPaid);
      const totalRefunded = Number(r.totalRefunded);
      return {
        userId: r.userId,
        userName: r.userName,
        userEmail: r.userEmail,
        paymentCount: Number(r.paymentCount),
        courseCount: Number(r.courseCount),
        totalPaid,
        totalRefunded,
        netSpend: totalPaid - totalRefunded,
        lastPurchaseAt: r.lastPurchaseAt,
      };
    });
  }

  /** 7. Finance Activity — audit log filtered to finance-side entities. */
  async getReportFinanceActivity(opts: {
    startDate?: string;
    endDate?: string;
    actorId?: string;
    entityType?: string;
    action?: string;
  }) {
    const { startDate, endDate, actorId, entityType, action } = opts;
    // Finance-relevant entity types only — keeps the report focused even
    // though the underlying table holds platform-wide audit events.
    const FINANCE_ENTITIES = [
      'payment', 'refund', 'invoice', 'discount', 'coupon_campaign',
      'bank_transfer', 'reconciliation', 'discount_code', 'discount_batch',
    ];
    const conds: any[] = [
      entityType && entityType !== 'all'
        ? eq(auditLogs.entityType, entityType)
        : inArray(auditLogs.entityType, FINANCE_ENTITIES),
    ];
    if (startDate) conds.push(gte(auditLogs.createdAt, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conds.push(lte(auditLogs.createdAt, end));
    }
    if (actorId) conds.push(eq(auditLogs.performedBy, actorId));
    if (action && action !== 'all') conds.push(eq(auditLogs.action, action));

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        actorName: sql<string>`CASE WHEN ${users.id} IS NULL THEN NULL ELSE CONCAT(${users.firstName}, ' ', ${users.lastName}) END`,
        actorEmail: users.email,
        createdAt: auditLogs.createdAt,
        ipAddress: auditLogs.ipAddress,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(and(...conds))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1000);

    return rows;
  }

  /** 8. VAT/Tax — ZATCA-style summary: monthly totals over the period. */
  async getReportVat(opts: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = opts;
    const conds: any[] = [
      // Only count issued invoices that map to PAID payments — drafts and
      // failed-payment invoices aren't reportable to ZATCA.
      sql`${invoices.status} IN ('issued','paid','partially_refunded','refunded')`,
    ];
    if (startDate) conds.push(gte(invoices.issuedAt, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conds.push(lte(invoices.issuedAt, end));
    }

    const [byMonth, totalsRow] = await Promise.all([
      db
        .select({
          month: sql<string>`TO_CHAR(${invoices.issuedAt}, 'YYYY-MM')`,
          invoiceCount: sql<number>`COUNT(*)::int`,
          taxableBase: sql<string>`COALESCE(SUM(${invoices.subtotal}::numeric), 0)`,
          vatAmount: sql<string>`COALESCE(SUM(${invoices.taxAmount}::numeric), 0)`,
          total: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)`,
        })
        .from(invoices)
        .where(and(...conds))
        .groupBy(sql`TO_CHAR(${invoices.issuedAt}, 'YYYY-MM')`)
        .orderBy(asc(sql`TO_CHAR(${invoices.issuedAt}, 'YYYY-MM')`)),
      db
        .select({
          invoiceCount: sql<number>`COUNT(*)::int`,
          taxableBase: sql<string>`COALESCE(SUM(${invoices.subtotal}::numeric), 0)`,
          vatAmount: sql<string>`COALESCE(SUM(${invoices.taxAmount}::numeric), 0)`,
          total: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)`,
        })
        .from(invoices)
        .where(and(...conds)),
    ]);

    return {
      totals: {
        invoiceCount: Number(totalsRow[0]?.invoiceCount || 0),
        taxableBase: Number(totalsRow[0]?.taxableBase || 0),
        vatAmount: Number(totalsRow[0]?.vatAmount || 0),
        total: Number(totalsRow[0]?.total || 0),
      },
      byMonth: byMonth.map((r) => ({
        month: r.month,
        invoiceCount: Number(r.invoiceCount),
        taxableBase: Number(r.taxableBase),
        vatAmount: Number(r.vatAmount),
        total: Number(r.total),
      })),
    };
  }

  async getRevenueBySource(startDate?: string, endDate?: string) {
    // Filter on paidAt so paid bank transfers (which can have a much earlier
    // createdAt) land in the correct revenue window.
    const dateConditions = this.buildPaidAtConditions(startDate, endDate);
    const conditions = [eq(payments.status, 'paid' as any), ...dateConditions];

    // Activity counts per gateway (any status, window on createdAt) so the
    // 'volume' view can show all transactions even when revenue is zero.
    const activityConditions = this.buildDateConditions(startDate, endDate);

    const [paidResults, activityResults] = await Promise.all([
      db
        .select({
          gateway: payments.gateway,
          totalRevenue: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
          paidCount: sql<number>`COUNT(*)`,
        })
        .from(payments)
        .where(and(...conditions))
        .groupBy(payments.gateway),
      db
        .select({
          gateway: payments.gateway,
          totalCount: sql<number>`COUNT(*)`,
        })
        .from(payments)
        .where(activityConditions.length ? and(...activityConditions) : undefined)
        .groupBy(payments.gateway),
    ]);

    const activityMap = new Map<string, number>();
    for (const r of activityResults) activityMap.set(r.gateway, Number(r.totalCount));

    const allGateways = new Set<string>([
      ...paidResults.map((r) => r.gateway),
      ...activityResults.map((r) => r.gateway),
    ]);

    return Array.from(allGateways).map((gateway) => {
      const paid = paidResults.find((r) => r.gateway === gateway);
      return {
        gateway,
        totalRevenue: Number(paid?.totalRevenue || 0),
        count: Number(paid?.paidCount || 0),
        totalCount: activityMap.get(gateway) || 0,
      };
    });
  }

  async getRevenueTrend(
    period: 'day' | 'week' | 'month' = 'day',
    startDate?: string,
    endDate?: string,
  ): Promise<{ period: string; revenue: number; count: number }[]> {
    const safePeriod = ['day', 'week', 'month'].includes(period) ? period : 'day';
    // Drizzle creates a fresh parameter slot for each `${safePeriod}`
    // interpolation ($1, $5, $6 ...), and Postgres treats those as distinct
    // expressions — so date_trunc($1, paid_at) in SELECT does NOT match
    // date_trunc($5, paid_at) in GROUP BY. Raw SQL with a subquery alias
    // computes the bucket once and lets GROUP BY/ORDER BY reuse the alias.
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    const truncUnit = sql.raw(`'${safePeriod}'`); // safePeriod is validated above

    try {
      const result = await db.execute<{
        period: string;
        revenue: string;
        count: number;
      }>(sql`
        SELECT
          bucket::text AS period,
          COALESCE(SUM(amount), 0)::text AS revenue,
          COUNT(*)::int AS count
        FROM (
          SELECT
            date_trunc(${truncUnit}, paid_at) AS bucket,
            amount::numeric AS amount
          FROM payments
          WHERE status = 'paid'
            AND paid_at >= ${start}
            AND paid_at <= ${end}
        ) sub
        GROUP BY bucket
        ORDER BY bucket
      `);

      const rows = (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
      return (rows as { period: string; revenue: string; count: number }[]).map((r) => ({
        period: r.period,
        revenue: Number(r.revenue),
        count: Number(r.count),
      }));
    } catch (err) {
      this.logger.error(
        `getRevenueTrend failed (period=${safePeriod}, start=${startDate}, end=${endDate}): ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  async getTopCourses(
    limit: number = 5,
    startDate?: string,
    endDate?: string,
  ): Promise<{ courseId: string; title: string; titleAr: string | null; revenue: number; count: number }[]> {
    // Anchor on paidAt — top courses by realised revenue in the window.
    const conditions: any[] = [
      eq(payments.status, 'paid' as any),
      ...this.buildPaidAtConditions(startDate, endDate),
    ];

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
    const dateConditions = this.buildPaidAtConditions(startDate, endDate);
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
    if (startDate) conditions.push(gte(invoices.issuedAt, parseStartDate(startDate)!));
    if (endDate) conditions.push(lte(invoices.issuedAt, parseEndDate(endDate)!));
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

  /**
   * Bank-transfer receipt review aging — the only true "waiting on us"
   * receivable in this product. Counts active receipts (latest in their
   * re-upload chain, scan-clean, review still pending) bucketed by how
   * long they've been sitting in the queue. Surfaces on the Invoices
   * page replacing the empty invoice-aging bucket set. amounts read from
   * the underlying payment row.
   */
  async getBankTransferReviewAging() {
    const now = new Date();
    const h6 = new Date(now.getTime() - 6 * 3600_000);
    const h24 = new Date(now.getTime() - 24 * 3600_000);
    const h48 = new Date(now.getTime() - 48 * 3600_000);

    // Active receipts: latest in chain (replacedById IS NULL), scan clean,
    // review still pending. createdAt is the upload moment which is what
    // finance is "waiting on" — same as the dashboard's queue UI.
    const cleanPending = sql`
      ${paymentReceipts.replacedById} IS NULL
      AND ${paymentReceipts.scanStatus} = 'clean'
      AND ${paymentReceipts.reviewStatus} = 'pending'
    `;

    const [result] = await db
      .select({
        underSix: sql<number>`COUNT(CASE WHEN ${cleanPending} AND ${paymentReceipts.createdAt} >= ${h6} THEN 1 END)::int`,
        underSixAmount: sql<string>`COALESCE(SUM(CASE WHEN ${cleanPending} AND ${paymentReceipts.createdAt} >= ${h6} THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        sixToDay: sql<number>`COUNT(CASE WHEN ${cleanPending} AND ${paymentReceipts.createdAt} < ${h6} AND ${paymentReceipts.createdAt} >= ${h24} THEN 1 END)::int`,
        sixToDayAmount: sql<string>`COALESCE(SUM(CASE WHEN ${cleanPending} AND ${paymentReceipts.createdAt} < ${h6} AND ${paymentReceipts.createdAt} >= ${h24} THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        dayToTwo: sql<number>`COUNT(CASE WHEN ${cleanPending} AND ${paymentReceipts.createdAt} < ${h24} AND ${paymentReceipts.createdAt} >= ${h48} THEN 1 END)::int`,
        dayToTwoAmount: sql<string>`COALESCE(SUM(CASE WHEN ${cleanPending} AND ${paymentReceipts.createdAt} < ${h24} AND ${paymentReceipts.createdAt} >= ${h48} THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        beyondTwo: sql<number>`COUNT(CASE WHEN ${cleanPending} AND ${paymentReceipts.createdAt} < ${h48} THEN 1 END)::int`,
        beyondTwoAmount: sql<string>`COALESCE(SUM(CASE WHEN ${cleanPending} AND ${paymentReceipts.createdAt} < ${h48} THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        scanQueue: sql<number>`COUNT(CASE WHEN ${paymentReceipts.replacedById} IS NULL AND ${paymentReceipts.scanStatus} = 'pending' THEN 1 END)::int`,
        scanQueueAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentReceipts.replacedById} IS NULL AND ${paymentReceipts.scanStatus} = 'pending' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(paymentReceipts)
      .leftJoin(payments, eq(payments.id, paymentReceipts.paymentId));

    return {
      asOf: now.toISOString(),
      underSix: { count: result?.underSix || 0, amount: Number(result?.underSixAmount || 0) },
      sixToDay: { count: result?.sixToDay || 0, amount: Number(result?.sixToDayAmount || 0) },
      dayToTwo: { count: result?.dayToTwo || 0, amount: Number(result?.dayToTwoAmount || 0) },
      beyondTwo: { count: result?.beyondTwo || 0, amount: Number(result?.beyondTwoAmount || 0) },
      scanQueue: { count: result?.scanQueue || 0, amount: Number(result?.scanQueueAmount || 0) },
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
      conditions.push(gte(payments.createdAt, parseStartDate(startDate)!));
    }
    if (endDate) {
      conditions.push(lte(payments.createdAt, parseEndDate(endDate)!));
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
    if (startDate) conditions.push(gte(payments.createdAt, parseStartDate(startDate)!));
    if (endDate) conditions.push(lte(payments.createdAt, parseEndDate(endDate)!));
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
    filters: Record<string, string | undefined> = {},
  ): Promise<Buffer | string> {
    // Fetch data based on report type
    const { title, headers, rows } = await this.getReportData(
      reportType,
      startDate,
      endDate,
      filters,
    );

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
    filters: Record<string, string | undefined> = {},
  ): Promise<{ title: string; headers: string[]; rows: (string | number | null)[][] }> {
    switch (reportType) {
      // ── 8 spec-defined reports ────────────────────────────────
      case 'revenue': {
        const data = await this.getReportRevenue({ startDate, endDate, gateway: filters.gateway });
        const rows: (string | number | null)[][] = [
          ['— TOTALS —', '', '', '', ''],
          ['Gross', data.totals.count, data.totals.gross, '', ''],
          ['Refunds', '', data.totals.refunds, '', ''],
          ['Net', '', data.totals.net, '', ''],
          ['VAT collected', '', data.totals.vat, '', ''],
          ['', '', '', '', ''],
          ['— BY GATEWAY —', '', '', '', ''],
          ...data.byGateway.map((r) => ['Gateway', r.gateway, r.count, r.gross, '']),
          ['', '', '', '', ''],
          ['— BY METHOD —', '', '', '', ''],
          ...data.byMethod.map((r) => ['Method', r.method, r.count, r.gross, '']),
        ];
        return {
          title: 'Revenue Report',
          headers: ['Type', 'Bucket', 'Count', 'Amount (SAR)', ''],
          rows,
        };
      }
      case 'refunds': {
        const data = await this.getReportRefunds({
          startDate, endDate,
          status: filters.status, gateway: filters.gateway, reason: filters.reason,
        });
        return {
          title: 'Refund Report',
          headers: ['RefundID', 'Requester', 'Email', 'Course', 'Gateway', 'Reason', 'Amount (SAR)', 'Fee Borne', 'Status', 'Agent', 'Created', 'Completed'],
          rows: data.map((r) => [
            r.id,
            r.requesterName || '',
            r.requesterEmail || '',
            r.courseTitle || '',
            r.gateway || '',
            r.reason || '',
            r.refundAmount,
            r.deductionAmount,
            r.status,
            r.processedByName || '',
            r.createdAt ? new Date(r.createdAt).toISOString() : '',
            r.completedAt ? new Date(r.completedAt).toISOString() : '',
          ]),
        };
      }
      case 'payments': {
        const data = await this.getReportPayments({
          startDate, endDate,
          gateway: filters.gateway, status: filters.status, method: filters.method,
        });
        return {
          title: 'Payment Report',
          headers: ['PaymentID', 'Buyer', 'Email', 'Course', 'Gateway', 'Method', 'Amount (SAR)', 'Status', 'Gateway Ref', 'Created', 'Paid'],
          rows: data.map((r) => [
            r.id,
            r.userName || '',
            r.userEmail || '',
            r.courseTitle || '',
            r.gateway,
            r.paymentMethod,
            r.amount,
            r.status,
            r.gatewayChargeId || '',
            r.createdAt ? new Date(r.createdAt).toISOString() : '',
            r.paidAt ? new Date(r.paidAt).toISOString() : '',
          ]),
        };
      }
      case 'courseSales': {
        const data = await this.getReportCourseSales({
          startDate, endDate,
          courseId: filters.courseId, deliveryType: filters.deliveryType,
        });
        return {
          title: 'Course Sales Report',
          headers: ['Course', 'Delivery', 'Units Sold', 'Gross (SAR)', 'Refunds (SAR)', 'Net (SAR)'],
          rows: data.map((r) => [
            r.courseTitle,
            r.deliveryType,
            r.units,
            r.gross,
            r.refunds,
            r.net,
          ]),
        };
      }
      case 'webinarSales': {
        const data = await this.getReportWebinarSales({
          startDate, endDate,
          courseId: filters.courseId, sessionId: filters.sessionId,
        });
        return {
          title: 'Webinar Sales Report',
          headers: ['Course', 'Session', 'Scheduled', 'Total Registrants', 'Paid Registrants', 'Revenue (SAR)'],
          rows: data.map((r) => [
            r.courseTitle || '',
            r.sessionTitle || '',
            r.scheduledAt ? new Date(r.scheduledAt).toISOString() : '',
            r.totalRegistrations,
            r.paidRegistrations,
            r.revenue,
          ]),
        };
      }
      case 'studentPurchases': {
        const data = await this.getReportStudentPurchases({
          startDate, endDate,
          search: filters.search, top: filters.top ? Number(filters.top) : undefined,
        });
        return {
          title: 'Student Purchase Report',
          headers: ['Student', 'Email', 'Payments', 'Courses', 'Total Paid (SAR)', 'Refunded (SAR)', 'Net (SAR)', 'Last Purchase'],
          rows: data.map((r) => [
            r.userName,
            r.userEmail,
            r.paymentCount,
            r.courseCount,
            r.totalPaid,
            r.totalRefunded,
            r.netSpend,
            r.lastPurchaseAt ? new Date(r.lastPurchaseAt).toISOString() : '',
          ]),
        };
      }
      case 'financeActivity': {
        const data = await this.getReportFinanceActivity({
          startDate, endDate,
          actorId: filters.actorId, entityType: filters.entityType, action: filters.action,
        });
        return {
          title: 'Finance Activity Report',
          headers: ['When', 'Actor', 'Email', 'Action', 'Entity', 'Entity ID', 'IP'],
          rows: data.map((r) => [
            r.createdAt ? new Date(r.createdAt).toISOString() : '',
            r.actorName || '',
            r.actorEmail || '',
            r.action,
            r.entityType,
            r.entityId,
            r.ipAddress || '',
          ]),
        };
      }
      case 'vat': {
        const data = await this.getReportVat({ startDate, endDate });
        const rows: (string | number | null)[][] = [
          ['— TOTALS —', '', '', '', ''],
          ['All months', data.totals.invoiceCount, data.totals.taxableBase, data.totals.vatAmount, data.totals.total],
          ['', '', '', '', ''],
          ['— BY MONTH —', '', '', '', ''],
          ...data.byMonth.map((m) => [m.month, m.invoiceCount, m.taxableBase, m.vatAmount, m.total]),
        ];
        return {
          title: 'VAT / Tax Report (ZATCA summary)',
          headers: ['Period', 'Invoices', 'Taxable Base (SAR)', 'VAT 15% (SAR)', 'Total (SAR)'],
          rows,
        };
      }

      // ── Legacy analytics reports (kept for Overview widgets) ──
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
    rows: (string | number | null)[][],
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
    rows: (string | number | null)[][],
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

  /**
   * Per-report PDF layout: which columns to keep (by index into the full
   * headers/rows array) and how wide each kept column should be.
   *
   * Widths must sum to 760 (landscape-A4 content width with 40px side
   * margins). CSV/XLSX exports always include every column — these layouts
   * only trim what would be unreadable on a printed page (UUIDs, duplicate
   * timestamps, secondary metadata).
   *
   * Reports not listed here fall back to even-split across all columns.
   */
  private readonly PDF_LAYOUTS: Record<string, { keep: number[]; widths: number[] }> = {
    // headers: Type, Bucket, Count, Amount, '' — drop the trailing spacer
    revenue: { keep: [0, 1, 2, 3], widths: [120, 280, 140, 220] },

    // headers: RefundID, Requester, Email, Course, Gateway, Reason,
    //          Amount, FeeBorne, Status, Agent, Created, Completed
    // print-essentials: Requester, Course, Gateway, Reason, Amount, Status, Agent, Created
    refunds: { keep: [1, 3, 4, 5, 6, 8, 9, 10], widths: [110, 150, 70, 90, 80, 80, 100, 80] },

    // headers: PaymentID, Buyer, Email, Course, Gateway, Method, Amount,
    //          Status, GatewayRef, Created, Paid
    // print-essentials: Buyer, Course, Gateway, Method, Amount, Status, Paid
    payments: { keep: [1, 3, 4, 5, 6, 7, 10], widths: [130, 180, 70, 70, 90, 90, 130] },

    // headers: Course, Delivery, Units Sold, Gross, Refunds, Net
    courseSales: { keep: [0, 1, 2, 3, 4, 5], widths: [240, 80, 90, 110, 110, 130] },

    // headers: Course, Session, Scheduled, Total Reg, Paid Reg, Revenue
    webinarSales: { keep: [0, 1, 2, 3, 4, 5], widths: [160, 160, 130, 100, 100, 110] },

    // headers: Student, Email, Payments, Courses, Total Paid, Refunded, Net, Last Purchase
    studentPurchases: { keep: [0, 2, 3, 4, 5, 6, 7], widths: [150, 80, 80, 110, 110, 110, 120] },

    // headers: When, Actor, Email, Action, Entity, EntityID, IP
    financeActivity: { keep: [0, 1, 3, 4, 6], widths: [140, 150, 200, 140, 130] },

    // headers: Period, Invoices, Taxable Base, VAT 15%, Total
    vat: { keep: [0, 1, 2, 3, 4], widths: [110, 110, 180, 160, 200] },

    // headers: Detected, Drift, Gateway, Customer, Course, ChargeID, Status, Note
    // (used by ReconciliationService.exportFindings — defined here so the
    //  PDF style/layout stays consistent across the whole finance section).
    reconciliationFindings: { keep: [0, 1, 2, 3, 4, 6, 7], widths: [110, 100, 70, 130, 160, 80, 110] },
  };

  // ── Public export builders (used by ReconciliationService too) ───
  // Visibility deliberately public: ReconciliationService injects this
  // service to reuse the same CSV/XLSX/PDF styling for its own findings
  // export. Inlining the renderers there would duplicate ~150 lines of
  // PDFKit layout code.

  buildCsv(
    title: string,
    headers: string[],
    rows: (string | number | null)[][],
    reportType: string,
    startDate?: string,
    endDate?: string,
    userId?: string,
  ): string {
    return this.buildCsvExport(title, headers, rows, reportType, startDate, endDate, userId);
  }

  buildXlsx(
    title: string,
    headers: string[],
    rows: (string | number | null)[][],
    reportType: string,
    startDate?: string,
    endDate?: string,
    userId?: string,
  ): Promise<Buffer> {
    return this.buildExcelExport(title, headers, rows, reportType, startDate, endDate, userId);
  }

  buildPdf(
    title: string,
    headers: string[],
    rows: (string | number | null)[][],
    reportType: string,
    startDate?: string,
    endDate?: string,
    userId?: string,
  ): Promise<Buffer> {
    return this.buildPdfExport(title, headers, rows, reportType, startDate, endDate, userId);
  }

  private buildPdfExport(
    title: string,
    headers: string[],
    rows: (string | number | null)[][],
    reportType: string,
    startDate?: string,
    endDate?: string,
    userId?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // ── Layout: drop noise columns + give the rest proportional widths.
        // Falls back to even-split for any report not yet in the map.
        const layout = this.PDF_LAYOUTS[reportType];
        const keep = layout ? layout.keep : headers.map((_, i) => i);
        const colHeaders = keep.map((i) => headers[i]);
        const colRows = rows.map((r) => keep.map((i) => r[i]));
        const colWidths = layout
          ? layout.widths
          : keep.map(() => Math.floor(760 / keep.length));

        // Right-align numeric columns. Detected from the first non-null value
        // in each column — works for both the 8 spec reports (where most
        // numeric cols are derived from amounts/counts) and the legacy ones.
        const colAlignments = colHeaders.map((_, i) => {
          for (const r of colRows) {
            if (r[i] != null) return typeof r[i] === 'number' ? 'right' : 'left';
          }
          return 'left';
        });

        // Column x-offsets (absolute, in PDF points)
        const colX: number[] = [];
        let xCursor = 40;
        for (const w of colWidths) {
          colX.push(xCursor);
          xCursor += w;
        }

        const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── Branding / report header ────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(16)
          .text(`PhysioGuidance — ${title}`, 40, 40);
        doc.font('Helvetica').fontSize(8).fillColor('#666666')
          .text('Gamma Developers  |  PhysioGuidance Platform', 40, 58);
        doc.fillColor('#000000').fontSize(9)
          .text(
            `Generated: ${new Date().toISOString()}  |  Generated by: ${userId || 'system'}  |  NELC Audit Evidence`,
            40, 70,
          );
        if (startDate || endDate) {
          doc.text(`Date Range: ${startDate || 'beginning'} → ${endDate || 'now'}`, 40, 82);
        }
        doc.moveTo(40, 96).lineTo(800, 96).stroke('#CCCCCC');

        // ── Table header (light-fill band) ─────────────────────────
        const drawHeader = (y: number) => {
          doc.rect(40, y - 3, 760, 18).fill('#F3F4F6');
          doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);
          colHeaders.forEach((h, i) => {
            doc.text(String(h), colX[i] + 4, y + 1, {
              width: colWidths[i] - 8,
              align: colAlignments[i] as 'left' | 'right',
            });
          });
          doc.fillColor('#000000');
          return y + 18;
        };

        let y = 108;
        y = drawHeader(y);

        // ── Data rows (alternating stripe, right-aligned numerics) ──
        doc.font('Helvetica').fontSize(7.5);
        const truncate = (s: string | number | null | undefined, len: number) => {
          const str = String(s ?? '—');
          return str.length > len ? str.substring(0, len - 1) + '…' : str;
        };
        // Char budget per column ≈ width / 4.2 at 7.5pt; pad a little so
        // descenders don't get clipped.
        const charBudget = colWidths.map((w) => Math.max(8, Math.floor((w - 8) / 4.2)));

        const ROW_HEIGHT = 16;
        for (let ri = 0; ri < colRows.length; ri++) {
          if (y > 530) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
            y = drawHeader(40);
            doc.font('Helvetica').fontSize(7.5);
          }

          // Subtle zebra striping
          if (ri % 2 === 1) {
            doc.rect(40, y - 2, 760, ROW_HEIGHT).fill('#FAFAFA');
            doc.fillColor('#000000');
          }

          colRows[ri].forEach((cell, i) => {
            const val =
              typeof cell === 'number'
                ? cell.toLocaleString('en-US', {
                    minimumFractionDigits: Number.isInteger(cell) ? 0 : 2,
                    maximumFractionDigits: 2,
                  })
                : truncate(cell, charBudget[i]);
            doc.text(val, colX[i] + 4, y + 2, {
              width: colWidths[i] - 8,
              align: colAlignments[i] as 'left' | 'right',
            });
          });
          y += ROW_HEIGHT;
        }

        // ── Footer summary ─────────────────────────────────────────
        doc.moveTo(40, y + 4).lineTo(800, y + 4).stroke('#CCCCCC');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151')
          .text(`Total rows: ${rows.length}`, 40, y + 10);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
