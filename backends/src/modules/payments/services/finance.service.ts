import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { db } from '../../../database';
import { payments, invoices, refunds } from '../../../database/schema';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  async getSummary() {
    const [stats] = await db
      .select({
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        totalPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)`,
        totalRefunds: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        pendingPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'pending' THEN 1 END)`,
        pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'pending' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        failedPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'failed' THEN 1 END)`,
      })
      .from(payments);

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

  async getRevenueBySource() {
    const results = await db
      .select({
        gateway: payments.gateway,
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        count: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)`,
      })
      .from(payments)
      .groupBy(payments.gateway);

    return results.map((r) => ({
      gateway: r.gateway,
      totalRevenue: Number(r.totalRevenue),
      count: Number(r.count),
    }));
  }

  async getPaymentStatus() {
    const results = await db
      .select({
        status: payments.status,
        count: sql<number>`COUNT(*)`,
        totalAmount: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
      })
      .from(payments)
      .groupBy(payments.status);

    return results.map((r) => ({
      status: r.status,
      count: Number(r.count),
      totalAmount: Number(r.totalAmount),
    }));
  }

  async getRefundRate() {
    const [stats] = await db
      .select({
        totalPaid: sql<number>`COUNT(CASE WHEN ${payments.status} = 'paid' THEN 1 END)`,
        totalRefunded: sql<number>`COUNT(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN 1 END)`,
        refundedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('refunded', 'partially_refunded') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        paidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'paid' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(payments);

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
}
