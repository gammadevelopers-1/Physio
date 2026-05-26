import { Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, gte, isNotNull, lt, notLike, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  users,
  courses,
  enrollments,
  payments,
  auditLogs,
  certificateRequests,
  roles,
  userRoles,
  roleRequests,
  pointTransactions,
} from '../../database/schema';
import { NelcComplianceService } from '../nelc-compliance/nelc-compliance.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

interface KpiBlock {
  activeUsers: number;
  activeUsersTrend: number; // % change vs prior 30 days
  totalUsers: number;
  totalUsersNew: number; // new last 7 days
  revenueMTD: number; // SAR completed this month
  revenueTrend: number; // % vs prior month at same day
  certificatesIssued: number; // approved this month
  certificatesPeriod: 'thisMonth';
  /** Open trainer / role applications awaiting an admin decision. */
  pendingApplications: number;
}

interface PointHistoryRow {
  id: string;
  userId: string;
  userName: string;
  delta: number;
  reason: string;
  awardedAt: string; // ISO
}

interface AnalyticsBlock {
  visitorToSignup: number | null; // we don't track visitors yet
  signupToEnroll: number;
  enrollToPaid: number;
  completionRate: number;
}

interface SecurityBlock {
  failedLogins: number; // last 24h
  ipsBlocked: number; // distinct IPs w/ ≥5 failures last 24h
  activeSessions: number; // logged in last 24h
  twoFaAdoption: number;
}

interface FinanceBlock {
  grossRevenue: number;
  netRevenue: number;
  gateways: Array<{ name: string; percentage: number }>;
  refundRate: number;
  chargebackRate: number; // always 0 for now (no chargeback column)
}

interface UserRow {
  id: string;
  name: string;
  initials: string;
  role: 'admin' | 'instructor' | 'student' | 'manager';
  status: 'active' | 'suspended' | 'pending';
}

interface ComplianceBlock {
  percentage: number;
  passed: number;
  review: number;
  failed: number;
  areas: Array<{ id: string; name: string; status: 'pass' | 'review' | 'fail' }>;
}

interface ActivityRow {
  id: string;
  type: 'user' | 'admin' | 'payment' | 'course' | 'certificate';
  user: string;
  action: string;
  time: string; // ISO — frontend formats relative
}

export interface AdminDashboardPayload {
  kpi: KpiBlock;
  analytics: AnalyticsBlock;
  security: SecurityBlock;
  finance: FinanceBlock;
  recentUsers: UserRow[];
  compliance: ComplianceBlock;
  recentActivity: ActivityRow[];
  recentPoints: PointHistoryRow[];
}

const DELETED_EMAIL_PREFIX = 'deleted-%@deleted.local';

const ZERO_KPI: KpiBlock = {
  activeUsers: 0,
  activeUsersTrend: 0,
  totalUsers: 0,
  totalUsersNew: 0,
  revenueMTD: 0,
  revenueTrend: 0,
  certificatesIssued: 0,
  certificatesPeriod: 'thisMonth',
  pendingApplications: 0,
};
const ZERO_ANALYTICS: AnalyticsBlock = {
  visitorToSignup: null,
  signupToEnroll: 0,
  enrollToPaid: 0,
  completionRate: 0,
};
const ZERO_SECURITY: SecurityBlock = {
  failedLogins: 0,
  ipsBlocked: 0,
  activeSessions: 0,
  twoFaAdoption: 0,
};
const ZERO_FINANCE: FinanceBlock = {
  grossRevenue: 0,
  netRevenue: 0,
  gateways: [],
  refundRate: 0,
  chargebackRate: 0,
};
const ZERO_COMPLIANCE: ComplianceBlock = {
  percentage: 0,
  passed: 0,
  review: 0,
  failed: 0,
  areas: [],
};

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(private readonly compliance: NelcComplianceService) {}

  /**
   * Run each builder with its own try/catch + zero fallback. A single
   * bad sub-query (missing column, unexpected null, transient failure)
   * used to take down the entire dashboard payload because Promise.all
   * rejects on the first failure. Now any failing block degrades to
   * zeros and the rest of the widgets still light up.
   */
  private async safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.logger.error(
        `dashboard.${label} failed — returning zero-fallback`,
        err instanceof Error ? err.stack : String(err),
      );
      return fallback;
    }
  }

  async getDashboard(user: AuthenticatedUser): Promise<AdminDashboardPayload> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonthSameDay = new Date(startOfPrevMonth);
    endOfPrevMonthSameDay.setDate(now.getDate());
    const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const day60Ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day1Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      kpi,
      analytics,
      security,
      finance,
      recentUsers,
      compliance,
      recentActivity,
    ] = await Promise.all([
      this.safe(
        'kpi',
        () =>
          this.buildKpi(
            now,
            startOfMonth,
            endOfPrevMonthSameDay,
            startOfPrevMonth,
            day30Ago,
            day60Ago,
            day7Ago,
          ),
        ZERO_KPI,
      ),
      this.safe('analytics', () => this.buildAnalytics(day30Ago), ZERO_ANALYTICS),
      this.safe('security', () => this.buildSecurity(day1Ago), ZERO_SECURITY),
      this.safe('finance', () => this.buildFinance(startOfMonth), ZERO_FINANCE),
      this.safe('recentUsers', () => this.buildRecentUsers(), []),
      this.safe('compliance', () => this.buildCompliance(user), ZERO_COMPLIANCE),
      this.safe('recentActivity', () => this.buildRecentActivity(), []),
    ]);

    const recentPoints = await this.safe(
      'recentPoints',
      () => this.buildRecentPoints(),
      [] as PointHistoryRow[],
    );

    return {
      kpi,
      analytics,
      security,
      finance,
      recentUsers,
      compliance,
      recentActivity,
      recentPoints,
    };
  }

  private async buildKpi(
    now: Date,
    startOfMonth: Date,
    endOfPrevMonthSameDay: Date,
    startOfPrevMonth: Date,
    day30Ago: Date,
    day60Ago: Date,
    day7Ago: Date,
  ): Promise<KpiBlock> {
    const [
      activeNow,
      activePrev,
      totalUsersRow,
      newUsersRow,
      revenueNowRow,
      revenuePrevRow,
      certIssuedRow,
      pendingAppsRow,
    ] = await Promise.all([
      db
        .select({ value: sql<number>`cast(count(distinct ${users.id}) as int)` })
        .from(users)
        .where(and(isNotNull(users.lastLoginAt), gte(users.lastLoginAt, day30Ago))),
      db
        .select({ value: sql<number>`cast(count(distinct ${users.id}) as int)` })
        .from(users)
        .where(
          and(
            isNotNull(users.lastLoginAt),
            gte(users.lastLoginAt, day60Ago),
            lt(users.lastLoginAt, day30Ago),
          ),
        ),
      db
        .select({ value: count() })
        .from(users)
        .where(notLike(users.email, DELETED_EMAIL_PREFIX)),
      db
        .select({ value: count() })
        .from(users)
        .where(
          and(
            notLike(users.email, DELETED_EMAIL_PREFIX),
            gte(users.createdAt, day7Ago),
          ),
        ),
      db
        .select({
          value: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
        })
        .from(payments)
        .where(
          and(eq(payments.status, 'completed'), gte(payments.createdAt, startOfMonth)),
        ),
      db
        .select({
          value: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.status, 'completed'),
            gte(payments.createdAt, startOfPrevMonth),
            lt(payments.createdAt, endOfPrevMonthSameDay),
          ),
        ),
      db
        .select({ value: count() })
        .from(certificateRequests)
        .where(
          and(
            eq(certificateRequests.status, 'approved'),
            gte(certificateRequests.approvedAt, startOfMonth),
          ),
        ),
      // Pending instructor / role applications. The schema stores
      // status in UPPER_CASE (see ROLE_REQUEST_STATUS).
      db
        .select({ value: count() })
        .from(roleRequests)
        .where(eq(roleRequests.status, 'PENDING')),
    ]);

    const activeUsers = Number(activeNow[0].value);
    const activeUsersPrev = Number(activePrev[0].value);
    const activeUsersTrend = pctChange(activeUsers, activeUsersPrev);

    const revNow = Number(revenueNowRow[0].value);
    const revPrev = Number(revenuePrevRow[0].value);
    const revenueTrend = pctChange(revNow, revPrev);

    return {
      activeUsers,
      activeUsersTrend,
      totalUsers: Number(totalUsersRow[0].value),
      totalUsersNew: Number(newUsersRow[0].value),
      revenueMTD: revNow,
      revenueTrend,
      certificatesIssued: Number(certIssuedRow[0].value),
      certificatesPeriod: 'thisMonth',
      pendingApplications: Number(pendingAppsRow[0].value),
    };
  }

  private async buildAnalytics(day30Ago: Date): Promise<AnalyticsBlock> {
    // Recent signups (last 30d).
    const recentSignupsRow = await db
      .select({ value: count() })
      .from(users)
      .where(
        and(
          notLike(users.email, DELETED_EMAIL_PREFIX),
          gte(users.createdAt, day30Ago),
        ),
      );
    const recentSignups = Number(recentSignupsRow[0].value);

    // Of those, how many have at least one enrollment?
    const enrolledRow = await db
      .select({
        value: sql<number>`cast(count(distinct ${users.id}) as int)`,
      })
      .from(users)
      .innerJoin(enrollments, eq(enrollments.studentId, users.id))
      .where(
        and(
          notLike(users.email, DELETED_EMAIL_PREFIX),
          gte(users.createdAt, day30Ago),
        ),
      );
    const enrolledFromRecent = Number(enrolledRow[0].value);

    // Recent enrollments (last 30d).
    const recentEnrollmentsRow = await db
      .select({ value: count() })
      .from(enrollments)
      .where(gte(enrollments.enrolledAt, day30Ago));
    const recentEnrollments = Number(recentEnrollmentsRow[0].value);

    // Of those, how many have a completed payment?
    const paidRow = await db
      .select({
        value: sql<number>`cast(count(distinct ${enrollments.id}) as int)`,
      })
      .from(enrollments)
      .innerJoin(
        payments,
        and(eq(payments.enrollmentId, enrollments.id), eq(payments.status, 'completed')),
      )
      .where(gte(enrollments.enrolledAt, day30Ago));
    const paidFromRecent = Number(paidRow[0].value);

    // Completion rate — any-time, enrollments with status='completed' / total.
    const totalEnrollmentsRow = await db.select({ value: count() }).from(enrollments);
    const completedEnrollmentsRow = await db
      .select({ value: count() })
      .from(enrollments)
      .where(eq(enrollments.status, 'completed'));

    const totalEnrolled = Number(totalEnrollmentsRow[0].value);
    const totalCompleted = Number(completedEnrollmentsRow[0].value);

    return {
      visitorToSignup: null, // no visitor analytics integrated yet
      signupToEnroll: pct(enrolledFromRecent, recentSignups),
      enrollToPaid: pct(paidFromRecent, recentEnrollments),
      completionRate: pct(totalCompleted, totalEnrolled),
    };
  }

  private async buildSecurity(day1Ago: Date): Promise<SecurityBlock> {
    const [failedRow, ipsRow, activeRow, twoFaTotalRow, twoFaOnRow] = await Promise.all([
      db
        .select({ value: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, 'login_failed'),
            gte(auditLogs.createdAt, day1Ago),
          ),
        ),
      db.execute<{ value: number }>(sql`
        SELECT cast(count(*) as int) AS value
        FROM (
          SELECT ip_address
          FROM audit_logs
          WHERE action = 'login_failed'
            AND created_at >= ${day1Ago}
            AND ip_address IS NOT NULL
          GROUP BY ip_address
          HAVING count(*) >= 5
        ) t
      `),
      db
        .select({
          value: sql<number>`cast(count(distinct ${users.id}) as int)`,
        })
        .from(users)
        .where(
          and(isNotNull(users.lastLoginAt), gte(users.lastLoginAt, day1Ago)),
        ),
      db
        .select({ value: count() })
        .from(users)
        .where(notLike(users.email, DELETED_EMAIL_PREFIX)),
      db
        .select({ value: count() })
        .from(users)
        .where(
          and(
            notLike(users.email, DELETED_EMAIL_PREFIX),
            eq(users.twoFactorEnabled, true),
          ),
        ),
    ]);

    const total = Number(twoFaTotalRow[0].value);
    const on = Number(twoFaOnRow[0].value);

    const ipsBlocked = Array.isArray(ipsRow.rows) && ipsRow.rows.length > 0
      ? Number((ipsRow.rows[0] as { value: number }).value || 0)
      : 0;

    return {
      failedLogins: Number(failedRow[0].value),
      ipsBlocked,
      activeSessions: Number(activeRow[0].value),
      twoFaAdoption: pct(on, total),
    };
  }

  private async buildFinance(startOfMonth: Date): Promise<FinanceBlock> {
    const [grossRow, refundedRow, gatewaysRows, refundCountRow, totalCountRow] =
      await Promise.all([
        db
          .select({
            value: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
          })
          .from(payments)
          .where(
            and(
              eq(payments.status, 'completed'),
              gte(payments.createdAt, startOfMonth),
            ),
          ),
        db
          .select({
            value: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
          })
          .from(payments)
          .where(
            and(
              eq(payments.status, 'refunded'),
              gte(payments.createdAt, startOfMonth),
            ),
          ),
        db
          .select({
            provider: payments.provider,
            total: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
          })
          .from(payments)
          .where(
            and(
              eq(payments.status, 'completed'),
              gte(payments.createdAt, startOfMonth),
            ),
          )
          .groupBy(payments.provider),
        db
          .select({ value: count() })
          .from(payments)
          .where(
            and(
              eq(payments.status, 'refunded'),
              gte(payments.createdAt, startOfMonth),
            ),
          ),
        db
          .select({ value: count() })
          .from(payments)
          .where(gte(payments.createdAt, startOfMonth)),
      ]);

    const gross = Number(grossRow[0].value);
    const refunded = Number(refundedRow[0].value);
    const totalCount = Number(totalCountRow[0].value);
    const refundCount = Number(refundCountRow[0].value);

    const sumProvider = gatewaysRows.reduce((acc, r) => acc + Number(r.total), 0);
    const gateways = gatewaysRows
      .map((r) => ({
        name: formatProvider(r.provider),
        percentage: sumProvider > 0 ? Math.round((Number(r.total) / sumProvider) * 100) : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    return {
      grossRevenue: gross,
      netRevenue: gross - refunded,
      gateways,
      refundRate: pct(refundCount, totalCount),
      chargebackRate: 0, // no chargeback status in schema yet
    };
  }

  private async buildRecentUsers(): Promise<UserRow[]> {
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        activeRole: users.activeRole,
        isActive: users.isActive,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(notLike(users.email, DELETED_EMAIL_PREFIX))
      .orderBy(desc(users.createdAt))
      .limit(5);

    return rows.map((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;
      const initials = (
        (u.firstName?.[0] || '') + (u.lastName?.[0] || '')
      ).toUpperCase() || u.email.slice(0, 2).toUpperCase();
      const role = mapRole(u.activeRole);
      const status: UserRow['status'] = !u.isActive
        ? 'suspended'
        : u.isVerified
          ? 'active'
          : 'pending';
      return { id: u.id, name, initials, role, status };
    });
  }

  private async buildCompliance(user: AuthenticatedUser): Promise<ComplianceBlock> {
    try {
      const summary = await this.compliance.getComplianceSummary(user);
      const total = summary.passed + summary.review + summary.failed;
      const percentage = total > 0 ? Math.round((summary.passed / total) * 100) : 0;

      // Bucket into 4 area labels so the widget's bar reads naturally.
      // We don't have per-area scoring at the platform level yet, so
      // derive a coarse status from the overall summary.
      const overall: 'pass' | 'review' | 'fail' =
        percentage >= 90 ? 'pass' : percentage >= 70 ? 'review' : 'fail';

      return {
        percentage,
        passed: summary.passed,
        review: summary.review,
        failed: summary.failed,
        areas: [
          { id: 'accessibility', name: 'Accessibility', status: overall },
          { id: 'content', name: 'Content Standards', status: overall },
          { id: 'data', name: 'Data Protection', status: overall },
          { id: 'governance', name: 'Governance', status: overall },
        ],
      };
    } catch {
      return {
        percentage: 0,
        passed: 0,
        review: 0,
        failed: 0,
        areas: [],
      };
    }
  }

  /**
   * Last 8 point transactions joined to the recipient user. Surfaces
   * gamification activity in the admin dashboard so we can spot
   * who's earning what and whether the rules are firing as intended.
   */
  private async buildRecentPoints(): Promise<PointHistoryRow[]> {
    const rows = await db
      .select({
        id: pointTransactions.id,
        userId: pointTransactions.userId,
        delta: pointTransactions.delta,
        reason: pointTransactions.reason,
        createdAt: pointTransactions.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(pointTransactions)
      .innerJoin(users, eq(users.id, pointTransactions.userId))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(8);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName:
        [r.firstName, r.lastName].filter(Boolean).join(' ').trim() ||
        r.email ||
        'Unknown',
      delta: r.delta,
      reason: r.reason,
      awardedAt: r.createdAt.toISOString(),
    }));
  }

  private async buildRecentActivity(): Promise<ActivityRow[]> {
    const rows = await db
      .select({
        id: auditLogs.id,
        entityType: auditLogs.entityType,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.performedBy))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8);

    return rows.map((r) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.email || 'System';
      return {
        id: r.id,
        type: mapActivityType(r.entityType),
        user: name,
        action: humanizeAction(r.entityType, r.action),
        time: r.createdAt.toISOString(),
      };
    });
  }
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function pctChange(now: number, prev: number): number {
  if (prev === 0) return now > 0 ? 100 : 0;
  return Math.round(((now - prev) / prev) * 100);
}

function formatProvider(p: string): string {
  switch (p) {
    case 'stripe':
      return 'Stripe';
    case 'hyperpay':
      return 'HyperPay';
    case 'placeholder':
      return 'Placeholder';
    default:
      return p.charAt(0).toUpperCase() + p.slice(1);
  }
}

function mapRole(activeRole: string): UserRow['role'] {
  switch (activeRole) {
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return 'admin';
    case 'INSTRUCTOR':
    case 'TEACHING_ASSISTANT':
      return 'instructor';
    case 'MANAGER':
      return 'manager';
    default:
      return 'student';
  }
}

function mapActivityType(entityType: string): ActivityRow['type'] {
  const t = entityType.toLowerCase();
  if (t.includes('user') || t.includes('auth')) return 'user';
  if (t.includes('payment') || t.includes('refund')) return 'payment';
  if (t.includes('certificate')) return 'certificate';
  if (t.includes('course') || t.includes('module') || t.includes('material'))
    return 'course';
  return 'admin';
}

function humanizeAction(entityType: string, action: string): string {
  const a = action.replace(/_/g, ' ').toLowerCase();
  return `${a} ${entityType.replace(/_/g, ' ')}`.trim();
}
